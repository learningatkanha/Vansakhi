-- 0012: Creative Adda (27 Nov 2026)
--
-- Creations: paintings, written and audio stories and poems, and anything else the team makes, inspired by
-- one or more sightings (anyone's) or by Kanha in general. Shared with the whole team as soon as posted;
-- the author can edit or delete, the admin can delete. "This moved me" is the appreciation.
-- Run this in Supabase -> SQL Editor BEFORE the matching app update goes live. Safe to run more than once.

create table if not exists public.creations (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('painting', 'story', 'poem', 'audio_story', 'audio_poem', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  text_body text check (char_length(text_body) <= 100000),   -- written stories and poems (line breaks kept)
  moved_note text check (char_length(moved_note) <= 1000),   -- "What moved me"
  link_url text check (link_url ~ '^https?://'),              -- optional, e.g. a song or video elsewhere
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creations_created_idx on public.creations (created_at desc);
create index if not exists creations_author_idx on public.creations (author_id);

-- Photos of a painting, or the recording of an audio story/poem (rows in public.media), in order.
create table if not exists public.creation_media (
  creation_id uuid not null references public.creations (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  position int not null default 0,
  primary key (creation_id, media_id)
);
create index if not exists creation_media_media_idx on public.creation_media (media_id);

-- The sightings a creation was inspired by. None = "Inspired by Kanha".
create table if not exists public.creation_links (
  creation_id uuid not null references public.creations (id) on delete cascade,
  observation_id uuid not null references public.observations (id) on delete cascade,
  primary key (creation_id, observation_id)
);
create index if not exists creation_links_observation_idx on public.creation_links (observation_id);

-- "This moved me": one per person per creation.
create table if not exists public.creation_reactions (
  creation_id uuid not null references public.creations (id) on delete cascade,
  member_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (creation_id, member_id)
);

alter table public.creations enable row level security;
alter table public.creation_media enable row level security;
alter table public.creation_links enable row level security;
alter table public.creation_reactions enable row level security;

-- Creations: the whole team reads; you add and edit your own; you or the admin delete.
drop policy if exists "members read creations" on public.creations;
create policy "members read creations" on public.creations for select to authenticated using (public.is_member());
drop policy if exists "add own creations" on public.creations;
create policy "add own creations" on public.creations
  for insert to authenticated with check (author_id = (select auth.uid()) and public.is_member());
drop policy if exists "edit own creations" on public.creations;
create policy "edit own creations" on public.creations
  for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
drop policy if exists "delete own creations" on public.creations;
create policy "delete own creations" on public.creations
  for delete to authenticated using (author_id = (select auth.uid()) or public.is_admin());

-- Media and links of a creation: the team reads; only the author attaches or detaches (their own media).
drop policy if exists "members read creation media" on public.creation_media;
create policy "members read creation media" on public.creation_media for select to authenticated using (public.is_member());
drop policy if exists "author manages creation media" on public.creation_media;
create policy "author manages creation media" on public.creation_media
  for all to authenticated
  using (exists (select 1 from public.creations c where c.id = creation_id and c.author_id = (select auth.uid())))
  with check (
    exists (select 1 from public.creations c where c.id = creation_id and c.author_id = (select auth.uid()))
    and public.owns_media(media_id)
  );

drop policy if exists "members read creation links" on public.creation_links;
create policy "members read creation links" on public.creation_links for select to authenticated using (public.is_member());
drop policy if exists "author manages creation links" on public.creation_links;
create policy "author manages creation links" on public.creation_links
  for all to authenticated
  using (exists (select 1 from public.creations c where c.id = creation_id and c.author_id = (select auth.uid())))
  with check (exists (select 1 from public.creations c where c.id = creation_id and c.author_id = (select auth.uid())));

-- Reactions: the team reads; you add or remove your own.
drop policy if exists "members read reactions" on public.creation_reactions;
create policy "members read reactions" on public.creation_reactions for select to authenticated using (public.is_member());
drop policy if exists "add own reaction" on public.creation_reactions;
create policy "add own reaction" on public.creation_reactions
  for insert to authenticated with check (member_id = (select auth.uid()) and public.is_member());
drop policy if exists "remove own reaction" on public.creation_reactions;
create policy "remove own reaction" on public.creation_reactions
  for delete to authenticated using (member_id = (select auth.uid()));

-- Photos and recordings of creations are visible to the whole team.
drop policy if exists "read visible media" on public.media;
create policy "read visible media" on public.media
  for select to authenticated using (
    owner_id = (select auth.uid())
    or public.is_admin()
    or exists (select 1 from public.observation_media om where om.media_id = media.id)
    or exists (select 1 from public.creation_media cm where cm.media_id = media.id)
    or exists (
      select 1 from public.links l
      join public.journal_entries j on j.id = l.from_entry_id
      where l.to_media_id = media.id and j.is_shared
    )
  );

-- Newer Supabase projects don't open new tables to signed-in users automatically (see 0002).
grant select, insert, update, delete on
  public.creations, public.creation_media, public.creation_links, public.creation_reactions
to authenticated;
grant all on public.creations, public.creation_media, public.creation_links, public.creation_reactions to service_role;
revoke all on public.creations, public.creation_media, public.creation_links, public.creation_reactions from anon;
