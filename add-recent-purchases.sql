-- Barre « achats récents » en haut du site : seulement de VRAIES commandes (aucun texte inventé).
-- Ne montre que la ville et l'article des 14 derniers jours, jamais le nom, le téléphone ni l'adresse du client.
-- Les commandes annulées ou signalées comme fausses n'y sont pas. Sans commande récente, la barre reste cachée.
-- Sans danger à relancer. À lancer une fois dans Supabase › SQL Editor.
create or replace function public.recent_purchases(p_limit integer default 12)
returns table (city text, product text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select nullif(btrim(o.shipping_city), '') as city,
         nullif(btrim(regexp_replace(it->>'product_name', '\s+', ' ', 'g')), '') as product,
         o.created_at
  from public.orders o
  cross join lateral jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) it
  where o.status <> 'cancelled'
    and coalesce(o.is_flagged_fake, false) = false
    and o.created_at > now() - interval '14 days'
    and nullif(btrim(it->>'product_name'), '') is not null
  order by o.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 20);
$$;

revoke all on function public.recent_purchases(integer) from public;
grant execute on function public.recent_purchases(integer) to anon, authenticated;
