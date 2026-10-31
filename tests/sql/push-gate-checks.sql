-- Contrôles de add-push-gate.sql sur un Postgres local jetable (voir tests/sql/run-push-gate.sh).
-- Toutes les heures sont des heures du Tchad (UTC+1) ; le gardien reçoit l'heure à laquelle il « regarde » (run_push_gate(p_now)).
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
create function t.at(s text) returns timestamptz language sql immutable as $$ select (s || '+01')::timestamptz $$;
create function t.pid(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.pushes() returns bigint language sql as $$ select count(*) from net.calls where url like '%send-web-push' $$;
create function t.notifs() returns bigint language sql as $$ select count(*) from public.product_notifications $$;
-- les annonces créées par les déclencheurs prennent l'heure RÉELLE de la machine : on les date à l'heure simulée du test
create function t.stamp(ts text) returns void language sql as $$
  update public.push_outbox set created_at = t.at(ts) where status = 'pending' and created_at between now() - interval '10 minutes' and now() + interval '1 minute' $$;
create function t.pending(k text) returns bigint language sql as $$ select count(*) from public.push_outbox where status = 'pending' and kind = k $$;

-- 0. le script a créé ce qu'il fallait
select t.ok('réglages ajoutés : gardien actif, écart 3 h, 2 par jour, de 9 h à 20 h',
  (select push_gate_enabled and push_min_gap_minutes = 180 and push_max_per_day = 2 and push_window_start = 9 and push_window_end = 20 from public.store_settings where id = 1));
select t.ok('nouveaux articles : interrupteur ÉTEINT par défaut', (select push_new_products_enabled = false from public.store_settings where id = 1));
select t.ok('file d''attente créée, sécurité par ligne activée', (select relrowsecurity from pg_class where relname = 'push_outbox'));
select t.ok('une seule planification : « albasse-push-gate » chaque minute (l''ancienne est partie, l''autre tâche est intacte)',
  (select count(*) from cron.job) = 2
  and exists (select 1 from cron.job where jobname = 'albasse-push-gate' and schedule = '* * * * *')
  and exists (select 1 from cron.job where jobname = 'une-autre-tache')
  and not exists (select 1 from cron.job where jobname = 'albasse-scheduled-pushes'));
select t.ok('l''ancien nom run_scheduled_pushes() appelle le gardien', (select prosrc like '%run_push_gate%' from pg_proc where proname = 'run_scheduled_pushes'));

-- 1. les produits ; les 3 abonnés aux notifications
insert into public.web_push_subscriptions select from generate_series(1, 3);
-- interrupteur « nouveaux articles » éteint : publier ne fait rien (ni file, ni notification)
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(99), 'Article sans notification', 1000, 5, true, true);
select t.ok('interrupteur éteint : publier un article n''envoie rien et ne met rien en attente', t.pending('new') = 0 and t.notifs() = 0 and t.pushes() = 0);
update public.store_settings set push_new_products_enabled = true where id = 1;
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values
  (t.pid(1), 'Montre A', 15000, 5, true, true),   -- « nouvel article » : va dans la file
  (t.pid(2), 'Montre B', 20000, 5, true, false),
  (t.pid(3), 'Montre C', 21000, 5, true, false),
  (t.pid(4), 'Montre D', 22000, 5, true, false),
  (t.pid(5), 'Montre E', 23000, 5, true, false);
select t.ok('nouvel article : la notification attend dans la file, rien ne part', t.pending('new') = 1 and t.notifs() = 0 and t.pushes() = 0);

update public.products set is_flash_sale = true where id in (t.pid(2), t.pid(3), t.pid(4), t.pid(5));
select t.ok('4 ventes flash à la même minute : 4 annonces en attente, rien ne part', t.pending('promo') = 4 and t.notifs() = 0 and t.pushes() = 0);
update public.products set is_flash_sale = false where id = t.pid(2);
update public.products set is_flash_sale = true where id = t.pid(2);
select t.ok('la même annonce n''attend pas deux fois', t.pending('promo') = 4);
select t.stamp('2026-11-02 08:00');

-- Montre D est la plus regardée de la semaine
insert into public.visitor_product_interest(visitor_id, product_id, views, last_viewed_at) values
  ('v1', t.pid(4)::text, 9, t.at('2026-11-01 10:00')),
  ('v2', t.pid(3)::text, 2, t.at('2026-11-01 11:00'));

-- 2. lundi 2 novembre : la fenêtre d'envoi, l'écart, le regroupement
select t.ok('7 h : trop tôt, rien ne part', public.run_push_gate(t.at('2026-11-02 07:00')) = 0 and t.notifs() = 0);
select t.ok('20 h : trop tard, rien ne part', public.run_push_gate(t.at('2026-11-02 20:00')) = 0 and t.notifs() = 0);
select t.ok('les annonces attendent toujours', t.pending('promo') = 4 and t.pending('new') = 1);

select t.ok('9 h : UNE seule notification part', public.run_push_gate(t.at('2026-11-02 09:00')) = 1 and t.notifs() = 1 and t.pushes() = 1);
select t.ok('les promotions passent avant le nouvel article, regroupées : « 4 promotions en cours » avec l''article le plus regardé',
  (select title = '🔥 4 promotions en cours' and message = 'Montre D et 3 autres articles en vente flash' and product_id = t.pid(4) and created_at = t.at('2026-11-02 09:00') from public.product_notifications));
select t.ok('file : 1 envoyée, 3 regroupées, le nouvel article attend',
  (select count(*) from public.push_outbox where kind = 'promo' and status = 'sent') = 1
  and (select count(*) from public.push_outbox where kind = 'promo' and status = 'merged') = 3
  and t.pending('promo') = 0 and t.pending('new') = 1);
select t.ok('l''envoi réel est fait une fois (les deux fonctions d''envoi, un seul message)',
  (select count(*) from net.calls) = 2 and t.pushes() = 1 and (select count(*) from net.calls where url like '%send-product-push') = 1);

select t.ok('1 minute plus tard : rien (écart)', public.run_push_gate(t.at('2026-11-02 09:01')) = 0 and t.notifs() = 1);
select t.ok('11 h 59 : rien (écart de 3 h pas fini)', public.run_push_gate(t.at('2026-11-02 11:59')) = 0 and t.notifs() = 1);
select t.ok('12 h 00 : le nouvel article part', public.run_push_gate(t.at('2026-11-02 12:00')) = 1 and t.notifs() = 2);
select t.ok('… tel quel (une seule annonce, pas de regroupement)',
  (select title = '🛍️ Nouveau produit disponible' and message like 'Montre A — %FCFA' and product_id = t.pid(1) from public.product_notifications where created_at = t.at('2026-11-02 12:00')));

-- 3. le plafond du jour
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(6), 'Montre F', 24000, 5, true, true);
select t.stamp('2026-11-02 13:00');
select t.ok('15 h : écart respecté mais 2 notifications déjà parties aujourd''hui : rien', public.run_push_gate(t.at('2026-11-02 15:00')) = 0 and t.notifs() = 2 and t.pending('new') = 1);
select t.ok('le lendemain 9 h : le plafond repart de zéro, la notification part', public.run_push_gate(t.at('2026-11-03 09:00')) = 1 and t.notifs() = 3);

-- 4. ce qui n'a plus de sens n'est jamais annoncé
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values
  (t.pid(7), 'Montre G', 25000, 5, true, true),
  (t.pid(8), 'Montre H', 26000, 5, true, true),
  (t.pid(9), 'Montre I', 27000, 5, false, true);   -- désactivée
update public.products set is_flash_sale = false where id = t.pid(5);
update public.products set is_flash_sale = true where id = t.pid(5);   -- nouvelle vente flash de E
update public.products set is_flash_sale = false where id = t.pid(5);  -- … terminée avant l'envoi
update public.products set stock = 0 where id = t.pid(7);              -- épuisée avant l'envoi
insert into public.push_outbox(product_id, kind, title, message, created_at) values (t.pid(8), 'new', 'Vieille', 'annonce', t.at('2026-11-01 12:00'));
select t.stamp('2026-11-04 08:00');
select t.ok('4 novembre 10 h : les annonces périmées sont écartées, seule la valable (Montre H) part', public.run_push_gate(t.at('2026-11-04 10:00')) = 1 and t.notifs() = 4);
select t.ok('vente flash terminée : « promotion terminée »', (select note from public.push_outbox where product_id = t.pid(5) and kind = 'promo' and status = 'expired') = 'promotion terminée');
select t.ok('article épuisé : « article indisponible »', (select status || ':' || note from public.push_outbox where product_id = t.pid(7)) = 'expired:article indisponible');
select t.ok('article désactivé : « article indisponible »', (select status || ':' || note from public.push_outbox where product_id = t.pid(9)) = 'expired:article indisponible');
select t.ok('annonce de plus de 24 h : abandonnée', (select status || ':' || note from public.push_outbox where title = 'Vieille') = 'expired:trop ancienne (plus de 24 h)');
select t.ok('l''annonce valable est partie, une seule', (select count(*) from public.push_outbox where product_id = t.pid(8) and status = 'sent') = 1 and t.pending('new') = 0 and t.pending('promo') = 0);

-- 5. les notifications programmées par l'administrateur : leur heure, mais jamais deux ensemble
insert into public.scheduled_pushes(product_id, title, message, send_at) values
  (t.pid(1), 'M1', 'message un',   t.at('2026-11-05 21:00')),
  (t.pid(2), 'M2', 'message deux', t.at('2026-11-05 21:00'));
select t.ok('20 h 59 : pas encore l''heure', public.run_push_gate(t.at('2026-11-05 20:59')) = 0);
select t.ok('21 h 00 (hors fenêtre : c''est son choix) : UNE seule des deux part', public.run_push_gate(t.at('2026-11-05 21:00')) = 1 and t.notifs() = 5);
select t.ok('la première programmée est partie (téléphones comptés), la seconde attend',
  (select status = 'sent' and sent_at = t.at('2026-11-05 21:00') and recipients = 3 from public.scheduled_pushes where title = 'M1')
  and (select status = 'pending' from public.scheduled_pushes where title = 'M2'));
select t.ok('21 h 01 et 23 h 59 : la seconde attend l''écart', public.run_push_gate(t.at('2026-11-05 21:01')) = 0 and public.run_push_gate(t.at('2026-11-05 23:59')) = 0 and t.notifs() = 5);
select t.ok('minuit : la seconde part (écart de 3 h, la fenêtre ne compte pas pour elle)', public.run_push_gate(t.at('2026-11-06 00:00')) = 1 and t.notifs() = 6);
select t.ok('… et elle est marquée envoyée', (select status = 'sent' from public.scheduled_pushes where title = 'M2'));

-- la programmée passe avant l'automatique
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(10), 'Montre J', 28000, 5, true, true);
select t.stamp('2026-11-07 08:00');
insert into public.scheduled_pushes(product_id, title, message, send_at) values (t.pid(3), 'M3', 'message trois', t.at('2026-11-07 10:00'));
select t.ok('7 novembre 10 h : une notification part', public.run_push_gate(t.at('2026-11-07 10:00')) = 1);
select t.ok('… c''est la programmée (avant l''automatique, qui attend)', (select title from public.product_notifications order by created_at desc limit 1) = 'M3' and t.pending('new') = 1);
select t.ok('13 h : l''automatique part (écart de 3 h respecté)', public.run_push_gate(t.at('2026-11-07 13:00')) = 1 and t.notifs() = 8);
-- une programmée juste après une automatique attend
insert into public.scheduled_pushes(product_id, title, message, send_at) values (t.pid(4), 'M4', 'message quatre', t.at('2026-11-07 13:05'));
select t.ok('13 h 05 : la programmée attend l''écart', public.run_push_gate(t.at('2026-11-07 13:05')) = 0 and t.notifs() = 8);
select t.ok('16 h 00 : elle part', public.run_push_gate(t.at('2026-11-07 16:00')) = 1 and t.notifs() = 9);
-- article épuisé
insert into public.scheduled_pushes(product_id, title, message, send_at) values (t.pid(7), 'M5', 'message cinq', t.at('2026-11-08 10:00'));
select t.ok('programmée pour un article épuisé : rien ne part', public.run_push_gate(t.at('2026-11-08 10:00')) = 0 and t.notifs() = 9);
select t.ok('… elle est abandonnée (jamais envoyée)', (select status = 'expired' from public.scheduled_pushes where title = 'M5'));

-- 6. les bonnes heures : celles où le site est le plus fréquenté (moyenne de la fenêtre)
select t.ok('peu de visites (moins de 100) : toutes les heures de la fenêtre sont bonnes', public.push_good_hours(9, 20, t.at('2026-11-10 12:00')) = array[9,10,11,12,13,14,15,16,17,18,19]);
insert into public.visitor_product_interest(visitor_id, product_id, views, last_viewed_at)
select 'h' || h || '-' || g, 'x', 1, t.at('2026-11-09 ' || lpad(h::text, 2, '0') || ':30') - ((g % 7) || ' days')::interval
from (values (9,144),(10,157),(11,187),(12,179),(13,136),(14,83),(15,94),(16,79),(17,85),(18,125),(19,204)) v(h, n), generate_series(1, v.n) g;
insert into public.visitor_product_interest(visitor_id, product_id, views, last_viewed_at)   -- très actif la nuit : hors fenêtre, ignoré
select 'n' || g, 'x', 1, t.at('2026-11-09 22:30') from generate_series(1, 300) g;
select t.ok('beaucoup de visites : seules les heures au-dessus de la moyenne gardées (9–13 h et 19 h)', public.push_good_hours(9, 20, t.at('2026-11-10 12:00')) = array[9,10,11,12,13,19]);
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(11), 'Montre K', 29000, 5, true, true);
select t.stamp('2026-11-10 08:00');
select t.ok('15 h (creux) : rien', public.run_push_gate(t.at('2026-11-10 15:00')) = 0);
select t.ok('18 h (juste sous la moyenne) : rien', public.run_push_gate(t.at('2026-11-10 18:00')) = 0 and t.pending('new') >= 1);
select t.ok('19 h (pic du soir) : part', public.run_push_gate(t.at('2026-11-10 19:00')) = 1);

-- 7. les réglages sont respectés
update public.store_settings set push_window_start = 10, push_window_end = 12, push_min_gap_minutes = 60, push_max_per_day = 5 where id = 1;
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(12), 'Montre L', 30000, 5, true, true);
select t.stamp('2026-11-11 08:00');
select t.ok('fenêtre 10 h–12 h : à 9 h, rien', public.run_push_gate(t.at('2026-11-11 09:00')) = 0);
select t.ok('à 10 h : rien (dans la fenêtre, mais 10 h est sous la moyenne de la fenêtre : 157 visiteurs contre 187 à 11 h)', public.run_push_gate(t.at('2026-11-11 10:00')) = 0);
select t.ok('à 11 h : part (heure au-dessus de la moyenne de la fenêtre)', public.run_push_gate(t.at('2026-11-11 11:00')) = 1);
select t.ok('écart de 60 minutes : rien à 11 h 30', public.run_push_gate(t.at('2026-11-11 11:30')) = 0);
update public.store_settings set push_window_start = 15, push_window_end = 15 where id = 1;
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(13), 'Montre M', 31000, 5, true, true);
select t.stamp('2026-11-11 08:00');
select t.ok('fenêtre invalide (début = fin) : retour à 9 h–20 h, il part à 12 h 00 (bonne heure, 60 min passées)', public.run_push_gate(t.at('2026-11-11 12:00')) = 1);
update public.store_settings set push_window_start = 9, push_window_end = 20, push_min_gap_minutes = 180, push_max_per_day = 2 where id = 1;

-- 7 bis. on éteint l'interrupteur « nouveaux articles » alors qu'une annonce attend : elle ne partira jamais
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(17), 'Montre Q', 35000, 5, true, true);
select t.stamp('2026-11-12 08:00');
select t.ok('une annonce « nouvel article » attend', t.pending('new') = 1);
update public.store_settings set push_new_products_enabled = false where id = 1;
select t.ok('interrupteur éteint : le gardien n''envoie rien', public.run_push_gate(t.at('2026-11-12 11:00')) = 0);
select t.ok('… et l''annonce est abandonnée (« nouveaux articles désactivés »)', (select status || ':' || note from public.push_outbox where product_id = t.pid(17)) = 'expired:nouveaux articles désactivés');
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(18), 'Montre R', 36000, 5, true, true);
select t.ok('éteint : un nouvel article publié ne crée rien', (select count(*) from public.push_outbox where product_id = t.pid(18)) = 0);
update public.store_settings set push_new_products_enabled = true where id = 1;
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(19), 'Montre S', 37000, 5, true, false);
select t.ok('rallumé, mais « notify_on_publish » faux pour cet article : rien', (select count(*) from public.push_outbox where product_id = t.pid(19)) = 0);
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(20), 'Montre T', 38000, 5, true, true);
select t.ok('rallumé : le nouvel article attend de nouveau dans la file', (select count(*) from public.push_outbox where product_id = t.pid(20) and status = 'pending') = 1);
select t.stamp('2026-11-12 08:00');

-- 8. gardien éteint : comme avant
update public.store_settings set push_gate_enabled = false where id = 1;
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(14), 'Montre N', 32000, 5, true, true);
select t.ok('gardien éteint : le nouvel article part tout de suite, rien dans la file',
  (select count(*) from public.push_outbox where product_id = t.pid(14)) = 0
  and (select count(*) from public.product_notifications where product_id = t.pid(14)) = 1);
update public.store_settings set push_gate_enabled = true where id = 1;
insert into public.products(id, name, price, stock, is_active, notify_on_publish) values (t.pid(15), 'Montre O', 33000, 5, true, true), (t.pid(16), 'Montre P', 34000, 5, true, true);
update public.store_settings set push_gate_enabled = false where id = 1;
select t.ok('on éteint le gardien avec 3 annonces en attente (Montre T, O et P) : elles partent, une par une, comme avant', public.run_push_gate(t.at('2026-11-12 03:00')) = 3);
select t.ok('… marquées « envoyée sans gardien »', (select count(*) from public.push_outbox where note = 'envoyée sans gardien') = 3);
update public.store_settings set push_gate_enabled = true where id = 1;

-- 9. droits d'accès
reset role;
select set_config('test.is_admin', 'off', false);
set role anon;
select t.fails('un visiteur ne lit pas la file', 'select count(*) from public.push_outbox', 'permission denied');
reset role;
set role authenticated;
select t.ok('un client connecté ne voit aucune ligne de la file', (select count(*) from public.push_outbox) = 0);
select t.fails('un client ne peut pas écrire dans la file', 'insert into public.push_outbox(product_id, kind, title, message) select id, ''new'', ''x'', ''y'' from public.products limit 1', 'permission denied');
select t.fails('un client ne peut pas lancer le gardien', 'select public.run_push_gate()', 'permission denied');
select t.fails('un client ne peut pas mettre une annonce dans la file', 'select public.push_enqueue(null, ''new'', ''x'', ''y'')', 'permission denied');
select t.fails('un client ne peut pas appeler les bonnes heures', 'select public.push_good_hours()', 'permission denied');
reset role;
select set_config('test.is_admin', 'on', false);
set role authenticated;
select t.ok('un administrateur lit la file', (select count(*) from public.push_outbox) > 10);
select t.fails('même un administrateur n''écrit pas directement dans la file', 'delete from public.push_outbox', 'permission denied');
reset role;

select 'TOUS LES CONTROLES SONT PASSES' as resultat;
