-- Contrôles de add-password-request-alert.sql sur un Postgres local jetable (voir tests/sql/run-password-alert.sh).
create schema t;
grant usage on schema t to public;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.calls() returns int language sql as $$ select count(*)::int from net.calls $$;
create function t.alerts() returns int language sql as $$ select count(*)::int from public.password_request_alerts $$;
create function t.last_text() returns text language sql as $$ select body->>'text' from net.calls order by id desc limit 1 $$;
-- une demande faite comme un visiteur sans compte (rôle anon), puis retour au rôle de départ
create function t.ask(p_login text) returns void language plpgsql as $$
begin
  set local role anon;
  perform public.notify_admin_password_request(p_login);
  reset role;
end $$;
create function t.reset() returns void language plpgsql as $$ begin delete from net.calls; delete from public.password_request_alerts; end $$;

-- les gens : 1 = administrateur (Telegram lié), 2 = client par numéro, 3 = ancien compte avec e-mail, 4 = 2e administrateur sans Telegram, 5 = client par numéro sans ville,
-- 6 et 7 = deux comptes qui se terminent par les mêmes 8 chiffres
insert into public.profiles (id, email, full_name, phone, whatsapp_number, region, is_admin, telegram_chat_id, created_at) values
  (t.u(1), 'admin@exemple.com', 'Patron', '66000000', null, 'N''Djamena', true, 424242, '2026-01-01'),
  (t.u(2), '23566123456@tel.albasseshopping.com', 'Éric Moussa', '66 12 34 56', null, 'N''Djamena', false, null, '2026-02-01'),
  (t.u(3), 'amina@gmail.com', 'Amina', '99 88 77 66', '+235 99 88 77 66', 'Doba', false, null, '2026-01-15'),
  (t.u(4), 'admin2@exemple.com', 'Second', '66777777', null, null, true, null, '2026-01-01'),
  (t.u(5), '23566111111@tel.albasseshopping.com', 'Zakaria', '0023566111111', null, '   ', false, null, '2026-03-01'),
  (t.u(6), 'ancien@gmail.com', 'Vieux compte', '66 55 44 33', null, 'Abéché', false, null, '2026-01-01'),
  (t.u(7), '23566554433@tel.albasseshopping.com', 'Nouveau compte', '66 55 44 33', null, 'Abéché', false, null, '2026-04-01');
insert into vault.decrypted_secrets values ('telegram_bot_token', '123456:FAKE-TOKEN-FOR-TESTS-ONLY-xxxxxxxxxxxxxxx');

-- 0. ce que le script crée
select t.ok('journal créé, sécurité par ligne activée', (select relrowsecurity from pg_class where relname = 'password_request_alerts'));
select t.ok('journal : seulement id, client, moyen, date (aucun mot de passe, aucun code)',
  (select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'password_request_alerts') = 'channel,created_at,id,user_id');
select t.ok('droits du journal : l''anonyme n''a rien, le connecté peut seulement lire',
  not has_table_privilege('anon', 'public.password_request_alerts', 'select')
  and not has_table_privilege('anon', 'public.password_request_alerts', 'insert')
  and has_table_privilege('authenticated', 'public.password_request_alerts', 'select')
  and not has_table_privilege('authenticated', 'public.password_request_alerts', 'insert')
  and not has_table_privilege('authenticated', 'public.password_request_alerts', 'update')
  and not has_table_privilege('authenticated', 'public.password_request_alerts', 'delete'));
select t.ok('la fonction est ouverte aux visiteurs (anon) et aux connectés, pas à « public »',
  has_function_privilege('anon', 'public.notify_admin_password_request(text)', 'execute')
  and has_function_privilege('authenticated', 'public.notify_admin_password_request(text)', 'execute'));

-- 1. un client par numéro demande un nouveau mot de passe
select t.ask('66 12 34 56');
select t.ok('numéro connu : 1 message Telegram', t.calls() = 1);
select t.ok('le message part au compte administrateur lié (424242) par le bot, en texte simple (sans mise en forme à risque)',
  (select (body->>'chat_id') = '424242' and url like 'https://api.telegram.org/bot123456:FAKE-TOKEN%/sendMessage' and not (body ? 'parse_mode') from net.calls limit 1));
select t.ok('le message dit « Mot de passe oublié », le nom, le numéro et la ville',
  t.last_text() like '🔑 Mot de passe oublié%' and t.last_text() like '%Éric Moussa%' and t.last_text() like '%66 12 34 56%' and t.last_text() like '%N''Djamena%');
select t.ok('le message donne le lien direct vers la fiche du client et son WhatsApp (235 + 8 chiffres)',
  t.last_text() like '%https://www.albasseshopping.com/admin/clients/00000000-0000-4000-8000-000000000002%' and t.last_text() like '%https://wa.me/23566123456%');
select t.ok('le message ne contient ni mot de passe ni code (hors liens) et jamais le token du bot', regexp_replace(t.last_text(), 'https?://\S+', '', 'g') !~* '(mot de passe\s*:|code\s*:|\m[0-9]{6}\M)' and t.last_text() not like '%FAKE-TOKEN%');
select t.ok('le journal garde : quel client, par numéro', (select user_id = t.u(2) and channel = 'phone' from public.password_request_alerts));

-- 2. pas plus d'une alerte par client toutes les 30 minutes
select t.ask('66 12 34 56');
select t.ask('+235 66 12 34 56');
select t.ok('2 demandes de plus dans les 30 minutes : aucun message de plus', t.calls() = 1 and t.alerts() = 1);
update public.password_request_alerts set created_at = now() - interval '31 minutes';
select t.ask('66 12 34 56');
select t.ok('31 minutes plus tard : une nouvelle alerte', t.calls() = 2 and t.alerts() = 2);

-- 3. toutes les façons d'écrire le même numéro trouvent le même client
select t.reset();
select t.ask('+235 66 12 34 56'); select t.ok('« +235 66 12 34 56 »', t.last_text() like '%Éric Moussa%'); select t.reset();
select t.ask('0023566123456');    select t.ok('« 0023566123456 »', t.last_text() like '%Éric Moussa%'); select t.reset();
select t.ask('23566123456');      select t.ok('« 23566123456 »', t.last_text() like '%Éric Moussa%'); select t.reset();
select t.ask('66123456');         select t.ok('« 66123456 » (sans espaces)', t.last_text() like '%Éric Moussa%'); select t.reset();
select t.ask('  66-12.34 56  ');  select t.ok('espaces, tirets et points autour', t.last_text() like '%Éric Moussa%'); select t.reset();
select t.ask('99887766');         select t.ok('numéro WhatsApp d''un ancien compte avec e-mail : trouvé, WhatsApp préféré', t.last_text() like '%Amina%' and t.last_text() like '%+235 99 88 77 66%' and t.last_text() like '%wa.me/23599887766%'); select t.reset();
select t.ask('66111111');         select t.ok('numéro écrit « 00235… » dans le profil : trouvé par ses 8 derniers chiffres, sans ville : pas de ligne 📍', t.last_text() like '%Zakaria%' and t.last_text() not like '%📍%'); select t.reset();
select t.ask('66 55 44 33');
select t.ok('2 comptes avec le même numéro : celui créé avec ce numéro (connexion par numéro) passe d''abord', t.last_text() like '%Nouveau compte%' and t.calls() = 1);
select t.reset();

-- 4. ancien compte avec e-mail : l'équipe est seulement prévenue
select t.ask('amina@gmail.com');
select t.ok('e-mail connu : 1 message « par e-mail », sans demander de code', t.calls() = 1 and t.last_text() like '🔑 Mot de passe oublié (par e-mail)%' and t.last_text() like '%Amina · amina@gmail.com%' and t.last_text() like '%rien à faire%');
select t.ok('…avec le lien vers sa fiche', t.last_text() like '%/admin/clients/00000000-0000-4000-8000-000000000003%');
select t.ok('…et le journal note « email »', (select channel = 'email' from public.password_request_alerts));
select t.reset();
select t.ask('  AMINA@Gmail.COM ');
select t.ok('e-mail en majuscules et espaces autour : trouvé', t.calls() = 1);
select t.reset();

-- 5. ce qui n'envoie rien (et ne fait jamais d'erreur)
select t.ask('66 99 99 99');       select t.ok('numéro inconnu : rien', t.calls() = 0 and t.alerts() = 0);
select t.ask('inconnu@gmail.com'); select t.ok('e-mail inconnu : rien', t.calls() = 0 and t.alerts() = 0);
select t.ask('66000000');          select t.ok('numéro du compte administrateur : rien', t.calls() = 0 and t.alerts() = 0);
select t.ask('admin@exemple.com'); select t.ok('e-mail du compte administrateur : rien', t.calls() = 0 and t.alerts() = 0);
select t.ask('');                  select t.ask('   ');   select t.ask('12'); select t.ask('1234567'); select t.ask('abc');
select t.ok('vide, espaces, trop court, lettres : rien', t.calls() = 0 and t.alerts() = 0);
select t.ask(null);
select t.ok('valeur absente (null) : rien, sans erreur', t.calls() = 0 and t.alerts() = 0);
select t.ask(repeat('6', 500));
select t.ok('texte très long : rien, sans erreur', t.calls() = 0 and t.alerts() = 0);
select t.ask('''; drop table public.profiles; --');
select t.ask('x@y.z'' or ''1''=''1');
select t.ok('texte piégé (guillemets, point-virgule) : rien, la table existe toujours', t.calls() = 0 and (select count(*) from public.profiles) = 7);
-- la réponse est la même pour un compte connu et inconnu (on ne peut pas deviner les numéros)
select t.ok('la fonction ne renvoie jamais rien (void), compte connu ou non', pg_typeof(public.notify_admin_password_request('66 12 34 56'))::text = 'void' and pg_typeof(public.notify_admin_password_request('66 99 99 99'))::text = 'void');
select t.reset();

-- 6. sans token ou sans administrateur lié : rien n'est envoyé, rien n'échoue
delete from vault.decrypted_secrets where name = 'telegram_bot_token';
select t.ask('66 12 34 56');
select t.ok('token du bot absent : aucun message, aucun journal, aucune erreur', t.calls() = 0 and t.alerts() = 0);
insert into vault.decrypted_secrets values ('telegram_bot_token', '123456:FAKE-TOKEN-FOR-TESTS-ONLY-xxxxxxxxxxxxxxx');
update public.profiles set telegram_chat_id = null where id = t.u(1);
select t.ask('66 12 34 56');
select t.ok('aucun administrateur n''a lié Telegram : aucun message, aucun journal, aucune erreur', t.calls() = 0 and t.alerts() = 0);
update public.profiles set telegram_chat_id = 424242 where id = t.u(1);
select t.ask('66 12 34 56');
select t.ok('Telegram relié de nouveau : l''alerte repart (rien n''avait été « consommé »)', t.calls() = 1 and t.alerts() = 1);
select t.reset();

-- 7. plusieurs administrateurs liés : chacun reçoit le message
update public.profiles set telegram_chat_id = 515151 where id = t.u(4);
select t.ask('66 12 34 56');
select t.ok('2 administrateurs liés : 2 messages (424242 et 515151), 1 seule ligne de journal', t.calls() = 2 and t.alerts() = 1 and (select string_agg(body->>'chat_id', ',' order by body->>'chat_id') from net.calls) = '424242,515151');
update public.profiles set telegram_chat_id = null where id = t.u(4);
select t.reset();

-- 8. au plus 20 alertes par heure en tout
insert into public.password_request_alerts (user_id, channel, created_at) select t.u(3), 'phone', now() - interval '10 minutes' - (g || ' seconds')::interval from generate_series(1, 20) g;
select t.ask('66 12 34 56');
select t.ok('20 alertes déjà dans l''heure : plus aucune (on ne peut pas inonder le Telegram du patron)', t.calls() = 0);
update public.password_request_alerts set created_at = now() - interval '61 minutes';
select t.ask('66 12 34 56');
select t.ok('une heure plus tard : l''alerte repart', t.calls() = 1);
select t.reset();

-- 9. le journal est nettoyé après 30 jours
insert into public.password_request_alerts (user_id, channel, created_at) values (t.u(3), 'phone', now() - interval '31 days'), (t.u(3), 'email', now() - interval '29 days');
select t.ask('66 99 99 99');
select t.ok('journal : 31 jours effacés, 29 jours gardés', (select count(*) from public.password_request_alerts) = 1 and (select channel from public.password_request_alerts) = 'email');
select t.reset();

-- 10. le journal : les administrateurs le lisent, les autres non
insert into public.password_request_alerts (user_id, channel) values (t.u(2), 'phone');
begin;
set local role authenticated;
set local test.is_admin = 'off';
select t.ok('client ordinaire connecté : ne voit aucune ligne du journal', (select count(*) from public.password_request_alerts) = 0);
set local test.is_admin = 'on';
select t.ok('administrateur : voit le journal', (select count(*) from public.password_request_alerts) = 1);
rollback;
begin;
set local role anon;
do $$ begin
  begin
    perform count(*) from public.password_request_alerts;
    raise exception 'ECHEC anon lit le journal';
  exception when insufficient_privilege then raise notice 'OK    visiteur sans compte (anon) : lecture du journal refusée';
  end;
end $$;
rollback;

-- 11. le script relancé ne change rien d'autre
select t.ok('une seule fonction du même nom (pas de doublon après relance)', (select count(*) from pg_proc where proname = 'notify_admin_password_request') = 1);
