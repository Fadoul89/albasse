-- Contrôles de add-telegram-absent.sql sur un Postgres local jetable (voir tests/sql/run-telegram-absent.sh).
create schema t;
grant usage on schema t to public;

create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
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
create function t.uid(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- les clients de test (u1 = administrateur)
insert into auth.users(id) select t.uid(n) from generate_series(1, 14) n;
insert into public.profiles(id, full_name, is_admin, banned, created_at, last_login_at, telegram_chat_id) values
  (t.uid(1),  'Admin Albasse',   true,  false, now() - interval '90 days', now(),                       1001),
  (t.uid(2),  'Amina Hassan',    false, false, now() - interval '60 days', now() - interval '10 days',  1002), -- à contacter (absente 10 jours)
  (t.uid(3),  'Brahim Moussa',   false, false, now() - interval '60 days', now() - interval '2 days',   1003), -- est venu il y a 2 jours
  (t.uid(4),  'Carine Dillah',   false, false, now() - interval '60 days', now() - interval '12 days',  1004), -- a lié Telegram sans accepter les offres
  (t.uid(5),  'Djimet Ali',      false, false, now() - interval '60 days', now() - interval '12 days',  1005), -- a écrit STOP
  (t.uid(6),  'Esther Naba',     false, true,  now() - interval '60 days', now() - interval '12 days',  1006), -- compte bloqué
  (t.uid(7),  'Fatimé Oumar',    false, false, now() - interval '60 days', now() - interval '12 days',  1007), -- a commandé il y a 3 jours
  (t.uid(8),  'Gaston Ngar',     false, false, now() - interval '60 days', now() - interval '12 days',  null), -- pas de Telegram
  (t.uid(9),  'Hawa Abakar',     false, false, now() - interval '90 days', now() - interval '20 days',  1009), -- à contacter (absente 20 jours)
  (t.uid(10), 'Idriss Kemba',    false, false, now() - interval '90 days', now() - interval '15 days',  1010), -- message reçu il y a 5 jours
  (t.uid(11), 'Jeanne Mbaïdé',   false, false, now() - interval '90 days', now() - interval '30 days',  1011), -- message reçu il y a 20 jours : à recontacter
  (t.uid(12), 'Khadidja Saleh',  false, false, now() - interval '9 days',  null,                        1012), -- jamais connectée, compte créé il y a 9 jours
  (t.uid(13), 'Lazare Tchio',    false, false, now() - interval '90 days', now() - interval '40 days',  1013), -- a une visite récente (sessions) mais pas de connexion
  (t.uid(14), 'Mariam Zakaria',  false, false, now() - interval '90 days', now() - interval '25 days',  1014); -- à contacter (absente 25 jours)
insert into public.visitor_sessions(user_id, last_seen_at) values (t.uid(13), now() - interval '1 day');
insert into public.orders(user_id, created_at) values (t.uid(7), now() - interval '3 days');

-- 0. le script a créé ce qu'il fallait
select t.ok('réglages ajoutés (interrupteur éteint, limite 50)',
  (select telegram_absent_enabled = false and telegram_absent_daily_limit = 50 from public.store_settings where id = 1));
select t.ok('tables créées', (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('telegram_prefs', 'telegram_promos')) = 2);
select t.ok('sécurité par ligne activée sur les deux tables', (select count(*) from pg_class where relname in ('telegram_prefs', 'telegram_promos') and relrowsecurity) = 2);
select t.ok('deux planifications créées (9 h 30 et 17 h, heure de N''Djamena)',
  (select count(*) from cron.job) = 2
  and exists (select 1 from cron.job where jobname = 'telegram-absent-daily' and schedule = '30 8 * * *')
  and exists (select 1 from cron.job where jobname = 'telegram-promos-report' and schedule = '0 16 * * *'));

-- 1. les droits : ni visiteur ni client n'ont accès aux tables ni aux fonctions serveur
set role anon;
select t.fails('un visiteur ne peut pas lire telegram_prefs', 'select * from public.telegram_prefs', 'permission denied');
select t.fails('un visiteur ne peut pas lire telegram_promos', 'select * from public.telegram_promos', 'permission denied');
select t.fails('un visiteur ne peut pas réserver des clients', 'select * from public.telegram_absent_claim()', 'permission denied');
select t.fails('un visiteur ne peut pas lire le rapport', 'select public.telegram_promos_report()', 'permission denied');
select t.fails('un visiteur ne peut pas voir les chiffres de liaison', 'select public.telegram_linked_stats()', 'permission denied');
reset role;
set role authenticated;
select t.fails('un client ne peut pas lire telegram_prefs', 'select * from public.telegram_prefs', 'permission denied');
select t.fails('un client ne peut pas écrire dans telegram_promos', 'insert into public.telegram_promos(user_id) values (''00000000-0000-4000-8000-000000000002'')', 'permission denied');
select t.fails('un client ne peut pas se donner le consentement', 'insert into public.telegram_prefs(user_id, promos_ok) values (''00000000-0000-4000-8000-000000000002'', true)', 'permission denied');
select t.fails('un client ne peut pas réserver des clients', 'select * from public.telegram_absent_claim()', 'permission denied');
select t.fails('un client ne peut pas noter un envoi', 'select public.telegram_absent_record(null, ''sent'')', 'permission denied');
select t.fails('un client ne peut pas lire le rapport', 'select public.telegram_promos_report()', 'permission denied');
select t.fails('un client ne peut pas lancer l''envoi', 'select public.run_telegram_absent()', 'permission denied');
reset role;
set role service_role;
select t.ok('la fonction serveur (service_role) lit les tables', (select count(*) from public.telegram_prefs) = 0 and (select count(*) from public.telegram_promos) = 0);
reset role;

-- 2. consentements (ce que fait le bot quand un client lie son Telegram, ou écrit STOP)
insert into public.telegram_prefs(user_id, promos_ok, consented_at) select t.uid(n), true, now() - interval '30 days' from generate_series(2, 14) n where n not in (4);
insert into public.telegram_prefs(user_id, promos_ok) values (t.uid(4), false);
update public.telegram_prefs set stopped_at = now() - interval '5 days', stop_reason = 'STOP' where user_id = t.uid(5);
insert into public.telegram_promos(user_id, status, created_at, sent_at) values
  (t.uid(10), 'sent', now() - interval '5 days',  now() - interval '5 days'),
  (t.uid(11), 'sent', now() - interval '20 days', now() - interval '20 days');

-- 3. interrupteur éteint : personne n'est choisi, aucun appel
select t.ok('interrupteur éteint : personne n''est choisi', (select count(*) from public.telegram_absent_claim()) = 0);
select t.ok('interrupteur éteint : aucune réservation écrite', (select count(*) from public.telegram_promos where status = 'pending') = 0);
insert into vault.decrypted_secrets values ('email_cron_secret', 'secret-de-test');
select public.run_telegram_absent();
select t.ok('interrupteur éteint : la planification n''appelle pas la fonction serveur', (select count(*) from net.calls) = 0);

-- 4. interrupteur allumé : les bons clients, dans le bon ordre
update public.store_settings set telegram_absent_enabled = true where id = 1;
create temp table claimed as select * from public.telegram_absent_claim();
select t.ok('5 clients choisis : u2 (absente 10 j), u12 (compte créé il y a 9 j, jamais connecté), u9 (20 j), u14 (25 j), u11 (recontactée après 20 jours)',
  (select count(*) from claimed) = 5
  and exists (select 1 from claimed where o_user_id = t.uid(2) and o_name = 'Amina Hassan' and o_chat_id = 1002)
  and exists (select 1 from claimed where o_user_id = t.uid(12))
  and exists (select 1 from claimed where o_user_id = t.uid(9))
  and exists (select 1 from claimed where o_user_id = t.uid(14))
  and exists (select 1 from claimed where o_user_id = t.uid(11)));
select t.ok('pas l''administrateur', not exists (select 1 from claimed where o_user_id = t.uid(1)));
select t.ok('pas le client venu il y a 2 jours', not exists (select 1 from claimed where o_user_id = t.uid(3)));
select t.ok('pas celui qui n''a pas accepté les offres en liant Telegram', not exists (select 1 from claimed where o_user_id = t.uid(4)));
select t.ok('pas celui qui a écrit STOP', not exists (select 1 from claimed where o_user_id = t.uid(5)));
select t.ok('pas le compte bloqué', not exists (select 1 from claimed where o_user_id = t.uid(6)));
select t.ok('pas celui qui a commandé il y a 3 jours', not exists (select 1 from claimed where o_user_id = t.uid(7)));
select t.ok('pas celui qui n''a pas lié Telegram', not exists (select 1 from claimed where o_user_id = t.uid(8)));
select t.ok('pas celui qui a reçu un message il y a 5 jours (un message tous les 14 jours au plus)', not exists (select 1 from claimed where o_user_id = t.uid(10)));
select t.ok('celui dont le dernier message date de 20 jours est recontacté', exists (select 1 from claimed where o_user_id = t.uid(11)));
select t.ok('pas celui qui a une visite récente sans connexion (sessions du site)', not exists (select 1 from claimed where o_user_id = t.uid(13)));
select t.ok('les plus récemment absents d''abord (u12, u2, u9, u14, u11)',
  (select array_agg(o_user_id order by ctid) from claimed) = array[t.uid(12), t.uid(2), t.uid(9), t.uid(14), t.uid(11)]);
select t.ok('les choisis sont réservés (« pending ») : un deuxième passage ne les reprend pas', (select count(*) from public.telegram_promos where status = 'pending') = 5 and (select count(*) from public.telegram_absent_claim()) = 0);

-- 5. noter les résultats
select public.telegram_absent_record(t.uid(2), 'sent');
select public.telegram_absent_record(t.uid(9), 'failed', 'Bad Request: chat not found ou autre erreur très longue ' || repeat('x', 300));
select public.telegram_absent_record(t.uid(14), 'blocked', 'Forbidden: bot was blocked by the user');
select t.ok('envoyé : statut et heure notés', (select status = 'sent' and sent_at is not null from public.telegram_promos where user_id = t.uid(2) and created_at > now() - interval '1 minute'));
select t.ok('échec : statut noté, erreur coupée à 200 signes', (select status = 'failed' and sent_at is null and length(error) = 200 from public.telegram_promos where user_id = t.uid(9) and created_at > now() - interval '1 minute'));
select t.ok('bot bloqué : statut noté ET le client n''est plus jamais contacté',
  (select status = 'blocked' from public.telegram_promos where user_id = t.uid(14) and created_at > now() - interval '1 minute')
  and (select stopped_at is not null and stop_reason = 'bot bloqué' from public.telegram_prefs where user_id = t.uid(14)));
select t.fails('un statut inconnu est refusé', 'select public.telegram_absent_record(null::uuid, ''ok'')', 'statut inconnu');
select t.ok('u11 (réservée, jamais notée) reste en attente : pas de double envoi le lendemain', (select status = 'pending' from public.telegram_promos where user_id = t.uid(11) and created_at > now() - interval '1 minute'));
select t.ok('un échec (non bloqué) est retenté plus tard : pas dans les 14 jours « protégés »',
  (select count(*) from public.telegram_promos where user_id = t.uid(9) and status in ('pending', 'sent') and created_at > now() - interval '14 days') = 0);

-- 6. la limite par jour
delete from public.telegram_promos where created_at > now() - interval '1 minute';
update public.store_settings set telegram_absent_daily_limit = 2 where id = 1;
update public.telegram_prefs set stopped_at = null, stop_reason = null where user_id = t.uid(14);
select t.ok('limite par jour : 2 clients seulement', (select count(*) from public.telegram_absent_claim()) = 2);
select t.ok('limite par jour : rien de plus dans les 20 heures qui suivent', (select count(*) from public.telegram_absent_claim()) = 0);
update public.store_settings set telegram_absent_daily_limit = 50 where id = 1;
delete from public.telegram_promos where created_at > now() - interval '1 minute';

-- 7. la planification appelle la fonction serveur, avec le secret
select public.run_telegram_absent();
select t.ok('interrupteur allumé : un appel à telegram-promo (action absent) avec le secret',
  (select count(*) from net.calls) = 1
  and (select url like '%/functions/v1/telegram-promo' and body->>'action' = 'absent' and headers->>'x-cron-secret' = 'secret-de-test' from net.calls limit 1));
delete from vault.decrypted_secrets;
select public.run_telegram_absent();
select t.ok('sans secret dans le coffre-fort : aucun appel de plus', (select count(*) from net.calls) = 1);
insert into vault.decrypted_secrets values ('email_cron_secret', 'secret-de-test');
select public.run_telegram_promos_report();
select t.ok('le rapport quotidien appelle telegram-promo (action report)', (select count(*) from net.calls) = 2 and (select body->>'action' = 'report' from net.calls order by id desc limit 1));

-- 8. le rapport : e-mails + Telegram, revenus et commandes APRÈS le message
delete from public.telegram_promos; delete from public.visitor_sessions; delete from public.orders; delete from public.email_outbox;
insert into public.telegram_promos(user_id, status, created_at, sent_at) values
  (t.uid(2), 'sent', now() - interval '1 minute', now() - interval '1 minute'),
  (t.uid(9), 'sent', now() - interval '2 days',  now() - interval '2 days'),
  (t.uid(11), 'sent', now() - interval '3 days', now() - interval '3 days'),
  (t.uid(14), 'failed', now() - interval '1 day', null),
  (t.uid(10), 'blocked', now() - interval '1 day', null),
  (t.uid(12), 'sent', now() - interval '10 days', now() - interval '10 days');
insert into public.visitor_sessions(user_id, last_seen_at) values (t.uid(9), now() - interval '1 day'), (t.uid(11), now() - interval '4 days');
insert into public.orders(user_id, created_at) values (t.uid(9), now() - interval '20 hours'), (t.uid(11), now() - interval '5 days');
insert into public.email_outbox(kind, user_id, status, sent_at) values
  ('promo_inactive', t.uid(2), 'sent', now() - interval '1 minute'),
  ('promo_inactive', t.uid(3), 'sent', now() - interval '1 minute'),
  ('promo_inactive', t.uid(4), 'sent', now() - interval '2 days'),
  ('promo_inactive', t.uid(5), 'failed', null),
  ('welcome', t.uid(6), 'sent', now() - interval '1 minute');
insert into public.visitor_sessions(user_id, last_seen_at) values (t.uid(4), now() - interval '1 day'), (t.uid(3), now() - interval '10 days');
create temp table rep as select public.telegram_promos_report() as r;
select t.ok('rapport Telegram : 1 message aujourd''hui, 3 sur 7 jours (celui d''il y a 10 jours ne compte pas)', (select (r->'telegram'->>'today')::int = 1 and (r->'telegram'->>'week')::int = 3 from rep));
select t.ok('rapport Telegram : 1 client revenu (visite après le message : u9) ; la visite d''u11 date d''AVANT son message', (select (r->'telegram'->>'returned')::int = 1 from rep));
select t.ok('rapport Telegram : 1 client a commandé après le message (u9) ; la commande d''u11 date d''avant', (select (r->'telegram'->>'orders')::int = 1 from rep));
select t.ok('rapport Telegram : 1 échec et 1 bot bloqué', (select (r->'telegram'->>'failed')::int = 1 and (r->'telegram'->>'blocked')::int = 1 from rep));
select t.ok('rapport e-mails : 2 aujourd''hui, 3 sur 7 jours (pas l''échec, pas le « bienvenue »)', (select (r->'emails'->>'today')::int = 2 and (r->'emails'->>'week')::int = 3 from rep));
select t.ok('rapport e-mails : 1 client revenu après l''e-mail (u4) ; la visite d''u3 date d''avant', (select (r->'emails'->>'returned')::int = 1 from rep));
select t.ok('rapport : les deux interrupteurs sont lus', (select (r->>'telegram_enabled')::boolean = true and (r->>'emails_enabled')::boolean = false from rep));
select t.ok('rapport : clients liés (12 hors administrateur), 10 qui ont accepté et ne sont pas arrêtés, 1 arrêté',
  (select (r->'linked'->>'linked')::int = 12 and (r->'linked'->>'consented')::int = 10 and (r->'linked'->>'stopped')::int = 1 from rep));

-- 9. le nombre de clients liés, pour l'écran administrateur
select set_config('request.jwt.claim.sub', t.uid(1)::text, false);
set role authenticated;
select t.ok('un administrateur voit les chiffres de liaison', (select (public.telegram_linked_stats()->>'linked')::int = 12));
reset role;
select set_config('request.jwt.claim.sub', t.uid(2)::text, false);
set role authenticated;
select t.ok('un client ordinaire n''obtient rien', public.telegram_linked_stats() is null);
reset role;

-- 10. la suppression d'un compte efface ses traces
delete from auth.users where id = t.uid(9);
select t.ok('compte supprimé : ses préférences et son journal disparaissent', (select count(*) from public.telegram_prefs where user_id = t.uid(9)) = 0 and (select count(*) from public.telegram_promos where user_id = t.uid(9)) = 0);

select 'TOUS LES CONTROLES SONT PASSES' as resultat;
