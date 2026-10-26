-- Zara choisit les articles de la Vente flash (24 h, AUTOMATIQUEMENT si l'administrateur l'autorise) et des Promotions (7 jours, quand l'administrateur valide),
-- d'après les statistiques du site ; l'ancien prix barré n'est montré que pour les vraies promotions ; la Vente flash disparaît d'elle-même après 24 h.
--
-- À lancer une fois dans Supabase › SQL Editor. Sans danger à relancer. Aucune nouvelle table : pas de « grant » de table à ajouter
-- (les fonctions sont réservées aux administrateurs ou au serveur).
--
-- ⚠️ ZARA NE MODIFIE JAMAIS LE PRIX D'UN ARTICLE (colonne « price ») : aucune fonction de ce script ne l'écrit. Elle choisit seulement quels articles
-- montrent leur ancien prix barré pendant 24 h (vente flash) ou 7 jours (promotion).
--
-- ⚠️ CE QUI CHANGE TOUT DE SUITE sur le site quand ce script est lancé :
--   - les anciens prix barrés disparaissent de tous les articles qui ne sont pas en Vente flash ou en promotion (ils sont mis de côté, PAS effacés) ;
--   - les ventes flash terminées (24 h passées) cessent d'être affichées ;
--   - la Vente flash automatique est ÉTEINTE : rien ne se lance seul tant que l'administrateur n'a pas touché l'interrupteur (Promotions intelligentes).
--   Pour tout remettre comme avant : voir la dernière section de ce fichier.
--
-- Ce que fait le script :
--   1. Colonnes : products.promo_ends_at (fin de la promotion), old_price_saved (l'ancien prix mis de côté), last_flash_at (dernière vente flash) ;
--                 store_settings.zara_auto_flash_enabled (interrupteur, éteint) et zara_auto_flash_last (dernier choix automatique, pour l'afficher).
--   2. zara_real_discount()          : une remise est « vraie » seulement entre 5 % et 60 % (au-delà, c'est une erreur de saisie).
--   3. zara_promotions_cleanup()     : toutes les 5 minutes : termine les ventes flash et promotions finies, et met de côté l'ancien prix des articles
--                                       qui ne sont plus en vente flash ni en promotion.
--   4. zara_promotion_rows()         : (interne) les chiffres de la semaine par article : vues, paniers, j'aime, ventes, stock.
--   5. zara_promotion_stats()        : les mêmes chiffres pour l'écran administrateur. Réservée aux administrateurs.
--   6. zara_set_flash()              : (interne) met des articles en vente flash (seulement en stock, avec une vraie remise).
--   7. zara_apply_promotions()       : publie le choix VALIDÉ par l'administrateur (Vente flash 24 h et Promotion 7 jours).
--   8. zara_auto_flash_run()         : toutes les 5 minutes : si l'interrupteur est allumé et qu'aucune vente flash n'est en cours, Zara choisit seule les
--                                       4 articles suivants (les plus demandés, avec du stock et une vraie remise, pas plus de 2 par rubrique, jamais
--                                       un article qui a eu une vente flash depuis moins de 3 jours). Rien si les visites ne suffisent pas.
--   9. zara_stop_promotions()        : arrête tout (vente flash, promotions ET Vente flash automatique). Réservée aux administrateurs.

-- 1. les colonnes
alter table public.products add column if not exists promo_ends_at timestamptz;
alter table public.products add column if not exists old_price_saved numeric;
alter table public.products add column if not exists last_flash_at timestamptz;
alter table public.store_settings add column if not exists zara_auto_flash_enabled boolean not null default false;
alter table public.store_settings add column if not exists zara_auto_flash_last jsonb;

-- 2. une remise est vraie entre 5 % et 60 % (renvoie le pourcentage arrondi, sinon null)
create or replace function public.zara_real_discount(p_price numeric, p_old numeric)
returns integer
language sql
immutable
as $$
  select case
    when p_price is null or p_old is null or p_price <= 0 or p_old <= p_price then null
    when (1 - p_price / p_old) between 0.05 and 0.60 then round((1 - p_price / p_old) * 100)::integer
    else null
  end
$$;

-- 3. le nettoyage automatique
create or replace function public.zara_promotions_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ended_flash integer := 0;
  ended_promo integer := 0;
  saved integer := 0;
begin
  -- la vente flash se termine toute seule (24 h passées, ou sans date de fin : ce n'est pas une vraie vente flash)
  update public.products set is_flash_sale = false, flash_sale_ends_at = null
   where is_flash_sale and (flash_sale_ends_at is null or flash_sale_ends_at <= now());
  get diagnostics ended_flash = row_count;

  -- la promotion de Zara se termine toute seule
  update public.products set promo_ends_at = null
   where promo_ends_at is not null and promo_ends_at <= now();
  get diagnostics ended_promo = row_count;

  -- l'ancien prix ne se montre que pendant une vente flash ou une promotion : sinon il est mis de côté (le prix de vente ne change pas)
  update public.products set old_price_saved = compare_at_price, compare_at_price = null
   where compare_at_price is not null and not is_flash_sale and promo_ends_at is null;
  get diagnostics saved = row_count;

  return jsonb_build_object('flash_ended', ended_flash, 'promo_ended', ended_promo, 'old_price_saved', saved);
end;
$$;
revoke all on function public.zara_promotions_cleanup() from public, anon, authenticated;
grant execute on function public.zara_promotions_cleanup() to service_role;

-- 4. (interne) les chiffres par article : vues et paniers sur p_days jours (1 à 30), ventes sur 30 jours (commandes non annulées, non « fausses »)
create or replace function public.zara_promotion_rows(p_days integer default 7)
returns table (
  id uuid, name text, slug text, image text, price numeric, old_price numeric, stock integer, category_id uuid,
  likes integer, views integer, carts integer, sold integer,
  flash_active boolean, promo_active boolean, flash_ends_at timestamptz, promo_ends_at timestamptz, last_flash_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.name, p.slug, p.images[1], p.price,
    coalesce(p.compare_at_price, p.old_price_saved),
    p.stock, p.category_id,
    coalesce(p.likes_count, 0),
    coalesce(v.n, 0), coalesce(c.n, 0), coalesce(s.n, 0),
    coalesce(p.is_flash_sale and p.flash_sale_ends_at > now(), false),
    coalesce(p.promo_ends_at is not null and p.promo_ends_at > now(), false),
    p.flash_sale_ends_at, p.promo_ends_at, p.last_flash_at
  from public.products p
  left join (
    select product_id::text as pid, count(*)::integer as n from public.product_views
    where viewed_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 30))) group by 1
  ) v on v.pid = p.id::text
  left join (
    select product_id::text as pid, count(*)::integer as n from public.cart_events
    where created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 30))) group by 1
  ) c on c.pid = p.id::text
  left join (
    select i ->> 'product_id' as pid, sum(greatest(1, coalesce((i ->> 'quantity')::numeric, 1)))::integer as n
    from public.orders o
    cross join lateral jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) as i
    where o.created_at >= now() - interval '30 days'
      and o.status <> 'cancelled'
      and coalesce((to_jsonb(o) ->> 'is_flagged_fake')::boolean, false) = false
      and i ->> 'product_id' is not null
    group by 1
  ) s on s.pid = p.id::text
  where p.is_active and p.stock > 0
$$;
revoke all on function public.zara_promotion_rows(integer) from public, anon, authenticated;
grant execute on function public.zara_promotion_rows(integer) to service_role;

-- 5. les mêmes chiffres pour l'écran administrateur
create or replace function public.zara_promotion_stats(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(r)) from public.zara_promotion_rows(p_days) r), '[]'::jsonb);
end;
$$;
revoke all on function public.zara_promotion_stats(integer) from public, anon;
grant execute on function public.zara_promotion_stats(integer) to authenticated;

-- 6. (interne) mettre des articles en vente flash pendant p_hours heures (1 à 72) : seulement en stock, actifs, avec une vraie remise. Le prix de vente n'est pas touché.
create or replace function public.zara_set_flash(p_ids uuid[], p_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hours integer := greatest(1, least(coalesce(p_hours, 24), 72));
  nf integer := 0;
  skipped jsonb := '[]'::jsonb;
  r record;
begin
  for r in
    select id, price, coalesce(old_price_saved, compare_at_price) as old, stock, is_active
    from public.products where id = any(coalesce(p_ids, '{}'))
  loop
    if not r.is_active or r.stock < 1 then
      skipped := skipped || jsonb_build_object('id', r.id, 'reason', 'indisponible');
    elsif public.zara_real_discount(r.price, r.old) is null then
      skipped := skipped || jsonb_build_object('id', r.id, 'reason', 'pas de vraie remise');
    else
      update public.products
         set is_flash_sale = true, flash_sale_ends_at = now() + make_interval(hours => hours), last_flash_at = now(),
             promo_ends_at = null, old_price_saved = r.old, compare_at_price = r.old
       where id = r.id;
      nf := nf + 1;
    end if;
  end loop;
  return jsonb_build_object('flash', nf, 'skipped', skipped);
end;
$$;
revoke all on function public.zara_set_flash(uuid[], integer) from public, anon, authenticated;
grant execute on function public.zara_set_flash(uuid[], integer) to service_role;

-- 7. publier le choix validé : Vente flash (p_flash_hours heures, 1 à 72) et Promotions (p_promo_days jours, 1 à 30)
create or replace function public.zara_apply_promotions(
  p_flash uuid[] default '{}',
  p_promo uuid[] default '{}',
  p_flash_hours integer default 24,
  p_promo_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  days integer := greatest(1, least(coalesce(p_promo_days, 7), 30));
  fl jsonb;
  np integer := 0;
  skipped jsonb := '[]'::jsonb;
  r record;
begin
  if not public.is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;

  -- les promotions de Zara qui ne sont pas reconduites se terminent maintenant
  update public.products set promo_ends_at = null
   where promo_ends_at is not null and not (id = any(coalesce(p_promo, '{}')));

  -- Vente flash
  fl := public.zara_set_flash(p_flash, p_flash_hours);
  skipped := coalesce(fl -> 'skipped', '[]'::jsonb);

  -- Promotions (un article déjà en vente flash reste en vente flash)
  for r in
    select id, price, coalesce(old_price_saved, compare_at_price) as old, stock, is_active,
           (is_flash_sale and flash_sale_ends_at > now()) as in_flash
    from public.products
    where id = any(coalesce(p_promo, '{}')) and not (id = any(coalesce(p_flash, '{}')))
  loop
    if not r.is_active or r.stock < 1 then
      skipped := skipped || jsonb_build_object('id', r.id, 'reason', 'indisponible');
    elsif r.in_flash then
      skipped := skipped || jsonb_build_object('id', r.id, 'reason', 'déjà en vente flash');
    elsif public.zara_real_discount(r.price, r.old) is null then
      skipped := skipped || jsonb_build_object('id', r.id, 'reason', 'pas de vraie remise');
    else
      update public.products
         set promo_ends_at = now() + make_interval(days => days), old_price_saved = r.old, compare_at_price = r.old
       where id = r.id;
      np := np + 1;
    end if;
  end loop;

  perform public.zara_promotions_cleanup();
  return jsonb_build_object('flash', (fl ->> 'flash')::integer, 'promo', np, 'skipped', skipped);
end;
$$;
revoke all on function public.zara_apply_promotions(uuid[], uuid[], integer, integer) from public, anon;
grant execute on function public.zara_apply_promotions(uuid[], uuid[], integer, integer) to authenticated;

-- 8. la Vente flash AUTOMATIQUE : toutes les 5 minutes. Mêmes règles que les propositions de Zara dans l'écran (src/lib/zaraPromoPicker.ts) :
--    intérêt = vues + 5 × paniers + j'aime (20 au plus) sur 7 jours ; au moins 5 ; stock d'au moins 5 ; vraie remise ; score = intérêt × (1 + remise (40 au plus) / 40) ;
--    2 articles au plus par rubrique ; pas un article déjà en promotion ni qui a eu une vente flash depuis moins de 3 jours.
create or replace function public.zara_auto_flash_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  picked uuid[];
  res jsonb;
  names jsonb;
begin
  perform public.zara_promotions_cleanup();

  if not coalesce((select zara_auto_flash_enabled from public.store_settings where id = 1), false) then
    return jsonb_build_object('skipped', 'off');
  end if;
  -- une vente flash est déjà en cours (celle de l'administrateur ou celle de Zara) : on attend sa fin
  if exists (select 1 from public.products where is_flash_sale and flash_sale_ends_at > now()) then
    return jsonb_build_object('skipped', 'en_cours');
  end if;

  select coalesce(array_agg(t.id order by t.score desc, t.stock desc, t.name), '{}'::uuid[]) into picked
  from (
    select q.id, q.name, q.stock, q.score
    from (
      select r.id, r.name, r.stock, r.score,
             row_number() over (partition by r.category_id order by r.score desc, r.stock desc, r.name) as rn
      from (
        select x.id, x.name, x.stock, x.category_id, x.price, x.old_price, x.flash_active, x.promo_active, x.last_flash_at,
               (x.views + 5 * x.carts + least(x.likes, 20)) as interest,
               (x.views + 5 * x.carts + least(x.likes, 20)) * (1 + least(coalesce(public.zara_real_discount(x.price, x.old_price), 0), 40) / 40.0) as score
        from public.zara_promotion_rows(7) x
      ) r
      where not r.flash_active and not r.promo_active
        and r.stock >= 5 and r.interest >= 5
        and public.zara_real_discount(r.price, r.old_price) is not null
        and (r.last_flash_at is null or r.last_flash_at < now() - interval '3 days')
    ) q
    where q.rn <= 2
    order by q.score desc, q.stock desc, q.name
    limit 4
  ) t;

  if cardinality(picked) = 0 then
    -- pas assez de visites ET de vraie remise : rien n'est choisi au hasard (on ne réécrit la note qu'une fois)
    update public.store_settings
       set zara_auto_flash_last = jsonb_build_object('at', now(), 'count', 0, 'note', 'pas assez de visites')
     where id = 1 and coalesce(zara_auto_flash_last ->> 'note', '') <> 'pas assez de visites';
    return jsonb_build_object('picked', 0);
  end if;

  res := public.zara_set_flash(picked, 24);
  select coalesce(jsonb_agg(p.name order by array_position(picked, p.id)), '[]'::jsonb) into names
    from public.products p where p.id = any(picked);
  update public.store_settings
     set zara_auto_flash_last = jsonb_build_object('at', now(), 'count', res -> 'flash', 'names', names)
   where id = 1;
  return res;
end;
$$;
revoke all on function public.zara_auto_flash_run() from public, anon, authenticated;
grant execute on function public.zara_auto_flash_run() to service_role;

-- 9. tout arrêter (administrateurs seulement) : plus de vente flash ni de promotion, les anciens prix sont mis de côté, et la Vente flash automatique est coupée
create or replace function public.zara_stop_promotions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  nf integer := 0;
  np integer := 0;
begin
  if not public.is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;
  update public.store_settings set zara_auto_flash_enabled = false where id = 1;
  update public.products set is_flash_sale = false, flash_sale_ends_at = null where is_flash_sale;
  get diagnostics nf = row_count;
  update public.products set promo_ends_at = null where promo_ends_at is not null;
  get diagnostics np = row_count;
  perform public.zara_promotions_cleanup();
  return jsonb_build_object('flash', nf, 'promo', np);
end;
$$;
revoke all on function public.zara_stop_promotions() from public, anon;
grant execute on function public.zara_stop_promotions() to authenticated;

-- le nettoyage et la Vente flash automatique toutes les 5 minutes (heure du serveur), puis un premier nettoyage tout de suite
select cron.unschedule('zara-promotions-cleanup') where exists (select 1 from cron.job where jobname = 'zara-promotions-cleanup');
select cron.schedule('zara-promotions-cleanup', '*/5 * * * *', 'select public.zara_promotions_cleanup()');
select cron.unschedule('zara-auto-flash') where exists (select 1 from cron.job where jobname = 'zara-auto-flash');
select cron.schedule('zara-auto-flash', '2-59/5 * * * *', 'select public.zara_auto_flash_run()');
select public.zara_promotions_cleanup();

-- POUR TOUT REMETTRE COMME AVANT (les anciens prix barrés réapparaissent sur tous les articles qui en avaient un) :
--   select cron.unschedule('zara-promotions-cleanup');
--   select cron.unschedule('zara-auto-flash');
--   update public.products set compare_at_price = old_price_saved where old_price_saved is not null and compare_at_price is null;
-- POUR COUPER SEULEMENT LA VENTE FLASH AUTOMATIQUE : l'interrupteur de la page Promotions intelligentes, ou
--   update public.store_settings set zara_auto_flash_enabled = false where id = 1;
