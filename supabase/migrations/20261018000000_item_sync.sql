-- Little Days: per-item family sync (run after 20261017000000_family_security.sql).
-- Safe to re-run. Keeps family_planners as a read-only backup.
--
-- What it changes:
--   * New table planner_items: one row per activity, to-do, child, chore,
--     routine, reward, reward request, shared list, list entry, chore/routine
--     tick, star bank and the settings record. Devices save and receive single items, so edits to
--     different things on different devices never overwrite each other.
--   * Deletions are kept as "deleted" rows so other devices learn about them.
--   * Saves go through save_items(), which checks membership, validates each
--     item, stamps the server time, and reports when another device changed the
--     same item first (the newest save wins).
--   * Every existing family's planner is copied into planner_items.
--   * family_planners stops accepting updates (old app versions then show a sync
--     error and reload into the new version instead of silently diverging).
--     Merge/deploy the matching app version BEFORE running this file.
begin;

create table if not exists public.planner_items (
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('kid','event','task','chore','routine','reward','redemption','list','listitem','log','bank','setting')),
  id text not null check (length(id) between 1 and 200),
  data jsonb check (data is null or octet_length(data::text) <= 100000),
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (family_id, kind, id)
);
create index if not exists planner_items_family_time on public.planner_items (family_id, updated_at);
alter table public.planner_items enable row level security;

drop policy if exists "members read items" on public.planner_items;
create policy "members read items" on public.planner_items
  for select to authenticated using (public.is_family_member(family_id));
-- No insert/update/delete policies: all writes go through save_items().
revoke insert, update, delete on public.planner_items from anon, authenticated;

create or replace function public.touch_planner_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end; $$;
drop trigger if exists planner_items_touch on public.planner_items;
create trigger planner_items_touch before insert or update on public.planner_items
  for each row execute function public.touch_planner_item();

-- Split a whole planner (the old single-document format) into items.
-- Mirrors flatten() in sync-core.js.
create or replace function public.planner_items_from_blob(p jsonb)
returns table (kind text, id text, data jsonb)
language sql immutable set search_path = '' as $$
  select l.kind, x.value ->> 'id', x.value
    from (values ('kid','kids'),('event','events'),('task','tasks'),('chore','chores'),
                 ('routine','routines'),('reward','rewards'),('redemption','redemptions'),
                 ('list','lists'),('listitem','listItems')) as l(kind, list)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(p -> l.list) = 'array' then p -> l.list else '[]'::jsonb end) as x(value)
   where jsonb_typeof(x.value) = 'object' and coalesce(x.value ->> 'id', '') <> ''
  union all
  select 'log', d.key || '|' || e.key, e.value
    from jsonb_each(case when jsonb_typeof(p -> 'log') = 'object' then p -> 'log' else '{}'::jsonb end) as d(key, value)
    cross join lateral jsonb_each(case when jsonb_typeof(d.value) = 'object' then d.value else '{}'::jsonb end) as e(key, value)
  union all
  select 'bank', b.key, jsonb_build_object('stars', coalesce((b.value #>> '{}')::numeric, 0))
    from jsonb_each(case when jsonb_typeof(p -> 'starBank') = 'object' then p -> 'starBank' else '{}'::jsonb end) as b(key, value)
  union all
  select 'setting', 'settings', p -> 'settings'
   where jsonb_typeof(p -> 'settings') = 'object' and p -> 'settings' <> '{}'::jsonb;
$$;

-- Copy a family's old planner into items, once (skipped if it already has items).
create or replace function public.import_planner_blob(fid uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0;
begin
  if exists (select 1 from public.planner_items where family_id = fid) then return 0; end if;
  insert into public.planner_items (family_id, kind, id, data)
  select fid, b.kind, b.id, b.data
    from public.family_planners fp, public.planner_items_from_blob(fp.content) b
   where fp.family_id = fid
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end; $$;

-- Save a batch of items. items: [{ kind, id, data, deleted, base }] where base is
-- the updated_at this device last saw for the item (null for new items).
-- Returns each item's new updated_at and whether someone else changed it first.
create or replace function public.save_items(fid uuid, items jsonb)
returns table (kind text, id text, updated_at timestamptz, conflict boolean)
language plpgsql security definer set search_path = '' as $$
declare
  it record;
  cur timestamptz;
  saved timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not public.is_family_member(fid) then raise exception 'Not a member of this family'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 500 then raise exception 'Send between 1 and 500 items at a time'; end if;
  for it in select * from jsonb_to_recordset(items) as x(kind text, id text, data jsonb, deleted boolean, base timestamptz) loop
    select p.updated_at into cur from public.planner_items p where p.family_id = fid and p.kind = it.kind and p.id = it.id;
    insert into public.planner_items as p (family_id, kind, id, data, deleted, updated_by)
    values (fid, it.kind, it.id, case when coalesce(it.deleted, false) then null else it.data end, coalesce(it.deleted, false), auth.uid())
    on conflict on constraint planner_items_pkey do update
      set data = excluded.data, deleted = excluded.deleted, updated_by = excluded.updated_by
    returning p.updated_at into saved;
    kind := it.kind; id := it.id; updated_at := saved;
    conflict := cur is not null and (it.base is null or cur > it.base);
    return next;
  end loop;
end; $$;

-- New families start with item rows as well as the backup document.
create or replace function public.create_family(initial_data jsonb default '{"kids":[],"events":[],"tasks":[]}'::jsonb)
returns table (id uuid, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare f public.families%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into public.families (created_by, invite_code) values (auth.uid(), public.new_invite_code()) returning * into f;
  insert into public.family_members (family_id, user_id, role) values (f.id, auth.uid(), 'owner');
  insert into public.family_planners (family_id, content)
    values (f.id, coalesce(initial_data, '{"kids":[],"events":[],"tasks":[]}'::jsonb));
  perform public.import_planner_blob(f.id);
  return query select f.id, f.invite_code;
end; $$;

-- Copy every existing family now.
do $$ declare r record; begin
  for r in select family_id from public.family_planners loop perform public.import_planner_blob(r.family_id); end loop;
end $$;

-- The old document becomes a read-only backup.
drop policy if exists "members update planner" on public.family_planners;

revoke all on function public.planner_items_from_blob(jsonb) from public;
revoke all on function public.import_planner_blob(uuid) from public;
revoke all on function public.save_items(uuid, jsonb) from public;
revoke all on function public.create_family(jsonb) from public;
grant execute on function public.save_items(uuid, jsonb) to authenticated;
grant execute on function public.create_family(jsonb) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'planner_items') then
    alter publication supabase_realtime add table public.planner_items;
  end if;
end $$;

commit;
