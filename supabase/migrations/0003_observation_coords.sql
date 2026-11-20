-- Plain latitude/longitude columns, kept in step with the PostGIS location, so the app can read
-- coordinates without decoding geography values.

alter table public.observations
  add column lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored;

alter table public.media
  add column lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored;
