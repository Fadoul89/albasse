-- Contrôles de add-partners.sql sur un Postgres local jetable (voir tests/sql/run-partners.sh).
create schema t;
grant usage on schema t to public;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.ok(label text, cond boolean, detail text) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC % : %', label, detail; end if;
end $$;
create function t.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.refused(stmt text) returns boolean language plpgsql as $$
begin
  begin execute stmt; return false;
  exception when others then return true;
  end;
end $$;
create function t.last_text() returns text language sql as $$ select body->>'text' from net.calls order by id desc limit 1 $$;
create function t.reset() returns void language plpgsql as $$ begin delete from net.calls; end $$;
-- passe une commande et rend le texte envoyé sur Telegram (null si rien n'est parti)
create function t.order_text(p_items jsonb) returns text language plpgsql as $$
declare txt text;
begin
  delete from net.calls;
  insert into public.orders (items, shipping_name, shipping_phone, shipping_city, total) values (p_items, 'Aïcha Moussa', '66 11 11 11', 'N''Djamena', 25500);
  select body->>'text' into txt from net.calls order by id desc limit 1;
  return txt;
end $$;

-- les gens : 1 = administrateur (Telegram lié) ; les articles : 11 à 14
insert into public.profiles (id, is_admin, telegram_chat_id) values (t.u(1), true, 424242), (t.u(2), false, null);
insert into public.products (id, name, price) values (t.u(11), 'Montre KEEP MOVING', 11000), (t.u(12), 'Parfum Oud', 22000), (t.u(13), 'Sac doré', 30000), (t.u(14), 'Article à moi', 5000);
insert into vault.decrypted_secrets values ('telegram_bot_token', '123456:FAKE-TOKEN-FOR-TESTS-ONLY-xxxxxxxxxxxxxxx');

-- 0. ce que le script crée et protège
select t.ok('les 2 tables existent, sécurité par ligne activée',
  (select count(*) from pg_class where relname in ('partners', 'product_partners') and relrowsecurity) = 2);
select t.ok('la table publique « products » ne reçoit AUCUNE colonne de partenaire (le lien ne voyage jamais avec les articles montrés aux clients)',
  (select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'products') = 'id,name,price');
select t.ok('droits : l''anonyme n''a rien du tout sur les deux tables',
  not has_table_privilege('anon', 'public.partners', 'select') and not has_table_privilege('anon', 'public.partners', 'insert')
  and not has_table_privilege('anon', 'public.product_partners', 'select') and not has_table_privilege('anon', 'public.product_partners', 'insert'));
select t.ok('droits : le connecté a les droits de table, mais seule la sécurité par ligne (administrateurs) décide',
  has_table_privilege('authenticated', 'public.partners', 'select') and has_table_privilege('authenticated', 'public.product_partners', 'insert')
  and (select count(*) from pg_policies where tablename in ('partners', 'product_partners') and policyname like '%admin_all') = 2);

-- 1. règles de la base : nom obligatoire et tailles
select t.ok('nom vide refusé', t.refused($$insert into public.partners (name) values ('')$$));
select t.ok('nom d''espaces refusé', t.refused($$insert into public.partners (name) values ('    ')$$));
select t.ok('nom de 81 caractères refusé', t.refused($$insert into public.partners (name) values (repeat('x', 81))$$));
select t.ok('petit mot de 301 caractères refusé', t.refused($$insert into public.partners (name, note) values ('A', repeat('x', 301))$$));
select t.ok('téléphone de 41 caractères refusé', t.refused($$insert into public.partners (name, phone) values ('A', repeat('6', 41))$$));

-- 2. les partenaires et les liens
insert into public.partners (id, name, phone, note) values
  (t.u(101), 'Mahamat Ali', '66 12 34 56', 'Marché de Dembé'),
  (t.u(102), 'Boutique Amina', null, null),
  (t.u(103), 'Idriss', '   ', 'sans numéro');
insert into public.product_partners (product_id, partner_id, note) values (t.u(11), t.u(101), 'Prix chez lui : 8 000'), (t.u(12), t.u(102), null);
select t.ok('un article n''a qu''un seul partenaire : un 2e lien pour le même article est refusé', t.refused(format($$insert into public.product_partners (product_id, partner_id) values (%L, %L)$$, t.u(11), t.u(102))));
select t.ok('lien vers un article ou un partenaire inexistant : refusé', t.refused(format($$insert into public.product_partners (product_id, partner_id) values (%L, %L)$$, t.u(999), t.u(101))) and t.refused(format($$insert into public.product_partners (product_id, partner_id) values (%L, %L)$$, t.u(13), t.u(999))));
insert into public.product_partners (product_id, partner_id) values (t.u(13), t.u(101));
select t.ok('un partenaire peut avoir plusieurs articles', (select count(*) from public.product_partners where partner_id = t.u(101)) = 2);
-- le changement de partenaire par « upsert » (comme le site)
insert into public.product_partners (product_id, partner_id, note) values (t.u(13), t.u(102), 'changé') on conflict (product_id) do update set partner_id = excluded.partner_id, note = excluded.note;
select t.ok('upsert : l''article 13 passe chez Boutique Amina avec son petit message', (select partner_id = t.u(102) and note = 'changé' from public.product_partners where product_id = t.u(13)));

-- 3. qui peut lire quoi
begin;
set local role authenticated;
set local test.is_admin = 'off';
select t.ok('client connecté (pas administrateur) : ne voit AUCUN partenaire ni aucun lien', (select count(*) from public.partners) = 0 and (select count(*) from public.product_partners) = 0);
select t.ok('client connecté : ne peut rien ajouter, modifier ni supprimer',
  t.refused($$insert into public.partners (name) values ('Pirate')$$)
  and (select count(*) from (select 1 from public.partners where false) x) = 0);
update public.partners set name = 'Piraté';
delete from public.product_partners;
rollback;
select t.ok('…et rien n''a bougé (modifier / supprimer par un client ne touche aucune ligne)', (select count(*) from public.partners where name = 'Piraté') = 0 and (select count(*) from public.product_partners) = 3);
begin;
set local role authenticated;
set local test.is_admin = 'on';
select t.ok('administrateur : voit les 3 partenaires et les 3 liens', (select count(*) from public.partners) = 3 and (select count(*) from public.product_partners) = 3);
insert into public.partners (name, phone) values ('Nouveau partenaire', '99 88 77 66');
select t.ok('administrateur : peut ajouter', (select count(*) from public.partners) = 4);
update public.partners set note = 'modifié par le patron' where name = 'Nouveau partenaire';
select t.ok('administrateur : peut modifier', (select note from public.partners where name = 'Nouveau partenaire') = 'modifié par le patron');
delete from public.partners where name = 'Nouveau partenaire';
select t.ok('administrateur : peut supprimer', (select count(*) from public.partners) = 3);
rollback;
begin;
set local role anon;
do $$ begin
  begin perform count(*) from public.partners; raise exception 'ECHEC anon lit les partenaires';
  exception when insufficient_privilege then raise notice 'OK    visiteur sans compte (anon) : lecture des partenaires refusée'; end;
  begin perform count(*) from public.product_partners; raise exception 'ECHEC anon lit les liens';
  exception when insufficient_privilege then raise notice 'OK    visiteur sans compte (anon) : lecture des liens refusée'; end;
end $$;
rollback;

-- 4. l'alerte Telegram de nouvelle commande
-- 4a. commande sans aucun article de partenaire : EXACTEMENT le même message qu'avant
select t.ok('commande sans partenaire : message identique à l''ancienne alerte, mot pour mot', (
  with o as (select * from public.orders limit 0)
  select t.order_text(jsonb_build_array(jsonb_build_object('product_id', t.u(14), 'product_name', 'Article à moi', 'quantity', 2)))
       = public.telegram_notify_admin_new_order_old(row(null, jsonb_build_array(jsonb_build_object('product_id', t.u(14), 'product_name', 'Article à moi', 'quantity', 2)), 'Aïcha Moussa', '66 11 11 11', 'N''Djamena', 25500)::public.orders)));
select t.ok('…envoyé au compte administrateur lié (424242) par le bot', (select (body->>'chat_id') = '424242' and url like 'https://api.telegram.org/bot123456:FAKE-TOKEN%/sendMessage' from net.calls limit 1));
-- 4b. commande avec un article de partenaire
select t.order_text(jsonb_build_array(jsonb_build_object('product_id', t.u(11), 'product_name', 'Montre KEEP MOVING', 'quantity', 1)));
select t.ok('article de Mahamat : ligne « 🤝 Partenaire : Mahamat Ali · 66 12 34 56 — Prix chez lui : 8 000 » sous l''article',
  t.last_text() like E'%• Montre KEEP MOVING × 1\n   🤝 Partenaire : Mahamat Ali · 66 12 34 56 — Prix chez lui : 8 000\n%', t.last_text());
select t.ok('…le reste du message est inchangé (client, ville, total)', t.last_text() like '🛒 Nouvelle commande%Aïcha Moussa · 66 11 11 11%N''Djamena%💰 25 500 FCFA');
-- 4c. partenaire sans téléphone ni petit message / avec téléphone vide
select t.order_text(jsonb_build_array(jsonb_build_object('product_id', t.u(12), 'product_name', 'Parfum Oud', 'quantity', 3)));
select t.ok('partenaire sans téléphone ni message : « 🤝 Partenaire : Boutique Amina » seul', t.last_text() like E'%• Parfum Oud × 3\n   🤝 Partenaire : Boutique Amina\n%' and t.last_text() not like '%Boutique Amina ·%' and t.last_text() not like '%Boutique Amina —%');
insert into public.product_partners (product_id, partner_id) values (t.u(14), t.u(103));
select t.order_text(jsonb_build_array(jsonb_build_object('product_id', t.u(14), 'product_name', 'Article à moi', 'quantity', 1)));
select t.ok('téléphone d''espaces : ignoré (pas de « · » vide)', t.last_text() like E'%🤝 Partenaire : Idriss\n%' and t.last_text() not like '%Idriss ·%');
delete from public.product_partners where product_id = t.u(14);
-- 4d. plusieurs articles : l'ordre de la commande est gardé, seuls les articles de partenaires ont leur ligne
select t.order_text(jsonb_build_array(
  jsonb_build_object('product_id', t.u(14), 'product_name', 'Article à moi', 'quantity', 1),
  jsonb_build_object('product_id', t.u(11), 'product_name', 'Montre KEEP MOVING', 'quantity', 2),
  jsonb_build_object('product_id', t.u(12), 'product_name', 'Parfum Oud', 'quantity', 1)));
select t.ok('3 articles : dans l''ordre de la commande, une ligne 🤝 sous la montre et sous le parfum, aucune sous l''article à moi',
  position('• Article à moi × 1' in t.last_text()) < position('• Montre KEEP MOVING × 2' in t.last_text())
  and position('• Montre KEEP MOVING × 2' in t.last_text()) < position('• Parfum Oud × 1' in t.last_text())
  and (length(t.last_text()) - length(replace(t.last_text(), '🤝', ''))) / length('🤝') = 2
  and t.last_text() like E'%• Article à moi × 1\n• Montre%', t.last_text());
-- 4e. commandes bizarres : jamais d'échec de la commande, message quand même
select t.ok('article sans product_id : pas d''erreur, ligne simple', t.order_text(jsonb_build_array(jsonb_build_object('product_name', 'Sans identifiant', 'quantity', 1))) like E'%• Sans identifiant × 1\n💰%');
select t.ok('product_id qui n''est pas un identifiant : pas d''erreur, ligne simple', t.order_text(jsonb_build_array(jsonb_build_object('product_id', 'abc', 'product_name', 'Identifiant bizarre', 'quantity', 1))) like E'%• Identifiant bizarre × 1\n💰%');
select t.ok('product_id d''un article supprimé : pas d''erreur, ligne simple', t.order_text(jsonb_build_array(jsonb_build_object('product_id', t.u(555), 'product_name', 'Article disparu', 'quantity', 1))) like E'%• Article disparu × 1\n💰%');
select t.ok('commande sans articles : pas d''erreur', t.order_text('[]'::jsonb) like '🛒 Nouvelle commande%💰 25 500 FCFA' and t.order_text(null) like '🛒 Nouvelle commande%');
select t.ok('la commande est bien enregistrée même quand l''alerte ne peut pas partir (items qui n''est pas une liste)', (select count(*) from (select t.order_text('{"a":1}'::jsonb)) x) = 1 and (select count(*) from public.orders) >= 8);
-- 4f. sans token ou sans administrateur lié : rien n'est envoyé, rien n'échoue
delete from vault.decrypted_secrets where name = 'telegram_bot_token';
select t.ok('token du bot absent : aucun message, commande enregistrée', t.order_text(jsonb_build_array(jsonb_build_object('product_id', t.u(11), 'product_name', 'Montre', 'quantity', 1))) is null);
insert into vault.decrypted_secrets values ('telegram_bot_token', '123456:FAKE-TOKEN-FOR-TESTS-ONLY-xxxxxxxxxxxxxxx');
update public.profiles set telegram_chat_id = null where id = t.u(1);
select t.ok('aucun administrateur lié à Telegram : aucun message, commande enregistrée', t.order_text(jsonb_build_array(jsonb_build_object('product_id', t.u(11), 'product_name', 'Montre', 'quantity', 1))) is null);
update public.profiles set telegram_chat_id = 424242 where id = t.u(1);
select t.ok('Telegram relié de nouveau : l''alerte repart', t.order_text(jsonb_build_array(jsonb_build_object('product_id', t.u(11), 'product_name', 'Montre', 'quantity', 1))) like '%🤝 Partenaire : Mahamat Ali%');

-- 5. suppressions : jamais les articles
delete from public.partners where id = t.u(102);
select t.ok('supprimer un partenaire retire seulement les liens de ses articles (articles 12 et 13) ; les 4 articles existent toujours',
  (select count(*) from public.product_partners where partner_id = t.u(102)) = 0 and (select count(*) from public.product_partners) = 1 and (select count(*) from public.products) = 4);
delete from public.products where id = t.u(11);
select t.ok('supprimer un article retire son lien ; le partenaire reste', (select count(*) from public.product_partners) = 0 and (select count(*) from public.partners where id = t.u(101)) = 1);
select t.ok('une seule fonction d''alerte de commande (pas de doublon après relance)', (select count(*) from pg_proc where proname = 'telegram_notify_admin_new_order') = 1);
select t.ok('la fonction d''alerte n''est appelable ni par anon ni par un client connecté (déclencheur seulement)', not has_function_privilege('anon', 'public.telegram_notify_admin_new_order()', 'execute') and not has_function_privilege('authenticated', 'public.telegram_notify_admin_new_order()', 'execute'));
