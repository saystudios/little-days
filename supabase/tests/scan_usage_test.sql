-- Scan limit: only family members can scan, and only 30 times a day.
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null
do $$ begin
  assert not has_function_privilege('anon', 'public.claim_scan()', 'execute'), 'claim_scan callable without signing in';
  assert has_function_privilege('authenticated', 'public.claim_scan()', 'execute'), 'claim_scan not callable by parents';
  assert not has_table_privilege('authenticated', 'public.scan_usage', 'select'), 'scan_usage readable directly';
  raise notice 'ok: scan access locked down';
end $$;

-- A signed-in user with no family can't scan
insert into auth.users(id, email) values ('bbbbbbbb-0000-0000-0000-00000000000f', 'nofamily@example.com') on conflict do nothing;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000f', false);
set role authenticated;
do $$ begin
  begin perform public.claim_scan(); assert false, 'non-member scanned';
  exception when insufficient_privilege then null; end;
  raise notice 'ok: non-members refused';
end $$;
reset role;

-- A family member gets 30 scans, then is refused without the refusal being counted
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
do $$ declare left_over int; begin
  left_over := public.claim_scan();
  assert left_over = 29, 'first scan should leave 29, got ' || left_over;
  for i in 2..30 loop left_over := public.claim_scan(); end loop;
  assert left_over = 0, 'thirtieth scan should leave 0, got ' || left_over;
  begin perform public.claim_scan(); assert false, '31st scan allowed';
  exception when raise_exception then assert sqlerrm = 'scan_limit', 'unexpected error ' || sqlerrm; end;
  raise notice 'ok: daily limit enforced';
end $$;
reset role;
do $$ begin
  assert (select count from public.scan_usage where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 30, 'refused scan was counted';
  raise notice 'ok: refused scans not counted';
end $$;

-- Not signed in at all
select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$ begin
  begin perform public.claim_scan(); assert false, 'anonymous scan';
  exception when invalid_authorization_specification then null; end;
  raise notice 'ok: signed-out refused';
end $$;
