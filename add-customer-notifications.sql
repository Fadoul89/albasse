-- Migration : Notifications clients (nouveaux produits) — consentement + désabonnement
-- A executer dans Supabase SQL Editor.

alter table profiles add column if not exists notify_new_products boolean not null default true;
alter table profiles add column if not exists notify_promotions boolean not null default true;
alter table profiles add column if not exists notify_flash_sale boolean not null default true;
alter table profiles add column if not exists notifications_last_seen_at timestamptz;

alter table products add column if not exists notify_on_publish boolean not null default true;

create table if not exists product_notifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists product_notifications_created_idx on product_notifications(created_at desc);

alter table product_notifications enable row level security;
drop policy if exists "product_notifications_authenticated_read" on product_notifications;
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
    values ('🛍️ Nouveau produit disponible', new.name || ' — ' || new.price || ' FCFA');
  end if;
  return new;
end;
$$;

drop trigger if exists on_product_created_notify on products;
create trigger on_product_created_notify
  after insert on products
  for each row execute procedure public.notify_new_product();
