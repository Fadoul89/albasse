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
--   • articles vus et clics « Commander » = ceux des visites de la période ; commandes et chiffre d'affaires = seulement les commandes LIVRÉES
--     et non fausses, créées dans la période ; conversion = commandes / visiteurs.
-- En plus : « vraies visites » (la personne reste 20 secondes ou plus, OU voit 2 pages ou plus, OU est connectée) par source et par campagne.
--
-- 21 novembre 2026 (le patron : « j'ai livré au moins 1 article, je vois 0 chiffre d'affaires ») :
--   • ventes rangées selon la PREMIÈRE visite connue du client (orders_first / revenue_first) : il voit TikTok, revient 2 jours après et commande
--     → la vente compte pour TikTok. L'ancien rangement (la visite où il a commandé) reste : orders / revenue ;
--   • la visite de la commande compte même si elle a commencé juste avant la période (avant : la vente disparaissait) ;
--   • les commandes livrées sans visite connue (commande WhatsApp ajoutée à la main…) : « unattributed » (avant : elles ne comptaient nulle part) ;
--   • le panier n'existe plus : cart_events = les clics « Commander », sur le site (channel = 'site') ou sur WhatsApp (channel = 'whatsapp') ;
--   • « D'où viennent les visiteurs Autre ? » : le site garde le NOM du site d'où vient le visiteur (referrer_host, jamais l'adresse complète)
--     et le utm_source du lien : other_hosts.
--
-- À lancer dans Supabase › SQL Editor. Sans danger si on le relance. Ajoute 3 colonnes vides à des tables qui existent déjà (visitor_sessions,
-- cart_events : leurs droits ne changent pas) et remplace la fonction de lecture. Rien n'est supprimé.

alter table public.visitor_sessions add column if not exists referrer_host text;
alter table public.visitor_sessions add column if not exists utm_source text;
alter table public.cart_events add column if not exists channel text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'visitor_sessions_referrer_host_len') then
    alter table public.visitor_sessions add constraint visitor_sessions_referrer_host_len check (referrer_host is null or char_length(referrer_host) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visitor_sessions_utm_source_len') then
    alter table public.visitor_sessions add constraint visitor_sessions_utm_source_len check (utm_source is null or char_length(utm_source) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cart_events_channel_check') then
    alter table public.cart_events add constraint cart_events_channel_check check (channel is null or channel in ('site', 'whatsapp'));
  end if;
end $$;

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
      referrer_host,
      utm_source,
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
  -- les clics « Commander » (le panier n'existe plus) : sur le site, sur WhatsApp, et ceux d'avant la mise à jour (channel vide)
  ca as (
    select s.source, count(*) as n,
      count(*) filter (where c.channel = 'site') as n_site,
      count(*) filter (where c.channel = 'whatsapp') as n_whatsapp
    from public.cart_events c join s on s.id = c.session_id
    group by s.source
  ),
  -- les commandes livrées et non fausses créées dans la période, avec la visite où elles ont été passées (même commencée avant la période)
  dord as (
    select o.id, o.total, o.user_id, o.session_id, o.created_at,
      os.id is not null as has_session,
      os.visitor_id as os_visitor,
      coalesce(os.referrer_source, 'Autre') as order_source
    from public.orders o
    left join public.visitor_sessions os on os.id = o.session_id
    where o.status = 'delivered' and not coalesce(o.is_flagged_fake, false)
      and o.created_at >= p_since and o.created_at <= p_until
  ),
  -- la source de la PREMIÈRE visite connue du client avant sa commande : par son visiteur (visitor_id de la visite de la commande),
  -- par son compte, ou la visite de la commande elle-même. Aucune visite : null (« sans visite connue »).
  dfirst as (
    select d.*,
      (
        select coalesce(f.referrer_source, 'Autre')
        from (
          select v.started_at, v.referrer_source from public.visitor_sessions v where v.id = d.session_id
          union all
          select v.started_at, v.referrer_source from public.visitor_sessions v
            where d.os_visitor is not null and v.visitor_id = d.os_visitor and v.started_at <= d.created_at
          union all
          select v.started_at, v.referrer_source from public.visitor_sessions v
            where d.user_id is not null and v.user_id = d.user_id and v.started_at <= d.created_at
        ) f
        order by f.started_at
        limit 1
      ) as first_source
    from dord d
  ),
  od as (
    select order_source as source, count(*) as n, coalesce(sum(total), 0) as revenue
    from dord where has_session
    group by order_source
  ),
  odf as (
    select first_source as source, count(*) as n, coalesce(sum(total), 0) as revenue
    from dfirst where first_source is not null
    group by first_source
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
  -- toutes les sources de la période : celles qui ont des visites, et celles qui ont des ventes (première visite avant la période, par exemple)
  allsrc as (
    select source from src union select source from od union select source from odf
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
  ),
  -- « D'où viennent les visiteurs Autre ? » : le nom du site d'où ils viennent, sinon le utm_source du lien ; vide = inconnu (visites d'avant)
  oh as (
    select coalesce(s.referrer_host, case when s.utm_source is not null then 'utm : ' || s.utm_source end) as label,
      count(distinct s.vkey) as visitors,
      count(*) as sessions
    from s
    where s.source = 'Autre'
    group by 1
    order by count(distinct s.vkey) desc, 1 nulls last
    limit 12
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
        'source', a.source,
        'sessions', coalesce(src.sessions, 0),
        'visitors', coalesce(src.visitors, 0),
        'new_visitors', coalesce(src.new_visitors, 0),
        'avg_time_seconds', case when coalesce(src.sessions, 0) > 0 then round(src.total_duration::numeric / src.sessions) else 0 end,
        'pages_viewed', coalesce(src.pages_viewed, 0),
        'product_views', coalesce(pv.n, 0),
        'cart_adds', coalesce(ca.n, 0),
        'checkout_site', coalesce(ca.n_site, 0),
        'checkout_whatsapp', coalesce(ca.n_whatsapp, 0),
        'orders', coalesce(od.n, 0),
        'revenue', coalesce(od.revenue, 0),
        'orders_first', coalesce(odf.n, 0),
        'revenue_first', coalesce(odf.revenue, 0),
        'real_sessions', coalesce(src.real_sessions, 0),
        'real_visitors', coalesce(src.real_visitors, 0)
      ) order by coalesce(src.sessions, 0) desc, a.source)
      from allsrc a
      left join src on src.source = a.source
      left join pv on pv.source = a.source
      left join ca on ca.source = a.source
      left join od on od.source = a.source
      left join odf on odf.source = a.source
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
    ), '[]'::jsonb),
    'unattributed', jsonb_build_object(
      'orders', (select count(*) from dord where not has_session),
      'revenue', (select coalesce(sum(total), 0) from dord where not has_session),
      'orders_first', (select count(*) from dfirst where first_source is null),
      'revenue_first', (select coalesce(sum(total), 0) from dfirst where first_source is null)
    ),
    'other_hosts', coalesce((
      select jsonb_agg(jsonb_build_object('label', oh.label, 'visitors', oh.visitors, 'sessions', oh.sessions)
        order by oh.visitors desc, oh.label nulls last)
      from oh
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_source_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_source_report(timestamptz, timestamptz) to authenticated;
