-- Programme d'affiliation complet : inscription affilie, lien de parrainage,
-- calcul automatique des commissions (par produit/categorie/taux global),
-- validation a la livraison, anti auto-parrainage.
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
    values (aff_id, new.id, round(total_commission), 'pending');
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
