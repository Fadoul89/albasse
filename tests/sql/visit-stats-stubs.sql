-- Décor de test pour add-visit-stats.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, auth.uid(), is_admin(), et les 5 tables lues (mêmes colonnes que la vraie base, sans les clés étrangères).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

create table public.profiles (id uuid primary key, full_name text, is_admin boolean not null default false);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

create table public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  visitor_id text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  duration_seconds integer not null default 0,
  page_views integer not null default 1,
  referrer_source text,
  utm_medium text,
  utm_campaign text
);
create table public.product_views (id uuid primary key default gen_random_uuid(), session_id uuid, user_id uuid, product_id uuid, viewed_at timestamptz not null default now());
create table public.cart_events (id uuid primary key default gen_random_uuid(), session_id uuid, user_id uuid, product_id uuid, created_at timestamptz not null default now());
create table public.orders (id uuid primary key default gen_random_uuid(), session_id uuid, total numeric not null default 0, status text not null default 'pending', is_flagged_fake boolean not null default false);

grant usage on schema public to anon, authenticated;
grant usage on schema auth to authenticated;
