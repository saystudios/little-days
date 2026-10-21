-- Little Days: Sports & Meals family sync (one shared document per family).
-- Records the table that already exists in production so new environments
-- match it. Safe to re-run; it doesn't change existing rows.
begin;

create table if not exists public.family_sports_meals (
  family_id uuid primary key references public.families(id) on delete cascade,
  content jsonb not null default '{"meals": [], "events": [], "checklist": {}}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.family_sports_meals enable row level security;

drop policy if exists "members read sports meals" on public.family_sports_meals;
create policy "members read sports meals" on public.family_sports_meals
  for select to authenticated using (public.is_family_member(family_id));
drop policy if exists "members create sports meals" on public.family_sports_meals;
create policy "members create sports meals" on public.family_sports_meals
  for insert to authenticated with check (public.is_family_member(family_id));
drop policy if exists "members edit sports meals" on public.family_sports_meals;
create policy "members edit sports meals" on public.family_sports_meals
  for update to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

commit;
