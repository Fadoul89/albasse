-- Décor de test pour add-scheduled-delivery.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, auth.uid(), is_admin(), tables orders / profiles, coffre-fort, pg_net et pg_cron simulés.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key, banned_until timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);

-- pg_net simulé : chaque envoi Telegram est noté dans net.calls
create schema net;
create table net.calls (id serial primary key, url text, body jsonb);
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$ declare n bigint; begin insert into net.calls(url, body) values (url, body) returning id into n; return n; end $$;

-- pg_cron simulé
create schema cron;
create table cron.job (jobid serial primary key, jobname text, schedule text, command text);
create function cron.schedule(job_name text, sched text, cmd text) returns bigint language plpgsql as $$ declare n bigint; begin insert into cron.job(jobname, schedule, command) values (job_name, sched, cmd) returning jobid into n; return n; end $$;
create function cron.unschedule(job_name text) returns boolean language plpgsql as $$ begin delete from cron.job where jobname = job_name; return true; end $$;

create table public.profiles (
  id uuid primary key,
  is_admin boolean not null default false,
  telegram_chat_id bigint,
  fake_order_count int not null default 0,
  banned boolean not null default false
);
create table public.customer_sanctions (id serial primary key, user_id uuid, action text, reason text, admin_id uuid);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;
create function public.is_banned() returns boolean language sql stable as $$ select false $$;

create sequence public.order_number_seq;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  items jsonb not null,
  total numeric not null,
  status text not null default 'pending' check (status in ('pending','paid','processing','shipped','delivered','cancelled')),
  payment_method text not null check (payment_method in ('airtel_money','moov_money','cash_on_delivery','stripe')),
  payment_reference text,
  shipping_name text not null,
  shipping_phone text not null,
  shipping_address text not null,
  shipping_city text not null,
  created_at timestamptz not null default now(),
  session_id uuid,
  referrer_source text,
  is_flagged_fake boolean not null default false,
  gift_wrap boolean not null default false,
  assistant_device text,
  loyalty_discount integer not null default 0,
  order_number bigint not null default nextval('public.order_number_seq')
);

-- mêmes règles d'accès que la vraie base
alter table public.orders enable row level security;
create policy orders_admin_delete on public.orders for delete using (is_admin());
create policy orders_admin_update on public.orders for update using (is_admin());
create policy orders_guest_insert on public.orders for insert with check (user_id is null and not is_banned());
create policy orders_own_insert on public.orders for insert with check (auth.uid() = user_id and not is_banned());
create policy orders_own_read on public.orders for select using (auth.uid() = user_id or is_admin());
create policy orders_own_update on public.orders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.orders to anon, authenticated;
grant select on public.profiles to authenticated;
grant usage on sequence public.order_number_seq to anon, authenticated;
