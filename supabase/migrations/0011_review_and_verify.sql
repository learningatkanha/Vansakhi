-- 0011: four naming states, researcher review and Verify (26 Nov 2026)
--
-- States of a sighting's name (column observations.id_status):
--   needs_id        no name yet
--   suggested       "Named": named, but the namer isn't sure; waits for a researcher
--   self_confirmed  "Self-confirmed": the owner is sure (common species)
--   verified        "Verified": checked by a researcher or the admin (who and when are recorded)
-- Rules: only researchers/admins (is_reviewer) can set "verified"; they can also change the name and state of
-- anyone's sighting through review_observation(); "self_confirmed" is for the owner's own sightings.
-- Existing named sightings stay "Named". Run this in Supabase -> SQL Editor BEFORE the app update goes live.

-- 1. States become plain text with a fixed list (so the new value can be used straight away).
alter table public.observations alter column id_status drop default;
alter table public.observations alter column id_status type text using id_status::text;
alter table public.observations drop constraint if exists observations_id_status_check;
alter table public.observations
  add constraint observations_id_status_check check (id_status in ('needs_id', 'suggested', 'self_confirmed', 'verified'));
alter table public.observations alter column id_status set default 'needs_id';
drop type if exists public.id_status;

-- 2. Who verified, and when.
alter table public.observations add column if not exists verified_by uuid references public.profiles (id) on delete set null;
alter table public.observations add column if not exists verified_at timestamptz;

-- 3. Guard: only reviewers can make (or keep, after a name change) a sighting "verified".
create or replace function public.guard_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id_status = 'verified' then
    if tg_op = 'INSERT' or old.id_status <> 'verified' or new.species_id is distinct from old.species_id then
      -- auth.uid() is null for the app's admin key and the SQL Editor: allowed (trusted).
      if (select auth.uid()) is not null and not public.is_reviewer() then
        raise exception 'Only researchers can verify a sighting';
      end if;
      new.verified_by := (select auth.uid());
      new.verified_at := now();
    end if;
  else
    new.verified_by := null;
    new.verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_verification on public.observations;
create trigger guard_verification
  before insert or update on public.observations
  for each row execute function public.guard_verification();

-- 4. Researchers and admins: change the name and state of anyone's sighting (and nothing else).
--    p_species_id null = keep the current name. Returns false if not allowed or not found.
create or replace function public.review_observation(p_id uuid, p_status text, p_species_id bigint default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_reviewer() then
    return false;
  end if;
  if p_status not in ('needs_id', 'suggested', 'self_confirmed', 'verified') then
    raise exception 'Unknown state %', p_status;
  end if;
  update public.observations
     set species_id = coalesce(p_species_id, species_id),
         species_guess = case when p_species_id is null then species_guess else null end,
         id_status = p_status
   where id = p_id;
  return found;
end;
$$;

revoke execute on function public.review_observation(uuid, text, bigint) from public, anon;
grant execute on function public.review_observation(uuid, text, bigint) to authenticated;
