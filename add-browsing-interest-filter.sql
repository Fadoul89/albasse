-- Suivi de navigation : la liste « Détail : qui regarde quoi » peut maintenant montrer TOUTES les lignes d'un niveau d'intérêt.
--
-- Problème : la fonction browsing_overview ne renvoie que les 300 regards les plus récents (sur près de 3 000 par mois), et l'écran filtrait ces
-- 300 lignes. Les tuiles disaient « Intérêt élevé : 141 » mais la liste « Élevé » n'en montrait que 5.
--
-- Correction : un 3e paramètre facultatif, p_interest (« eleve », « moyen » ou « leger »). Il ne change QUE la liste « rows » : les tuiles
-- (levels, totals) et les classements (top_products, top_categories, top_searches) restent calculés sur toutes les lignes de la période.
-- Sans p_interest (ou avec une valeur inconnue) : exactement comme avant. Le plafond reste de 1 000 lignes au plus.
--
-- La fonction à 2 paramètres est remplacée par celle à 3 paramètres (les deux ensemble rendraient l'appel par noms ambigu pour PostgREST) ;
-- les appels d'avant (p_since, p_limit) marchent toujours, grâce à la valeur par défaut. Réservé aux administrateurs, comme avant.
-- Sans danger à relancer.
--
-- Pour annuler : relancer la fin de add-browsing-intelligence.sql (fonction à 2 paramètres) après
--   drop function if exists public.browsing_overview(timestamptz, integer, text);

create or replace function public.browsing_overview(p_since timestamptz default null, p_limit integer default 300, p_interest text default null) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since timestamptz := coalesce(p_since, '-infinity'::timestamptz);
  lim integer := greatest(1, least(coalesce(p_limit, 300), 1000));
  wanted text := case when p_interest in ('leger', 'moyen', 'eleve') then p_interest end;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(r order by r.last_viewed_at desc nulls last)
      from (
        select
          'V-' || left(md5(t.visitor_id), 6) as visitor_ref,
          case when t.user_id is not null then 'C-' || left(t.user_id::text, 8) end as account_ref,
          t.session_id,
          t.product_id,
          t.product_name,
          t.category_name,
          t.views,
          t.sessions,
          t.active_seconds,
          t.last_duration_seconds,
          t.last_viewed_at,
          t.image_clicks + t.size_clicks + t.color_clicks as variant_clicks,
          t.cart_status,
          -- statut de la commande du client connecté pour cet article, s'il en a passé une
          case when t.user_id is not null then (
            select o.status from public.orders o
            where o.user_id = t.user_id and o.items @> jsonb_build_array(jsonb_build_object('product_id', t.product_id))
            order by o.created_at desc limit 1
          ) end as order_status,
          t.interest,
          t.last_suggestion_kind,
          t.last_suggestion_at
        from public.visitor_product_interest t
        where coalesce(t.last_viewed_at, t.updated_at) >= since
          and (wanted is null or t.interest = wanted)
        order by t.last_viewed_at desc nulls last
        limit lim
      ) r
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(x order by x.views desc, x.active_seconds desc)
      from (
        select product_id, max(product_name) as product_name, max(category_name) as category_name,
               sum(views)::integer as views, sum(active_seconds)::integer as active_seconds, count(*)::integer as visitors,
               count(*) filter (where interest = 'eleve')::integer as high_interest
        from public.visitor_product_interest
        where coalesce(last_viewed_at, updated_at) >= since
        group by product_id
        order by sum(views) desc, sum(active_seconds) desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'top_categories', coalesce((
      select jsonb_agg(x order by x.views desc)
      from (
        select coalesce(max(category_name), category_slug) as category, sum(views)::integer as views, count(distinct visitor_id)::integer as visitors
        from public.visitor_product_interest
        where category_slug is not null and coalesce(last_viewed_at, updated_at) >= since
        group by category_slug
        order by sum(views) desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'top_searches', coalesce((
      select jsonb_agg(x order by x.n desc)
      from (
        select query, count(*)::integer as n
        from public.browsing_searches
        where searched_at >= since
        group by query
        order by count(*) desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'levels', coalesce((
      select jsonb_object_agg(interest, n)
      from (
        select interest, count(*)::integer as n
        from public.visitor_product_interest
        where coalesce(last_viewed_at, updated_at) >= since
        group by interest
      ) x
    ), '{}'::jsonb),
    'totals', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from public.visitor_product_interest where coalesce(last_viewed_at, updated_at) >= since),
      'rows', (select count(*) from public.visitor_product_interest where coalesce(last_viewed_at, updated_at) >= since)
    )
  );
end;
$$;

revoke all on function public.browsing_overview(timestamptz, integer, text) from public;
revoke all on function public.browsing_overview(timestamptz, integer, text) from anon;
grant execute on function public.browsing_overview(timestamptz, integer, text) to authenticated;

-- l'ancienne fonction à 2 paramètres est remplacée (sinon l'appel par noms « p_since, p_limit » serait ambigu)
drop function if exists public.browsing_overview(timestamptz, integer);
