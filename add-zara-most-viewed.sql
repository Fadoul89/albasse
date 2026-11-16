-- Zara + psychologie de la vente (demande du patron, 16 novembre 2026) : « 👀 Les plus regardés » et « Vu par N personnes (30 j) ».
-- Voir docs/zara-psychologie-vente.md. À lancer dans Supabase › SQL Editor. Relançable (aucun doublon, aucune donnée effacée).
--
-- La fonction ne renvoie que des TOTAUX par article : jamais un nom, un numéro, une adresse ni un identifiant de client.
-- Une personne = un compte, sinon le même navigateur (visitor_id gardé sur l'appareil), sinon la visite (session) :
-- quelqu'un qui revient 3 fois sur le même article ne compte qu'UNE fois. Les visites des administrateurs ne comptent pas.
-- Seulement les articles actifs, regardés par au moins 10 personnes (le site ne dit un chiffre qu'à partir de 50).

-- les visites sont lues par date : un index pour que le calcul reste rapide quand il y en aura beaucoup
create index if not exists product_views_viewed_idx on public.product_views (viewed_at);

create or replace function public.assistant_product_views(p_days integer default 30)
returns table (product_id text, visitors integer)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with seen as (
    select pv.product_id,
           coalesce(pv.user_id::text, vs.user_id::text, nullif(vs.visitor_id, ''), pv.session_id::text) as person,
           coalesce(pv.user_id, vs.user_id) as account
    from public.product_views pv
    left join public.visitor_sessions vs on vs.id = pv.session_id
    where pv.viewed_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 30)))
      and pv.product_id is not null
  )
  select s.product_id::text, count(distinct s.person)::integer as visitors
  from seen s
  join public.products p on p.id = s.product_id and p.is_active
  where s.person is not null
    and not exists (select 1 from public.profiles pr where pr.id = s.account and pr.is_admin)
  group by s.product_id
  having count(distinct s.person) >= 10
  order by 2 desc, 1
  limit 300
$$;

revoke all on function public.assistant_product_views(integer) from public;
grant execute on function public.assistant_product_views(integer) to anon, authenticated;
