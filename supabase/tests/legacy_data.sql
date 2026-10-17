-- A family created with the ORIGINAL schema, before the security migration,
-- to prove the migration keeps existing data.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'stranger@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'coparent@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'late@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'other-family@example.com');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
select * from public.create_family('{"kids":[{"id":"k1","name":"Yuna"}],"events":[{"id":"e1","title":"Piano","date":"2026-10-20"}],"tasks":[]}'::jsonb);
reset role;
