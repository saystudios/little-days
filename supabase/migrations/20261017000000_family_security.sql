-- Little Days: family security update (run once in the Supabase SQL Editor,
-- after supabase/schema.sql). Safe to re-run. Keeps all existing families,
-- members and planner data.
--
-- What it changes:
--   * Invite codes expire after 14 days and any parent can replace (revoke) them.
--     Existing codes stay valid for 14 days from when this runs.
--   * Joining is rate limited: 5 wrong codes in 15 minutes locks that account
--     out of joining for 15 minutes. Families are capped at 8 parent accounts.
--   * Members get a role ('owner' for the creator, 'parent' for invitees) and
--     can see who else is in their family.
--   * Parents can leave a family and permanently delete their account
--     (required by Apple). A family with no members left is deleted.
--   * The server, not the device clock, stamps every planner save, and saves
--     must be a well-formed planner under 2 MB.
begin;

-- Roles and join time ------------------------------------------------------
alter table public.family_members add column if not exists role text not null default 'parent';
alter table public.family_members add column if not exists joined_at timestamptz not null default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'family_members_role_check') then
    alter table public.family_members add constraint family_members_role_check check (role in ('owner', 'parent'));
  end if;
end $$;
update public.family_members m set role = 'owner'
  from public.families f
 where f.id = m.family_id and f.created_by = m.user_id and m.role <> 'owner';

-- Invite expiry ------------------------------------------------------------
alter table public.families add column if not exists invite_expires_at timestamptz;
update public.families set invite_expires_at = now() + interval '14 days' where invite_expires_at is null;
alter table public.families alter column invite_expires_at set default now() + interval '14 days';
alter table public.families alter column invite_expires_at set not null;

-- Let a creator delete their account without deleting the shared family -----
alter table public.families alter column created_by drop not null;
do $$
declare c text;
begin
  select con.conname into c
    from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
   where con.conrelid = 'public.families'::regclass and con.contype = 'f' and a.attname = 'created_by';
  if c is not null then execute format('alter table public.families drop constraint %I', c); end if;
  alter table public.families add constraint families_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
end $$;

-- Server-side save time and planner shape -----------------------------------
create or replace function public.touch_family_planner()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end; $$;
drop trigger if exists family_planners_touch on public.family_planners;
create trigger family_planners_touch before insert or update on public.family_planners
  for each row execute function public.touch_family_planner();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'family_planners_content_shape') then
    -- coalesce: a CHECK that evaluates to NULL would otherwise pass.
    alter table public.family_planners add constraint family_planners_content_shape check (coalesce(
      jsonb_typeof(content) = 'object'
      and jsonb_typeof(content -> 'kids') = 'array'
      and jsonb_typeof(content -> 'events') = 'array'
      and jsonb_typeof(content -> 'tasks') = 'array'
      and octet_length(content::text) < 2000000, false));
  end if;
end $$;

-- Invite attempts (no client access; only the functions below use it) ------
create table if not exists public.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);
create index if not exists invite_attempts_user_time on public.invite_attempts (user_id, attempted_at desc);
alter table public.invite_attempts enable row level security;

-- Membership helper (security definer so policies don't recurse) -----------
create or replace function public.is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members where family_id = fid and user_id = auth.uid());
$$;

drop policy if exists "members see co-members" on public.family_members;
create policy "members see co-members" on public.family_members
  for select to authenticated using (public.is_family_member(family_id));

-- New invite code: 18 hex characters (72 random bits), same format as before.
create or replace function public.new_invite_code()
returns text language sql volatile set search_path = '' as $$
  select upper(substr(encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'), 1, 18));
$$;

-- Create a family (the creator becomes its owner) ---------------------------
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
  return query select f.id, f.invite_code;
end; $$;

-- Join with an invite code ---------------------------------------------------
-- Returns the family id, or NULL when the code is wrong or expired (so the
-- failed attempt is recorded and counts toward the rate limit).
create or replace function public.join_family(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  clean text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  f uuid;
  recent int;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select count(*) into recent from public.invite_attempts
   where user_id = uid and not succeeded and attempted_at > now() - interval '15 minutes';
  if recent >= 5 then
    raise exception 'Too many incorrect invite codes. Please wait 15 minutes and try again.';
  end if;
  select id into f from public.families
   where invite_code = clean and invite_expires_at > now();
  insert into public.invite_attempts (user_id, succeeded) values (uid, f is not null);
  if f is null then return null; end if;
  if exists (select 1 from public.family_members where family_id = f and user_id = uid) then return f; end if;
  if (select count(*) from public.family_members where family_id = f) >= 8 then
    raise exception 'This family already has the maximum of 8 parent accounts.';
  end if;
  insert into public.family_members (family_id, user_id, role) values (f, uid, 'parent');
  return f;
end; $$;

-- Replace the invite code (the old one stops working immediately) ----------
create or replace function public.regenerate_invite(fid uuid)
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_family_member(fid) then raise exception 'Not a member of this family'; end if;
  return query
    update public.families f
       set invite_code = public.new_invite_code(),
           invite_expires_at = now() + interval '14 days'
     where f.id = fid
    returning f.invite_code, f.invite_expires_at;
end; $$;

-- Who is in my family (emails are visible only to fellow members) ----------
create or replace function public.family_members_list(fid uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_family_member(fid) then raise exception 'Not a member of this family'; end if;
  return query
    select m.user_id, u.email::text, m.role, m.joined_at, m.user_id = auth.uid()
      from public.family_members m join auth.users u on u.id = m.user_id
     where m.family_id = fid
     order by m.joined_at;
end; $$;

-- Leave a family -------------------------------------------------------------
create or replace function public.leave_family(fid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); was_owner boolean;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  delete from public.family_members where family_id = fid and user_id = uid
  returning role = 'owner' into was_owner;
  if not found then return; end if;
  if not exists (select 1 from public.family_members where family_id = fid) then
    delete from public.families where id = fid;   -- cascades to the planner
  elsif was_owner then
    update public.family_members set role = 'owner'
     where (family_id, user_id) = (
       select family_id, user_id from public.family_members
        where family_id = fid order by joined_at, user_id limit 1);
  end if;
end; $$;

-- Permanently delete my account ---------------------------------------------
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); fid uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  for fid in select family_id from public.family_members where user_id = uid loop
    perform public.leave_family(fid);
  end loop;
  delete from auth.users where id = uid;
end; $$;

-- Permissions ----------------------------------------------------------------
revoke all on function public.is_family_member(uuid) from public;
revoke all on function public.new_invite_code() from public;
revoke all on function public.create_family(jsonb) from public;
revoke all on function public.join_family(text) from public;
revoke all on function public.regenerate_invite(uuid) from public;
revoke all on function public.family_members_list(uuid) from public;
revoke all on function public.leave_family(uuid) from public;
revoke all on function public.delete_account() from public;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.create_family(jsonb) to authenticated;
grant execute on function public.join_family(text) to authenticated;
grant execute on function public.regenerate_invite(uuid) to authenticated;
grant execute on function public.family_members_list(uuid) to authenticated;
grant execute on function public.leave_family(uuid) to authenticated;
grant execute on function public.delete_account() to authenticated;
revoke all on table public.invite_attempts from anon, authenticated;

-- Live updates: make sure planner changes are broadcast (no-op if already on).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_planners') then
    alter publication supabase_realtime add table public.family_planners;
  end if;
end $$;

commit;
