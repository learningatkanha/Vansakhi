-- The server's admin key (service_role) bypasses row-level security, but newer Supabase projects
-- still don't grant it table access automatically. Used only by admin-only server code.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
