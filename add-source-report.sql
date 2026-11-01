-- Page Admin › « Performance par source » : comptes exacts faits par la base (plus de limite de 1 000 lignes) + « vraies visites ».
--
-- Problème : la page lisait les visites une par une, et la base ne renvoie que 1 000 lignes par demande. Sur 7 jours (plus de 10 000 visites) ou
-- 30 jours (plus de 16 000), les visiteurs, les temps moyens, les pages vues et les campagnes étaient calculés sur 1 000 visites seulement. Les articles
-- vus et les paniers demandaient en plus des milliers d'identifiants dans une seule adresse : ils tombaient en erreur et restaient à zéro.
--
-- Solution : une fonction qui compte DANS la base, réservée aux administrateurs : admin_source_report(depuis, jusqu'à).
-- Même règles que l'ancien calcul de la page :
--   • visiteur = visitor_id, sinon le compte connecté, sinon la visite elle-même ; source vide = « Autre » ;
--   • nouveau visiteur = sa toute première visite (depuis toujours) tombe dans la période ; revenant = les autres ;
--   • temps moyen = temps total / nombre de visites ; pages vues = total des pages ;
--   • articles vus et paniers = ceux des visites de la période ; commandes et chiffre d'affaires = seulement les commandes LIVRÉES et non fausses,
--     créées dans la période ; conversion = commandes / visiteurs.
-- En plus : « vraies visites » (la personne reste 20 secondes ou plus, OU voit 2 pages ou plus, OU est connectée) par source et par campagne.
--
-- À lancer UNE FOIS dans Supabase › SQL Editor. Sans danger si on le relance. Aucune table, rien n'est modifié ni supprimé : une seule fonction de lecture.

create or replace function public.admin_source_report(p_since timestamptz, p_until timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Non autorise';
  end if;

  with s as (
    select
      id,
      coalesce(visitor_id::text, user_id::text, id::text) as vkey,
      coalesce(referrer_source, 'Autre') as source,
      utm_medium,
      utm_campaign,
      started_at,
      coalesce(duration_seconds, 0) as dur,
      coalesce(page_views, 1) as pages,
      (coalesce(duration_seconds, 0) >= 20 or coalesce(page_views, 1) >= 2 or user_id is not null) as is_real
    from public.visitor_sessions
    where started_at >= p_since and started_at <= p_until
  ),
  -- la toute première visite de chaque visiteur de la période (depuis toujours)
  first_seen as (
    select coalesce(v.visitor_id::text, v.user_id::text, v.id::text) as vkey, min(v.started_at) as first_at
    from public.visitor_sessions v
    where coalesce(v.visitor_id::text, v.user_id::text, v.id::text) in (select vkey from s)
    group by 1
  ),
  sj as (
    select s.*, fs.first_at from s left join first_seen fs on fs.vkey = s.vkey
  ),
  pv as (
    select s.source, count(*) as n
    from public.product_views v join s on s.id = v.session_id
    group by s.source
  ),
  ca as (
    select s.source, count(*) as n
    from public.cart_events c join s on s.id = c.session_id
    group by s.source
  ),
  od as (
    select s.source, count(*) as n, coalesce(sum(o.total), 0) as revenue
    from public.orders o join s on s.id = o.session_id
    where o.status = 'delivered' and not coalesce(o.is_flagged_fake, false)
      and o.created_at >= p_since and o.created_at <= p_until
    group by s.source
  ),
  src as (
    select
      source,
      count(*) as sessions,
      count(distinct vkey) as visitors,
      count(distinct vkey) filter (where first_at >= p_since and first_at <= p_until) as new_visitors,
      sum(dur) as total_duration,
      sum(pages) as pages_viewed,
      count(*) filter (where is_real) as real_sessions,
      count(distinct vkey) filter (where is_real) as real_visitors
    from sj
    group by source
  ),
  -- orders par campagne : les commandes livrées de la période dont la visite porte cette campagne
  cod as (
    select s.utm_campaign as campaign, count(*) as n, coalesce(sum(o.total), 0) as revenue
    from public.orders o join s on s.id = o.session_id
    where s.utm_campaign is not null
      and o.status = 'delivered' and not coalesce(o.is_flagged_fake, false)
      and o.created_at >= p_since and o.created_at <= p_until
    group by s.utm_campaign
  ),
  camp as (
    select
      s.utm_campaign as campaign,
      (array_agg(s.utm_medium order by s.started_at) filter (where s.utm_medium is not null))[1] as medium,
      (array_agg(s.source order by s.started_at))[1] as source,
      count(*) as sessions,
      count(distinct s.vkey) as visitors,
      count(*) filter (where s.is_real) as real_sessions,
      count(distinct s.vkey) filter (where s.is_real) as real_visitors,
      coalesce(max(cod.n), 0) as orders,
      coalesce(max(cod.revenue), 0) as revenue
    from s left join cod on cod.campaign = s.utm_campaign
    where s.utm_campaign is not null
    group by s.utm_campaign
    order by coalesce(max(cod.revenue), 0) desc, count(distinct s.vkey) desc, s.utm_campaign
    limit 200
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'sessions', (select count(*) from s),
      'visitors', (select count(distinct vkey) from s),
      'real_sessions', (select count(*) from s where is_real),
      'real_visitors', (select count(distinct vkey) from s where is_real)
    ),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', src.source,
        'sessions', src.sessions,
        'visitors', src.visitors,
        'new_visitors', src.new_visitors,
        'avg_time_seconds', case when src.sessions > 0 then round(src.total_duration::numeric / src.sessions) else 0 end,
        'pages_viewed', src.pages_viewed,
        'product_views', coalesce(pv.n, 0),
        'cart_adds', coalesce(ca.n, 0),
        'orders', coalesce(od.n, 0),
        'revenue', coalesce(od.revenue, 0),
        'real_sessions', src.real_sessions,
        'real_visitors', src.real_visitors
      ) order by src.sessions desc, src.source)
      from src
      left join pv on pv.source = src.source
      left join ca on ca.source = src.source
      left join od on od.source = src.source
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'campaign', camp.campaign,
        'medium', camp.medium,
        'source', camp.source,
        'sessions', camp.sessions,
        'visitors', camp.visitors,
        'real_sessions', camp.real_sessions,
        'real_visitors', camp.real_visitors,
        'orders', camp.orders,
        'revenue', camp.revenue
      ) order by camp.revenue desc, camp.visitors desc, camp.campaign)
      from camp
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_source_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_source_report(timestamptz, timestamptz) to authenticated;
