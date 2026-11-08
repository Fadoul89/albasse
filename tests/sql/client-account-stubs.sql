-- Décor de test pour add-client-account-admin.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles Supabase, auth.users + auth.uid(), profiles (colonnes utiles), orders, is_admin() lu dans le réglage « test.is_admin ».
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
-- comme sur Supabase : le rôle du serveur ignore la sécurité par ligne (le rôle peut exister d'un autre test, sans ce droit)
alter role service_role bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  whatsapp_number text,
  region text,
  country text,
  address text,
  profession text,
  is_admin boolean not null default false,
  client_number integer,
  created_at timestamptz not null default now()
);
create table public.orders (id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

grant usage on schema public to anon, authenticated, service_role;
grant select, update on public.profiles to authenticated;
grant select on public.orders to authenticated;
grant select, insert, update, delete on public.profiles, public.orders to service_role;
