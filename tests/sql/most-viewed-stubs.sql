-- Décor de test pour add-zara-most-viewed.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated et les 4 tables lues (mêmes colonnes utiles et mêmes types que la vraie base, sans les clés étrangères).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists extensions;
create table public.products (id uuid primary key, name text not null, is_active boolean not null default true);
create table public.profiles (id uuid primary key, is_admin boolean not null default false);
create table public.visitor_sessions (id uuid primary key, user_id uuid, visitor_id text);
create table public.product_views (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  user_id uuid,
  product_id uuid,
  viewed_at timestamptz not null default now()
);
-- comme sur la vraie base : les visiteurs ne lisent pas les visites des autres (la fonction, elle, renvoie seulement des totaux)
alter table public.product_views enable row level security;
alter table public.visitor_sessions enable row level security;
grant usage on schema public to anon, authenticated;
