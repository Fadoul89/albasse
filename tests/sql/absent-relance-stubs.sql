-- Décor de test pour add-absent-relance.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, un faux « cron » (cron.job, cron.schedule, cron.unschedule) et les tables lues (mêmes colonnes utiles que la vraie base).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create function cron.unschedule(p_name text) returns boolean language sql as $$ with d as (delete from cron.job where jobname = p_name returning 1) select exists (select 1 from d) $$;
insert into cron.job (jobname, schedule, command) values ('enqueue-inactive-promos', '0 8 * * *', 'select public.enqueue_inactive_promos()');

create table public.profiles (
  id uuid primary key, email text, notify_promotions boolean default true, banned boolean default false, is_admin boolean default false,
  created_at timestamptz not null default now() - interval '200 days', last_login_at timestamptz
);
create table public.visitor_sessions (id uuid primary key default gen_random_uuid(), user_id uuid, last_seen_at timestamptz not null default now());
create table public.email_outbox (id uuid primary key default gen_random_uuid(), kind text not null, user_id uuid, status text not null default 'pending', created_at timestamptz not null default now());
create table public.email_prefs (user_id uuid primary key, unsubscribed_at timestamptz, suppressed_at timestamptz);
create table public.orders (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz not null default now());
create table public.store_settings (id int primary key, order_emails_enabled boolean, inactive_emails_enabled boolean, inactive_emails_daily_limit int);
insert into public.store_settings values (1, true, true, 50);
create table public.marketing_ai_settings (id int primary key, mode text);
insert into public.marketing_ai_settings values (1, 'live');
grant usage on schema public to anon, authenticated;
