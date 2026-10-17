-- Per-item sync tests. Users: 1 owner, 2 stranger, 3 co-parent.
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null
create or replace function pg_temp.act(u text) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', u, false) $$;
select set_config('t.fam', id::text, false), set_config('t.code', invite_code, false)
  from public.families where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';

-- The legacy planner was copied into items ------------------------------------
do $$ begin
  assert (select count(*) from public.planner_items where family_id = current_setting('t.fam')::uuid) = 2, 'legacy kid + event copied';
  assert (select data ->> 'title' from public.planner_items where kind = 'event' and id = 'e1') = 'Piano', 'event content copied';
  assert (select count(*) from public.family_planners) = 1, 'backup document kept';
  raise notice 'ok: existing planner copied into items';
end $$;

-- Blob splitting matches sync-core.js flatten() --------------------------------
do $$ declare keys text; begin
  select string_agg(kind || ':' || id, ',' order by kind || ':' || id) into keys from public.planner_items_from_blob('{
    "kids":[{"id":"y"},{"id":"l"}], "events":[{"id":"e1"}], "tasks":[{"id":"t1"}],
    "chores":[{"id":"c1"}], "routines":[{"id":"r1"}], "rewards":[{"id":"w1"}], "redemptions":[{"id":"q1"}],
    "lists":[{"id":"g"}], "listItems":[{"id":"i1"}],
    "log":{"2026-10-20":{"c1":{"ok":true},"r1":{"ok":true}}}, "starBank":{"y":4}, "settings":{"stars":true}}'::jsonb);
  assert keys = 'bank:y,chore:c1,event:e1,kid:l,kid:y,list:g,listitem:i1,log:2026-10-20|c1,log:2026-10-20|r1,redemption:q1,reward:w1,routine:r1,setting:settings,task:t1',
    'same keys as flatten(): ' || keys;
  assert (select data from public.planner_items_from_blob('{"kids":[],"events":[],"tasks":[],"starBank":{"y":4}}') where kind = 'bank') = '{"stars": 4}', 'bank value shape';
  raise notice 'ok: blob split matches the app';
end $$;

-- Co-parent joins; members read, strangers don't --------------------------------
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000003');
set role authenticated;
select public.join_family(current_setting('t.code'));
do $$ begin
  assert (select count(*) from public.planner_items) = 2, 'member reads items';
end $$;
reset role;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000002');
set role authenticated;
do $$ declare denied boolean := false; begin
  assert (select count(*) from public.planner_items) = 0, 'stranger reads nothing';
  begin perform public.save_items(current_setting('t.fam')::uuid, '[{"kind":"task","id":"x","data":{"id":"x"}}]');
  exception when others then denied := sqlerrm like 'Not a member%'; end;
  assert denied, 'stranger cannot save';
  denied := false;
  begin insert into public.planner_items (family_id, kind, id, data) values (current_setting('t.fam')::uuid, 'task', 'x', '{}');
  exception when insufficient_privilege then denied := true; end;
  assert denied, 'direct inserts are blocked';
  raise notice 'ok: item isolation';
end $$;
reset role;

-- Saving, conflicts, deletes -----------------------------------------------------
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
set role authenticated;
do $$ declare r record; v1 timestamptz; v2 timestamptz; begin
  select * into r from public.save_items(current_setting('t.fam')::uuid, '[{"kind":"task","id":"t9","data":{"id":"t9","title":"Buy milk"}}]');
  assert r.kind = 'task' and r.id = 't9' and not r.conflict, 'new item saved, no conflict';
  v1 := r.updated_at;
  perform set_config('t.v1', v1::text, false);
  select * into r from public.save_items(current_setting('t.fam')::uuid,
    jsonb_build_array(jsonb_build_object('kind','task','id','t9','data',jsonb_build_object('id','t9','title','Buy oat milk'),'base',v1)));
  assert not r.conflict and r.updated_at > v1, 'update from latest version: no conflict, newer stamp';
  perform set_config('t.v2', r.updated_at::text, false);
end $$;
reset role;
-- Co-parent edits the same to-do from the older version -> conflict, newest wins
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000003');
set role authenticated;
do $$ declare r record; begin
  select * into r from public.save_items(current_setting('t.fam')::uuid,
    jsonb_build_array(jsonb_build_object('kind','task','id','t9','data',jsonb_build_object('id','t9','title','Buy almond milk'),'base',current_setting('t.v1')::timestamptz)));
  assert r.conflict, 'stale edit is reported as a conflict';
  assert (select data ->> 'title' from public.planner_items where kind = 'task' and id = 't9') = 'Buy almond milk', 'newest save wins';
  assert (select updated_by from public.planner_items where kind = 'task' and id = 't9') = 'aaaaaaaa-0000-0000-0000-000000000003', 'records who saved';
  -- Different items in one batch don't affect each other
  select count(*) into r from public.save_items(current_setting('t.fam')::uuid, '[
    {"kind":"log","id":"2026-10-20|c1","data":{"kidId":"k1","stars":1,"ok":true}},
    {"kind":"chore","id":"c1","data":{"id":"c1","title":"Make bed","kidId":"k1"}}]');
  assert (select count(*) from public.planner_items where family_id = current_setting('t.fam')::uuid) = 5, 'batch saved';
  -- Delete keeps a tombstone so other devices learn about it
  perform public.save_items(current_setting('t.fam')::uuid, '[{"kind":"task","id":"t9","deleted":true}]');
  assert (select deleted and data is null from public.planner_items where kind = 'task' and id = 't9'), 'delete leaves a tombstone';
  raise notice 'ok: saving, conflicts and deletes';
end $$;

-- Validation ------------------------------------------------------------------------
do $$ declare bad int := 0; begin
  begin perform public.save_items(current_setting('t.fam')::uuid, '[{"kind":"secret","id":"x","data":{}}]'); exception when check_violation then bad := bad + 1; end;
  begin perform public.save_items(current_setting('t.fam')::uuid, jsonb_build_array(jsonb_build_object('kind','task','id','big','data',jsonb_build_object('t', repeat('x', 120000))))); exception when check_violation then bad := bad + 1; end;
  begin perform public.save_items(current_setting('t.fam')::uuid, '[{"kind":"task","id":"","data":{}}]'); exception when check_violation then bad := bad + 1; end;
  assert bad = 3, 'unknown kinds, oversized items and empty ids are rejected (' || bad || ')';
  raise notice 'ok: validation';
end $$;

-- The old document is read-only now -------------------------------------------------
do $$ begin
  update public.family_planners set content = '{"kids":[],"events":[],"tasks":[]}';
  assert not found, 'old app versions can no longer overwrite the planner document';
  raise notice 'ok: backup document is read-only';
end $$;
reset role;

-- New families get items from their first planner --------------------------------------
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000005');
set role authenticated;
do $$ declare fid uuid; begin
  select id into fid from public.create_family('{"kids":[{"id":"a"},{"id":"b"}],"events":[],"tasks":[{"id":"t"}],"settings":{"stars":false}}');
  assert (select count(*) from public.planner_items where family_id = fid) = 4, 'new family has items';
  raise notice 'ok: new families start with items';
end $$;
reset role;

-- Deleting the last account removes the family's items --------------------------------
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000005');
set role authenticated;
select public.delete_account();
reset role;
do $$ begin
  assert not exists (select 1 from public.planner_items p join public.families f on f.id = p.family_id where f.created_by = 'aaaaaaaa-0000-0000-0000-000000000005'), 'items removed with family';
  assert (select count(*) from public.planner_items where family_id = current_setting('t.fam')::uuid) = 5, 'other family untouched';
  raise notice 'ok: account deletion removes items';
end $$;
\o
\echo item sync tests passed
