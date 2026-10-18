-- Little Days: daily limit for "Scan a flyer or screenshot" (run after the earlier migrations).
-- Safe to re-run. Adds one small table and one function; no existing data is touched.
--
-- Each scan is a paid AI call, so the scan-event Edge Function asks the database
-- for permission first. Only signed-in parents who belong to a family can scan,
-- and each parent gets SCAN_DAILY_LIMIT scans per day (UTC). A refused scan is
-- not counted. Rows older than a week are cleared as new scans come in.

create table if not exists public.scan_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
-- No policies: the table is only reachable through claim_scan().
alter table public.scan_usage enable row level security;
revoke all on public.scan_usage from anon, authenticated;

create or replace function public.claim_scan()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  daily_limit constant integer := 30;   -- SCAN_DAILY_LIMIT
  me uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  used integer;
begin
  if me is null then raise exception 'Sign in to scan.' using errcode = '28000'; end if;
  if not exists (select 1 from public.family_members m where m.user_id = me) then
    raise exception 'Turn on family sync to scan.' using errcode = '42501';
  end if;
  delete from public.scan_usage where user_id = me and day < today - 7;
  insert into public.scan_usage as s (user_id, day, count) values (me, today, 1)
    on conflict (user_id, day) do update set count = s.count + 1
    returning s.count into used;
  if used > daily_limit then
    -- Raising undoes the increment above, so a refused scan isn't counted.
    raise exception 'scan_limit' using errcode = 'P0001', hint = 'Daily scan limit reached. Try again tomorrow.';
  end if;
  return daily_limit - used;
end $$;

revoke execute on function public.claim_scan() from public, anon;
grant execute on function public.claim_scan() to authenticated;
