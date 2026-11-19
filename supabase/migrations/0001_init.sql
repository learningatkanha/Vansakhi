-- Kanha Field Journal: initial schema
-- Run once in the Supabase SQL editor (or with `supabase db push`).

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------
create type public.app_role as enum ('admin', 'researcher');
create type public.id_status as enum ('needs_id', 'suggested', 'verified');

-- ---------------------------------------------------------------
-- Profiles: one row per team member, created automatically on invite
-- ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  role public.app_role not null default 'researcher',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Role is never taken from user-supplied metadata; admins change it from the app.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Species (from GBIF, saved the first time someone records them)
-- ---------------------------------------------------------------
create table public.species (
  id bigint generated always as identity primary key,
  gbif_key bigint unique,
  scientific_name text not null,
  common_name text,
  hindi_name text,
  group_name text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table public.custom_fields (
  id bigint generated always as identity primary key,
  species_id bigint references public.species (id) on delete cascade,
  group_name text,
  label text not null,
  field_type text not null check (field_type in ('text', 'number', 'choice', 'boolean')),
  options text[],
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (species_id is not null or group_name is not null)
);

-- ---------------------------------------------------------------
-- Observations (shared with the team)
-- ---------------------------------------------------------------
create table public.observations (
  id uuid primary key default gen_random_uuid(),
  observer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  species_id bigint references public.species (id),
  species_guess text,
  observed_at timestamptz not null,
  place_name text,
  location extensions.geography (point, 4326),
  count int check (count is null or count > 0),
  life_stage text,
  sex text,
  behaviour text,
  habitat text,
  weather text,
  notes text,
  custom_values jsonb not null default '{}'::jsonb,
  id_status public.id_status not null default 'needs_id',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index observations_observed_at_idx on public.observations (observed_at desc);
create index observations_species_idx on public.observations (species_id);
create index observations_observer_idx on public.observations (observer_id);
create index observations_location_idx on public.observations using gist (location);

create trigger observations_updated_at
  before update on public.observations
  for each row execute function public.set_updated_at();

create table public.identifications (
  id bigint generated always as identity primary key,
  observation_id uuid not null references public.observations (id) on delete cascade,
  member_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  species_id bigint not null references public.species (id),
  source text not null check (source in ('ai', 'manual')),
  confidence numeric(4, 3),
  comment text,
  created_at timestamptz not null default now()
);

create index identifications_observation_idx on public.identifications (observation_id);

-- ---------------------------------------------------------------
-- Media (files live in Cloudflare R2; rows hold their keys)
-- ---------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  file_key text not null unique,
  media_type text not null check (media_type in ('photo', 'video', 'audio')),
  mime_type text,
  size_bytes bigint,
  taken_at timestamptz,
  location extensions.geography (point, 4326),
  thumbnail_key text,
  transcript text,
  created_at timestamptz not null default now()
);

create index media_owner_idx on public.media (owner_id);

create table public.observation_media (
  observation_id uuid not null references public.observations (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  position int not null default 0,
  primary key (observation_id, media_id)
);

-- ---------------------------------------------------------------
-- Journal and notes (private unless shared)
-- ---------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default '',
  body jsonb not null default '{}'::jsonb,
  entry_date date not null default current_date,
  place_name text,
  location extensions.geography (point, 4326),
  weather text,
  tags text[] not null default '{}',
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journal_entries_owner_idx on public.journal_entries (owner_id, entry_date desc);

create trigger journal_entries_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default '',
  body jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_owner_idx on public.notes (owner_id);

create trigger notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

create table public.links (
  id bigint generated always as identity primary key,
  from_entry_id uuid references public.journal_entries (id) on delete cascade,
  from_note_id uuid references public.notes (id) on delete cascade,
  to_observation_id uuid references public.observations (id) on delete cascade,
  to_species_id bigint references public.species (id) on delete cascade,
  to_media_id uuid references public.media (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls (from_entry_id, from_note_id) = 1),
  check (num_nonnulls (to_observation_id, to_species_id, to_media_id) = 1)
);

create table public.comments (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  observation_id uuid references public.observations (id) on delete cascade,
  journal_entry_id uuid references public.journal_entries (id) on delete cascade,
  body text not null check (length(body) > 0),
  created_at timestamptz not null default now(),
  check (num_nonnulls (observation_id, journal_entry_id) = 1)
);

-- ---------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.species enable row level security;
alter table public.custom_fields enable row level security;
alter table public.observations enable row level security;
alter table public.identifications enable row level security;
alter table public.media enable row level security;
alter table public.observation_media enable row level security;
alter table public.journal_entries enable row level security;
alter table public.notes enable row level security;
alter table public.links enable row level security;
alter table public.comments enable row level security;

-- Profiles: members see each other; a member may edit only their own name and avatar.
create policy "members read profiles" on public.profiles
  for select to authenticated using (public.is_member());
create policy "edit own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (name, avatar_url) on public.profiles to authenticated;

-- Species: members read and add; admins edit and delete.
create policy "members read species" on public.species
  for select to authenticated using (public.is_member());
create policy "members add species" on public.species
  for insert to authenticated with check (public.is_member());
create policy "admins edit species" on public.species
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete species" on public.species
  for delete to authenticated using (public.is_admin());

-- Custom fields: members read; admins manage.
create policy "members read custom fields" on public.custom_fields
  for select to authenticated using (public.is_member());
create policy "admins manage custom fields" on public.custom_fields
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Observations: everyone in the team reads; you write your own.
create policy "members read observations" on public.observations
  for select to authenticated using (public.is_member());
create policy "add own observations" on public.observations
  for insert to authenticated with check (observer_id = (select auth.uid()) and public.is_member());
create policy "edit own observations" on public.observations
  for update to authenticated
  using (observer_id = (select auth.uid())) with check (observer_id = (select auth.uid()));
create policy "delete own observations" on public.observations
  for delete to authenticated using (observer_id = (select auth.uid()) or public.is_admin());

-- Identifications
create policy "members read identifications" on public.identifications
  for select to authenticated using (public.is_member());
create policy "add own identifications" on public.identifications
  for insert to authenticated with check (member_id = (select auth.uid()) and public.is_member());
create policy "delete own identifications" on public.identifications
  for delete to authenticated using (member_id = (select auth.uid()));

-- Media: private to the owner unless attached to an observation or linked from a shared entry.
create policy "read visible media" on public.media
  for select to authenticated using (
    owner_id = (select auth.uid())
    or exists (select 1 from public.observation_media om where om.media_id = media.id)
    or exists (
      select 1 from public.links l
      join public.journal_entries j on j.id = l.from_entry_id
      where l.to_media_id = media.id and j.is_shared
    )
  );
create policy "add own media" on public.media
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.is_member());
create policy "edit own media" on public.media
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "delete own media" on public.media
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "members read observation media" on public.observation_media
  for select to authenticated using (public.is_member());
create policy "observer attaches media" on public.observation_media
  for insert to authenticated with check (
    exists (select 1 from public.observations o where o.id = observation_id and o.observer_id = (select auth.uid()))
    and exists (select 1 from public.media m where m.id = media_id and m.owner_id = (select auth.uid()))
  );
create policy "observer detaches media" on public.observation_media
  for delete to authenticated using (
    exists (select 1 from public.observations o where o.id = observation_id and o.observer_id = (select auth.uid()))
  );

-- Journal entries and notes: owner only, plus the team when shared.
create policy "read own or shared entries" on public.journal_entries
  for select to authenticated using (owner_id = (select auth.uid()) or (is_shared and public.is_member()));
create policy "add own entries" on public.journal_entries
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.is_member());
create policy "edit own entries" on public.journal_entries
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "delete own entries" on public.journal_entries
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "read own or shared notes" on public.notes
  for select to authenticated using (owner_id = (select auth.uid()) or (is_shared and public.is_member()));
create policy "add own notes" on public.notes
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.is_member());
create policy "edit own notes" on public.notes
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "delete own notes" on public.notes
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Links follow their source entry or note.
create policy "read visible links" on public.links
  for select to authenticated using (
    exists (select 1 from public.journal_entries j where j.id = from_entry_id
            and (j.owner_id = (select auth.uid()) or j.is_shared))
    or exists (select 1 from public.notes n where n.id = from_note_id
               and (n.owner_id = (select auth.uid()) or n.is_shared))
  );
create policy "owner manages links" on public.links
  for all to authenticated using (
    exists (select 1 from public.journal_entries j where j.id = from_entry_id and j.owner_id = (select auth.uid()))
    or exists (select 1 from public.notes n where n.id = from_note_id and n.owner_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.journal_entries j where j.id = from_entry_id and j.owner_id = (select auth.uid()))
    or exists (select 1 from public.notes n where n.id = from_note_id and n.owner_id = (select auth.uid()))
  );

-- Comments: on observations, or on journal entries you can see.
create policy "read visible comments" on public.comments
  for select to authenticated using (
    (observation_id is not null and public.is_member())
    or exists (select 1 from public.journal_entries j where j.id = journal_entry_id
               and (j.owner_id = (select auth.uid()) or j.is_shared))
  );
create policy "add own comments" on public.comments
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and (
      (observation_id is not null and public.is_member())
      or exists (select 1 from public.journal_entries j where j.id = journal_entry_id
                 and (j.owner_id = (select auth.uid()) or j.is_shared))
    )
  );
create policy "delete own comments" on public.comments
  for delete to authenticated using (author_id = (select auth.uid()));
