-- Ajout : suivi par produit des liens d'affiliation (clics/commandes/commission
-- par article dans l'espace affilie). A executer APRES add-affiliate-program.sql.


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


alter table affiliate_commission_items enable row level security;
create policy "affiliate_commission_items_own_read" on affiliate_commission_items for select using (
  auth.uid() = affiliate_id or public.is_admin()
);
