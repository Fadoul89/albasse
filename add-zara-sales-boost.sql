-- BROUILLON : Zara vendeuse (preuves vraies + rappel WhatsApp). PAS ENCORE APPLIQUÉ à la vraie base.
--
-- Deux choses :
--   1. « Cet article a été commandé N fois ces 7 derniers jours » : Zara le dit SEULEMENT avec le vrai chiffre.
--      La fonction donne seulement des totaux par article (jamais un nom, un numéro ou une adresse de client).
--   2. « Me rappeler sur WhatsApp » : un client qui n'est pas prêt laisse son prénom et son numéro, avec son accord.
--      La liste arrive dans l'admin (« Rappels WhatsApp ») et une notification s'ajoute à la cloche.
--
-- À appliquer dans Supabase > SQL Editor (le script peut être relancé sans danger).
-- Il faut que la fonction public.is_admin() existe déjà (elle existe depuis les premiers scripts du site).
--
-- Tant que ce script n'est pas appliqué, le site marche comme avant : Zara ne dit aucun chiffre de ventes et,
-- si un client demande un rappel, elle lui dit d'écrire directement sur WhatsApp.
--
-- Pour annuler (tout supprimer) :
--   drop function if exists public.assistant_product_sales(integer);
--   drop function if exists public.assistant_request_callback(text, text, text, text, text);
--   drop table if exists public.assistant_callbacks;

-- 1. Ventes réelles par article (commandes non annulées et non marquées « fausses »), sur les derniers jours
create or replace function public.assistant_product_sales(p_days integer default 7)
returns table (product_id text, orders_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select i ->> 'product_id' as product_id, count(distinct o.id)::integer as orders_count
  from public.orders o
  cross join lateral jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) as i
  where o.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 30)))
    and o.status <> 'cancelled'
    and coalesce((to_jsonb(o) ->> 'is_flagged_fake')::boolean, false) = false
    and i ->> 'product_id' is not null
  group by 1
$$;

revoke all on function public.assistant_product_sales(integer) from public;
grant execute on function public.assistant_product_sales(integer) to anon, authenticated;

-- 2. Les demandes de rappel WhatsApp
create table if not exists public.assistant_callbacks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  note text not null default '',
  source text not null default 'chat' check (source in ('later', 'price', 'cart', 'chat')),
  device text not null default 'Autre',
  user_id uuid,
  status text not null default 'new' check (status in ('new', 'done')),
  done_at timestamptz
);

create index if not exists assistant_callbacks_status_idx on public.assistant_callbacks (status, created_at desc);

alter table public.assistant_callbacks enable row level security;

-- Seul l'administrateur lit et traite les demandes ; personne d'autre ne peut écrire directement dans la table
-- (les clients passent par la fonction ci-dessous, qui vérifie le numéro).
drop policy if exists assistant_callbacks_admin_read on public.assistant_callbacks;
create policy assistant_callbacks_admin_read on public.assistant_callbacks
  for select
  using (public.is_admin());

drop policy if exists assistant_callbacks_admin_update on public.assistant_callbacks;
create policy assistant_callbacks_admin_update on public.assistant_callbacks
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists assistant_callbacks_admin_delete on public.assistant_callbacks;
create policy assistant_callbacks_admin_delete on public.assistant_callbacks
  for delete
  using (public.is_admin());

-- 3. La demande du client : numéro du Tchad à 8 chiffres (6xxxxxxx ou 9xxxxxxx), prénom, et ce qu'il regardait
create or replace function public.assistant_request_callback(
  p_name text,
  p_phone text,
  p_note text default '',
  p_source text default 'chat',
  p_device text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', ' ', 'g')), 60);
  v_note text := left(btrim(regexp_replace(coalesce(p_note, ''), '[[:cntrl:]]', ' ', 'g')), 300);
  v_source text := case when p_source in ('later', 'price', 'cart', 'chat') then p_source else 'chat' end;
  v_device text := case when p_device in ('iPhone', 'Android', 'Tablette', 'PC') then p_device else 'Autre' end;
begin
  if length(v_phone) = 11 and left(v_phone, 3) = '235' then
    v_phone := substr(v_phone, 4);
  elsif length(v_phone) = 13 and left(v_phone, 5) = '00235' then
    v_phone := substr(v_phone, 6);
  end if;

  if v_phone !~ '^[69][0-9]{7}$' or length(v_name) < 2 then
    return false;
  end if;

  -- le même numéro est déjà en attente : on met à jour la demande au lieu de la doubler
  update public.assistant_callbacks
     set name = v_name,
         note = case when v_note <> '' then v_note else note end,
         source = v_source
   where phone = v_phone
     and status = 'new'
     and created_at > now() - interval '3 days';
  if found then
    return true;
  end if;

  -- protection : pas plus de 300 demandes par jour en tout
  if (select count(*) from public.assistant_callbacks where created_at > now() - interval '1 day') >= 300 then
    return false;
  end if;

  insert into public.assistant_callbacks (name, phone, note, source, device, user_id)
  values (v_name, v_phone, v_note, v_source, v_device, auth.uid());

  -- la cloche de l'admin (si le script des notifications est installé)
  if to_regclass('public.admin_notifications') is not null then
    insert into public.admin_notifications (type, title, message, link)
    values ('callback_request', '📲 Rappel WhatsApp demandé', v_name || ' — ' || v_phone, 'admin/rappels');
  end if;

  return true;
end;
$$;

revoke all on function public.assistant_request_callback(text, text, text, text, text) from public;
grant execute on function public.assistant_request_callback(text, text, text, text, text) to anon, authenticated;
