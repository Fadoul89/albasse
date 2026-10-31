-- Décor de test pour add-push-gate.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, is_admin(), produits, notifications avec leur déclencheur d'envoi (pg_net simulé), abonnés, visites,
-- notifications programmées, pg_cron simulé. Les deux déclencheurs « nouvel article » et « promotion » sont ceux d'AVANT le script
-- (ils écrivent directement dans product_notifications) : le script doit les remplacer.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

-- pg_net simulé : chaque appel est noté dans net.calls
create schema net;
create table net.calls (id serial primary key, url text, body jsonb);
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$ declare n bigint; begin insert into net.calls(url, body) values (url, body) returning id into n; return n; end $$;

-- pg_cron simulé, avec l'ancienne planification d'avant le script
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create function cron.schedule(job_name text, sched text, cmd text) returns bigint language plpgsql as $$ declare n bigint; begin insert into cron.job(jobname, schedule, command) values (job_name, sched, cmd) returning jobid into n; return n; end $$;
create function cron.unschedule(job_id bigint) returns boolean language plpgsql as $$ begin delete from cron.job where jobid = job_id; return true; end $$;
select cron.schedule('albasse-scheduled-pushes', '* * * * *', 'select public.run_scheduled_pushes()');
select cron.schedule('une-autre-tache', '0 8 * * *', 'select 1');

create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

create table public.store_settings (id integer primary key);
insert into public.store_settings(id) values (1);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null default 0,
  is_active boolean not null default true,
  stock integer,
  is_flash_sale boolean not null default false,
  notify_on_publish boolean not null default false
);
create table public.product_notifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create table public.web_push_subscriptions (id uuid primary key default gen_random_uuid());
create table public.visitor_product_interest (visitor_id text not null, product_id text not null, views integer not null default 1, last_viewed_at timestamptz);

-- add-scheduled-push.sql + add-push-clicks.sql (sans pg_cron, absent d'un Postgres local)
create table public.scheduled_pushes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  message text not null check (char_length(message) between 1 and 160),
  send_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'expired', 'cancelled')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  clicks integer not null default 0,
  recipients integer
);

-- L'envoi réel d'une notification : chaque ligne de product_notifications appelle les deux fonctions d'envoi (comme en vrai)
create function public.push_notify_product_notification() returns trigger language plpgsql security definer as $$
begin
  perform net.http_post(url := 'https://exemple.test/functions/v1/send-product-push', body := jsonb_build_object('title', new.title, 'message', new.message));
  perform net.http_post(url := 'https://exemple.test/functions/v1/send-web-push', body := jsonb_build_object('title', new.title, 'message', new.message, 'product_id', new.product_id));
  return new;
end $$;
create trigger push_on_product_notification after insert on public.product_notifications for each row execute function public.push_notify_product_notification();

-- Les producteurs d'AVANT le script
create function public.notify_new_product() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.notify_on_publish then
    insert into product_notifications (product_id, title, message) values (new.id, '🛍️ Nouveau produit disponible', new.name || ' — ' || new.price || ' FCFA');
  end if;
  return new;
end $$;
create function public.notify_product_promotion() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_flash_sale and (old.is_flash_sale is distinct from new.is_flash_sale) then
    insert into product_notifications (product_id, title, message) values (new.id, '🔥 Promotion en cours', new.name || ' est maintenant en vente flash — ' || new.price || ' FCFA');
  end if;
  return new;
end $$;
create trigger on_product_created_notify after insert on public.products for each row execute function public.notify_new_product();
create trigger on_product_promotion_notify after update on public.products for each row execute function public.notify_product_promotion();

grant usage on schema public to anon, authenticated, service_role;
grant select on public.store_settings to anon, authenticated, service_role;
