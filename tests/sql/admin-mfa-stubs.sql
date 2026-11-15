-- Décor de test pour add-admin-mfa.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles, auth.users, auth.mfa_factors (statut « factor_status » comme Supabase), auth.uid() et auth.jwt() lus dans des réglages, profiles.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create type auth.factor_status as enum ('unverified', 'verified');
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), factor_type text, status auth.factor_status);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('test.jwt', true), '')::jsonb $$;
create table public.profiles (id uuid primary key references auth.users(id), is_admin boolean not null default false);
-- l'ancienne version (comme sur la vraie base avant le script)
create function public.is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select coalesce((select is_admin from profiles where id = auth.uid()), false); $$;
grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
-- une table protégée comme les commandes : seul l'admin lit
create table public.orders (id int primary key, client text);
alter table public.orders enable row level security;
create policy orders_admin_read on public.orders for select using (public.is_admin());
grant select on public.orders to anon, authenticated;
insert into public.orders values (1, 'Client A'), (2, 'Client B');

insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'), ('33333333-3333-3333-3333-333333333333');
insert into public.profiles values
  ('11111111-1111-1111-1111-111111111111', true),   -- admin
  ('22222222-2222-2222-2222-222222222222', false),  -- client
  ('33333333-3333-3333-3333-333333333333', true);   -- 2e admin
