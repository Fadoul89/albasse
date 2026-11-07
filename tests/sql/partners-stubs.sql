-- Décor de test pour add-partners.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, profiles, products (publique, comme la vraie), orders (déclencheur d'alerte), is_admin(), coffre-fort (vault) et pg_net simulés.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create table public.profiles (id uuid primary key, is_admin boolean not null default false, telegram_chat_id bigint);
create table public.products (id uuid primary key, name text not null, price numeric not null default 0);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  items jsonb,
  shipping_name text, shipping_phone text, shipping_city text,
  total numeric
);
-- comme la vraie base : l'administrateur connecté est lu dans le réglage « test.is_admin »
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

create schema vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);

create schema net;
create table net.calls (id serial primary key, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$ declare n bigint; begin insert into net.calls(url, body, headers) values (url, body, headers) returning id into n; return n; end $$;

-- L'ANCIENNE alerte de commande (telle qu'elle est dans la vraie base avant ce script) : sert de référence pour prouver que le message ne change pas sans partenaire
create function public.telegram_notify_admin_new_order_old(o public.orders) returns text language plpgsql as $$
declare articles text; txt text;
begin
  select string_agg('• ' || coalesce(i->>'product_name','Article') || ' × ' || coalesce(i->>'quantity','1'), E'\n') into articles from jsonb_array_elements(coalesce(o.items,'[]'::jsonb)) i;
  txt := '🛒 Nouvelle commande' || E'\n' || coalesce(o.shipping_name,'') || ' · ' || coalesce(o.shipping_phone,'') || E'\n'
      || coalesce(o.shipping_city,'') || E'\n' || coalesce(articles || E'\n','')
      || '💰 ' || replace(to_char(o.total,'FM999,999,999'),',',' ') || ' FCFA';
  return txt;
end $$;

-- le déclencheur existe déjà dans la vraie base : il appelle la fonction que le script remplace
create function public.telegram_notify_admin_new_order() returns trigger language plpgsql as $$ begin return new; end $$;
create trigger on_order_created_telegram_admin after insert on public.orders for each row execute function public.telegram_notify_admin_new_order();

grant usage on schema public to anon, authenticated;
