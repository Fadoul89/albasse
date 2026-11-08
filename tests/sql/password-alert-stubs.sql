-- Décor de test pour add-password-request-alert.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, profiles (comme la vraie table, colonnes utiles), is_admin(), coffre-fort (vault) et pg_net simulés.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create table public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  phone text,
  whatsapp_number text,
  region text,
  is_admin boolean not null default false,
  telegram_chat_id bigint,
  created_at timestamptz not null default now()
);
-- comme la vraie base : l'administrateur connecté est lu dans le réglage « test.is_admin »
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

-- comme la vraie base : auth.users (la connexion d'un compte créé avec le numéro est une adresse « 235…@tel.albasseshopping.com »)
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);

-- le coffre-fort : le token du bot
create schema vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);

-- pg_net simulé : chaque appel est noté dans net.calls (adresse, corps)
create schema net;
create table net.calls (id serial primary key, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$ declare n bigint; begin insert into net.calls(url, body, headers) values (url, body, headers) returning id into n; return n; end $$;

grant usage on schema public to anon, authenticated;
-- le décor ressemble à Supabase : les rôles anon et authenticated ne voient ni vault ni net
