-- Contrôles de add-absent-relance.sql sur un Postgres local jetable (voir tests/sql/run-absent-relance.sh).
create schema t;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.uid(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.ago(days numeric) returns timestamptz language sql stable as $$ select now() - make_interval(secs => days * 86400) $$;
-- les clients mis en file aujourd'hui (numéros)
create function t.queued() returns text language sql stable as $$
  select coalesce(string_agg(n::text, ',' order by n), '') from (
    select (right(user_id::text, 12))::int as n from public.email_outbox where kind = 'promo_inactive' and created_at > now() - interval '1 hour'
  ) x $$;

-- les clients (dernière venue = la dernière visite sur le site, sinon la dernière connexion, sinon la création du compte)
insert into public.profiles (id, email, last_login_at) select t.uid(n), 'client' || n || '@exemple.td', null from generate_series(1, 20) n;
-- absents : u1 8 j, u2 10 j, u3 15 j, u4 20 j, u5 31 j, u6 60 j, u7 8,5 j (revenu après 3 vieilles relances), u8 9 j, u9 9 j, u10 9 j,
--           u11 9 j (désinscrit), u12 9 j (adresse en suppression), u13 9 j (refuse les offres), u14 9 j (compte par téléphone),
--           u15 9 j (administrateur), u16 9 j (bloqué), u17 actif il y a 2 j, u18 connecté il y a 3 j (sans visite), u19 adresse fausse, u20 9 j
insert into public.visitor_sessions (user_id, last_seen_at) values
  (t.uid(1), t.ago(8)), (t.uid(2), t.ago(10)), (t.uid(3), t.ago(15)), (t.uid(4), t.ago(20)), (t.uid(5), t.ago(31)), (t.uid(6), t.ago(60)),
  (t.uid(7), t.ago(8.5)), (t.uid(7), t.ago(70)), (t.uid(8), t.ago(9)), (t.uid(9), t.ago(9)), (t.uid(10), t.ago(9)), (t.uid(11), t.ago(9)),
  (t.uid(12), t.ago(9)), (t.uid(13), t.ago(9)), (t.uid(14), t.ago(9)), (t.uid(15), t.ago(9)), (t.uid(16), t.ago(9)), (t.uid(17), t.ago(2)),
  (t.uid(18), t.ago(30)), (t.uid(19), t.ago(9)), (t.uid(20), t.ago(9));
update public.profiles set last_login_at = t.ago(3) where id = t.uid(18);
update public.profiles set notify_promotions = false where id = t.uid(13);
update public.profiles set email = '66123456@tel.albasseshopping.com' where id = t.uid(14);
update public.profiles set is_admin = true where id = t.uid(15);
update public.profiles set banned = true where id = t.uid(16);
update public.profiles set email = 'pas-une-adresse' where id = t.uid(19);
insert into public.email_prefs (user_id, unsubscribed_at, suppressed_at) values (t.uid(11), t.ago(1), null), (t.uid(12), null, t.ago(1));
-- relances déjà faites et autres e-mails
insert into public.email_outbox (kind, user_id, status, created_at) values
  ('promo_inactive', t.uid(2), 'sent', t.ago(3)),                                                     -- u2 : 1re relance il y a 3 j
  ('promo_inactive', t.uid(3), 'sent', t.ago(8)),                                                     -- u3 : 1re relance il y a 8 j
  ('promo_inactive', t.uid(4), 'sent', t.ago(13)), ('promo_inactive', t.uid(4), 'sent', t.ago(6)),    -- u4 : 2 relances
  ('promo_inactive', t.uid(5), 'sent', t.ago(24)), ('promo_inactive', t.uid(5), 'sent', t.ago(10)),   -- u5 : 2 relances
  ('promo_inactive', t.uid(6), 'sent', t.ago(53)), ('promo_inactive', t.uid(6), 'sent', t.ago(46)), ('promo_inactive', t.uid(6), 'sent', t.ago(30)), -- u6 : 3 relances
  ('promo_inactive', t.uid(7), 'sent', t.ago(63)), ('promo_inactive', t.uid(7), 'sent', t.ago(56)), ('promo_inactive', t.uid(7), 'sent', t.ago(40)), -- u7 : 3 relances AVANT son retour
  ('marketing', t.uid(8), 'sent', t.ago(2)),                                                          -- u8 : vente flash il y a 2 j
  ('marketing', t.uid(9), 'sent', t.ago(8)),                                                          -- u9 : vente flash il y a 8 j
  ('promo_inactive', t.uid(20), 'failed', t.ago(1)),                                                  -- u20 : un échec ne compte pas
  ('welcome', t.uid(1), 'sent', t.ago(0.5));                                                          -- u1 : « bienvenue », pas une publicité
insert into public.orders (user_id, created_at) values (t.uid(10), t.ago(3));                         -- u10 : a commandé il y a 3 j

-- 0. droits et tâche quotidienne
select t.ok('droits : ni l''anonyme ni un client ne lancent la relance', not has_function_privilege('anon', 'public.enqueue_inactive_promos()', 'execute') and not has_function_privilege('authenticated', 'public.enqueue_inactive_promos()', 'execute'));
select t.ok('tâche quotidienne : une seule, à 7h45 UTC (8h45 à N''Djamena), avant Zara Marketing (9h05)',
  (select count(*) from cron.job where jobname = 'enqueue-inactive-promos') = 1 and (select schedule from cron.job where jobname = 'enqueue-inactive-promos') = '45 7 * * *');

-- 1. le passage du jour, Zara Marketing en « live »
select t.ok('Zara Marketing en marche : la relance marche quand même (6 clients mis en file)', public.enqueue_inactive_promos() = 6);
select t.ok('les bons clients : u1 (1re relance, 8 j), u3 (2e, 15 j), u5 (3e, 31 j), u7 (revenu après 3 vieilles relances : on repart de zéro), u9 (vente flash il y a 8 j), u20 (un échec ne compte pas)',
  t.queued() = '1,3,5,7,9,20');
select t.ok('pas mis en file : u2 (1 relance, absent 10 j < 14), u4 (2 relances, 20 j < 30), u6 (déjà 3 relances), u8 (vente flash il y a 2 j : 1 pub par semaine), u10 (a commandé), u11 (désinscrit), u12 (suppression), u13 (refuse les offres), u14 (téléphone), u15 (admin), u16 (bloqué), u17 (actif), u18 (connecté il y a 3 j), u19 (adresse fausse)',
  not exists (select 1 from public.email_outbox where kind = 'promo_inactive' and created_at > now() - interval '1 hour'
                and user_id in (select t.uid(n) from unnest(array[2,4,6,8,10,11,12,13,14,15,16,17,18,19]) n)));
select t.ok('les e-mails mis en file attendent l''envoi (pending), sans doublon', (select count(*) from public.email_outbox where kind = 'promo_inactive' and created_at > now() - interval '1 hour' and status = 'pending') = 6
  and (select count(distinct user_id) from public.email_outbox where kind = 'promo_inactive' and created_at > now() - interval '1 hour') = 6);
select t.ok('chaque client relancé a sa ligne de préférences (pour son lien de désinscription)', (select count(*) from public.email_prefs where user_id in (t.uid(1), t.uid(3), t.uid(5), t.uid(7), t.uid(9), t.uid(20))) = 6);
select t.ok('relancé une 2e fois le même jour : rien de plus', public.enqueue_inactive_promos() = 0);
select t.ok('… et la file reste la même', t.queued() = '1,3,5,7,9,20');

-- 2. la limite du jour : les 1res relances d'abord, puis les absents les plus récents
delete from public.email_outbox where kind = 'promo_inactive' and created_at > now() - interval '1 hour';
update public.store_settings set inactive_emails_daily_limit = 2 where id = 1;
select t.ok('limite 2 par jour : 2 clients', public.enqueue_inactive_promos() = 2);
select t.ok('… u1 (8 j) et u7 (8,5 j) : des 1res relances, les absents les plus récents', t.queued() = '1,7');
select t.ok('limite atteinte : plus rien aujourd''hui', public.enqueue_inactive_promos() = 0);
select t.ok('… toujours u1 et u7', t.queued() = '1,7');
update public.store_settings set inactive_emails_daily_limit = 50 where id = 1;

-- 3. les interrupteurs
delete from public.email_outbox where kind = 'promo_inactive' and created_at > now() - interval '1 hour';
update public.store_settings set inactive_emails_enabled = false where id = 1;
select t.ok('publicité « absents » éteinte : rien', public.enqueue_inactive_promos() = 0);
select t.ok('… file vide', t.queued() = '');
update public.store_settings set inactive_emails_enabled = true, order_emails_enabled = false where id = 1;
select t.ok('tous les e-mails éteints : rien', public.enqueue_inactive_promos() = 0);
select t.ok('… file vide', t.queued() = '');
update public.store_settings set order_emails_enabled = true where id = 1;
update public.marketing_ai_settings set mode = 'off' where id = 1;
select t.ok('Zara Marketing arrêté : la relance marche aussi (6 clients)', public.enqueue_inactive_promos() = 6);
select t.ok('… les mêmes 6', t.queued() = '1,3,5,7,9,20');

select 'TOUS LES CONTROLES SONT PASSES' as resultat;
