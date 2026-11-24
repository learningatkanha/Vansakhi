-- 0007: admin powers and blocking members (24 Nov 2026)
--
-- 1. Admins can read and delete every journal entry, private ones included, with their photos and links.
--    (Members are told in the app that the admin can see private entries.)
-- 2. Admins can delete anyone's comments.
-- 3. Blocking: an admin can block a member. A blocked member counts as not on the team, so they can't read
--    or add anything, even with a session that is still open. Their sightings and entries stay.
--    (The app also bans their login in Supabase Auth so they can't sign in again.)
--
-- Run this in Supabase -> SQL Editor BEFORE the matching app update goes live.

alter table public.profiles add column if not exists blocked_at timestamptz;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and blocked_at is null);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and blocked_at is null
  );
$$;

-- Only admins may block or unblock (the app does it with the admin key; this stops anything else).
revoke update (blocked_at) on public.profiles from authenticated;

-- Journal entries: admins read and delete all of them.
drop policy "read own or shared entries" on public.journal_entries;
create policy "read own or shared entries" on public.journal_entries
  for select to authenticated using (
    owner_id = (select auth.uid()) or (is_shared and public.is_member()) or public.is_admin()
  );

drop policy "delete own entries" on public.journal_entries;
create policy "delete own entries" on public.journal_entries
  for delete to authenticated using (owner_id = (select auth.uid()) or public.is_admin());

-- Links from entries and notes: admins see them all, so an admin reading a private entry sees its sightings.
drop policy "read visible links" on public.links;
create policy "read visible links" on public.links
  for select to authenticated using (
    public.is_admin()
    or exists (select 1 from public.journal_entries j where j.id = from_entry_id
               and (j.owner_id = (select auth.uid()) or j.is_shared))
    or exists (select 1 from public.notes n where n.id = from_note_id
               and (n.owner_id = (select auth.uid()) or n.is_shared))
  );

-- Photos and videos: admins see them all, so the photos inside private entries show for them too.
drop policy "read visible media" on public.media;
create policy "read visible media" on public.media
  for select to authenticated using (
    owner_id = (select auth.uid())
    or public.is_admin()
    or exists (select 1 from public.observation_media om where om.media_id = media.id)
    or exists (
      select 1 from public.links l
      join public.journal_entries j on j.id = l.from_entry_id
      where l.to_media_id = media.id and j.is_shared
    )
  );

-- Comments: admins can delete anyone's.
drop policy "delete own comments" on public.comments;
create policy "delete own comments" on public.comments
  for delete to authenticated using (author_id = (select auth.uid()) or public.is_admin());
