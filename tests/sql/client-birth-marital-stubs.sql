-- Décor de test pour add-client-birth-marital.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, auth.uid(), profiles avec les mêmes règles de lecture et de modification que la vraie base, is_admin(),
-- et le déclencheur de protection des colonnes sensibles (fix-profile-security.sql) : il ne doit PAS gêner les deux nouvelles colonnes.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

create table public.profiles (id uuid primary key, full_name text, is_admin boolean not null default false, banned boolean not null default false, loyalty_points int not null default 0);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
alter table public.profiles enable row level security;
create policy profiles_self_read on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy profiles_self_insert on public.profiles for insert with check (auth.uid() = id);
create policy profiles_self_update on public.profiles for update using (auth.uid() = id);

-- version réduite de public.protect_profile_columns() (fix-profile-security.sql) : un client ne se donne ni droits, ni points, ni ne se débannit
create function public.protect_profile_columns() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then return new; end if;
  if new.is_admin is distinct from old.is_admin or new.banned is distinct from old.banned or new.loyalty_points is distinct from old.loyalty_points then
    raise exception 'Modification non autorisée de ce profil' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger protect_profile_columns before update on public.profiles for each row execute function public.protect_profile_columns();
