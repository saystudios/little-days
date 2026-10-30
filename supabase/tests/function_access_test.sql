-- Who can call which database functions (mirrors Supabase's default grants).
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null
do $$ declare open_to_anon text; internal_open text; app_missing text; begin
  select string_agg(p.proname, ', ') into open_to_anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e');
  assert open_to_anon is null, 'callable without signing in: ' || open_to_anon;
  select string_agg(p.proname, ', ') into internal_open
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('import_planner_blob', 'planner_items_from_blob', 'new_invite_code', 'touch_family_planner', 'touch_planner_item')
     and has_function_privilege('authenticated', p.oid, 'execute');
  assert internal_open is null, 'internal helpers callable by the app: ' || internal_open;
  select string_agg(f, ', ') into app_missing
    from unnest(array['is_family_member(uuid)', 'create_family(jsonb)', 'join_family(text)', 'regenerate_invite(uuid)',
                      'family_members_list(uuid)', 'leave_family(uuid)', 'delete_account()', 'save_items(uuid,jsonb)',
                      'remove_member(uuid,uuid)']) f
   where not has_function_privilege('authenticated', 'public.' || f, 'execute');
  assert app_missing is null, 'app calls missing for signed-in parents: ' || app_missing;
  raise notice 'ok: function access locked down';
end $$;
-- Row security still works for members after the change
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.families) = 1, 'owner still reads their family';
  assert (select count(*) from public.planner_items) = 2, 'owner still reads their items';
  raise notice 'ok: members still have access';
end $$;
reset role;
\o
\echo function access tests passed
