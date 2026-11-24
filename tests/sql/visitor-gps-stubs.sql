-- Décor de test pour add-visitor-gps.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles, auth.users, auth.uid(), public.profiles, public.is_admin() (comme sur la vraie base).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.profiles (id uuid primary key references auth.users(id), is_admin boolean not null default false);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select coalesce((select is_admin from profiles where id = auth.uid()), false); $$;
grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
insert into public.profiles values
  ('11111111-1111-1111-1111-111111111111', true),   -- admin
  ('22222222-2222-2222-2222-222222222222', false);  -- client
