-- Programme d'affiliation : corrections après la vérification du 22 novembre 2026 (demande du patron : « vérifie mon programme
-- d'affiliation, est-il opérationnel à 100 % sans erreurs »). À lancer APRÈS add-affiliate-program.sql (déjà en place).
--
-- Ce qui ne marchait pas :
--   1. Espace affilié : « Visiteurs envoyés », « Chiffre d'affaires » et « Mes produits » restaient à 0 : la page lisait les visites,
--      les articles vus et les commandes, que la base réserve (à raison) aux administrateurs.
--      → affiliate_my_stats() : une fonction sûre qui rend à l'affilié connecté SES chiffres seulement (comptes de visites et de vues
--        venues de son lien, ses commissions avec le numéro et le montant de la commande), jamais un nom, un téléphone ni une adresse.
--   2. Le détail par article des commissions (affiliate_commission_items) n'existait pas : add-affiliate-product-links.sql n'avait
--      jamais été lancé. → la table est créée ici (avec ses droits explicites : nouvelle table), et la commission la remplit.
--   3. Une commande signalée fausse (à la main ou après 48 h) gardait sa commission « en attente ».
--   4. Une commande livrée puis annulée (retour) gardait sa commission « validée » : elle aurait pu être payée.
--      → la commission suit aussi le signalement « fausse commande », et une commission validée MAIS PAS ENCORE PAYÉE est annulée
--        si la commande est annulée ensuite. Une commission déjà payée ne change jamais (l'administrateur règle ce cas à la main).
--   5. Un code tapé en minuscules (« amin123 ») n'était pas reconnu. → le code est comparé sans tenir compte des majuscules.
--
-- Sans danger si on le relance. Rien n'est supprimé.

-- 1) le détail par article d'une commission (nouvelle table : droits explicites, en plus des règles de lecture)
create table if not exists public.affiliate_commission_items (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.affiliate_commissions(id) on delete cascade,
  affiliate_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid,
  product_name text not null,
  quantity int not null,
  amount numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_commission_items_affiliate_idx on public.affiliate_commission_items (affiliate_id, product_id);
alter table public.affiliate_commission_items enable row level security;
drop policy if exists "affiliate_commission_items_own_read" on public.affiliate_commission_items;
create policy "affiliate_commission_items_own_read" on public.affiliate_commission_items for select using (auth.uid() = affiliate_id or public.is_admin());
revoke all on public.affiliate_commission_items from public, anon, authenticated;
grant select on public.affiliate_commission_items to authenticated;
grant select, insert, update, delete on public.affiliate_commission_items to service_role;

-- 2) la commission à la création d'une commande : code sans tenir compte des majuscules, détail par article
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
  select nullif(upper(trim(vs.referral_code)), '') into ref_code from visitor_sessions vs where vs.id = new.session_id;
  if ref_code is null then
    return new;
  end if;

  select id into aff_id from profiles where upper(trim(referral_code)) = ref_code and is_affiliate and affiliate_status = 'approved' limit 1;
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
      where p.id = nullif(item->>'product_id', '')::uuid;
    rate := coalesce(prate, crate, default_rate, 0);
    line_total := coalesce((item->>'unit_price')::numeric, 0) * coalesce((item->>'quantity')::numeric, 0);
    total_commission := total_commission + (line_total * rate / 100);
  end loop;

  if total_commission > 0 then
    insert into affiliate_commissions (affiliate_id, order_id, amount, status)
    values (aff_id, new.id, round(total_commission), 'pending')
    on conflict (order_id) do nothing
    returning id into new_commission_id;

    if new_commission_id is not null then
      for item in select * from jsonb_array_elements(new.items)
      loop
        prate := null;
        crate := null;
        select p.affiliate_commission_rate, c.affiliate_commission_rate
          into prate, crate
          from products p left join categories c on c.id = p.category_id
          where p.id = nullif(item->>'product_id', '')::uuid;
        rate := coalesce(prate, crate, default_rate, 0);
        line_total := coalesce((item->>'unit_price')::numeric, 0) * coalesce((item->>'quantity')::numeric, 0);
        line_amount := round(line_total * rate / 100);
        if line_amount > 0 then
          insert into affiliate_commission_items (commission_id, affiliate_id, product_id, product_name, quantity, amount)
          values (new_commission_id, aff_id, nullif(item->>'product_id', '')::uuid, coalesce(item->>'product_name', 'Article'), coalesce((item->>'quantity')::int, 1), line_amount);
        end if;
      end loop;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_order_created_commission on public.orders;
create trigger on_order_created_commission
  after insert on public.orders
  for each row execute procedure public.create_affiliate_commission();

-- 3) la commission suit la commande : livrée → validée ; annulée ou signalée fausse → annulée (même validée, tant qu'elle n'est pas payée)
create or replace function public.sync_affiliate_commission_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_flagged_fake, false) and not coalesce(old.is_flagged_fake, false) then
    update affiliate_commissions set status = 'cancelled' where order_id = new.id and status in ('pending', 'validated') and not paid;
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update affiliate_commissions set status = 'cancelled' where order_id = new.id and status in ('pending', 'validated') and not paid;
  elsif new.status = 'delivered' and old.status is distinct from 'delivered' and not coalesce(new.is_flagged_fake, false) then
    update affiliate_commissions set status = 'validated' where order_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_status_sync_commission on public.orders;
create trigger on_order_status_sync_commission
  after update of status, is_flagged_fake on public.orders
  for each row execute procedure public.sync_affiliate_commission_status();

-- les commandes déjà signalées fausses ou annulées : leurs commissions non payées sont annulées (aucune aujourd'hui ; sans danger)
update public.affiliate_commissions c set status = 'cancelled'
  from public.orders o
 where o.id = c.order_id and c.status in ('pending', 'validated') and not c.paid
   and (coalesce(o.is_flagged_fake, false) or o.status = 'cancelled');

-- 4) les chiffres de l'espace affilié, pour l'affilié connecté seulement (index : les visites d'un code se trouvent vite)
create index if not exists visitor_sessions_referral_upper_idx on public.visitor_sessions (upper(trim(referral_code))) where referral_code is not null;
create or replace function public.affiliate_my_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  code text;
  result jsonb;
begin
  if me is null then
    return null;
  end if;
  select upper(trim(referral_code)) into code from profiles where id = me and is_affiliate and referral_code is not null;
  if code is null then
    return null;
  end if;

  with s as (
    select id, coalesce(visitor_id::text, user_id::text, id::text) as vkey
    from visitor_sessions
    where upper(trim(referral_code)) = code
  ), v as (
    select pv.product_id, count(*) as n from product_views pv join s on s.id = pv.session_id group by pv.product_id
  ), it as (
    select product_id, count(distinct commission_id) as orders, sum(amount) as commission
    from affiliate_commission_items i
    where i.affiliate_id = me and exists (select 1 from affiliate_commissions c where c.id = i.commission_id and c.status <> 'cancelled')
    group by product_id
  )
  select jsonb_build_object(
    'visitors', (select count(distinct vkey) from s),
    'sessions', (select count(*) from s),
    'commissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'order_id', c.order_id, 'order_number', o.order_number, 'order_total', o.total,
        'amount', c.amount, 'status', c.status, 'paid', c.paid, 'paid_at', c.paid_at, 'created_at', c.created_at
      ) order by c.created_at desc)
      from affiliate_commissions c left join orders o on o.id = c.order_id
      where c.affiliate_id = me
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('product_id', x.product_id, 'views', x.views, 'orders', x.orders, 'commission', x.commission))
      from (
        select coalesce(v.product_id, it.product_id) as product_id, coalesce(v.n, 0) as views, coalesce(it.orders, 0) as orders, coalesce(it.commission, 0) as commission
        from v full join it on it.product_id = v.product_id
        where coalesce(v.product_id, it.product_id) is not null
      ) x
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.affiliate_my_stats() from public, anon;
grant execute on function public.affiliate_my_stats() to authenticated;
