-- Removing a parent: only the family owner can, never the owner themselves.
-- Users: 1 owner, 2 stranger, 3 co-parent, 4 second co-parent, 5 another family.
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null
create or replace function pg_temp.act(u text) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', u, false) $$;

do $$ begin
  assert not has_function_privilege('anon', 'public.remove_member(uuid,uuid)', 'execute'), 'remove_member callable without signing in';
  assert has_function_privilege('authenticated', 'public.remove_member(uuid,uuid)', 'execute'), 'remove_member not callable by parents';
  raise notice 'ok: remove_member access';
end $$;

-- Two co-parents join the owner's family
select set_config('t.family', id::text, false), set_config('t.code', invite_code, false)
  from public.families where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000003');
set role authenticated;
select public.join_family(current_setting('t.code'));
reset role;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000004');
set role authenticated;
select public.join_family(current_setting('t.code'));
reset role;
-- Another family the owner has nothing to do with
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000005');
set role authenticated;
select set_config('t.other_family', (public.create_family()).id::text, false);
reset role;

-- A co-parent (not the owner) can't remove anyone
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000003');
set role authenticated;
do $$ declare denied int := 0; begin
  begin perform public.remove_member(current_setting('t.family')::uuid, 'aaaaaaaa-0000-0000-0000-000000000004');
  exception when raise_exception then denied := denied + 1; end;
  begin perform public.remove_member(current_setting('t.family')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001');
  exception when raise_exception then denied := denied + 1; end;
  assert denied = 2, 'non-owner must not remove parents';
  raise notice 'ok: only the owner can remove';
end $$;
reset role;

-- A stranger can't remove anyone from someone else's family
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000002');
set role authenticated;
do $$ declare denied boolean := false; begin
  begin perform public.remove_member(current_setting('t.family')::uuid, 'aaaaaaaa-0000-0000-0000-000000000003');
  exception when raise_exception then denied := true; end;
  assert denied, 'stranger must not remove parents';
end $$;
reset role;

-- The owner can't remove themselves, or a parent of another family
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
set role authenticated;
do $$ declare denied int := 0; begin
  begin perform public.remove_member(current_setting('t.family')::uuid, 'aaaaaaaa-0000-0000-0000-000000000001');
  exception when raise_exception then denied := denied + 1; end;
  begin perform public.remove_member(current_setting('t.other_family')::uuid, 'aaaaaaaa-0000-0000-0000-000000000005');
  exception when raise_exception then denied := denied + 1; end;
  begin perform public.remove_member(current_setting('t.family')::uuid, 'aaaaaaaa-0000-0000-0000-000000000005');
  exception when raise_exception then denied := denied + 1; end;
  assert denied = 3, 'owner self-removal and cross-family removal must fail';
  raise notice 'ok: owner and other families protected';
end $$;

-- The owner removes a co-parent: the invite code is replaced
select public.remove_member(current_setting('t.family')::uuid, 'aaaaaaaa-0000-0000-0000-000000000003');
do $$ begin
  assert (select count(*) from public.family_members_list(current_setting('t.family')::uuid)) = 2, 'one parent removed';
  assert not exists (select 1 from public.family_members_list(current_setting('t.family')::uuid)
                      where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'the right parent removed';
  assert (select invite_code from public.families where id = current_setting('t.family')::uuid) <> current_setting('t.code'), 'invite code replaced';
end $$;
reset role;

-- The removed parent loses access and can't rejoin with the old code
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000003');
set role authenticated;
do $$ begin
  assert (select count(*) from public.family_planners) = 0, 'removed parent sees no planner';
  assert (select count(*) from public.families) = 0, 'removed parent sees no family';
  assert public.join_family(current_setting('t.code')) is null, 'old code no longer works';
  raise notice 'ok: owner removes a parent';
end $$;
reset role;

-- The other family is untouched
do $$ begin
  assert (select count(*) from public.family_members where family_id = current_setting('t.other_family')::uuid) = 1, 'other family untouched';
end $$;

\o
\echo remove member tests passed
