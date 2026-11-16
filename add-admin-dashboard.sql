-- Tableau de bord « couleur hacker » (demande du patron, 16 novembre 2026) : tous les chiffres en UNE lecture, comptés dans la base.
-- Voir docs/tableau-de-bord-hacker.md. À lancer dans Supabase › SQL Editor. Relançable (aucune table créée, aucune donnée changée).
--
-- Réservé aux administrateurs (public.is_admin() : admin ET, s'il l'a activée, double vérification faite). Pour tout autre appel : refus.
-- Renvoie seulement des TOTAUX (nombres de visiteurs, de clients, de commandes ; noms des articles, qui sont publics) : aucun client nommé.
-- Un visiteur = un compte, sinon le même navigateur (visitor_id), sinon la visite. Les visites des administrateurs ne comptent pas.
-- Périodes : 'today' (depuis minuit à N'Djamena), '7d', '30d', 'all'. La période d'avant a la même durée (aujourd'hui : hier à la même heure).

create or replace function public.admin_dashboard_overview(p_period text default '30d')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := now();
  v_today timestamptz := date_trunc('day', now() at time zone 'Africa/Ndjamena') at time zone 'Africa/Ndjamena';
  v_period text := case when p_period in ('today', '7d', '30d', 'all') then p_period else '30d' end;
  v_since timestamptz;
  v_len interval;
  v_week0 timestamptz := date_trunc('week', now() at time zone 'Africa/Ndjamena') at time zone 'Africa/Ndjamena';
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Non autorise' using errcode = '42501';
  end if;

  case v_period
    when 'today' then v_since := v_today; v_len := interval '1 day';
    when '7d' then v_since := v_now - interval '7 days'; v_len := interval '7 days';
    when 'all' then v_since := '-infinity'::timestamptz; v_len := null;
    else v_since := v_now - interval '30 days'; v_len := interval '30 days';
  end case;

  with sess as (
    select vs.id, vs.started_at, coalesce(vs.referrer_source, 'Inconnue') as source,
           coalesce(vs.user_id::text, nullif(vs.visitor_id, ''), vs.id::text) as person
    from public.visitor_sessions vs
    where not exists (select 1 from public.profiles pr where pr.id = vs.user_id and pr.is_admin)
  ),
  orders_ok as (
    select o.created_at, o.status, o.total
    from public.orders o
    where o.status <> 'cancelled' and not coalesce(o.is_flagged_fake, false)
  ),
  clients as (
    select p.created_at from public.profiles p where not p.is_admin
  ),
  weeks as (
    select g.w as week_start,
           (select count(distinct s.person) from sess s where s.started_at >= g.w and s.started_at < g.w + interval '7 days') as visitors
    from generate_series(v_week0 - interval '11 weeks', v_week0, interval '1 week') as g(w)
  ),
  src as (
    select s.source, count(distinct s.person) as visitors
    from sess s where s.started_at >= v_since
    group by s.source order by 2 desc, 1 limit 6
  ),
  seen as (
    select pv.product_id, coalesce(pv.user_id::text, vs.user_id::text, nullif(vs.visitor_id, ''), pv.session_id::text) as person,
           coalesce(pv.user_id, vs.user_id) as account
    from public.product_views pv
    left join public.visitor_sessions vs on vs.id = pv.session_id
    where pv.viewed_at >= v_since and pv.product_id is not null
  ),
  top as (
    select p.id, p.name, count(distinct s.person) as visitors
    from seen s
    join public.products p on p.id = s.product_id and p.is_active
    where s.person is not null
      and not exists (select 1 from public.profiles pr where pr.id = s.account and pr.is_admin)
    group by p.id, p.name order by 3 desc, 2 limit 5
  )
  select jsonb_build_object(
    'period', v_period,
    'since', case when v_period = 'all' then null else v_since end,
    'visitors', (select count(distinct person) from sess where started_at >= v_since),
    'visitors_prev', case when v_len is null then null else (select count(distinct person) from sess where started_at >= v_since - v_len and started_at < v_now - v_len) end,
    'new_customers', (select count(*) from clients where created_at >= v_since),
    'new_customers_prev', case when v_len is null then null else (select count(*) from clients where created_at >= v_since - v_len and created_at < v_now - v_len) end,
    'orders', (select count(*) from orders_ok where created_at >= v_since),
    'orders_prev', case when v_len is null then null else (select count(*) from orders_ok where created_at >= v_since - v_len and created_at < v_now - v_len) end,
    'revenue', (select coalesce(sum(total), 0) from orders_ok where status = 'delivered' and created_at >= v_since),
    'products', (select count(*) from public.products where is_active),
    'categories', (select count(distinct coalesce(c.parent_id, c.id)) from public.products p join public.categories c on c.id = p.category_id where p.is_active),
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object('week', to_char(week_start at time zone 'Africa/Ndjamena', 'YYYY-MM-DD'), 'visitors', visitors) order by week_start), '[]'::jsonb) from weeks),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'visitors', visitors) order by visitors desc, source), '[]'::jsonb) from src),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('product_id', id, 'name', name, 'visitors', visitors) order by visitors desc, name), '[]'::jsonb) from top)
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_dashboard_overview(text) from public;
revoke all on function public.admin_dashboard_overview(text) from anon;
grant execute on function public.admin_dashboard_overview(text) to authenticated;
