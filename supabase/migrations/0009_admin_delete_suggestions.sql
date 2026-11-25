-- 0009: name suggestions (25 Nov 2026)
--
-- Name suggestions are rows in public.identifications with source = 'suggestion'. Anyone on the team can add
-- one to any sighting, their own included ("I think it's this, but I'm not sure"), and withdraw their own.
-- The owner's own naming history stays as source = 'manual'; AI guesses (later) are 'ai'.
-- 1. Allow the new source value.  2. The admin can delete anyone's suggestion.
--
-- Safe to run more than once. Run this in Supabase -> SQL Editor BEFORE the matching app update goes live.

alter table public.identifications drop constraint if exists identifications_source_check;
alter table public.identifications
  add constraint identifications_source_check check (source in ('ai', 'manual', 'suggestion'));

drop policy if exists "delete own identifications" on public.identifications;
create policy "delete own identifications" on public.identifications
  for delete to authenticated using (member_id = (select auth.uid()) or public.is_admin());
