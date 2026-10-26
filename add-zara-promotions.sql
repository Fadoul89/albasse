-- Zara choisit les articles de la Vente flash et des Promotions d'après les statistiques du site ; l'ancien prix barré n'est montré que pour les vraies promotions ;
-- la Vente flash disparaît d'elle-même après 24 h.
--
-- À lancer une fois dans Supabase › SQL Editor. Sans danger à relancer. Aucune nouvelle table : pas de « grant » de table à ajouter
-- (les fonctions sont réservées aux administrateurs ou au serveur).
--
-- ⚠️ CE QUI CHANGE TOUT DE SUITE sur le site quand ce script est lancé :
--   - les anciens prix barrés disparaissent de tous les articles qui ne sont pas en Vente flash ou en promotion (ils sont mis de côté, PAS effacés) ;
--   - les ventes flash terminées (24 h passées) cessent d'être affichées.
--   Pour tout remettre comme avant : voir la dernière section de ce fichier.
--
-- Ce que fait le script :
--   1. Deux colonnes sur « products » : promo_ends_at (fin de la promotion de Zara) et old_price_saved (l'ancien prix mis de côté).
--   2. zara_real_discount()          : une remise est « vraie » seulement entre 5 % et 60 % (au-delà, c'est une erreur de saisie).
--   3. zara_promotions_cleanup()     : toutes les 5 minutes : termine les ventes flash et promotions finies, et met de côté l'ancien prix des articles
--                                       qui ne sont plus en vente flash ni en promotion. Elle ne touche JAMAIS à un prix de vente.
--   4. zara_promotion_stats()        : les chiffres de la semaine par article (vues, paniers, j'aime, ventes, stock). Réservée aux administrateurs.
--   5. zara_apply_promotions()       : publie le choix validé par l'administrateur (articles en Vente flash 24 h et en Promotion 7 jours).
--                                       Seuls les articles en stock avec une vraie remise sont acceptés. Aucun prix de vente n'est modifié.
--   6. zara_stop_promotions()        : arrête tout (bouton « Arrêter » de l'administrateur).

-- 1. les colonnes
alter table public.products add column if not exists promo_ends_at timestamptz;
alter table public.products add column if not exists old_price_saved numeric;

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

-- 4. les chiffres par article (administrateurs seulement) : vues et paniers sur p_days jours (1 à 30), ventes sur 30 jours (commandes non annulées, non « fausses »)
create or replace function public.zara_promotion_stats(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d integer := greatest(1, least(coalesce(p_days, 7), 30));
begin
  if not public.is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'slug', p.slug,
      'image', p.images[1],
      'price', p.price,
      'old_price', coalesce(p.compare_at_price, p.old_price_saved),
      'stock', p.stock,
      'category_id', p.category_id,
      'likes', coalesce(p.likes_count, 0),
      'views', coalesce(v.n, 0),
      'carts', coalesce(c.n, 0),
      'sold', coalesce(s.n, 0),
      'flash_active', (p.is_flash_sale and p.flash_sale_ends_at > now()),
      'promo_active', (p.promo_ends_at is not null and p.promo_ends_at > now()),
      'flash_ends_at', p.flash_sale_ends_at,
      'promo_ends_at', p.promo_ends_at
    ))
    from public.products p
    left join (
      select product_id::text as pid, count(*)::integer as n from public.product_views
      where viewed_at >= now() - make_interval(days => d) group by 1
    ) v on v.pid = p.id::text
    left join (
      select product_id::text as pid, count(*)::integer as n from public.cart_events
      where created_at >= now() - make_interval(days => d) group by 1
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
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.zara_promotion_stats(integer) from public, anon;
grant execute on function public.zara_promotion_stats(integer) to authenticated;

-- 5. publier le choix validé : Vente flash (p_flash_hours heures, 1 à 72) et Promotions (p_promo_days jours, 1 à 30)
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
  hours integer := greatest(1, least(coalesce(p_flash_hours, 24), 72));
  days integer := greatest(1, least(coalesce(p_promo_days, 7), 30));
  nf integer := 0;
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
  for r in
    select id, price, coalesce(old_price_saved, compare_at_price) as old, stock, is_active
    from public.products where id = any(coalesce(p_flash, '{}'))
  loop
    if not r.is_active or r.stock < 1 then
      skipped := skipped || jsonb_build_object('id', r.id, 'reason', 'indisponible');
    elsif public.zara_real_discount(r.price, r.old) is null then
      skipped := skipped || jsonb_build_object('id', r.id, 'reason', 'pas de vraie remise');
    else
      update public.products
         set is_flash_sale = true, flash_sale_ends_at = now() + make_interval(hours => hours),
             promo_ends_at = null, old_price_saved = r.old, compare_at_price = r.old
       where id = r.id;
      nf := nf + 1;
    end if;
  end loop;

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
  return jsonb_build_object('flash', nf, 'promo', np, 'skipped', skipped);
end;
$$;
revoke all on function public.zara_apply_promotions(uuid[], uuid[], integer, integer) from public, anon;
grant execute on function public.zara_apply_promotions(uuid[], uuid[], integer, integer) to authenticated;

-- 6. tout arrêter (administrateurs seulement) : plus de vente flash ni de promotion, les anciens prix sont mis de côté
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

-- le nettoyage toutes les 5 minutes (heure du serveur), puis une première fois tout de suite
select cron.unschedule('zara-promotions-cleanup') where exists (select 1 from cron.job where jobname = 'zara-promotions-cleanup');
select cron.schedule('zara-promotions-cleanup', '*/5 * * * *', 'select public.zara_promotions_cleanup()');
select public.zara_promotions_cleanup();

-- POUR TOUT REMETTRE COMME AVANT (les anciens prix barrés réapparaissent sur tous les articles qui en avaient un) :
--   select cron.unschedule('zara-promotions-cleanup');
--   update public.products set compare_at_price = old_price_saved where old_price_saved is not null and compare_at_price is null;
