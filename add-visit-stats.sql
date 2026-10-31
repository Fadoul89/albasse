-- Vrais chiffres des visites + « vraies visites » (tableau de bord et Admin › Clients).
--
-- Problème : le tableau de bord et Admin › Clients lisaient les visites ligne par ligne, et la base ne renvoie que 1 000 lignes par demande.
-- Avec plus de 1 000 visites par jour, « Visiteurs aujourd'hui » se bloquait (900 au lieu de 1 618), et les statistiques de chaque client
-- (visites, durée, articles regardés) étaient fausses aussi. De plus, « Produits les plus consultés » lisait une colonne qui n'existe pas
-- (product_views.created_at ; la vraie s'appelle viewed_at) : la liste restait vide.
--
-- Solution : deux fonctions qui comptent DANS la base (comptes exacts, quelle que soit la taille), réservées aux administrateurs :
--   • admin_visit_overview(depuis, jusqu'à) : visites et visiteurs, « vraies visites », détail par source et par campagne, articles les plus vus.
--   • admin_customer_activity()            : pour chaque client connecté, ses visites, sa durée, ses articles vus, ses ajouts, sa source principale.
-- « Vraie visite » = la personne est restée 20 secondes ou plus, OU a vu 2 pages ou plus, OU est connectée. Les clics qui repartent tout de suite
-- (par erreur, ou venus de pubs mal ciblées) comptent dans « Visites » mais pas dans « Vraies visites ».
--
-- À lancer UNE FOIS dans Supabase › SQL Editor. Sans danger si on le relance. Aucune table créée, rien n'est modifié ni supprimé :
-- seulement deux fonctions de lecture. Aucun « grant » de table à ajouter ; chaque fonction vérifie elle-même que l'appelant est administrateur.

create or replace function public.admin_visit_overview(p_since timestamptz, p_until timestamptz default null)
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
      coalesce(visitor_id, id::text) as vkey,
      coalesce(referrer_source, 'Inconnue') as source,
      utm_medium,
      utm_campaign,
      (duration_seconds >= 20 or coalesce(page_views, 1) >= 2 or user_id is not null) as is_real
    from public.visitor_sessions
    where started_at >= p_since and (p_until is null or started_at < p_until)
  ),
  src as (
    select
      source,
      count(*) as sessions,
      count(distinct vkey) as visitors,
      count(*) filter (where is_real) as real_sessions,
      count(distinct vkey) filter (where is_real) as real_visitors
    from s
    group by source
  ),
  pv as (
    select s.source, count(*) as n
    from public.product_views v
    join s on s.id = v.session_id
    group by s.source
  ),
  ca as (
    select s.source, count(*) as n
    from public.cart_events c
    join s on s.id = c.session_id
    group by s.source
  ),
  od as (
    select s.source, count(*) as n, coalesce(sum(o.total), 0) as revenue
    from public.orders o
    join s on s.id = o.session_id
    where o.status = 'delivered' and not coalesce(o.is_flagged_fake, false)
    group by s.source
  ),
  camp as (
    select
      source,
      coalesce(utm_medium, '-') as medium,
      utm_campaign as campaign,
      count(*) as sessions,
      count(*) filter (where is_real) as real_sessions
    from s
    where utm_campaign is not null
    group by source, coalesce(utm_medium, '-'), utm_campaign
    order by count(*) desc, utm_campaign
    limit 20
  ),
  top_p as (
    select product_id, count(*) as views
    from public.product_views
    where viewed_at >= p_since and (p_until is null or viewed_at < p_until) and product_id is not null
    group by product_id
    order by count(*) desc, product_id
    limit 5
  )
  select jsonb_build_object(
    'sessions', (select count(*) from s),
    'visitors', (select count(distinct vkey) from s),
    'real_sessions', (select count(*) from s where is_real),
    'real_visitors', (select count(distinct vkey) from s where is_real),
    'by_source', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', src.source,
        'sessions', src.sessions,
        'visitors', src.visitors,
        'real_sessions', src.real_sessions,
        'real_visitors', src.real_visitors,
        'product_views', coalesce(pv.n, 0),
        'cart_adds', coalesce(ca.n, 0),
        'orders', coalesce(od.n, 0),
        'revenue', coalesce(od.revenue, 0)
      ) order by src.sessions desc, src.source)
      from src
      left join pv on pv.source = src.source
      left join ca on ca.source = src.source
      left join od on od.source = src.source
    ), '[]'::jsonb),
    'by_campaign', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', camp.source,
        'medium', camp.medium,
        'campaign', camp.campaign,
        'sessions', camp.sessions,
        'real_sessions', camp.real_sessions
      ) order by camp.sessions desc, camp.campaign)
      from camp
    ), '[]'::jsonb),
    'top_viewed', coalesce((
      select jsonb_agg(jsonb_build_object('product_id', top_p.product_id, 'views', top_p.views) order by top_p.views desc, top_p.product_id)
      from top_p
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_visit_overview(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_visit_overview(timestamptz, timestamptz) to authenticated;

create or replace function public.admin_customer_activity()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Non autorise';
  end if;

  return coalesce((
    with sess as (
      select
        user_id,
        count(*) as sessions,
        coalesce(sum(duration_seconds), 0) as duration_seconds,
        max(last_seen_at) as last_seen_at
      from public.visitor_sessions
      where user_id is not null
      group by user_id
    ),
    src as (
      select distinct on (user_id) user_id, referrer_source
      from (
        select user_id, referrer_source, count(*) as n
        from public.visitor_sessions
        where user_id is not null and referrer_source is not null
        group by user_id, referrer_source
      ) t
      order by user_id, n desc, referrer_source
    ),
    pv as (
      select user_id, count(*) as n from public.product_views where user_id is not null group by user_id
    ),
    ca as (
      select user_id, count(*) as n from public.cart_events where user_id is not null group by user_id
    ),
    ids as (
      select user_id from sess
      union select user_id from pv
      union select user_id from ca
    )
    select jsonb_agg(jsonb_build_object(
      'user_id', ids.user_id,
      'sessions', coalesce(sess.sessions, 0),
      'duration_seconds', coalesce(sess.duration_seconds, 0),
      'last_seen_at', sess.last_seen_at,
      'top_source', src.referrer_source,
      'views', coalesce(pv.n, 0),
      'cart_adds', coalesce(ca.n, 0)
    ))
    from ids
    left join sess on sess.user_id = ids.user_id
    left join src on src.user_id = ids.user_id
    left join pv on pv.user_id = ids.user_id
    left join ca on ca.user_id = ids.user_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_customer_activity() from public, anon;
grant execute on function public.admin_customer_activity() to authenticated;
