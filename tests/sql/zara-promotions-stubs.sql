-- Décor de test pour add-zara-promotions.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, auth.uid(), is_admin(), tables products / product_views / cart_events / orders / profiles, pg_cron simulé.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema cron;
create table cron.job (jobid serial primary key, jobname text, schedule text, command text);
create function cron.schedule(job_name text, sched text, cmd text) returns bigint language plpgsql as $$ declare n bigint; begin insert into cron.job(jobname, schedule, command) values (job_name, sched, cmd) returning jobid into n; return n; end $$;
create function cron.unschedule(job_name text) returns boolean language plpgsql as $$ begin delete from cron.job where jobname = job_name; return true; end $$;

create table public.profiles (id uuid primary key, is_admin boolean not null default false);
create table public.store_settings (id integer primary key, shop_name text);
insert into public.store_settings(id, shop_name) values (1, 'Albasse Shopping');
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  price numeric not null,
  compare_at_price numeric,
  images text[] not null default '{}',
  stock integer not null default 10,
  category_id uuid,
  is_active boolean not null default true,
  is_flash_sale boolean not null default false,
  flash_sale_ends_at timestamptz,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.product_views (id serial primary key, session_id text, user_id uuid, product_id uuid, viewed_at timestamptz not null default now());
create table public.cart_events (id serial primary key, session_id text, user_id uuid, product_id uuid, created_at timestamptz not null default now());
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null,
  total numeric not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  is_flagged_fake boolean not null default false
);
-- comme sur Supabase : tout le monde peut LIRE les articles (la lecture est publique), seules les fonctions réservées les modifient
alter table public.products enable row level security;
create policy products_read on public.products for select using (true);
grant select on public.products to anon, authenticated;
