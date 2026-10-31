-- Décor de test pour add-admin-reset-password.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, schéma « extensions » avec pgcrypto (comme Supabase), auth.users, auth.uid(), profiles, is_admin().
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema extensions;
create extension pgcrypto schema extensions;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  encrypted_password character varying,
  updated_at timestamptz
);
-- comme Supabase : l'utilisateur connecté est lu dans le réglage « test.uid » ici
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, is_admin boolean not null default false);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to authenticated;
grant usage on schema extensions to authenticated;
