-- 0008: a third role, "observer", the default for new team members (24 Nov 2026)
--
-- Roles: observer (most of the team: guides, naturalists), researcher (can later name and verify anyone's
-- sightings), admin. Roles become plain text with a fixed list, so this runs in one go in the SQL Editor
-- (a new value in a Postgres enum can't be used in the same run it is added).
-- Everyone keeps their current role. Run this in Supabase -> SQL Editor BEFORE the matching app update goes live.

alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type text using role::text;
alter table public.profiles add constraint profiles_role_check check (role in ('observer', 'researcher', 'admin'));
alter table public.profiles alter column role set default 'observer';
drop type public.app_role;

-- Researcher or admin: the people who will be able to name and verify anyone's sighting (next step).
create or replace function public.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('researcher', 'admin') and blocked_at is null
  );
$$;
