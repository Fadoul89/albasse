-- Numéro de commande (1, 2, 3…) et factures électroniques.
--  1. Chaque commande reçoit automatiquement un numéro, dans l'ordre (les commandes déjà passées sont numérotées par date).
--     Le numéro est donné par la base : le téléphone du client ne peut ni le choisir ni le changer.
--  2. La facture de chaque commande se calcule à partir de la commande (aucune table de plus) : elle s'ouvre sur albasseshopping.com/facture/<commande>,
--     pour le client qui a passé la commande et pour l'administrateur.
--  3. Une ligne facultative « informations légales » (NIF, RCCM…) imprimée en bas des factures : Admin › Paramètres de la boutique.
-- Sans danger à relancer. À lancer une fois dans Supabase › SQL Editor.

-- 1) le numéro
alter table public.orders add column if not exists order_number bigint;
create sequence if not exists public.order_number_seq;

-- les commandes déjà passées, numérotées dans l'ordre de leur date (seulement celles qui n'ont pas encore de numéro)
with numbered as (
  select id, row_number() over (order by created_at, id) as n from public.orders where order_number is null
)
update public.orders o
set order_number = numbered.n + (select coalesce(max(order_number), 0) from public.orders)
from numbered
where o.id = numbered.id;

-- la suite de la numérotation continue après le plus grand numéro
select setval('public.order_number_seq', greatest(coalesce(max(order_number), 0), 1), count(order_number) > 0) from public.orders;

alter table public.orders alter column order_number set not null;
create unique index if not exists orders_order_number_key on public.orders (order_number);

-- le numéro est donné par la base à chaque nouvelle commande, et ne change plus jamais
create or replace function public.assign_order_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.order_number := nextval('public.order_number_seq');
  return new;
end; $$;
revoke all on function public.assign_order_number() from public, anon, authenticated;

create or replace function public.keep_order_number()
returns trigger language plpgsql set search_path = public as $$
begin
  new.order_number := old.order_number;
  return new;
end; $$;
revoke all on function public.keep_order_number() from public, anon, authenticated;

drop trigger if exists orders_assign_number on public.orders;
create trigger orders_assign_number before insert on public.orders for each row execute function public.assign_order_number();
drop trigger if exists orders_keep_number on public.orders;
create trigger orders_keep_number before update on public.orders for each row execute function public.keep_order_number();

-- 3) informations légales facultatives en bas des factures
alter table public.store_settings add column if not exists invoice_legal_line text;
