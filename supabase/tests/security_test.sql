-- Security and behaviour tests for the Little Days database.
-- Users: 1 owner, 2 stranger, 3 co-parent, 4 late joiner, 5 another family.
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null
create or replace function pg_temp.act(u text) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', u, false) $$;

-- Existing data survived the migration -------------------------------------
do $$ declare r record; begin
  select f.id, m.role, p.content into r from public.families f
    join public.family_members m on m.family_id = f.id
    join public.family_planners p on p.family_id = f.id
   where f.created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert r.role = 'owner', 'legacy creator should become owner';
  assert r.content -> 'events' -> 0 ->> 'title' = 'Piano', 'legacy planner content kept';
  assert (select invite_expires_at > now() + interval '13 days' from public.families where id = r.id), 'legacy code gets 14 days';
  raise notice 'ok: legacy data preserved';
end $$;

-- Wrong codes are counted and then locked out ------------------------------
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000002');
set role authenticated;
do $$ declare i int; got uuid; blocked boolean := false; begin
  for i in 1..5 loop
    got := public.join_family('WRONGCODE' || i);
    assert got is null, 'wrong code must return null';
  end loop;
  begin
    perform public.join_family('WRONGCODE6');
  exception when others then blocked := sqlerrm like 'Too many%';
  end;
  assert blocked, 'sixth wrong code within 15 minutes must be blocked';
  raise notice 'ok: invite brute force is rate limited';
end $$;

-- A stranger sees nothing ---------------------------------------------------
do $$ begin
  assert (select count(*) from public.families) = 0, 'stranger sees no families';
  assert (select count(*) from public.family_planners) = 0, 'stranger sees no planners';
  assert (select count(*) from public.family_members) = 0, 'stranger sees no members';
  update public.family_planners set content = '{"kids":[],"events":[],"tasks":[]}';
  assert not found, 'stranger cannot overwrite a planner';
  begin
    perform * from public.invite_attempts;
    assert false, 'invite_attempts must not be readable';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: stranger isolation';
end $$;
reset role;

-- The co-parent joins with the real code (spaces/lowercase tolerated) ------
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000003');
select set_config('t.legacy_code', invite_code, false), set_config('t.legacy_family', id::text, false)
  from public.families where created_by = 'aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated;
select set_config('t.joined', public.join_family(lower(substr(current_setting('t.legacy_code'), 1, 9)) || ' ' || substr(current_setting('t.legacy_code'), 10))::text, false);
do $$ begin
  assert current_setting('t.joined')::uuid = current_setting('t.legacy_family')::uuid, 'co-parent joins the right family';
  assert (select count(*) from public.family_planners) = 1, 'co-parent reads the planner';
  assert (select count(*) from public.family_members) = 2, 'co-parent sees both parents';
  assert (select count(*) from public.family_members_list(current_setting('t.legacy_family')::uuid)) = 2, 'member list works';
  assert (select role from public.family_members where user_id = auth.uid()) = 'parent', 'invitee is a parent';
  raise notice 'ok: join and co-member visibility';
end $$;

-- Saves are stamped by the server and must be well formed ------------------
-- (Parents can no longer update this backup document once item sync is on,
-- so these checks run as the database owner.)
reset role;
do $$ declare before timestamptz; after timestamptz; rejected boolean := false; begin
  select updated_at into before from public.family_planners;
  update public.family_planners set content = '{"kids":[],"events":[{"id":"e2"}],"tasks":[]}',
         updated_at = '2000-01-01';
  select updated_at into after from public.family_planners;
  assert after > before and after > '2020-01-01', 'server sets updated_at';
  begin
    update public.family_planners set content = '{"events":[]}';
  exception when check_violation then rejected := true;
  end;
  assert rejected, 'malformed planner rejected';
  raise notice 'ok: server timestamps and content checks';
end $$;
reset role;

-- Replacing the code revokes the old one ------------------------------------
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
set role authenticated;
select set_config('t.new_code', invite_code, false) from public.regenerate_invite(current_setting('t.legacy_family')::uuid);
reset role;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000004');
set role authenticated;
do $$ begin
  assert public.join_family(current_setting('t.legacy_code')) is null, 'old code no longer works';
  assert current_setting('t.new_code') <> current_setting('t.legacy_code') and length(current_setting('t.new_code')) = 18, 'new code is fresh';
end $$;
reset role;

-- Expired codes fail ---------------------------------------------------------
update public.families set invite_expires_at = now() - interval '1 minute' where id = current_setting('t.legacy_family')::uuid;
set role authenticated;
do $$ begin
  assert public.join_family(current_setting('t.new_code')) is null, 'expired code rejected';
  raise notice 'ok: revoke and expiry';
end $$;
reset role;
update public.families set invite_expires_at = now() + interval '14 days' where id = current_setting('t.legacy_family')::uuid;

-- Non-members cannot replace another family's code or list its members -----
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000005');
set role authenticated;
select set_config('t.other_family', (public.create_family()).id::text, false);
do $$ declare denied int := 0; begin
  begin perform public.regenerate_invite(current_setting('t.legacy_family')::uuid); exception when others then denied := denied + 1; end;
  begin perform public.family_members_list(current_setting('t.legacy_family')::uuid); exception when others then denied := denied + 1; end;
  assert denied = 2, 'outsider blocked from other family functions';
  assert (select count(*) from public.family_planners) = 1, 'outsider sees only own planner';
  assert (select role from public.family_members where family_id = current_setting('t.other_family')::uuid) = 'owner', 'creator is owner';
  raise notice 'ok: cross-family isolation';
end $$;
reset role;

-- Owner leaves: the co-parent becomes owner ----------------------------------
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
set role authenticated;
select public.leave_family(current_setting('t.legacy_family')::uuid);
do $$ begin
  assert (select count(*) from public.family_planners) = 0, 'former member loses access';
end $$;
reset role;
do $$ begin
  assert (select role from public.family_members where family_id = current_setting('t.legacy_family')::uuid
            and user_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'owner', 'ownership passes on';
  raise notice 'ok: leave family';
end $$;

-- Last member deletes their account: family and planner are removed --------
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000003');
set role authenticated;
select public.delete_account();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'user removed';
  assert not exists (select 1 from public.families where id = current_setting('t.legacy_family')::uuid), 'empty family removed';
  assert not exists (select 1 from public.family_planners where family_id = current_setting('t.legacy_family')::uuid), 'planner removed';
  assert exists (select 1 from public.families where id = current_setting('t.other_family')::uuid), 'other family untouched';
  raise notice 'ok: delete account';
end $$;

-- Creator deletes account while another parent remains: family survives ----
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000005');
set role authenticated;
select set_config('t.other_code', invite_code, false) from public.families where id = current_setting('t.other_family')::uuid;
reset role;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000004');
set role authenticated;
select set_config('t.joined_other', (public.join_family(current_setting('t.other_code')) is not null)::text, false);
reset role;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000005');
set role authenticated;
select public.delete_account();
reset role;
do $$ begin
  assert current_setting('t.joined_other')::boolean, 'late joiner joined';
  assert exists (select 1 from public.families where id = current_setting('t.other_family')::uuid and created_by is null), 'family kept, creator cleared';
  assert (select role from public.family_members where family_id = current_setting('t.other_family')::uuid) = 'owner', 'remaining parent is owner';
  raise notice 'ok: creator account deletion keeps shared family';
end $$;

-- Anonymous visitors can't call family functions ----------------------------
set role anon;
do $$ declare denied boolean := false; begin
  begin perform public.join_family('X'); exception when insufficient_privilege then denied := true; end;
  assert denied, 'anon cannot join';
  raise notice 'ok: anonymous blocked';
end $$;
reset role;

\o
\echo security tests passed
