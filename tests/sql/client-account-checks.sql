-- Contrôles de add-client-account-admin.sql (voir tests/sql/run-client-account.sh).
create schema t;
grant usage on schema t to public;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
-- tente une modification comme administrateur connecté ; renvoie le message d'erreur, ou 'ok'
create function t.edit(p_target uuid, p_changes jsonb, p_admin boolean default true) returns text language plpgsql as $$
begin
  perform set_config('test.is_admin', case when p_admin then 'on' else 'off' end, true);
  perform set_config('test.uid', t.u(1)::text, true);
  set local role authenticated;
  begin
    perform public.admin_update_client_profile(p_target, p_changes);
  exception when others then
    reset role;
    return sqlerrm;
  end;
  reset role;
  return 'ok';
end $$;
create function t.info(p_target uuid, p_admin boolean default true) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('test.is_admin', case when p_admin then 'on' else 'off' end, true);
  set local role authenticated;
  r := public.admin_client_account_info(p_target);
  reset role;
  return r;
exception when others then
  reset role;
  return jsonb_build_object('error', sqlerrm);
end $$;

-- les comptes : 1 = administrateur, 2 = connecté par son numéro (avec vrai e-mail de contact), 3 = connecté par son numéro (sans e-mail),
-- 4 = ancien compte connecté par e-mail, 5 = compte fermé, 6 = un deuxième administrateur
insert into auth.users (id, email) values
  (t.u(1), 'admin@exemple.com'), (t.u(2), '23566123456@tel.albasseshopping.com'), (t.u(3), '23566111111@tel.albasseshopping.com'),
  (t.u(4), 'amina@gmail.com'), (t.u(5), 'closed-000005@closed.albasseshopping.com'), (t.u(6), 'admin2@exemple.com');
insert into public.profiles (id, email, full_name, phone, whatsapp_number, region, country, address, profession, is_admin, client_number) values
  (t.u(1), 'admin@exemple.com', 'Patron', '66000000', null, null, null, null, null, true, 1),
  (t.u(2), 'eric@gmail.com', 'Éric Moussa', '66 12 34 56', null, 'N''Djamena', 'Tchad', 'Quartier Farcha', 'Chauffeur', false, 2),
  (t.u(3), '23566111111@tel.albasseshopping.com', 'Zakaria', '66 11 11 11', null, null, null, null, null, false, 3),
  (t.u(4), 'amina@gmail.com', 'Amina', '99 88 77 66', '+235 99 88 77 66', 'Doba', 'Tchad', null, null, false, 4),
  (t.u(5), 'closed-000005@closed.albasseshopping.com', 'Compte fermé', null, null, null, null, null, null, false, 5),
  (t.u(6), 'admin2@exemple.com', 'Second', '66777777', null, null, null, null, null, true, 6);
insert into public.orders (user_id) values (t.u(2)), (t.u(2)), (t.u(4));

-- 1. le journal : droits
select t.ok('journal créé, sécurité par ligne activée', (select relrowsecurity from pg_class where relname = 'client_account_log'));
select t.ok('journal : le visiteur (anon) n''a aucun droit',
  not has_table_privilege('anon', 'public.client_account_log', 'select') and not has_table_privilege('anon', 'public.client_account_log', 'insert'));
select t.ok('journal : le connecté peut seulement LIRE (pas écrire, pas effacer)',
  has_table_privilege('authenticated', 'public.client_account_log', 'select') and not has_table_privilege('authenticated', 'public.client_account_log', 'insert')
  and not has_table_privilege('authenticated', 'public.client_account_log', 'update') and not has_table_privilege('authenticated', 'public.client_account_log', 'delete'));
select t.ok('journal : la fonction serveur (service_role) peut lire et écrire', has_table_privilege('service_role', 'public.client_account_log', 'select') and has_table_privilege('service_role', 'public.client_account_log', 'insert'));
select t.ok('journal : colonnes = quand, qui, quel compte, numéro client, action, détail (aucun nom, téléphone ni e-mail)',
  (select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'client_account_log') = 'action,admin_id,client_number,created_at,detail,id,target_id');

-- 2. comment le client se connecte
select t.ok('info : compte par numéro → « phone », 2 commandes', t.info(t.u(2)) @> '{"login_kind":"phone","orders":2,"is_admin":false}');
select t.ok('info : compte par numéro sans commande → 0', t.info(t.u(3)) @> '{"login_kind":"phone","orders":0}');
select t.ok('info : ancien compte → « email », 1 commande', t.info(t.u(4)) @> '{"login_kind":"email","orders":1}');
select t.ok('info : compte fermé → « closed »', t.info(t.u(5)) @> '{"login_kind":"closed"}');
select t.ok('info : compte administrateur signalé', t.info(t.u(6)) @> '{"is_admin":true}');
select t.ok('info : refusé à un client ordinaire', t.info(t.u(2), false) ->> 'error' = 'Non autorise');
select t.ok('info : client introuvable', t.info(t.u(99)) ->> 'error' = 'Client introuvable');
select t.ok('info : l''anonyme n''a pas le droit d''appeler la fonction', not has_function_privilege('anon', 'public.admin_client_account_info(uuid)', 'execute'));

-- 3. modifier la fiche
select t.ok('refusé à un client ordinaire', t.edit(t.u(2), '{"region":"Moundou"}', false) = 'Non autorise');
select t.ok('client introuvable', t.edit(t.u(99), '{"region":"Moundou"}') = 'Client introuvable');
select t.ok('compte administrateur : jamais modifié ici', t.edit(t.u(6), '{"region":"Moundou"}') like 'Compte administrateur%');
select t.ok('compte fermé : non modifiable', t.edit(t.u(5), '{"region":"Moundou"}') like 'Compte fermé%');
select t.ok('demande vide ou pas un objet : refusée', t.edit(t.u(2), '{}') = 'Demande invalide' and t.edit(t.u(2), '[1]') = 'Demande invalide' and t.edit(t.u(2), 'null') = 'Demande invalide');
select t.ok('champ inconnu refusé (is_admin, client_number, loyalty_points, id, created_at…)',
  t.edit(t.u(2), '{"is_admin":true}') like 'Champ non modifiable%' and t.edit(t.u(2), '{"client_number":99}') like 'Champ non modifiable%'
  and t.edit(t.u(2), '{"loyalty_points":9999}') like 'Champ non modifiable%' and t.edit(t.u(2), '{"id":"x"}') like 'Champ non modifiable%');
select t.ok('valeur qui n''est pas du texte : refusée', t.edit(t.u(2), '{"region":12}') like 'Valeur invalide%' and t.edit(t.u(2), '{"full_name":{"a":1}}') like 'Valeur invalide%');
select t.ok('rien n''a changé pendant les refus', (select region from public.profiles where id = t.u(2)) = 'N''Djamena' and (select is_admin from public.profiles where id = t.u(2)) = false and (select client_number from public.profiles where id = t.u(2)) = 2);
select t.ok('aucune ligne de journal pour les refus', (select count(*) from public.client_account_log) = 0);

select t.ok('modification valable (nom, ville, pays, adresse, profession) : ok', t.edit(t.u(2), '{"full_name":"  Éric Moussa Ali ","region":" Moundou ","country":"Tchad","address":"Quartier Béinamar","profession":"Commerçant"}') = 'ok');
select t.ok('les valeurs sont écrites sans espaces autour', (select full_name || '|' || region || '|' || address || '|' || profession from public.profiles where id = t.u(2)) = 'Éric Moussa Ali|Moundou|Quartier Béinamar|Commerçant');
select t.ok('journal : une ligne « edit » avec le numéro client 2 et SEULEMENT les noms des champs',
  (select count(*) from public.client_account_log where action = 'edit' and target_id = t.u(2) and client_number = 2) = 1
  and (select detail from public.client_account_log where target_id = t.u(2)) = 'fiche modifiée : nom, ville, pays, adresse, profession'
  and (select detail from public.client_account_log where target_id = t.u(2)) not like '%Moundou%');
select t.ok('journal : l''administrateur qui l''a fait est noté', (select admin_id from public.client_account_log where target_id = t.u(2)) = t.u(1));
select t.ok('champ vide = effacé (profession, adresse) (modification acceptée)', t.edit(t.u(2), '{"profession":"   ","address":""}') = 'ok');
select t.ok('champ vide = effacé (profession, adresse) (valeur écrite)', true and (select profession from public.profiles where id = t.u(2)) is null and (select address from public.profiles where id = t.u(2)) is null);
select t.ok('nom trop court, vide ou trop long : refusé', t.edit(t.u(2), '{"full_name":"A"}') like 'Le nom doit avoir%' and t.edit(t.u(2), '{"full_name":"   "}') like 'Le nom doit avoir%' and t.edit(t.u(2), jsonb_build_object('full_name', repeat('x', 81))) like 'Le nom doit avoir%');
select t.ok('ville, pays, profession, adresse trop longs : refusés',
  t.edit(t.u(2), jsonb_build_object('region', repeat('x', 81))) like 'Ville trop longue%' and t.edit(t.u(2), jsonb_build_object('country', repeat('x', 81))) like 'Pays trop long%'
  and t.edit(t.u(2), jsonb_build_object('profession', repeat('x', 81))) like 'Profession trop longue%' and t.edit(t.u(2), jsonb_build_object('address', repeat('x', 201))) like 'Adresse trop longue%');

-- le WhatsApp et le téléphone
select t.ok('WhatsApp valable : écrit (modification acceptée)', t.edit(t.u(2), '{"whatsapp_number":"+235 66 12 34 56"}') = 'ok');
select t.ok('WhatsApp valable : écrit (valeur écrite)', true and (select whatsapp_number from public.profiles where id = t.u(2)) = '+235 66 12 34 56');
select t.ok('WhatsApp invalide (lettres, trop court) : refusé', t.edit(t.u(2), '{"whatsapp_number":"abc"}') like 'Numéro WhatsApp invalide%' and t.edit(t.u(2), '{"whatsapp_number":"1234"}') like 'Numéro WhatsApp invalide%');
select t.ok('WhatsApp vidé : effacé (modification acceptée)', t.edit(t.u(2), '{"whatsapp_number":""}') = 'ok');
select t.ok('WhatsApp vidé : effacé (valeur écrite)', true and (select whatsapp_number from public.profiles where id = t.u(2)) is null);
select t.ok('compte par numéro : le téléphone ne se change PAS ici (c''est la connexion)', t.edit(t.u(2), '{"phone":"66 99 99 99"}') like 'Le téléphone de connexion se change%' and (select phone from public.profiles where id = t.u(2)) = '66 12 34 56');
select t.ok('ancien compte (connexion par e-mail) : le téléphone de contact se change (modification acceptée)', t.edit(t.u(4), '{"phone":"66 22 33 44"}') = 'ok');
select t.ok('ancien compte (connexion par e-mail) : le téléphone de contact se change (valeur écrite)', true and (select phone from public.profiles where id = t.u(4)) = '66 22 33 44');
select t.ok('ancien compte : téléphone invalide refusé', t.edit(t.u(4), '{"phone":"xx"}') like 'Numéro de téléphone invalide%');
select t.ok('ancien compte : téléphone vidé accepté', t.edit(t.u(4), '{"phone":""}') = 'ok');
select t.ok('ancien compte : téléphone vidé (valeur écrite)', (select phone from public.profiles where id = t.u(4)) is null);

-- l'e-mail
select t.ok('compte par numéro : l''e-mail de contact se change (en minuscules) (modification acceptée)', t.edit(t.u(2), '{"email":" Eric.Moussa@Gmail.com "}') = 'ok');
select t.ok('compte par numéro : l''e-mail de contact se change (en minuscules) (valeur écrite)', true and (select email from public.profiles where id = t.u(2)) = 'eric.moussa@gmail.com');
select t.ok('e-mail invalide refusé (sans @, avec espace, adresse technique tel/closed)',
  t.edit(t.u(2), '{"email":"pas un email"}') like 'Adresse e-mail invalide%' and t.edit(t.u(2), '{"email":"x@tel.albasseshopping.com"}') like 'Adresse e-mail invalide%'
  and t.edit(t.u(2), '{"email":"x@closed.albasseshopping.com"}') like 'Adresse e-mail invalide%');
select t.ok('e-mail vidé : la fiche garde l''adresse tirée du numéro (jamais vide) (modification acceptée)', t.edit(t.u(2), '{"email":""}') = 'ok');
select t.ok('e-mail vidé : la fiche garde l''adresse tirée du numéro (jamais vide) (valeur écrite)', true and (select email from public.profiles where id = t.u(2)) = '23566123456@tel.albasseshopping.com');
select t.ok('ancien compte : l''e-mail EST la connexion, il ne se change pas ici', t.edit(t.u(4), '{"email":"autre@gmail.com"}') like 'L''e-mail de connexion d''un ancien compte se change avec%' and (select email from public.profiles where id = t.u(4)) = 'amina@gmail.com');

-- le journal ne retient aucune donnée personnelle
select t.ok('journal : aucun nom, e-mail, téléphone ni adresse dans le détail',
  not exists (select 1 from public.client_account_log where detail ~* '(@|gmail|66 12|Béinamar|Éric|Moundou)'));
select t.ok('journal : chaque modification réussie est notée (8 lignes)', (select count(*) from public.client_account_log where action = 'edit') = 8);

-- 4. lecture du journal
begin;
set local role authenticated;
set local test.is_admin = 'off';
select t.ok('client ordinaire : ne voit aucune ligne du journal', (select count(*) from public.client_account_log) = 0);
set local test.is_admin = 'on';
select t.ok('administrateur : voit le journal', (select count(*) from public.client_account_log) = 8);
rollback;
begin;
set local role anon;
do $$ begin
  begin
    perform count(*) from public.client_account_log;
    raise exception 'ECHEC anon lit le journal';
  exception when insufficient_privilege then raise notice 'OK    visiteur sans compte (anon) : lecture du journal refusée';
  end;
end $$;
rollback;

-- 5. le serveur écrit dans le journal
set role service_role;
insert into public.client_account_log (admin_id, target_id, client_number, action, detail) values (t.u(1), t.u(3), 3, 'change_login', 'connexion changée');
reset role;
select t.ok('la fonction serveur (service_role) peut noter une action', (select count(*) from public.client_account_log where action = 'change_login') = 1);
do $$ begin
  begin
    insert into public.client_account_log (target_id, action) values (gen_random_uuid(), 'autre');
  exception when others then raise notice 'OK    une action inconnue est refusée par le journal';
  end;
end $$;
