-- Décor de test pour add-telegram-absent.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated / service_role, auth.uid(), is_admin(), tables profiles / orders / visitor_sessions / email_outbox / store_settings,
-- coffre-fort, pg_net et pg_cron simulés.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);

-- pg_net simulé : chaque appel est noté dans net.calls (adresse, corps, en-têtes)
create schema net;
create table net.calls (id serial primary key, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$ declare n bigint; begin insert into net.calls(url, body, headers) values (url, body, headers) returning id into n; return n; end $$;

-- pg_cron simulé
create schema cron;
create table cron.job (jobid serial primary key, jobname text, schedule text, command text);
create function cron.schedule(job_name text, sched text, cmd text) returns bigint language plpgsql as $$ declare n bigint; begin insert into cron.job(jobname, schedule, command) values (job_name, sched, cmd) returning jobid into n; return n; end $$;
create function cron.unschedule(job_name text) returns boolean language plpgsql as $$ begin delete from cron.job where jobname = job_name; return true; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  is_admin boolean not null default false,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  telegram_chat_id bigint
);
create table public.store_settings (id integer primary key, inactive_emails_enabled boolean not null default false);
insert into public.store_settings(id) values (1);
create table public.visitor_sessions (id serial primary key, user_id uuid, last_seen_at timestamptz not null default now());
create table public.orders (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz not null default now());
create table public.email_outbox (id uuid primary key default gen_random_uuid(), kind text, user_id uuid, status text, sent_at timestamptz);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.store_settings to anon, authenticated, service_role;
grant select on public.profiles, public.visitor_sessions, public.orders, public.email_outbox to service_role;
