-- Décor de test pour add-affiliate-program.sql + add-affiliate-fixes.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated / service_role, auth.uid(), is_admin(), et les tables lues (colonnes utiles de la vraie base).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;
create table public.profiles (id uuid primary key, full_name text);
create table public.categories (id uuid primary key default gen_random_uuid(), name text);
create table public.products (id uuid primary key default gen_random_uuid(), name text, category_id uuid);
create table public.visitor_sessions (id uuid primary key default gen_random_uuid(), user_id uuid, visitor_id text, started_at timestamptz not null default now());
create table public.product_views (id uuid primary key default gen_random_uuid(), session_id uuid, product_id uuid, user_id uuid);
create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number int, user_id uuid, session_id uuid, items jsonb not null default '[]',
  total numeric not null default 0, status text not null default 'pending', is_flagged_fake boolean not null default false,
  shipping_name text default 'Client secret', shipping_phone text default '66000000'
);
grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles, public.orders, public.visitor_sessions, public.product_views to authenticated;
