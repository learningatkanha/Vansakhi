-- Newer Supabase projects don't grant table access to signed-in users automatically.
-- Row-level security (0001) still decides which rows each person sees; these grants only open the tables.

grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant update (name, avatar_url) on public.profiles to authenticated;

grant select, insert, update, delete on
  public.species,
  public.custom_fields,
  public.observations,
  public.identifications,
  public.media,
  public.observation_media,
  public.journal_entries,
  public.notes,
  public.links,
  public.comments
to authenticated;

grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_admin(), public.is_member() to authenticated;

-- Signed-out visitors get nothing.
revoke all on all tables in schema public from anon;
