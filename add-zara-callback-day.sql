-- BROUILLON : le jour du rappel WhatsApp. PAS ENCORE APPLIQUÉ à la vraie base.
--
-- À appliquer APRÈS add-zara-sales-boost.sql (déjà appliqué). Le client choisit un jour précis pour que l'équipe lui écrive
-- (aujourd'hui, demain, ou l'un des 5 prochains jours ouvrables) ; la page « Rappels WhatsApp » de l'admin le montre et met
-- en avant ceux d'aujourd'hui ou en retard.
--
-- Tant que ce script n'est pas appliqué, tout marche comme avant : la demande part sans jour (Zara le dit au client dans sa
-- confirmation, et l'équipe voit la demande sans jour).
--
-- Pour annuler (revenir à la version sans jour) :
--   drop function if exists public.assistant_request_callback(text, text, text, text, text, date);
--   alter table public.assistant_callbacks drop column if exists wanted_day;
--   puis rejouer la fonction de add-zara-sales-boost.sql

-- 1. La colonne du jour souhaité (vide = pas de jour choisi)
alter table public.assistant_callbacks add column if not exists wanted_day date;

-- 2. L'ancienne fonction (5 paramètres) disparaît : sinon la base ne saurait pas laquelle appeler
drop function if exists public.assistant_request_callback(text, text, text, text, text);

-- 3. La nouvelle fonction : mêmes règles, plus le jour (aujourd'hui à 14 jours, à l'heure du Tchad ; hors de cette période = ignoré)
create or replace function public.assistant_request_callback(
  p_name text,
  p_phone text,
  p_note text default '',
  p_source text default 'chat',
  p_device text default null,
  p_day date default null
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
  v_today date := (now() at time zone 'Africa/Ndjamena')::date;
  v_day date := case when p_day is not null and p_day >= v_today - 1 and p_day <= v_today + 14 then p_day else null end;
begin
  if length(v_phone) = 11 and left(v_phone, 3) = '235' then
    v_phone := substr(v_phone, 4);
  elsif length(v_phone) = 13 and left(v_phone, 5) = '00235' then
    v_phone := substr(v_phone, 6);
  end if;

  if v_phone !~ '^[69][0-9]{7}$' or length(v_name) < 2 then
    return false;
  end if;

  -- le même numéro est déjà en attente : on met à jour la demande (et le jour) au lieu de la doubler
  update public.assistant_callbacks
     set name = v_name,
         note = case when v_note <> '' then v_note else note end,
         source = v_source,
         wanted_day = coalesce(v_day, wanted_day)
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

  insert into public.assistant_callbacks (name, phone, note, source, device, user_id, wanted_day)
  values (v_name, v_phone, v_note, v_source, v_device, auth.uid(), v_day);

  -- la cloche de l'admin (si le script des notifications est installé)
  if to_regclass('public.admin_notifications') is not null then
    insert into public.admin_notifications (type, title, message, link)
    values (
      'callback_request',
      '📲 Rappel WhatsApp demandé',
      v_name || ' — ' || v_phone || case when v_day is not null then ' — le ' || to_char(v_day, 'DD/MM') else '' end,
      'admin/rappels'
    );
  end if;

  return true;
end;
$$;

revoke all on function public.assistant_request_callback(text, text, text, text, text, date) from public;
grant execute on function public.assistant_request_callback(text, text, text, text, text, date) to anon, authenticated;
