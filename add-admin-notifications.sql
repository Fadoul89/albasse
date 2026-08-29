-- Migration : Notifications admin (cloche)
-- A executer dans Supabase SQL Editor.

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
drop policy if exists "admin_notifications_admin_all" on admin_notifications;
create policy "admin_notifications_admin_all" on admin_notifications for all using (
  public.is_admin()
) with check (public.is_admin());

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
