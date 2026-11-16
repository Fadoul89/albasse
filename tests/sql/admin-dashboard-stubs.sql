-- Décor de test pour add-admin-dashboard.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, is_admin() simulée, et les 6 tables lues (mêmes colonnes utiles et mêmes types que la vraie base, sans les clés étrangères).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists extensions;
-- l'administrateur est simulé par un réglage de session (test.is_admin = on)
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;
grant execute on function public.is_admin() to anon, authenticated;

create table public.categories (id uuid primary key, parent_id uuid);
create table public.products (id uuid primary key, name text not null, is_active boolean not null default true, category_id uuid);
create table public.profiles (id uuid primary key, is_admin boolean not null default false, created_at timestamptz not null default now());
create table public.visitor_sessions (id uuid primary key default gen_random_uuid(), user_id uuid, visitor_id text, referrer_source text, started_at timestamptz not null default now());
create table public.product_views (id uuid primary key default gen_random_uuid(), session_id uuid, user_id uuid, product_id uuid, viewed_at timestamptz not null default now());
create table public.orders (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), status text not null, total numeric not null, is_flagged_fake boolean not null default false);
-- comme sur la vraie base : rien n'est lisible directement par les visiteurs (la fonction, elle, renvoie seulement des totaux)
alter table public.visitor_sessions enable row level security;
alter table public.product_views enable row level security;
alter table public.orders enable row level security;
alter table public.profiles enable row level security;
grant usage on schema public to anon, authenticated;
