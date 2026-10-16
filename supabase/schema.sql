-- Run in Supabase SQL Editor. Enable email OTP in Authentication.
create extension if not exists pgcrypto;
create table if not exists public.families (
 id uuid primary key default gen_random_uuid(),
 invite_code text unique not null default upper(encode(gen_random_bytes(9),'hex')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.family_members (
 family_id uuid not null references public.families(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key (family_id,user_id)
);
create table if not exists public.family_planners (
 family_id uuid primary key references public.families(id) on delete cascade,
 content jsonb not null default '{"kids":[],"events":[],"tasks":[]}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_planners enable row level security;
create policy "members can read family" on public.families for select to authenticated using (
 exists(select 1 from public.family_members m where m.family_id=id and m.user_id=(select auth.uid()))
);
create policy "members see own membership" on public.family_members for select to authenticated using(user_id=(select auth.uid()));
create policy "members read planner" on public.family_planners for select to authenticated using (
 exists(select 1 from public.family_members m where m.family_id=family_id and m.user_id=(select auth.uid()))
);
create policy "members update planner" on public.family_planners for update to authenticated using (
 exists(select 1 from public.family_members m where m.family_id=family_id and m.user_id=(select auth.uid()))
) with check (
 exists(select 1 from public.family_members m where m.family_id=family_id and m.user_id=(select auth.uid()))
);
create or replace function public.create_family(initial_data jsonb default '{"kids":[],"events":[],"tasks":[]}'::jsonb)
returns table(id uuid, invite_code text) language plpgsql security definer set search_path = '' as $$
declare f public.families%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 insert into public.families(created_by) values(auth.uid()) returning * into f;
 insert into public.family_members(family_id,user_id) values(f.id,auth.uid());
 insert into public.family_planners(family_id,content) values(f.id,initial_data);
 return query select f.id,f.invite_code;
end; $$;
create or replace function public.join_family(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare f uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select id into f from public.families where invite_code=upper(trim(code));
 if f is null then raise exception 'Invalid invite code'; end if;
 insert into public.family_members(family_id,user_id) values(f,auth.uid()) on conflict do nothing;
 return f;
end; $$;
revoke all on function public.create_family(jsonb) from public;
revoke all on function public.join_family(text) from public;
grant execute on function public.create_family(jsonb) to authenticated;
grant execute on function public.join_family(text) to authenticated;
