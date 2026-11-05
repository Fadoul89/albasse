-- Décor de test pour add-friend-invites.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, auth.uid(), is_admin(), la table profiles avec ses droits et sa sécurité par ligne (le client lit et modifie seulement sa ligne).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema auth;
-- comme Supabase : l'utilisateur connecté est lu dans le réglage « test.uid » ici
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

create table public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  phone text,
  whatsapp_number text,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
alter table public.profiles enable row level security;
create policy profiles_self_read on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy profiles_self_update on public.profiles for update using (auth.uid() = id);
