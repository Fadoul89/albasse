-- Décor de test pour add-product-affinity.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated et les 2 tables lues (mêmes colonnes utiles que la vraie base, sans les clés étrangères).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  shipping_phone text,
  is_flagged_fake boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.visitor_product_interest (
  visitor_id text not null,
  product_id text not null,
  views integer not null default 0,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  primary key (visitor_id, product_id)
);
grant usage on schema public to anon, authenticated;
