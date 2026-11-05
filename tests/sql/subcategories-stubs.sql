-- Décor de test pour add-subcategories.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, is_admin(), la table categories telle qu'elle est aujourd'hui (avec sort_order), ses droits et sa sécurité par ligne,
-- et la table products qui y est rattachée (supprimer une catégorie laisse l'article sans catégorie).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  image_url text,
  affiliate_commission_rate numeric,
  sort_order integer
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null
);

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant update on public.products to authenticated;
alter table public.categories enable row level security;
create policy categories_public_read on public.categories for select using (true);
create policy categories_admin_write on public.categories for all using (public.is_admin()) with check (public.is_admin());
