-- Phase 3: the journal.
-- Run once in the Supabase SQL editor, after 0001–0004.

-- A plain-text copy of each journal entry and note, written by the app on save,
-- so the journal can be searched by word without reading every rich-text body.
alter table public.journal_entries add column body_text text not null default '';
alter table public.notes add column body_text text not null default '';

create index journal_entries_tags_idx on public.journal_entries using gin (tags);

-- Plain latitude/longitude, as for observations in 0003.
alter table public.journal_entries
  add column lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored;

-- An entry may only link to photos and videos its owner uploaded. Without this, linking someone
-- else's private photo into a shared entry would show it to the whole team.
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
    and (
      to_media_id is null
      or exists (select 1 from public.media m where m.id = to_media_id and m.owner_id = (select auth.uid()))
    )
  );
