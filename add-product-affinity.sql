-- BROUILLON : Zara « Mots qui vendent » — le VRAI « X % des clients ont aussi acheté ceci ». PAS ENCORE APPLIQUÉ à la vraie base.
--
-- Une seule fonction : public.product_affinity(p_product_id)
-- Pour un article, elle donne SEULEMENT des totaux (jamais un nom, un numéro, une adresse ni un identifiant de client) :
--   customers    : combien de clients différents ont acheté cet article (commandes non annulées et non « fausses »)
--   bought_with  : les autres articles que ces mêmes clients ont achetés, avec le nombre de clients (les 5 premiers)
--   viewers      : combien de visiteurs différents ont regardé cet article (90 derniers jours)
--   viewed_with  : les autres articles que ces mêmes visiteurs ont regardés, avec le nombre de visiteurs (les 5 premiers)
-- Le pourcentage n'est PAS calculé ici : le site le calcule lui-même avec ces vrais nombres, et ne le dit à Zara que si les
-- chiffres sont assez solides (au moins 5 clients, 2 achats en commun, 20 % — voir src/lib/assistantWords.ts).
--
-- Un « client » = un compte connecté, ou, pour une commande sans compte, le numéro de téléphone de livraison.
--
-- À appliquer dans Supabase > SQL Editor (le script peut être relancé sans danger).
-- Tant qu'il n'est pas appliqué, le site marche comme avant : Zara ne dit AUCUN pourcentage.
--
-- Pour annuler (tout supprimer) :
--   drop function if exists public.product_affinity(text);

create or replace function public.product_affinity(p_product_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id text := nullif(btrim(coalesce(p_product_id, '')), '');
  v_customers integer := 0;
  v_bought jsonb := '[]'::jsonb;
  v_viewers integer := 0;
  v_viewed jsonb := '[]'::jsonb;
begin
  if v_id is null then
    return jsonb_build_object('customers', 0, 'bought_with', '[]'::jsonb, 'viewers', 0, 'viewed_with', '[]'::jsonb);
  end if;

  -- 1. Les achats : un client compte une seule fois par article, même s'il l'a commandé plusieurs fois
  with lines as (
    select distinct
      coalesce(o.user_id::text, 'tel:' || nullif(regexp_replace(coalesce(o.shipping_phone, ''), '[^0-9]', '', 'g'), '')) as customer,
      i ->> 'product_id' as product_id
    from public.orders o
    cross join lateral jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) as i
    where o.status <> 'cancelled'
      and coalesce((to_jsonb(o) ->> 'is_flagged_fake')::boolean, false) = false
      and o.created_at >= now() - interval '365 days'
      and i ->> 'product_id' is not null
  ),
  buyers as (
    select customer from lines where product_id = v_id and customer is not null
  ),
  together as (
    select l.product_id, count(distinct l.customer)::integer as n
    from lines l
    join buyers b on b.customer = l.customer
    where l.product_id <> v_id
    group by l.product_id
    order by n desc, l.product_id
    limit 5
  )
  select
    (select count(*)::integer from buyers),
    coalesce((select jsonb_agg(jsonb_build_object('product_id', product_id, 'n', n) order by n desc, product_id) from together), '[]'::jsonb)
  into v_customers, v_bought;

  -- 2. La navigation : un visiteur compte une seule fois par article
  with seen as (
    select distinct visitor_id, product_id
    from public.visitor_product_interest
    where views > 0
      and visitor_id is not null
      and coalesce(last_viewed_at, first_viewed_at) >= now() - interval '90 days'
  ),
  watchers as (
    select visitor_id from seen where product_id = v_id
  ),
  together as (
    select s.product_id, count(distinct s.visitor_id)::integer as n
    from seen s
    join watchers w on w.visitor_id = s.visitor_id
    where s.product_id <> v_id
    group by s.product_id
    order by n desc, s.product_id
    limit 5
  )
  select
    (select count(*)::integer from watchers),
    coalesce((select jsonb_agg(jsonb_build_object('product_id', product_id, 'n', n) order by n desc, product_id) from together), '[]'::jsonb)
  into v_viewers, v_viewed;

  return jsonb_build_object('customers', v_customers, 'bought_with', v_bought, 'viewers', v_viewers, 'viewed_with', v_viewed);
end;
$$;

revoke all on function public.product_affinity(text) from public;
grant execute on function public.product_affinity(text) to anon, authenticated;
