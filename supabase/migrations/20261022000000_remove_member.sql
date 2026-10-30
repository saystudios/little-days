-- Little Days: let the family owner remove another parent (run after the
-- earlier migrations). Safe to re-run. Adds one function; no data is touched.
--
-- What it changes:
--   * The owner of a family can remove another parent from it. The removed
--     parent immediately loses access to the shared planner (their own device
--     keeps its local copy).
--   * Only the owner can do this, only for their own family, and the owner
--     can't remove themselves (they use "Leave family" for that).
--   * Removing someone also replaces the family's invite code, so the code
--     they could see in the app can't be used to join again.
begin;

create or replace function public.remove_member(fid uuid, uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.family_members
                  where family_id = fid and user_id = me and role = 'owner') then
    raise exception 'Only the family owner can remove a parent';
  end if;
  if uid is null or uid = me then raise exception 'The owner can''t remove themselves. Use Leave family instead.'; end if;
  if exists (select 1 from public.family_members
              where family_id = fid and user_id = uid and role = 'owner') then
    raise exception 'The family owner can''t be removed';
  end if;
  delete from public.family_members where family_id = fid and user_id = uid;
  if not found then raise exception 'That parent is not in this family'; end if;
  update public.families
     set invite_code = public.new_invite_code(),
         invite_expires_at = now() + interval '14 days'
   where id = fid;
end; $$;

revoke all on function public.remove_member(uuid, uuid) from public;
revoke execute on function public.remove_member(uuid, uuid) from anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

commit;
