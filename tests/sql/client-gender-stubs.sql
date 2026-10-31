-- Décor de test pour add-client-gender.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, auth.uid(), profiles avec les mêmes règles de lecture et de modification que la vraie base, is_admin().
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema auth;
-- comme Supabase : l'utilisateur connecté est lu dans le réglage « test.uid » ici
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

create table public.profiles (id uuid primary key, full_name text, is_admin boolean not null default false);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

-- la vraie base : accès à la table pour les rôles du site, et sécurité par ligne (le client lit et modifie seulement sa ligne ; l'administrateur lit tout)
grant usage on schema public to anon, authenticated;
grant usage on schema auth to authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
alter table public.profiles enable row level security;
create policy profiles_self_read on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy profiles_self_update on public.profiles for update using (auth.uid() = id);
