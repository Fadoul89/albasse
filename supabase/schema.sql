-- Albasse Shopping — schema Supabase (Postgres)
-- A executer dans le SQL Editor de Supabase (une seule fois)

create extension if not exists "pgcrypto";

-- ========== CATEGORIES ==========
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  image_url text
);

-- ========== PROFILES (etend auth.users) ==========
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  profession text,
  region text,
  country text,
  address text,
  is_admin boolean not null default false,
  last_login_at timestamptz,
  login_count integer not null default 0,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

-- Cree automatiquement un profil a l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========== PRODUCTS ==========
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  slug text unique,
  description text not null default '',
  price numeric(10,2) not null,
  compare_at_price numeric(10,2),
  images text[] not null default '{}',
  colors text[] not null default '{}',
  sizes text[] not null default '{}',
  stock integer not null default 0,
  is_flash_sale boolean not null default false,
  flash_sale_ends_at timestamptz,
  is_active boolean not null default true,
  rating numeric(2,1) not null default 0,
  review_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists products_category_idx on products(category_id);
create index if not exists products_slug_idx on products(slug);

-- Conserve les anciens slugs (produit renomme) pour rediriger proprement
-- au lieu de casser le lien partage sur les reseaux.
create table if not exists product_slug_history (
  slug text primary key,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ========== REVIEWS ==========
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

-- ========== ORDERS ==========
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  items jsonb not null,
  total numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','paid','processing','shipped','delivered','cancelled')),
  payment_method text not null check (payment_method in ('airtel_money','moov_money','cash_on_delivery','stripe')),
  payment_reference text,
  shipping_name text not null,
  shipping_phone text not null,
  shipping_address text not null,
  shipping_city text not null,
  session_id uuid,
  referrer_source text,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_idx on orders(user_id);

-- ========== FLIGHT REQUESTS (Voyage / Billets d'avion) ==========
create table if not exists flight_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  full_name text not null,
  phone text not null,
  origin_city text not null,
  destination_city text not null,
  preferred_airline text,
  departure_date date not null,
  return_date date,
  passenger_count integer not null default 1,
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending','contacted','booked','cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists flight_requests_user_idx on flight_requests(user_id);

-- ========== ANALYTICS (comportement visiteur, non sensible) ==========
-- Une session = un passage sur le site (anonyme ou connecte). Aucune donnee
-- personnelle sensible n'est deduite ; uniquement des mesures d'usage.
create table if not exists visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  visitor_id text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  duration_seconds integer not null default 0,
  page_views integer not null default 1,
  referrer_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

create index if not exists visitor_sessions_user_idx on visitor_sessions(user_id);
create index if not exists visitor_sessions_visitor_idx on visitor_sessions(visitor_id);
create index if not exists visitor_sessions_started_idx on visitor_sessions(started_at);

alter table orders add constraint orders_session_id_fkey
  foreign key (session_id) references visitor_sessions(id) on delete set null;
create index if not exists orders_session_idx on orders(session_id);

create table if not exists product_views (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references visitor_sessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  product_id uuid references products(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists product_views_session_idx on product_views(session_id);
create index if not exists product_views_user_idx on product_views(user_id);
create index if not exists product_views_product_idx on product_views(product_id);

create table if not exists cart_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references visitor_sessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  product_id uuid references products(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists cart_events_session_idx on cart_events(session_id);
create index if not exists cart_events_user_idx on cart_events(user_id);

-- Fonction securisee pour verifier le statut admin sans recursion RLS
-- (SECURITY DEFINER : s'execute avec les droits du proprietaire, contourne RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- Idem pour verifier si l'utilisateur courant est banni
create or replace function public.is_banned()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select banned from profiles where id = auth.uid()), false);
$$;

-- ========== SANCTIONS (bannissement clients) ==========
create table if not exists customer_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  action text not null check (action in ('ban', 'reactivate')),
  reason text,
  admin_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists customer_sanctions_user_idx on customer_sanctions(user_id);

-- Bannit ou reactive un client au niveau de Supabase Auth lui-meme
-- (banned_until sur auth.users) : la connexion est refusee par Supabase,
-- ce n'est pas un simple controle cote client contournable.
-- SECURITY DEFINER : s'execute avec les droits du proprietaire de la fonction,
-- ce qui permet d'ecrire dans auth.users sans exposer de cle service_role au frontend.
create or replace function public.admin_set_ban_status(
  target_user_id uuid,
  new_banned boolean,
  ban_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Non autorise';
  end if;

  if new_banned then
    update auth.users set banned_until = 'infinity' where id = target_user_id;
    update profiles set banned = true where id = target_user_id;
    insert into customer_sanctions (user_id, action, reason, admin_id)
    values (target_user_id, 'ban', ban_reason, auth.uid());
  else
    update auth.users set banned_until = null where id = target_user_id;
    update profiles set banned = false where id = target_user_id;
    insert into customer_sanctions (user_id, action, reason, admin_id)
    values (target_user_id, 'reactivate', ban_reason, auth.uid());
  end if;
end;
$$;

grant execute on function public.admin_set_ban_status(uuid, boolean, text) to authenticated;

-- ========== SIGNALEMENT DES FAUSSES COMMANDES ==========
alter table orders add column if not exists is_flagged_fake boolean not null default false;
alter table profiles add column if not exists fake_order_count int not null default 0;

-- Marque une commande comme "fausse" (non honoree) et incremente le compteur du
-- client. A la 3e, bannit automatiquement le compte (SECURITY DEFINER : ecrit
-- dans profiles/orders/auth.users sans exposer de droits admin au frontend).
create or replace function public.flag_fake_order(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  new_count int;
begin
  if not public.is_admin() then
    raise exception 'Non autorise';
  end if;

  select user_id into target_user_id from orders where id = target_order_id and not is_flagged_fake;
  if target_user_id is null then
    return;
  end if;

  update orders set is_flagged_fake = true where id = target_order_id;
  update profiles set fake_order_count = fake_order_count + 1 where id = target_user_id
    returning fake_order_count into new_count;

  if new_count >= 3 then
    update auth.users set banned_until = 'infinity' where id = target_user_id;
    update profiles set banned = true where id = target_user_id;
    insert into customer_sanctions (user_id, action, reason, admin_id)
    values (target_user_id, 'ban', 'Automatique : 3 commandes signalées comme fausses', auth.uid());
  end if;
end;
$$;

grant execute on function public.flag_fake_order(uuid) to authenticated;

-- ========== ROW LEVEL SECURITY ==========
alter table categories enable row level security;
alter table products enable row level security;
alter table reviews enable row level security;
alter table profiles enable row level security;
alter table orders enable row level security;
alter table flight_requests enable row level security;
alter table visitor_sessions enable row level security;
alter table product_views enable row level security;
alter table cart_events enable row level security;

-- Categories & products: lecture publique, ecriture admin uniquement
create policy "categories_public_read" on categories for select using (true);
create policy "categories_admin_write" on categories for all using (
  public.is_admin()
);

create policy "products_public_read" on products for select using (true);
create policy "products_admin_write" on products for all using (
  public.is_admin()
);

alter table product_slug_history enable row level security;
create policy "product_slug_history_public_read" on product_slug_history for select using (true);
create policy "product_slug_history_admin_write" on product_slug_history for all using (
  public.is_admin()
);

-- Reviews: lecture publique, un utilisateur cree ses propres avis
create policy "reviews_public_read" on reviews for select using (true);
create policy "reviews_own_insert" on reviews for insert with check (
  auth.uid() = user_id and not public.is_banned()
);

-- Profiles: chacun voit/modifie le sien, l'admin voit tout
create policy "profiles_self_read" on profiles for select using (
  auth.uid() = id or public.is_admin()
);
create policy "profiles_self_update" on profiles for update using (auth.uid() = id);

-- Orders: chacun voit/cree les siennes, l'admin voit et modifie tout
create policy "orders_own_read" on orders for select using (
  auth.uid() = user_id or public.is_admin()
);
create policy "orders_own_insert" on orders for insert with check (
  auth.uid() = user_id and not public.is_banned()
);
create policy "orders_admin_update" on orders for update using (
  public.is_admin()
);
create policy "orders_own_update" on orders for update using (
  auth.uid() = user_id
) with check (auth.uid() = user_id);
create policy "orders_admin_delete" on orders for delete using (
  public.is_admin()
);

-- Flight requests: chacun voit/cree les siennes, l'admin voit et modifie tout
create policy "flight_requests_own_read" on flight_requests for select using (
  auth.uid() = user_id or public.is_admin()
);
create policy "flight_requests_own_insert" on flight_requests for insert with check (
  auth.uid() = user_id and not public.is_banned()
);
create policy "flight_requests_admin_update" on flight_requests for update using (
  public.is_admin()
);
create policy "flight_requests_admin_delete" on flight_requests for delete using (
  public.is_admin()
);

-- Analytics : n'importe qui peut enregistrer un evenement (visiteurs anonymes
-- inclus) ; seul l'admin peut lire ces donnees comportementales.
create policy "visitor_sessions_insert" on visitor_sessions for insert with check (true);
create policy "visitor_sessions_update" on visitor_sessions for update using (true);
create policy "visitor_sessions_admin_read" on visitor_sessions for select using (
  public.is_admin()
);

create policy "product_views_insert" on product_views for insert with check (true);
create policy "product_views_admin_read" on product_views for select using (
  public.is_admin()
);

create policy "cart_events_insert" on cart_events for insert with check (true);
create policy "cart_events_admin_read" on cart_events for select using (
  public.is_admin()
);

-- ========== PAYMENT SETTINGS (Mobile Money) ==========
-- Une seule ligne (singleton) contenant les numeros et liens de paiement
create table if not exists payment_settings (
  id integer primary key default 1,
  airtel_number text,
  airtel_payment_url text,
  moov_number text,
  moov_payment_url text,
  instructions text,
  updated_at timestamptz not null default now(),
  constraint payment_settings_singleton check (id = 1)
);

insert into payment_settings (id) values (1) on conflict (id) do nothing;

alter table payment_settings enable row level security;

alter table customer_sanctions enable row level security;
create policy "customer_sanctions_admin_read" on customer_sanctions for select using (
  public.is_admin()
);
-- Pas de policy insert : seule la fonction admin_set_ban_status (SECURITY DEFINER) peut y ecrire.

create policy "payment_settings_public_read" on payment_settings for select using (true);
create policy "payment_settings_admin_write" on payment_settings for update using (
  public.is_admin()
);

-- ========== STORE SETTINGS (Informations de contact) ==========
create table if not exists store_settings (
  id integer primary key default 1,
  shop_name text not null default 'Albasse Shopping',
  address text,
  postal_code text,
  city text,
  country text,
  phone text,
  whatsapp text,
  email text,
  hours text,
  google_maps_url text,
  updated_at timestamptz not null default now(),
  constraint store_settings_singleton check (id = 1)
);

insert into store_settings (id, shop_name, address, postal_code, city, country, phone, whatsapp, email, hours)
values (
  1, 'Albasse Shopping', 'Marché Central', '5575', 'N''Djamena', 'Tchad',
  '00235 60605151', '00235 60605151', 'contact@albasseshopping.com',
  'Lun - Sam : 8h - 19h'
)
on conflict (id) do nothing;

alter table store_settings enable row level security;
create policy "store_settings_public_read" on store_settings for select using (true);
create policy "store_settings_admin_write" on store_settings for update using (
  public.is_admin()
);

-- ========== NOTIFICATIONS ADMIN (cloche) ==========
-- Alimentee par des triggers serveur (nouvelle commande, nouveau client,
-- paiement recu, commande livree, stock faible) : fiable meme si personne
-- n'a l'app ouverte au moment de l'evenement.
create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_read_idx on admin_notifications(is_read);
create index if not exists admin_notifications_created_idx on admin_notifications(created_at desc);

alter table admin_notifications enable row level security;
create policy "admin_notifications_admin_all" on admin_notifications for all using (
  public.is_admin()
) with check (public.is_admin());

-- Nouvelle commande
create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into admin_notifications (type, title, message, link)
  values (
    'new_order',
    '🛒 Nouvelle commande',
    new.shipping_name || ' — ' || new.total || ' FCFA',
    'admin/commandes'
  );
  return new;
end;
$$;

drop trigger if exists on_order_created on orders;
create trigger on_order_created
  after insert on orders
  for each row execute procedure public.notify_new_order();

-- Paiement recu / commande livree (changement de statut)
create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    insert into admin_notifications (type, title, message, link)
    values ('payment_received', '💳 Paiement reçu', new.shipping_name || ' — ' || new.total || ' FCFA', 'admin/commandes');
  elsif new.status = 'delivered' and old.status is distinct from 'delivered' then
    insert into admin_notifications (type, title, message, link)
    values ('order_delivered', '📦 Commande livrée', 'Commande de ' || new.shipping_name || ' marquée comme livrée', 'admin/commandes');
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_status_change on orders;
create trigger on_order_status_change
  after update of status on orders
  for each row execute procedure public.notify_order_status_change();

-- Nouveau client (creation de profil, juste apres l'inscription)
create or replace function public.notify_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into admin_notifications (type, title, message, link)
  values ('new_customer', '👤 Nouveau client', coalesce(new.email, 'Un nouveau client'), 'admin/clients');
  return new;
end;
$$;

drop trigger if exists on_profile_created on profiles;
create trigger on_profile_created
  after insert on profiles
  for each row execute procedure public.notify_new_customer();

-- Stock faible (uniquement quand on passe SOUS le seuil, pour eviter le spam)
create or replace function public.notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock <= 5 and (old.stock > 5 or old.stock is null) then
    insert into admin_notifications (type, title, message, link)
    values ('low_stock', '⚠️ Stock faible', new.name || ' — ' || new.stock || ' restant(s)', 'admin/produits');
  end if;
  return new;
end;
$$;

drop trigger if exists on_product_stock_change on products;
create trigger on_product_stock_change
  after update of stock on products
  for each row execute procedure public.notify_low_stock();

-- ========== PROMOTIONS INTELLIGENTES ==========
create table if not exists smart_promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references categories(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  gift text not null,
  min_purchase numeric(10,2) not null default 0,
  start_date date not null,
  end_date date not null,
  end_time time not null default '23:59',
  max_beneficiaries integer,
  claimed_count integer not null default 0,
  message text not null,
  image_url text,
  button_text text not null default 'PROFITER DE L''OFFRE',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists smart_promotions_category_idx on smart_promotions(category_id);
create index if not exists smart_promotions_product_idx on smart_promotions(product_id);
create index if not exists smart_promotions_active_idx on smart_promotions(is_active);

alter table smart_promotions enable row level security;
create policy "smart_promotions_public_read" on smart_promotions for select using (true);
create policy "smart_promotions_admin_insert" on smart_promotions for insert with check (public.is_admin());
create policy "smart_promotions_admin_update" on smart_promotions for update using (public.is_admin());
create policy "smart_promotions_admin_delete" on smart_promotions for delete using (public.is_admin());

-- Enregistre chaque fois qu'un client clique "profiter de l'offre" : sert de
-- compteur fiable (le nombre max de beneficiaires est verifie cote serveur,
-- impossible a contourner en rejouant l'appel client).
create table if not exists promotion_claims (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references smart_promotions(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  session_id uuid,
  claimed_at timestamptz not null default now()
);

create index if not exists promotion_claims_promotion_idx on promotion_claims(promotion_id);

alter table promotion_claims enable row level security;
create policy "promotion_claims_admin_read" on promotion_claims for select using (public.is_admin());
-- Pas de policy insert directe : seule claim_promotion() (SECURITY DEFINER) peut y ecrire.

create or replace function public.claim_promotion(promo_id uuid, p_session_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  promo record;
begin
  select * into promo from smart_promotions where id = promo_id for update;
  if not found or not promo.is_active then
    return false;
  end if;
  if now() < promo.start_date::timestamptz then
    return false;
  end if;
  if now() > (promo.end_date + promo.end_time)::timestamptz then
    return false;
  end if;
  if promo.max_beneficiaries is not null and promo.claimed_count >= promo.max_beneficiaries then
    return false;
  end if;

  update smart_promotions set claimed_count = claimed_count + 1 where id = promo_id;
  insert into promotion_claims (promotion_id, user_id, session_id) values (promo_id, auth.uid(), p_session_id);
  return true;
end;
$$;

grant execute on function public.claim_promotion(uuid, uuid) to authenticated, anon;

-- ========== NOTIFICATIONS CLIENTS (nouveaux produits) ==========
alter table profiles add column if not exists notify_new_products boolean not null default true;
alter table profiles add column if not exists notify_promotions boolean not null default true;
alter table profiles add column if not exists notify_flash_sale boolean not null default true;
alter table profiles add column if not exists notifications_last_seen_at timestamptz;

alter table products add column if not exists notify_on_publish boolean not null default true;

-- Une ligne par produit publie avec notification activee (pas une ligne par
-- client) : chaque client filtre cote lecture selon son propre consentement
-- et compare a sa date de derniere consultation. Evite la duplication en
-- base pour un petit catalogue tout en respectant le consentement individuel.
create table if not exists product_notifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists product_notifications_created_idx on product_notifications(created_at desc);

alter table product_notifications enable row level security;
create policy "product_notifications_authenticated_read" on product_notifications for select using (
  auth.uid() is not null
);

create or replace function public.notify_new_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.notify_on_publish then
    insert into product_notifications (product_id, title, message)
    values (new.id, '🛍️ Nouveau produit disponible', new.name || ' — ' || new.price || ' FCFA');
  end if;
  return new;
end;
$$;

drop trigger if exists on_product_created_notify on products;
create trigger on_product_created_notify
  after insert on products
  for each row execute procedure public.notify_new_product();

-- ========== FAVORIS ==========
create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists favorites_user_idx on favorites(user_id);

alter table favorites enable row level security;
create policy "favorites_own_all" on favorites for all using (
  auth.uid() = user_id
) with check (auth.uid() = user_id);

-- ========== VILLES (adresse client + frais de livraison) ==========
create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean not null default true,
  delivery_fee int, -- null = pas encore defini par l'admin ("A definir"), 0 = gratuit
  delivery_agency text, -- null = pas encore defini par l'admin ("A definir")
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cities_sort_idx on cities(sort_order);

alter table cities enable row level security;
create policy "cities_public_read" on cities for select using (true);
create policy "cities_admin_write" on cities for all using (
  public.is_admin()
) with check (public.is_admin());

insert into cities (name, sort_order) values
  ('N''Djamena', 1), ('Moundou', 2), ('Sarh', 3), ('Abéché', 4), ('Kélo', 5),
  ('Koumra', 6), ('Pala', 7), ('Bongor', 8), ('Doba', 9), ('Faya-Largeau', 10),
  ('Mongo', 11), ('Ati', 12), ('Am Timan', 13), ('Mao', 14), ('Moussoro', 15),
  ('Bol', 16), ('Massakory', 17), ('Biltine', 18), ('Fada', 19), ('Amdjarass', 20),
  ('Adré', 21), ('Iriba', 22), ('Goz Beïda', 23), ('Laï', 24), ('Fianga', 25),
  ('Léré', 26), ('Benoy', 27), ('Kyabé', 28), ('Moïssala', 29), ('Bousso', 30),
  ('Massaguet', 31), ('Massenya', 32), ('Ngouri', 33), ('Oum Hadjer', 34),
  ('Abou Deïa', 35), ('Am Dam', 36), ('Haraze', 37), ('Melfi', 38),
  ('Mbaïbokoum', 39), ('Beinamar', 40), ('Bébédjia', 41), ('Gounou-Gaya', 42),
  ('Guidiguir', 43)
on conflict (name) do nothing;

-- Frais de livraison et agences connus au lancement (les autres restent "A definir")
update cities set delivery_fee = 0, delivery_agency = 'Livraison' where name = 'N''Djamena';
update cities set delivery_fee = 2500, delivery_agency = 'STTL ou Sud Voyage' where name in ('Moundou', 'Sarh', 'Kélo', 'Koumra', 'Pala', 'Bongor', 'Doba');
update cities set delivery_fee = 2500, delivery_agency = 'Abou Aziza' where name in ('Abéché', 'Mongo');
update cities set delivery_fee = 2500 where name in ('Ati', 'Am Timan', 'Mao');

-- ========== MESSAGES ADMIN -> CLIENT ==========
create table if not exists customer_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  admin_id uuid references profiles(id),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_messages_user_idx on customer_messages(user_id, created_at desc);

alter table customer_messages enable row level security;
create policy "customer_messages_own_read" on customer_messages for select using (
  auth.uid() = user_id or public.is_admin()
);
create policy "customer_messages_own_update" on customer_messages for update using (
  auth.uid() = user_id
) with check (auth.uid() = user_id);
create policy "customer_messages_admin_write" on customer_messages for insert with check (
  public.is_admin()
);
create policy "customer_messages_admin_delete" on customer_messages for delete using (
  public.is_admin()
);

-- ========== PROGRAMME D'AFFILIATION ==========
alter table profiles add column if not exists is_affiliate boolean not null default false;
alter table profiles add column if not exists affiliate_status text check (affiliate_status in ('pending', 'approved', 'blocked'));
alter table profiles add column if not exists referral_code text;
alter table profiles add column if not exists social_link text;
alter table profiles add column if not exists affiliate_type text;
alter table profiles add column if not exists affiliate_mobile_money text;

create unique index if not exists profiles_referral_code_idx on profiles(referral_code) where referral_code is not null;

alter table categories add column if not exists affiliate_commission_rate numeric;
alter table products add column if not exists affiliate_commission_rate numeric;
alter table visitor_sessions add column if not exists referral_code text;

-- Reglage global : taux de commission par defaut (utilise si aucun taux
-- specifique n'est defini sur le produit ou sa categorie)
create table if not exists affiliate_settings (
  id integer primary key default 1,
  default_commission_rate numeric not null default 5,
  updated_at timestamptz not null default now(),
  constraint affiliate_settings_singleton check (id = 1)
);
insert into affiliate_settings (id) values (1) on conflict (id) do nothing;

-- Une commission par commande attribuee a un affilie. Le statut suit le
-- cycle de vie de la commande : pending -> validated (livree) ou cancelled
-- (commande annulee ou signalee comme fausse).
create table if not exists affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references profiles(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade unique,
  amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'validated', 'cancelled')),
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_commissions_affiliate_idx on affiliate_commissions(affiliate_id);

-- Detail par produit d'une commission (pour le tableau "Mes produits" cote
-- affilie : clics/vues, commandes et commission par article).
create table if not exists affiliate_commission_items (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references affiliate_commissions(id) on delete cascade,
  affiliate_id uuid not null references profiles(id) on delete cascade,
  product_id uuid,
  product_name text not null,
  quantity int not null,
  amount numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_commission_items_affiliate_idx on affiliate_commission_items(affiliate_id, product_id);

-- Approuve/bloque un affilie (ecriture sur le profil d'un AUTRE utilisateur :
-- necessite SECURITY DEFINER, comme admin_set_ban_status).
create or replace function public.admin_set_affiliate_status(
  target_user_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Non autorise';
  end if;
  if new_status not in ('pending', 'approved', 'blocked') then
    raise exception 'Statut invalide';
  end if;
  update profiles set affiliate_status = new_status where id = target_user_id;
end;
$$;

grant execute on function public.admin_set_affiliate_status(uuid, text) to authenticated;

-- Calcule et enregistre la commission d'un affilie a la creation d'une
-- commande, en se basant sur la session d'origine (code de parrainage
-- memorise jusqu'a 30 jours). Empeche l'auto-parrainage.
create or replace function public.create_affiliate_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  aff_id uuid;
  item jsonb;
  prate numeric;
  crate numeric;
  rate numeric;
  default_rate numeric;
  total_commission numeric := 0;
  line_total numeric;
  line_amount numeric;
  new_commission_id uuid;
begin
  select vs.referral_code into ref_code from visitor_sessions vs where vs.id = new.session_id;
  if ref_code is null then
    return new;
  end if;

  select id into aff_id from profiles where referral_code = ref_code and is_affiliate and affiliate_status = 'approved';
  if aff_id is null or aff_id = new.user_id then
    return new;
  end if;

  select default_commission_rate into default_rate from affiliate_settings where id = 1;

  for item in select * from jsonb_array_elements(new.items)
  loop
    prate := null;
    crate := null;
    select p.affiliate_commission_rate, c.affiliate_commission_rate
      into prate, crate
      from products p left join categories c on c.id = p.category_id
      where p.id = (item->>'product_id')::uuid;

    rate := coalesce(prate, crate, default_rate, 0);
    line_total := (item->>'unit_price')::numeric * (item->>'quantity')::numeric;
    total_commission := total_commission + (line_total * rate / 100);
  end loop;

  if total_commission > 0 then
    insert into affiliate_commissions (affiliate_id, order_id, amount, status)
    values (aff_id, new.id, round(total_commission), 'pending')
    returning id into new_commission_id;

    for item in select * from jsonb_array_elements(new.items)
    loop
      prate := null;
      crate := null;
      select p.affiliate_commission_rate, c.affiliate_commission_rate
        into prate, crate
        from products p left join categories c on c.id = p.category_id
        where p.id = (item->>'product_id')::uuid;

      rate := coalesce(prate, crate, default_rate, 0);
      line_total := (item->>'unit_price')::numeric * (item->>'quantity')::numeric;
      line_amount := round(line_total * rate / 100);
      if line_amount > 0 then
        insert into affiliate_commission_items (commission_id, affiliate_id, product_id, product_name, quantity, amount)
        values (
          new_commission_id,
          aff_id,
          nullif(item->>'product_id', '')::uuid,
          item->>'product_name',
          (item->>'quantity')::int,
          line_amount
        );
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists on_order_created_commission on orders;
create trigger on_order_created_commission
  after insert on orders
  for each row execute procedure public.create_affiliate_commission();

-- Fait suivre le statut de la commission a celui de la commande
create or replace function public.sync_affiliate_commission_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    update affiliate_commissions set status = 'validated' where order_id = new.id and status = 'pending';
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update affiliate_commissions set status = 'cancelled' where order_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_status_sync_commission on orders;
create trigger on_order_status_sync_commission
  after update of status on orders
  for each row execute procedure public.sync_affiliate_commission_status();

alter table affiliate_settings enable row level security;
create policy "affiliate_settings_public_read" on affiliate_settings for select using (true);
create policy "affiliate_settings_admin_write" on affiliate_settings for update using (public.is_admin());

alter table affiliate_commissions enable row level security;
create policy "affiliate_commissions_own_read" on affiliate_commissions for select using (
  auth.uid() = affiliate_id or public.is_admin()
);
create policy "affiliate_commissions_admin_update" on affiliate_commissions for update using (
  public.is_admin()
);

alter table affiliate_commission_items enable row level security;
create policy "affiliate_commission_items_own_read" on affiliate_commission_items for select using (
  auth.uid() = affiliate_id or public.is_admin()
);

-- ========== ROUE DE LA CHANCE (jeu fidelite) ==========
-- Un tour est gagne tous les 5 commandes livrees. Les lots et leur poids
-- (probabilite relative) sont configurables par l'admin.
create table if not exists wheel_prizes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  icon text not null default '🎁',
  weight int not null default 10,
  is_lose boolean not null default false,
  is_grand_prize boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists wheel_prizes_sort_idx on wheel_prizes(sort_order);

-- Palier 5 commandes livrees : tirage parmi les petits lots (grand_prize=false).
-- Palier 10 commandes livrees (multiple de 10) : lot garanti (grand_prize=true).
-- Montre et bague desactivees pour l'instant (l'admin peut les reactiver).
insert into wheel_prizes (label, icon, weight, is_lose, is_grand_prize, is_active, sort_order) values
  ('Chaussettes', '🧦', 25, false, false, true, 1),
  ('Parfum Hersh Lahab', '👑', 1, false, true, true, 2),
  ('Montre dorée', '⌚', 4, false, false, true, 3),
  ('T-shirt', '👕', 25, false, false, true, 4),
  ('Bague', '💍', 3, false, false, true, 5),
  ('Perdu', '❌', 1, true, false, true, 6),
  ('Stylo', '🖊️', 25, false, false, true, 7),
  ('Débardeur', '🎽', 25, false, false, true, 8)
on conflict do nothing;

-- Un tour enregistre par palier de 5 commandes livrees atteint (unique par
-- palier : impossible de reutiliser un meme palier deux fois).
create table if not exists wheel_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  milestone int not null,
  prize_id uuid references wheel_prizes(id),
  prize_label text not null,
  created_at timestamptz not null default now(),
  unique (user_id, milestone)
);

create index if not exists wheel_spins_user_idx on wheel_spins(user_id, created_at desc);

-- Tire un lot au hasard (pondere) et enregistre le tour, apres verification
-- que le client a bien un tour disponible (5 commandes livrees non encore
-- utilisees pour un tour). SECURITY DEFINER : le tirage doit etre fiable et
-- non manipulable depuis le client.
create or replace function public.spin_wheel()
returns table (out_label text, out_icon text, out_is_lose boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_count int;
  next_milestone int;
  weekly_key int;
  total_weight int;
  r numeric;
  running int := 0;
  chosen wheel_prizes%rowtype;
  lose_prize wheel_prizes%rowtype;
begin
  select count(*) into completed_count from orders where user_id = auth.uid() and status = 'delivered';
  select coalesce(max(milestone), 0) + 1 into next_milestone from wheel_spins where user_id = auth.uid() and milestone > 0;

  if completed_count >= next_milestone * 5 then
    if (next_milestone * 5) % 10 = 0 then
      -- Palier 10, 20, 30... : lot garanti (parfum)
      select * into chosen from wheel_prizes wp where wp.is_grand_prize and wp.is_active order by wp.sort_order limit 1;
      if chosen.id is null then
        raise exception 'Aucun grand lot configure';
      end if;
      insert into wheel_spins (user_id, milestone, prize_id, prize_label)
      values (auth.uid(), next_milestone, chosen.id, chosen.label);
      return query select chosen.label, chosen.icon, false;
      return;
    end if;

    -- Palier 5, 15, 25... : tirage pondere parmi les petits lots
    select sum(wp.weight) into total_weight from wheel_prizes wp where wp.is_active and not wp.is_grand_prize and not wp.is_lose;
    if total_weight is null or total_weight <= 0 then
      raise exception 'Aucun lot configure';
    end if;

    r := random() * total_weight;

    for chosen in select * from wheel_prizes wp where wp.is_active and not wp.is_grand_prize and not wp.is_lose order by wp.sort_order loop
      running := running + chosen.weight;
      if r <= running then
        insert into wheel_spins (user_id, milestone, prize_id, prize_label)
        values (auth.uid(), next_milestone, chosen.id, chosen.label);
        return query select chosen.label, chosen.icon, false;
        return;
      end if;
    end loop;
  end if;

  -- Pas de palier disponible : tour de consolation, une fois par semaine
  -- civile, toujours perdant (namespace negatif pour ne jamais entrer en
  -- collision avec un vrai palier, qui est toujours positif).
  weekly_key := -1 * (extract(isoyear from now())::int * 100 + extract(week from now())::int);

  if exists (select 1 from wheel_spins where user_id = auth.uid() and milestone = weekly_key) then
    raise exception 'Vous avez deja joue cette semaine. Revenez la semaine prochaine !';
  end if;

  select * into lose_prize from wheel_prizes wp where wp.is_lose and wp.is_active order by wp.sort_order limit 1;
  insert into wheel_spins (user_id, milestone, prize_id, prize_label)
  values (auth.uid(), weekly_key, lose_prize.id, coalesce(lose_prize.label, 'Perdu'));
  return query select coalesce(lose_prize.label, 'Perdu'), coalesce(lose_prize.icon, '❌'), true;
end;
$$;

grant execute on function public.spin_wheel() to authenticated;

alter table wheel_prizes enable row level security;
create policy "wheel_prizes_public_read" on wheel_prizes for select using (true);
create policy "wheel_prizes_admin_write" on wheel_prizes for all using (
  public.is_admin()
) with check (public.is_admin());

alter table wheel_spins enable row level security;
create policy "wheel_spins_own_read" on wheel_spins for select using (
  auth.uid() = user_id or public.is_admin()
);

-- ========== DONNEES DE BASE : CATEGORIES ==========
insert into categories (slug, name) values
  ('costumes', 'Costumes'),
  ('chemises', 'Chemises'),
  ('cravates', 'Cravates'),
  ('chaussures', 'Chaussures'),
  ('montres', 'Montres'),
  ('accessoires', 'Accessoires')
on conflict (slug) do nothing;

-- Pour promouvoir un compte en admin, executer apres inscription :
-- update profiles set is_admin = true where email = 'votre-email@exemple.com';
