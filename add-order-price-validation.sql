-- BROUILLON : contrôle des commandes côté serveur. PAS ENCORE APPLIQUÉ à la vraie base.
--
-- Problème : aujourd'hui la base enregistre le prix de chaque article et le total envoyés par le téléphone du client,
-- sans les revérifier, et un client peut modifier le total ou le statut de ses propres commandes (policy orders_own_update).
--
-- Ce script ajoute deux contrôles (aucune colonne nouvelle) :
--   1. À chaque NOUVELLE commande : relit le prix et le stock dans « products », refuse un article épuisé ou retiré,
--      recalcule le total (articles + livraison de la ville + emballage cadeau 2 000 FCFA) et refuse la commande si le total
--      envoyé est différent. La commande est toujours enregistrée « pending », non signalée, sans référence de paiement.
--   2. Quand un CLIENT (pas un admin) modifie sa commande : il ne peut plus toucher au propriétaire, au paiement, au signalement.
--      Il peut seulement : confirmer la réception (shipped -> delivered), et, tant que la commande est « pending »,
--      retirer des articles ou ajouter / retirer l'emballage cadeau, avec un total cohérent.
--   L'admin et les fonctions internes de la base (signalement des fausses commandes...) ne sont pas gênés.
--
-- Essayé : la logique a été testée dans un schéma temporaire (annulé ensuite) : prix truqué corrigé, total refusé, article
-- retiré ou épuisé, stock, variantes du même produit, emballage cadeau, statut, propriétaire, fonctions internes (20 cas : OK).
-- Reste à faire avant de l'appliquer : un essai de commande complet sur une copie (branche Supabase).
-- Pour annuler :
--   drop trigger if exists validate_new_order on public.orders;
--   drop trigger if exists protect_order_update on public.orders;

create or replace function public.validate_new_order() returns trigger
language plpgsql
set search_path = public
as $$
declare
  it jsonb;
  p record;
  q int;
  pid text;
  wanted jsonb := '{}'::jsonb; -- quantité demandée par produit (toutes variantes)
  sum_items numeric := 0;
  fee numeric := 0;
  expected numeric;
  fixed jsonb := '[]'::jsonb;
begin
  if new.items is null or jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) = 0 then
    raise exception 'Commande vide';
  end if;
  for it in select * from jsonb_array_elements(new.items) loop
    q := coalesce((it->>'quantity')::int, 0);
    if q < 1 or q > 100 then
      raise exception 'Quantité invalide';
    end if;
    pid := it->>'product_id';
    wanted := jsonb_set(wanted, array[pid], to_jsonb(coalesce((wanted->>pid)::int, 0) + q));
    select id, name, price, stock, is_active into p from public.products where id = pid::uuid;
    if not found or not p.is_active then
      raise exception 'Article indisponible : %', coalesce(it->>'product_name', pid);
    end if;
    if p.stock < (wanted->>pid)::int then
      raise exception 'Stock insuffisant : % (disponible : %)', p.name, p.stock;
    end if;
    sum_items := sum_items + p.price * q;
    fixed := fixed || jsonb_build_array(jsonb_set(jsonb_set(it, '{unit_price}', to_jsonb(p.price)), '{product_name}', to_jsonb(p.name)));
  end loop;
  select coalesce(c.delivery_fee, 0) into fee from public.cities c where lower(c.name) = lower(new.shipping_city) and c.is_active limit 1;
  expected := sum_items + coalesce(fee, 0) + case when coalesce(new.gift_wrap, false) then 2000 else 0 end;
  if new.total is distinct from expected then
    raise exception 'Le prix a changé : vérifiez votre panier (total attendu : %)', expected;
  end if;
  new.items := fixed;
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.status := 'pending';
    new.is_flagged_fake := false;
    new.payment_reference := null;
  end if;
  return new;
end
$$;

create or replace function public.protect_order_update() returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_gift boolean := coalesce(old.gift_wrap, false);
  new_gift boolean := coalesce(new.gift_wrap, false);
  old_sum numeric := 0;
  new_sum numeric := 0;
  delivery numeric;
  it jsonb;
  o jsonb;
  ok boolean;
begin
  -- admin et fonctions internes de la base (elles tournent avec le rôle propriétaire) : aucune restriction
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
     or new.payment_method is distinct from old.payment_method or new.payment_reference is distinct from old.payment_reference
     or new.is_flagged_fake is distinct from old.is_flagged_fake or new.session_id is distinct from old.session_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Modification non autorisée';
  end if;
  if new.status is distinct from old.status and not (old.status = 'shipped' and new.status = 'delivered') then
    raise exception 'Changement de statut non autorisé';
  end if;
  if new.items is distinct from old.items or new_gift <> old_gift or new.total is distinct from old.total then
    if old.status <> 'pending' or new.status <> old.status then
      raise exception 'Commande non modifiable';
    end if;
    if new.items is null or jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) = 0 then
      raise exception 'Commande vide';
    end if;
    -- chaque article gardé existe dans l'ancienne commande, au même prix, avec une quantité jamais plus grande
    for it in select * from jsonb_array_elements(new.items) loop
      ok := false;
      for o in select * from jsonb_array_elements(old.items) loop
        if it->>'product_id' = o->>'product_id'
           and coalesce(it->>'color', '') = coalesce(o->>'color', '')
           and coalesce(it->>'size', '') = coalesce(o->>'size', '')
           and (it->>'unit_price')::numeric = (o->>'unit_price')::numeric
           and (it->>'quantity')::int between 1 and (o->>'quantity')::int then
          ok := true;
          exit;
        end if;
      end loop;
      if not ok then
        raise exception 'Article modifié : non autorisé';
      end if;
      new_sum := new_sum + (it->>'unit_price')::numeric * (it->>'quantity')::int;
    end loop;
    select coalesce(sum((x->>'unit_price')::numeric * (x->>'quantity')::int), 0) into old_sum from jsonb_array_elements(old.items) x;
    delivery := old.total - old_sum - case when old_gift then 2000 else 0 end; -- la livraison, déduite de l'ancien total
    if new.total is distinct from (new_sum + delivery + case when new_gift then 2000 else 0 end) then
      raise exception 'Total incohérent';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists validate_new_order on public.orders;
create trigger validate_new_order before insert on public.orders for each row execute function public.validate_new_order();

drop trigger if exists protect_order_update on public.orders;
create trigger protect_order_update before update on public.orders for each row execute function public.protect_order_update();
