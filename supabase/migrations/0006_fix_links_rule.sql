-- Fix: journal entries could not be linked to sightings (or to their photos).
-- Run once in the Supabase SQL editor, after 0005.
--
-- The rule added in 0005 checked the media table when a link was saved, and the media table's own
-- read rule checks the links table. Postgres refuses that loop ("infinite recursion detected in
-- policy for relation links"), so every new link was rejected. The ownership check now goes through
-- a small function that reads the media table directly, which breaks the loop. The rule itself is
-- unchanged: an entry may only link to photos and videos its owner uploaded.

create or replace function public.owns_media(media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.media m where m.id = media_id and m.owner_id = (select auth.uid()));
$$;

revoke all on function public.owns_media(uuid) from public;
grant execute on function public.owns_media(uuid) to authenticated;

drop policy "owner manages links" on public.links;
create policy "owner manages links" on public.links
  for all to authenticated using (
    exists (select 1 from public.journal_entries j where j.id = from_entry_id and j.owner_id = (select auth.uid()))
    or exists (select 1 from public.notes n where n.id = from_note_id and n.owner_id = (select auth.uid()))
  ) with check (
    (
      exists (select 1 from public.journal_entries j where j.id = from_entry_id and j.owner_id = (select auth.uid()))
      or exists (select 1 from public.notes n where n.id = from_note_id and n.owner_id = (select auth.uid()))
    )
    and (to_media_id is null or public.owns_media(to_media_id))
  );
