-- Little Days: tighten who can call database functions (run after the earlier migrations).
-- Safe to re-run. Changes permissions only; no data is touched.
--
-- Supabase grants EXECUTE on new public functions to both `anon` (not signed in)
-- and `authenticated` by default. Every Little Days function already refuses
-- callers who aren't signed in or aren't in the family, but this makes it explicit:
--   * Nothing is callable without signing in.
--   * Internal helpers can't be called from the app at all.
--   * Signed-in parents keep exactly the calls the app uses.

-- Postgres also lets everyone (PUBLIC) call new functions, which includes anon.
-- On Supabase, extension functions live in the `extensions` schema and aren't affected.
revoke execute on all functions in schema public from public, anon;

-- Internal only (used inside the database, never by the app)
revoke execute on function public.import_planner_blob(uuid) from authenticated;
revoke execute on function public.planner_items_from_blob(jsonb) from authenticated;
revoke execute on function public.new_invite_code() from authenticated;
revoke execute on function public.touch_family_planner() from authenticated;
revoke execute on function public.touch_planner_item() from authenticated;

-- What the app calls (is_family_member is also used by the row security rules)
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.create_family(jsonb) to authenticated;
grant execute on function public.join_family(text) to authenticated;
grant execute on function public.regenerate_invite(uuid) to authenticated;
grant execute on function public.family_members_list(uuid) to authenticated;
grant execute on function public.leave_family(uuid) to authenticated;
grant execute on function public.delete_account() to authenticated;
grant execute on function public.save_items(uuid, jsonb) to authenticated;

-- New functions created later in this schema stay private until granted on purpose.
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges revoke execute on functions from public;
