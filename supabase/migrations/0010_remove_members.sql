-- 0010: remove a member but keep their work (26 Nov 2026)
--
-- Until now, deleting someone's login deleted their profile and, with it, everything they added.
-- From now on the profile stays when the login is deleted, so their sightings, photos, journal entries and
-- suggestions stay too, shown as "Name (former member)". The admin removes people from the Admin page.
-- Run this in Supabase -> SQL Editor BEFORE the matching app update goes live. Safe to run more than once.

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add column if not exists removed_at timestamptz;
