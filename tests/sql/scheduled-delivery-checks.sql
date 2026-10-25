-- Contrôles de add-scheduled-delivery.sql sur un Postgres local jetable (voir tests/sql/run-scheduled-delivery.sh).
-- Chaque contrôle affiche « OK » ou arrête tout avec « ECHEC ».
create schema t;
grant usage on schema t to public;

create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;

-- même contrôle, avec une valeur à afficher si ça échoue
create function t.ok(label text, cond boolean, detail anyelement) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC % : %', label, detail; end if;
end $$;

-- la commande doit être REFUSÉE avec un message qui contient « expect »
create function t.fails(label text, stmt text, expect text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like '%' || expect || '%' then raise notice 'OK    % (refusé : %)', label, sqlerrm; return; end if;
    raise exception 'ECHEC % : refusé mais autre message : %', label, sqlerrm;
  end;
  raise exception 'ECHEC % : aurait dû être refusé', label;
end $$;

-- « jour (décalage) + heure » de N'Djamena, en heure absolue
create function t.slot(day_offset int, hh int, mm int, ss int default 0) returns timestamptz language sql stable as $$
  select (date_trunc('day', now() at time zone 'Africa/Ndjamena') + make_interval(days => day_offset, hours => hh, mins => mm, secs => ss)) at time zone 'Africa/Ndjamena'
$$;

-- une commande enregistrée avec les droits de la personne connectée (le garde-fou s'applique)
create function t.mk(client uuid, city text, dtype text, sched timestamptz, reminder timestamptz default null, pay text default 'cash_on_delivery', gift boolean default false) returns uuid language plpgsql as $$
declare oid uuid := gen_random_uuid(); -- identifiant choisi à l'avance : un invité n'a pas le droit de relire sa commande (pas de « returning »)
begin
  insert into public.orders(id, user_id, items, total, payment_method, shipping_name, shipping_phone, shipping_address, shipping_city, gift_wrap, delivery_type, scheduled_for, scheduled_reminder_sent_at)
  values (oid, client, '[{"product_name":"Montre","quantity":2,"unit_price":2500}]'::jsonb, 5000, pay, 'Ali Mahamat', '66123456', 'Farcha, rue 12', city, gift, dtype, sched, reminder);
  return oid;
end $$;

-- une commande posée directement (droits du propriétaire, sans garde-fou) pour fabriquer des cas de temps
create function t.raw(client uuid, dtype text, sched timestamptz, st text default 'pending', flagged boolean default false, pay text default 'cash_on_delivery', created timestamptz default now()) returns uuid language plpgsql as $$
declare oid uuid;
begin
  insert into public.orders(user_id, items, total, status, payment_method, shipping_name, shipping_phone, shipping_address, shipping_city, is_flagged_fake, delivery_type, scheduled_for, created_at)
  values (client, '[{"product_name":"Parfum Oud","quantity":1,"unit_price":15000}]'::jsonb, 15000, st, pay, 'Fatime Idriss', '99001122', 'Chagoua, rue 4', 'N''Djamena', flagged, dtype, sched, created)
  returning id into oid;
  return oid;
end $$;

insert into public.profiles(id, is_admin, telegram_chat_id) values
  ('a0000000-0000-4000-8000-000000000001', true, 111),
  ('c0000000-0000-4000-8000-000000000001', false, null),
  ('c0000000-0000-4000-8000-000000000002', false, null);
insert into vault.decrypted_secrets values ('telegram_bot_token', 'TESTTOKEN');
truncate net.calls;

-- ============================================================================================
-- 1. Le script est relançable sans doublon
-- ============================================================================================
select t.ok('tâche pg_cron : une seule, chaque minute', (select count(*) from cron.job where jobname = 'zara-delivery-reminders') = 1 and (select schedule from cron.job where jobname = 'zara-delivery-reminders') = '* * * * *');
select t.ok('garde-fou installé une seule fois', (select count(*) from pg_trigger where tgname = 'orders_scheduled_guard' and not tgisinternal) = 1);
select t.ok('alerte immédiate installée une seule fois', (select count(*) from pg_trigger where tgname = 'on_order_created_telegram_scheduled' and not tgisinternal) = 1);
select t.ok('colonnes présentes, livraison normale par défaut', (select column_default from information_schema.columns where table_name = 'orders' and column_name = 'delivery_type') like '%standard%');

-- ============================================================================================
-- 2. Le garde-fou à l'enregistrement (un client connecté)
-- ============================================================================================
do $$
declare
  c1 uuid := 'c0000000-0000-4000-8000-000000000001';
  o uuid;
  r record;
begin
  perform set_config('request.jwt.claim.sub', c1::text, true);
  set local role authenticated;

  -- livraison normale : rien ne change
  o := t.mk(c1, 'N''Djamena', 'standard', null);
  select * into r from public.orders where id = o;
  perform t.ok('livraison normale : type « standard », pas de rendez-vous', r.delivery_type = 'standard' and r.scheduled_for is null and r.scheduled_reminder_sent_at is null);
  -- commande sans les nouveaux champs (ancienne appli) : pareil
  insert into public.orders(user_id, items, total, payment_method, shipping_name, shipping_phone, shipping_address, shipping_city)
    values (c1, '[]'::jsonb, 1000, 'cash_on_delivery', 'Ali', '66123456', 'Farcha', 'Moundou') returning id into o;
  select * into r from public.orders where id = o;
  perform t.ok('ancienne appli (sans les champs) : livraison normale', r.delivery_type = 'standard' and r.scheduled_for is null);
  -- un rendez-vous glissé dans une commande « normale » est effacé
  o := t.mk(c1, 'N''Djamena', 'standard', t.slot(1, 14, 30));
  select * into r from public.orders where id = o;
  perform t.ok('commande normale avec un rendez-vous glissé : rendez-vous effacé', r.delivery_type = 'standard' and r.scheduled_for is null);

  -- livraison programmée valide
  o := t.mk(c1, 'N''Djamena', 'scheduled', t.slot(1, 14, 30), now()); -- le client essaie aussi de marquer le rappel « déjà envoyé »
  select * into r from public.orders where id = o;
  perform t.ok('programmée demain 14h30 : acceptée', r.delivery_type = 'scheduled' and r.scheduled_for = t.slot(1, 14, 30));
  perform t.ok('programmée : le client ne peut pas marquer le rappel « déjà envoyé »', r.scheduled_reminder_sent_at is null);
  perform t.ok('premier créneau 8h30 accepté', t.mk(c1, 'N''Djamena', 'scheduled', t.slot(1, 8, 30)) is not null);
  perform t.ok('dernier créneau 15h30 accepté', t.mk(c1, 'N''Djamena', 'scheduled', t.slot(1, 15, 30)) is not null);
  perform t.ok('dans 7 jours à 15h30 : accepté', t.mk(c1, 'N''Djamena', 'scheduled', t.slot(7, 15, 30)) is not null);
  perform t.ok('« Ndjamena » écrit sans apostrophe : accepté', t.mk(c1, 'Ndjamena', 'scheduled', t.slot(1, 10, 0)) is not null);
  perform t.ok('« NDJAMENA » en majuscules : accepté', t.mk(c1, 'NDJAMENA', 'scheduled', t.slot(1, 10, 0)) is not null);
  perform t.ok('« N’Djaména » avec accent et apostrophe courbe : accepté', t.mk(c1, E'N’Djaména', 'scheduled', t.slot(1, 10, 0)) is not null);

  -- refus
  perform t.fails('autre ville : refusée', format('select t.mk(%L, %L, %L, %L)', c1, 'Moundou', 'scheduled', t.slot(1, 14, 30)), 'seulement à N''Djamena');
  perform t.fails('ville vide : refusée', format('select t.mk(%L, %L, %L, %L)', c1, '', 'scheduled', t.slot(1, 14, 30)), 'seulement à N''Djamena');
  perform t.fails('sans date : refusée', format('select t.mk(%L, %L, %L, null)', c1, 'N''Djamena', 'scheduled'), 'Choisissez le jour');
  perform t.fails('dans 1 heure : trop proche', format('select t.mk(%L, %L, %L, %L)', c1, 'N''Djamena', 'scheduled', now() + interval '60 minutes'), '2 h');
  perform t.fails('dans le passé : refusée', format('select t.mk(%L, %L, %L, %L)', c1, 'N''Djamena', 'scheduled', now() - interval '1 day'), '2 h');
  perform t.fails('dans 10 jours : trop loin', format('select t.mk(%L, %L, %L, %L)', c1, 'N''Djamena', 'scheduled', t.slot(10, 10, 0)), '7 prochains jours');
  perform t.fails('16h00 : après le dernier créneau', format('select t.mk(%L, %L, %L, %L)', c1, 'N''Djamena', 'scheduled', t.slot(1, 16, 0)), '8h30 à 15h30');
  perform t.fails('08h00 : avant le premier créneau', format('select t.mk(%L, %L, %L, %L)', c1, 'N''Djamena', 'scheduled', t.slot(1, 8, 0)), '8h30 à 15h30');
  perform t.fails('03h00 de nuit : refusée', format('select t.mk(%L, %L, %L, %L)', c1, 'N''Djamena', 'scheduled', t.slot(1, 3, 0)), '8h30 à 15h30');
  perform t.fails('14h20 : pas un créneau de 30 minutes', format('select t.mk(%L, %L, %L, %L)', c1, 'N''Djamena', 'scheduled', t.slot(1, 14, 20)), '8h30 à 15h30');
  perform t.fails('14h30 et 30 secondes : refusée', format('select t.mk(%L, %L, %L, %L)', c1, 'N''Djamena', 'scheduled', t.slot(1, 14, 30, 30)), '8h30 à 15h30');
  -- un type inconnu envoyé par un client est ramené à la livraison normale (sans rendez-vous)
  o := t.mk(c1, 'N''Djamena', 'express', t.slot(1, 14, 30));
  select * into r from public.orders where id = o;
  perform t.ok('type inconnu envoyé par un client : ramené à la livraison normale', r.delivery_type = 'standard' and r.scheduled_for is null);

  reset role;
  -- et la base elle-même ne garde jamais un type inconnu ni une livraison programmée sans date (même posée par le propriétaire)
  perform t.fails('type inconnu posé directement : refusé par la base', format('select t.raw(%L, %L, null)', c1, 'express'), 'orders_delivery_type_check');
  perform t.fails('programmée sans date posée directement : refusée par la base', format('select t.raw(%L, %L, null)', c1, 'scheduled'), 'orders_scheduled_needs_date');
end $$;

-- visiteur sans compte (invité) : mêmes règles
do $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  perform t.ok('invité : programmée à N’Djamena acceptée', t.mk(null, 'N''Djamena', 'scheduled', t.slot(1, 11, 0)) is not null);
  perform t.fails('invité : autre ville refusée', format('select t.mk(null, %L, %L, %L)', 'Sarh', 'scheduled', t.slot(1, 11, 0)), 'seulement à N''Djamena');
  reset role;
end $$;

-- ============================================================================================
-- 3. Après l'enregistrement : le client ne change pas son rendez-vous
-- ============================================================================================
do $$
declare
  c1 uuid := 'c0000000-0000-4000-8000-000000000001';
  c2 uuid := 'c0000000-0000-4000-8000-000000000002';
  o uuid;
  r record;
  n int;
begin
  o := (select id from public.orders where user_id = c1 and delivery_type = 'scheduled' order by created_at limit 1);
  perform set_config('request.jwt.claim.sub', c1::text, true);
  set local role authenticated;
  perform t.fails('le client ne change pas l''heure', format('update public.orders set scheduled_for = %L where id = %L', t.slot(2, 9, 0), o), 'ne peut pas être modifié');
  perform t.fails('le client ne repasse pas en livraison normale', format('update public.orders set delivery_type = %L where id = %L', 'standard', o), 'ne peut pas être modifié');
  perform t.fails('le client ne vide pas le rendez-vous', format('update public.orders set scheduled_for = null where id = %L', o), 'ne peut pas être modifié');
  perform t.fails('le client ne remet pas le rappel à zéro', format('update public.orders set scheduled_reminder_sent_at = %L where id = %L', now(), o), 'ne peut pas être modifié');
  -- les autres gestes du client restent possibles
  update public.orders set gift_wrap = true, total = total + 2000 where id = o;
  get diagnostics n = row_count;
  perform t.ok('le client peut toujours ajouter l''emballage cadeau', n = 1 and (select gift_wrap from public.orders where id = o));
  update public.orders set status = 'delivered' where id = o;
  perform t.ok('le client peut toujours confirmer la réception', (select status from public.orders where id = o) = 'delivered');
  -- un autre client ne voit ni ne change cette commande
  perform set_config('request.jwt.claim.sub', c2::text, true);
  update public.orders set scheduled_for = t.slot(3, 9, 0) where id = o;
  get diagnostics n = row_count;
  perform t.ok('un autre client ne touche pas à la commande (aucune ligne)', n = 0);
  reset role;
  -- l'administrateur, lui, peut déplacer un rendez-vous
  perform set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  update public.orders set scheduled_for = t.slot(2, 9, 0) where id = o;
  get diagnostics n = row_count;
  perform t.ok('l''administrateur peut déplacer le rendez-vous', n = 1 and (select scheduled_for from public.orders where id = o) = t.slot(2, 9, 0));
  reset role;
end $$;

-- ============================================================================================
-- 4. Le message immédiat à l'arrivée d'une commande avec rendez-vous
-- ============================================================================================
do $$
declare
  txt text;
begin
  select body->>'text' into txt from net.calls where body->>'text' like '📅 Livraison programmée demandée%' order by id limit 1;
  perform t.ok('message immédiat envoyé à l''administrateur', txt is not null);
  perform t.ok('message immédiat : jour, heure, nom, adresse, rappel annoncé', txt like '%à 14h30%' and txt like '%Ali Mahamat%' and txt like '%Farcha, rue 12%' and txt like '%10 minutes avant%', txt);
  perform t.ok('message immédiat : un seul par commande programmée (pas pour les normales)', (select count(*) from net.calls where body->>'text' like '📅 Livraison programmée demandée%') = (select count(*) from public.orders where delivery_type = 'scheduled'));
  perform t.ok('message envoyé au bon Telegram avec le jeton du coffre-fort', (select count(*) from net.calls where body->>'chat_id' = '111' and url = 'https://api.telegram.org/botTESTTOKEN/sendMessage') = (select count(*) from net.calls));
end $$;

-- ============================================================================================
-- 5. Le rappel de 10 minutes avant
-- ============================================================================================
truncate net.calls;
delete from public.orders;
do $$
declare
  c1 uuid := 'c0000000-0000-4000-8000-000000000001';
  due uuid; soon uuid; far uuid; late uuid; stale uuid; cancelled uuid; delivered uuid; flagged uuid; normal uuid; edge_in uuid; edge_out uuid; mm uuid;
  n int;
  txt text;
begin
  due := t.raw(c1, 'scheduled', now() + interval '9 minutes');
  far := t.raw(c1, 'scheduled', now() + interval '30 minutes');
  late := t.raw(c1, 'scheduled', now() - interval '5 minutes');
  stale := t.raw(c1, 'scheduled', now() - interval '16 minutes');
  cancelled := t.raw(c1, 'scheduled', now() + interval '8 minutes', 'cancelled');
  delivered := t.raw(c1, 'scheduled', now() + interval '8 minutes', 'delivered');
  flagged := t.raw(c1, 'scheduled', now() + interval '8 minutes', 'pending', true);
  normal := t.raw(c1, 'standard', null);
  edge_in := t.raw(c1, 'scheduled', now() + interval '9 minutes 50 seconds');
  edge_out := t.raw(c1, 'scheduled', now() + interval '10 minutes 30 seconds');
  mm := t.raw(c1, 'scheduled', now() + interval '7 minutes', 'processing', false, 'airtel_money');

  n := public.zara_send_delivery_reminders();
  perform t.ok('rappel : 4 commandes concernées (9 min, 9 min 50 s, 7 min Airtel, -5 min)', n = 4, n);
  perform t.ok('rappel : 9 minutes avant → envoyé', (select scheduled_reminder_sent_at from public.orders where id = due) is not null);
  perform t.ok('rappel : 9 min 50 s avant → envoyé', (select scheduled_reminder_sent_at from public.orders where id = edge_in) is not null);
  perform t.ok('rappel : 10 min 30 s avant → PAS encore', (select scheduled_reminder_sent_at from public.orders where id = edge_out) is null);
  perform t.ok('rappel : dans 30 minutes → pas encore', (select scheduled_reminder_sent_at from public.orders where id = far) is null);
  perform t.ok('rappel : rendez-vous passé depuis 5 minutes → « maintenant »', (select scheduled_reminder_sent_at from public.orders where id = late) is not null);
  perform t.ok('rappel : rendez-vous passé depuis 16 minutes → plus de rappel', (select scheduled_reminder_sent_at from public.orders where id = stale) is null);
  perform t.ok('rappel : commande annulée → aucun rappel', (select scheduled_reminder_sent_at from public.orders where id = cancelled) is null);
  perform t.ok('rappel : commande déjà livrée → aucun rappel', (select scheduled_reminder_sent_at from public.orders where id = delivered) is null);
  perform t.ok('rappel : fausse commande signalée → aucun rappel', (select scheduled_reminder_sent_at from public.orders where id = flagged) is null);
  perform t.ok('rappel : livraison normale → aucun rappel', (select scheduled_reminder_sent_at from public.orders where id = normal) is null);
  perform t.ok('rappel : un message par commande rappelée', (select count(*) from net.calls where body->>'text' like '⏰ Zara : livraison programmée%') = 4);

  select body->>'text' into txt from net.calls where body->>'text' like '⏰ Zara : livraison programmée dans%' order by id limit 1;
  perform t.ok('message : annonce « dans N min »', txt ~ 'livraison programmée dans [0-9]+ min', txt);
  perform t.ok('message : date et heure de N’Djamena', txt ~ '📅 [0-9]{2}/[0-9]{2} à [0-9]{2}h[0-9]{2}', txt);
  perform t.ok('message : numéro, client, téléphone, adresse, article, total', txt like '%Commande n° %' and txt like '%Fatime Idriss · 99001122%' and txt like '%Chagoua, rue 4, N''Djamena%' and txt like '%• Parfum Oud × 1%' and txt like '%15 000 FCFA%', txt);
  perform t.ok('message : paiement à la livraison → « À encaisser »', exists (select 1 from net.calls where body->>'text' like '%Commande n°%' and body->>'text' like '%💵 À encaisser à la livraison%'));
  perform t.ok('message : heure exacte du rendez-vous (UTC+1)', exists (select 1 from net.calls where body->>'text' like '%' || to_char(now() at time zone 'Africa/Ndjamena' + interval '9 minutes', 'DD/MM "à" HH24"h"') || '%'));
  perform t.ok('message : Mobile Money en préparation → « paiement confirmé »', exists (select 1 from net.calls where body->>'text' like '%📱 Airtel Money (paiement confirmé)%'));
  perform t.ok('message : rendez-vous passé → « maintenant »', exists (select 1 from net.calls where body->>'text' like '⏰ Zara : livraison programmée maintenant%'));

  -- jamais deux fois
  n := public.zara_send_delivery_reminders();
  perform t.ok('deuxième passage : rien de plus (jamais deux rappels)', n = 0 and (select count(*) from net.calls where body->>'text' like '⏰ Zara : livraison programmée%') = 4);

  -- plus tard, la commande « far » entre dans la fenêtre : rappelée une fois
  update public.orders set scheduled_for = now() + interval '9 minutes' where id = far;
  n := public.zara_send_delivery_reminders();
  perform t.ok('quand l''heure approche, la commande est rappelée une fois', n = 1 and (select scheduled_reminder_sent_at from public.orders where id = far) is not null);

  -- l'effacement d'un message de rappel par un client n'est pas possible (déjà vérifié) ; ici : plusieurs administrateurs
  insert into public.profiles(id, is_admin, telegram_chat_id) values ('a0000000-0000-4000-8000-000000000002', true, 222);
  truncate net.calls;
  mm := t.raw(c1, 'scheduled', now() + interval '6 minutes');
  n := public.zara_send_delivery_reminders();
  perform t.ok('deux administrateurs liés : chacun reçoit le message', n = 1 and (select count(*) from net.calls where body->>'text' like '⏰%') = 2 and exists (select 1 from net.calls where body->>'text' like '⏰%' and body->>'chat_id' = '111') and exists (select 1 from net.calls where body->>'text' like '⏰%' and body->>'chat_id' = '222'));
end $$;

-- sans Telegram lié ou sans jeton : rien n'est marqué (le rappel partira quand tout sera en place)
do $$
declare
  c1 uuid := 'c0000000-0000-4000-8000-000000000001';
  o uuid;
  n int;
begin
  truncate net.calls;
  update public.profiles set telegram_chat_id = null where is_admin;
  o := t.raw(c1, 'scheduled', now() + interval '5 minutes');
  n := public.zara_send_delivery_reminders();
  perform t.ok('aucun administrateur lié à Telegram : aucun envoi et rappel NON marqué', n = 0 and (select scheduled_reminder_sent_at from public.orders where id = o) is null and (select count(*) from net.calls where body->>'text' like '⏰%') = 0);
  update public.profiles set telegram_chat_id = 111 where id = 'a0000000-0000-4000-8000-000000000001';
  delete from vault.decrypted_secrets where name = 'telegram_bot_token';
  n := public.zara_send_delivery_reminders();
  perform t.ok('jeton du bot absent : aucun envoi et rappel NON marqué', n = 0 and (select scheduled_reminder_sent_at from public.orders where id = o) is null);
  insert into vault.decrypted_secrets values ('telegram_bot_token', 'TESTTOKEN');
  n := public.zara_send_delivery_reminders();
  perform t.ok('tout est en place : le rappel part', n = 1 and (select scheduled_reminder_sent_at from public.orders where id = o) is not null and (select count(*) from net.calls where body->>'text' like '⏰%') = 1);
end $$;

-- les droits : seul le propriétaire (cron) peut lancer le rappel
do $$
begin
  set local role authenticated;
  perform t.fails('un client ne peut pas lancer le rappel', 'select public.zara_send_delivery_reminders()', 'permission denied');
  reset role;
  set local role anon;
  perform t.fails('un visiteur ne peut pas lancer le rappel', 'select public.zara_send_delivery_reminders()', 'permission denied');
  reset role;
end $$;

-- ============================================================================================
-- 6. La règle des 48 h (fausses commandes) avec les rendez-vous
-- ============================================================================================
delete from public.orders;
do $$
declare
  u uuid;
  normal uuid; sched_future_cod uuid; sched_past_cod uuid; sched_future_airtel uuid; sched_recent uuid; sched_null uuid;
  n int;
  fk boolean;
  p uuid[] := array[]::uuid[];
begin
  -- un client par commande : le compteur de fausses commandes ne dépasse jamais 1
  for i in 1..6 loop
    u := ('d0000000-0000-4000-8000-00000000000' || i)::uuid;
    insert into public.profiles(id) values (u);
    insert into auth.users(id) values (u);
    p := p || u;
  end loop;
  normal := t.raw(p[1], 'standard', null, 'pending', false, 'cash_on_delivery', now() - interval '3 days');
  sched_future_cod := t.raw(p[2], 'scheduled', now() + interval '2 days', 'pending', false, 'cash_on_delivery', now() - interval '3 days');
  sched_past_cod := t.raw(p[3], 'scheduled', now() - interval '3 days', 'pending', false, 'cash_on_delivery', now() - interval '6 days');
  sched_future_airtel := t.raw(p[4], 'scheduled', now() + interval '2 days', 'pending', false, 'airtel_money', now() - interval '3 days');
  sched_recent := t.raw(p[5], 'standard', null, 'pending', false, 'cash_on_delivery', now() - interval '3 hours');
  sched_null := t.raw(p[6], 'standard', null, 'pending', false, 'airtel_money', now() - interval '47 hours');

  n := public.auto_flag_stale_orders();
  perform t.ok('48 h : deux commandes signalées (normale ancienne + Mobile Money programmée impayée) et une programmée dont le rendez-vous date de plus de 48 h = 3', n = 3, n);
  perform t.ok('48 h : commande normale vieille de 3 jours → signalée (comme avant)', (select is_flagged_fake from public.orders where id = normal));
  perform t.ok('48 h : programmée payée à la livraison, rendez-vous dans 2 jours → PAS signalée', not (select is_flagged_fake from public.orders where id = sched_future_cod));
  perform t.ok('48 h : programmée payée à la livraison, rendez-vous passé depuis plus de 48 h → signalée', (select is_flagged_fake from public.orders where id = sched_past_cod));
  perform t.ok('48 h : programmée en Mobile Money impayée depuis 3 jours → signalée (il faut payer sous 48 h)', (select is_flagged_fake from public.orders where id = sched_future_airtel));
  perform t.ok('48 h : commande de 3 heures → pas signalée', not (select is_flagged_fake from public.orders where id = sched_recent));
  perform t.ok('48 h : commande de 47 h → pas encore signalée', not (select is_flagged_fake from public.orders where id = sched_null));
  perform t.ok('48 h : le compteur de fausses commandes ne monte que pour les signalées', (select sum(fake_order_count) from public.profiles where id = any(p)) = 3);
end $$;

\echo
\echo TOUT EST BON
