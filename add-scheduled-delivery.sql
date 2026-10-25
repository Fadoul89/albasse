-- Livraison programmée pour les clients de N'Djamena : le client choisit un JOUR et une HEURE de rendez-vous à la commande.
-- Zara prévient l'administrateur sur Telegram 10 MINUTES AVANT le rendez-vous (et aussi tout de suite, quand la commande arrive).
--
-- Avant de lancer ce script : le bot Telegram doit déjà être configuré (token « telegram_bot_token » dans le coffre-fort Supabase, voir
-- add-telegram-order-alert.sql) et le compte administrateur doit avoir lié Telegram (Compte › Lier Telegram). Sinon rien n'est envoyé.
-- À lancer UNE FOIS dans Supabase › SQL Editor, AVANT de publier le site. Sans danger à relancer. Aucune nouvelle table : pas de « grant » à ajouter.
--
-- Ce que fait le script :
--   1. trois colonnes sur « orders » : delivery_type (standard / scheduled), scheduled_for (le rendez-vous), scheduled_reminder_sent_at (rappel déjà envoyé) ;
--   2. un garde-fou : à l'enregistrement, la base refuse un rendez-vous hors N'Djamena, trop proche (moins de ~2 h), trop loin (plus de 8 jours) ou
--      hors des horaires (8h30 à 15h30, un créneau toutes les 30 minutes) ; un client ne peut ensuite ni changer son rendez-vous ni effacer le rappel ;
--   3. le rappel : chaque minute, les commandes dont le rendez-vous est dans 10 minutes ou moins reçoivent UN message Telegram (jamais deux) ;
--   4. un message Telegram tout de suite quand une commande avec rendez-vous est enregistrée ;
--   5. la règle des 48 h (commande « fausse » si elle reste en attente) : une commande programmée payée à la livraison compte ses 48 h à partir du
--      rendez-vous, pas de la commande (sinon un rendez-vous dans 3 jours serait signalé avant d'avoir eu lieu).
-- Pour annuler : voir la fin du fichier.

-- ---------------------------------------------------------------------------------------------
-- 1. Les colonnes
-- ---------------------------------------------------------------------------------------------
alter table public.orders add column if not exists delivery_type text not null default 'standard';
alter table public.orders add column if not exists scheduled_for timestamptz;
alter table public.orders add column if not exists scheduled_reminder_sent_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_delivery_type_check') then
    alter table public.orders add constraint orders_delivery_type_check check (delivery_type in ('standard', 'scheduled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_scheduled_needs_date') then
    alter table public.orders add constraint orders_scheduled_needs_date check (delivery_type = 'standard' or scheduled_for is not null);
  end if;
end $$;

-- sert au rappel de chaque minute : seulement les commandes programmées dont le rappel n'est pas encore parti
create index if not exists orders_scheduled_reminder_idx on public.orders (scheduled_for)
  where delivery_type = 'scheduled' and scheduled_reminder_sent_at is null;

-- ---------------------------------------------------------------------------------------------
-- 2. Le garde-fou (le téléphone du client ne peut pas contourner les règles)
-- ---------------------------------------------------------------------------------------------
create or replace function public.guard_scheduled_delivery() returns trigger
language plpgsql
set search_path = public
as $$
declare
  city_key text;
  local_ts timestamp;
begin
  -- l'administrateur et les fonctions internes de la base (elles tournent avec le rôle propriétaire) ne sont pas gênés
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- un client ne change ni son rendez-vous ni l'état du rappel (confirmer la réception, retirer un article, etc. restent possibles)
    if new.delivery_type is distinct from old.delivery_type
       or new.scheduled_for is distinct from old.scheduled_for
       or new.scheduled_reminder_sent_at is distinct from old.scheduled_reminder_sent_at then
      raise exception 'Le rendez-vous de livraison ne peut pas être modifié ici. Contactez-nous.';
    end if;
    return new;
  end if;

  -- nouvelle commande
  new.scheduled_reminder_sent_at := null;
  if new.delivery_type is distinct from 'scheduled' then
    new.delivery_type := 'standard';
    new.scheduled_for := null;
    return new;
  end if;

  city_key := regexp_replace(translate(lower(coalesce(new.shipping_city, '')), 'éèêëàâäîïôöùûüç', 'eeeeaaaiioouuuc'), '[^a-z0-9]', '', 'g');
  if city_key not in ('ndjamena', 'djamena', 'ndjam') then
    raise exception 'La livraison programmée est possible seulement à N''Djamena.';
  end if;
  if new.scheduled_for is null then
    raise exception 'Choisissez le jour et l''heure du rendez-vous.';
  end if;
  -- un peu moins de 2 h : le téléphone vérifie 2 h pile, la commande met quelques secondes à arriver
  if new.scheduled_for < now() + interval '110 minutes' then
    raise exception 'Choisissez un rendez-vous au moins 2 h après votre commande.';
  end if;
  if new.scheduled_for > now() + interval '8 days' then
    raise exception 'Le rendez-vous doit avoir lieu dans les 7 prochains jours.';
  end if;
  local_ts := new.scheduled_for at time zone 'Africa/Ndjamena';
  if local_ts::time < time '08:30' or local_ts::time > time '15:30'
     or extract(second from local_ts) <> 0 or extract(minute from local_ts)::int % 30 <> 0 then
    raise exception 'Les rendez-vous sont possibles de 8h30 à 15h30, toutes les 30 minutes.';
  end if;
  return new;
end
$$;

drop trigger if exists orders_scheduled_guard on public.orders;
create trigger orders_scheduled_guard
  before insert or update on public.orders
  for each row execute function public.guard_scheduled_delivery();

-- ---------------------------------------------------------------------------------------------
-- 3. Le rappel Telegram : 10 minutes avant le rendez-vous (appelé chaque minute)
-- ---------------------------------------------------------------------------------------------
create or replace function public.zara_send_delivery_reminders() returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  tok text;
  o record;
  r record;
  articles text;
  pay text;
  left_min int;
  txt text;
  sent int := 0;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if tok is null then
    return 0;
  end if;
  -- personne à prévenir : on ne marque rien, le rappel partira dès qu'un administrateur aura lié Telegram
  if not exists (select 1 from public.profiles where is_admin and telegram_chat_id is not null) then
    return 0;
  end if;

  for o in
    select * from public.orders
    where delivery_type = 'scheduled'
      and scheduled_reminder_sent_at is null
      and status not in ('cancelled', 'delivered')
      and not is_flagged_fake
      and scheduled_for <= now() + interval '10 minutes'
      and scheduled_for > now() - interval '15 minutes' -- un rendez-vous passé depuis plus de 15 minutes n'est plus rappelé
    order by scheduled_for
    for update skip locked
  loop
    left_min := greatest(0, ceil(extract(epoch from (o.scheduled_for - now())) / 60)::int);
    select string_agg('• ' || coalesce(i->>'product_name', 'Article') || ' × ' || coalesce(i->>'quantity', '1'), E'\n')
      into articles
      from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) i;
    pay := case o.payment_method
      when 'cash_on_delivery' then '💵 À encaisser à la livraison'
      when 'airtel_money' then '📱 Airtel Money' || case when o.status = 'pending' then ' (paiement pas encore confirmé)' else ' (paiement confirmé)' end
      when 'moov_money' then '📲 Moov Money' || case when o.status = 'pending' then ' (paiement pas encore confirmé)' else ' (paiement confirmé)' end
      else coalesce(o.payment_method, '')
    end;
    txt := '⏰ Zara : livraison programmée ' || case when left_min > 0 then 'dans ' || left_min || ' min' else 'maintenant' end || E'\n'
        || '📅 ' || to_char(o.scheduled_for at time zone 'Africa/Ndjamena', 'DD/MM "à" HH24"h"MI') || E'\n'
        || '🧾 Commande n° ' || coalesce(o.order_number::text, left(o.id::text, 8)) || E'\n'
        || '👤 ' || coalesce(o.shipping_name, '') || ' · ' || coalesce(o.shipping_phone, '') || E'\n'
        || '📍 ' || coalesce(o.shipping_address, '') || ', ' || coalesce(o.shipping_city, '') || E'\n'
        || coalesce(articles || E'\n', '')
        || case when o.gift_wrap then '🎁 À emballer (emballage cadeau)' || E'\n' else '' end
        || '💰 ' || replace(to_char(o.total, 'FM999,999,999'), ',', ' ') || ' FCFA' || E'\n'
        || pay;
    for r in select telegram_chat_id from public.profiles where is_admin and telegram_chat_id is not null loop
      perform net.http_post(
        url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
        body := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', txt)
      );
    end loop;
    update public.orders set scheduled_reminder_sent_at = now() where id = o.id;
    sent := sent + 1;
  end loop;
  return sent;
exception when others then
  -- une erreur ne doit jamais bloquer la tâche de la minute suivante (tout ce que ce passage avait fait est annulé : pas de rappel perdu ni doublé)
  raise warning 'zara_send_delivery_reminders : %', sqlerrm;
  return 0;
end
$$;

revoke all on function public.zara_send_delivery_reminders() from public, anon, authenticated;

-- chaque minute (pg_cron compte en UTC, sans importance ici : le rappel se calcule avec l'heure exacte du rendez-vous)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'zara-delivery-reminders') then
    perform cron.unschedule('zara-delivery-reminders');
  end if;
  perform cron.schedule('zara-delivery-reminders', '* * * * *', 'select public.zara_send_delivery_reminders()');
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Un message tout de suite quand une commande avec rendez-vous arrive (en plus de « Nouvelle commande »)
-- ---------------------------------------------------------------------------------------------
create or replace function public.telegram_notify_admin_scheduled_order() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tok text;
  r record;
  local_ts timestamp;
  txt text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if tok is null then
    return new;
  end if;
  local_ts := new.scheduled_for at time zone 'Africa/Ndjamena';
  txt := '📅 Livraison programmée demandée' || E'\n'
      || (array['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'])[extract(dow from local_ts)::int + 1]
      || ' ' || to_char(local_ts, 'DD/MM "à" HH24"h"MI') || E'\n'
      || '🧾 Commande n° ' || coalesce(new.order_number::text, left(new.id::text, 8)) || E'\n'
      || coalesce(new.shipping_name, '') || ' · ' || coalesce(new.shipping_phone, '') || E'\n'
      || '📍 ' || coalesce(new.shipping_address, '') || ', ' || coalesce(new.shipping_city, '') || E'\n'
      || '🔔 Zara vous prévient 10 minutes avant.';
  for r in select telegram_chat_id from public.profiles where is_admin and telegram_chat_id is not null loop
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
      body := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', txt)
    );
  end loop;
  return new;
exception when others then
  return new; -- une commande n'échoue jamais à cause de l'alerte
end
$$;

revoke all on function public.telegram_notify_admin_scheduled_order() from public, anon, authenticated;

drop trigger if exists on_order_created_telegram_scheduled on public.orders;
create trigger on_order_created_telegram_scheduled
  after insert on public.orders
  for each row when (new.delivery_type = 'scheduled')
  execute function public.telegram_notify_admin_scheduled_order();

-- ---------------------------------------------------------------------------------------------
-- 5. Règle des 48 h : une commande programmée payée à la livraison attend son rendez-vous
--    (même fonction que add-auto-flag-stale-orders.sql, avec une seule condition en plus ; les commandes normales ne changent pas)
-- ---------------------------------------------------------------------------------------------
create or replace function public.auto_flag_stale_orders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  stale record;
  new_count int;
  flagged_count int := 0;
begin
  for stale in
    select id, user_id from orders
    where status = 'pending'
      and not is_flagged_fake
      and greatest(
            created_at,
            case when delivery_type = 'scheduled' and payment_method = 'cash_on_delivery' then coalesce(scheduled_for, created_at) else created_at end
          ) < now() - interval '48 hours'
  loop
    update orders set is_flagged_fake = true where id = stale.id;
    update profiles set fake_order_count = fake_order_count + 1 where id = stale.user_id
      returning fake_order_count into new_count;

    flagged_count := flagged_count + 1;

    if new_count >= 3 then
      update auth.users set banned_until = 'infinity' where id = stale.user_id;
      update profiles set banned = true where id = stale.user_id;
      insert into customer_sanctions (user_id, action, reason, admin_id)
      values (stale.user_id, 'ban', 'Automatique : 3 commandes signalées comme fausses (délai 48h dépassé)', null);
    end if;
  end loop;

  return flagged_count;
end;
$$;

grant execute on function public.auto_flag_stale_orders() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Message d'essai tout de suite : pour voir que Zara sait vous écrire (une seule fois, à chaque lancement du script)
-- ---------------------------------------------------------------------------------------------
do $$
declare
  tok text;
  r record;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if tok is null then
    raise notice 'Token du bot absent : les rappels ne partiront pas. Voir add-telegram-order-alert.sql.';
    return;
  end if;
  for r in select telegram_chat_id from public.profiles where is_admin and telegram_chat_id is not null loop
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
      body := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', '✅ Livraison programmée activée : pour chaque commande avec rendez-vous à N''Djamena, Zara vous écrit ici 10 minutes avant.')
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- POUR ANNULER (ne supprime pas les rendez-vous déjà enregistrés) :
--   select cron.unschedule('zara-delivery-reminders');
--   drop trigger if exists orders_scheduled_guard on public.orders;
--   drop trigger if exists on_order_created_telegram_scheduled on public.orders;
--   puis relancer add-auto-flag-stale-orders.sql pour revenir à la règle des 48 h d'avant.
-- ---------------------------------------------------------------------------------------------
