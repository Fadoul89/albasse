-- Contrôles de add-client-number.sql (voir tests/sql/run-client-number.sh).
create schema t;
grant usage on schema t to public;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.num(n int) returns integer language sql as $$ select client_number from public.profiles where id = t.u(n) $$;
-- une demande « mot de passe oublié » faite comme un visiteur sans compte (rôle anon)
create function t.ask(p_login text) returns void language plpgsql as $$
begin
  set local role anon;
  perform public.notify_admin_password_request(p_login);
  reset role;
end $$;
create function t.last_text() returns text language sql as $$ select body->>'text' from net.calls order by id desc limit 1 $$;

-- 1. les comptes qui existaient : un numéro chacun, du plus ancien au plus récent
select t.ok('3 comptes existants : tous ont un numéro', (select count(*) from public.profiles where client_number is not null) = 3);
select t.ok('le plus ancien (Amina, 5 janvier) a le numéro 1', t.num(3) = 1);
select t.ok('le suivant (Éric, 10 janvier) a le numéro 2', t.num(2) = 2);
select t.ok('le plus récent (le patron, 1er mars) a le numéro 3', t.num(1) = 3);
select t.ok('les numéros sont tous différents', (select count(distinct client_number) from public.profiles) = 3);

-- 2. le script relancé ne renumérote rien (rejoué avant ces contrôles) : les numéros ci-dessus sont déjà ceux d'après la 2e exécution
select t.ok('la colonne est obligatoire', (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'client_number') = 'NO');
select t.ok('un seul index unique sur le numéro', (select count(*) from pg_indexes where tablename = 'profiles' and indexname = 'profiles_client_number_key') = 1);
select t.ok('un seul déclencheur de protection (pas de doublon après relance)', (select count(*) from pg_trigger where tgname = 'protect_client_number' and not tgisinternal) = 1);
select t.ok('la séquence appartient à la colonne (supprimer la colonne la supprime)',
  exists (select 1 from pg_depend d join pg_class s on s.oid = d.objid and s.relkind = 'S' where s.relname = 'client_number_seq' and d.refobjid = 'public.profiles'::regclass and d.deptype = 'a'));

-- 3. un nouveau compte (comme le déclencheur de la base : id + e-mail seulement) reçoit tout de suite le numéro suivant
insert into public.profiles (id, email) values (t.u(4), '23566000004@tel.albasseshopping.com');
insert into public.profiles (id, email) values (t.u(5), '23566000005@tel.albasseshopping.com');
select t.ok('nouveau compte : numéro 4', t.num(4) = 4);
select t.ok('compte suivant : numéro 5', t.num(5) = 5);

-- 4. le serveur (service_role) peut créer un compte ; le numéro vient tout seul
set role service_role;
insert into public.profiles (id, email) values (t.u(6), 'serveur@exemple.com');
reset role;
select t.ok('création par le serveur (service_role) : numéro 6', t.num(6) = 6);

-- 5. le site (anon, authenticated) n'a pas besoin de la séquence
select t.ok('anon et authenticated n''ont aucun droit sur la séquence',
  not has_sequence_privilege('anon', 'public.client_number_seq', 'usage') and not has_sequence_privilege('authenticated', 'public.client_number_seq', 'usage'));
select t.ok('le serveur peut s''en servir', has_sequence_privilege('service_role', 'public.client_number_seq', 'usage'));

-- 6. personne ne change un numéro depuis le site
begin;
set local role authenticated;
set local test.is_admin = 'off';
do $$ begin
  begin
    update public.profiles set client_number = 99 where id = t.u(2);
    raise exception 'ECHEC un client change son numéro';
  exception when insufficient_privilege then raise notice 'OK    client connecté : changer son numéro est refusé';
  end;
end $$;
do $$ begin
  begin
    update public.profiles set client_number = 1 where id = t.u(2);
    raise exception 'ECHEC un client prend le numéro d''un autre';
  exception when insufficient_privilege then raise notice 'OK    client connecté : prendre le numéro d''un autre est refusé';
  end;
end $$;
update public.profiles set full_name = 'Éric M.' where id = t.u(2);
select t.ok('client connecté : modifier son nom reste possible (le déclencheur ne gêne rien d''autre)', (select full_name from public.profiles where id = t.u(2)) = 'Éric M.');
update public.profiles set client_number = client_number where id = t.u(2);
select t.ok('client connecté : réécrire le même numéro n''est pas une modification', t.num(2) = 2);
rollback;
begin;
set local role authenticated;
set local test.is_admin = 'on';
do $$ begin
  begin
    update public.profiles set client_number = 99 where id = t.u(2);
    raise exception 'ECHEC un administrateur du site change un numéro';
  exception when insufficient_privilege then raise notice 'OK    même un administrateur connecté au site ne change pas un numéro';
  end;
end $$;
rollback;
begin;
set local role anon;
do $$ begin
  begin
    update public.profiles set client_number = 99 where id = t.u(2);
    -- anon n'a pas le droit de modifier du tout : zéro ligne ou refus, jamais de changement
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
select t.ok('aucun numéro n''a changé pendant ces essais', t.num(2) = 2 and t.num(3) = 1 and t.num(1) = 3);
-- l'éditeur SQL de Supabase (rôle postgres) peut corriger un numéro à la main si un jour il le faut
update public.profiles set client_number = 77 where id = t.u(6);
select t.ok('l''éditeur SQL (propriétaire) peut corriger un numéro', t.num(6) = 77);
update public.profiles set client_number = 6 where id = t.u(6);

-- 7. unicité
do $$ begin
  begin
    update public.profiles set client_number = 1 where id = t.u(2);
    raise exception 'ECHEC deux comptes avec le même numéro';
  exception when unique_violation then raise notice 'OK    deux comptes ne peuvent pas avoir le même numéro';
  end;
end $$;
do $$ begin
  begin
    update public.profiles set client_number = null where id = t.u(2);
    raise exception 'ECHEC un compte sans numéro';
  exception when not_null_violation then raise notice 'OK    un compte sans numéro est refusé';
  end;
end $$;

-- 8. l'alerte Telegram « mot de passe oublié » porte le numéro (et marche aussi sans la colonne : voir run-client-number.sh, 1re passe)
select t.ask('66 12 34 56');
select t.ok('alerte client par numéro : « 🪪 N° client : AS-000002 »', t.last_text() like E'%🪪 N° client : AS-000002\n%');
select t.ok('alerte : le numéro client est entre le téléphone et la suite', t.last_text() like E'%📞 66 12 34 56\n🪪 N° client : AS-000002\n%');
delete from public.password_request_alerts;
select t.ask('amina@gmail.com');
select t.ok('alerte client par e-mail : « 🪪 N° client : AS-000001 »', t.last_text() like E'%🪪 N° client : AS-000001\n%');
select t.ok('l''alerte ne contient toujours ni mot de passe ni code', t.last_text() !~* 'mot de passe : |code :');

-- 9. « Mot de passe oublié » : le client tape son numéro client, ou l'e-mail d'un compte créé avec le numéro
delete from net.calls;
delete from public.password_request_alerts;
-- Fatimé : compte créé avec le numéro (connexion 235…@tel…) qui a AUSSI donné un vrai e-mail (profiles.email) : le cas de 88 comptes
insert into auth.users (id, email) values (t.u(7), '23566998877@tel.albasseshopping.com');
insert into public.profiles (id, email, full_name, phone, region) values (t.u(7), 'fatime@gmail.com', 'Fatimé Oumar', '66 99 88 77', 'Moundou');
select t.ask('fatime@gmail.com');
select t.ok('e-mail d''un compte créé avec le numéro : l''équipe est prévenue « il attend un nouveau code »', t.last_text() like E'%🔑 Mot de passe oublié\nFatimé Oumar%' and t.last_text() like E'%Il attend un nouveau code.%');
select t.ok('… avec la ligne qui explique : demande faite avec son e-mail, aucun lien ne part', t.last_text() like E'%✉️ Demande faite avec son e-mail%');
select t.ok('… le numéro client, le lien vers la fiche et le WhatsApp du client', t.last_text() like E'%🪪 N° client : AS-000007%' and t.last_text() like '%/admin/clients/' || t.u(7)::text || '%' and t.last_text() like '%https://wa.me/23566998877%');
select t.ok('… journal : moyen « phone » (c''est un code à donner, pas un lien à envoyer)', (select channel from public.password_request_alerts where user_id = t.u(7)) = 'phone');
select t.ok('une seule alerte pour la demande de Fatimé', (select count(*) from net.calls) = 1);
select t.ask('amina@gmail.com');
select t.ok('ancien compte : « 🔑 Mot de passe oublié (par e-mail) » et « rien à faire »', t.last_text() like E'%(par e-mail)%' and t.last_text() like '%rien à faire%' and t.last_text() not like '%Il attend un nouveau code%');
select t.ok('ancien compte : le numéro client est quand même dit', t.last_text() like E'%🪪 N° client : AS-000001%');
delete from net.calls;
delete from public.password_request_alerts;
select t.ask('AS-000002');
select t.ok('numéro client « AS-000002 » : Éric Moussa, avec son téléphone et son numéro client', t.last_text() like E'%Éric Moussa%' and t.last_text() like E'%📞 66 12 34 56%' and t.last_text() like E'%🪪 N° client : AS-000002%');
select t.ok('numéro client : « Il attend un nouveau code » et pas la ligne « par e-mail »', t.last_text() like '%Il attend un nouveau code.%' and t.last_text() not like '%Demande faite avec son e-mail%');
delete from net.calls;
delete from public.password_request_alerts;
select t.ask('as 2');
select t.ok('« as 2 » (écrit à la main) retrouve aussi le client 2', (select count(*) from net.calls) = 1 and t.last_text() like E'%Éric Moussa%');
delete from net.calls;
delete from public.password_request_alerts;
select t.ask('2');
select t.ok('« 2 » seul (7 chiffres ou moins) = le numéro client 2', (select count(*) from net.calls) = 1 and t.last_text() like E'%Éric Moussa%');
delete from net.calls;
delete from public.password_request_alerts;
select t.ask('AS-000999');
select t.ok('numéro client qui n''existe pas : aucune alerte, aucune trace', (select count(*) from net.calls) = 0 and (select count(*) from public.password_request_alerts) = 0);
select t.ask('AS-000003');
select t.ok('le numéro d''un compte administrateur (le patron, n° 3) : aucune alerte', (select count(*) from net.calls) = 0);
select t.ask('AS-000000');
select t.ask('0');
select t.ok('numéro zéro : rien', (select count(*) from net.calls) = 0);
select t.ask('AS-9999999999');
select t.ok('numéro trop long : rien (et pas d''erreur)', (select count(*) from net.calls) = 0);
select t.ask('66 12 34 56');
select t.ok('un numéro de téléphone de 8 chiffres reste un téléphone (jamais pris pour un numéro client)', (select count(*) from net.calls) = 1 and t.last_text() like E'%Éric Moussa%');
select t.ask('23566123456');
select t.ok('le même client redemande tout de suite : toujours 1 seule alerte (1 par client / 30 min)', (select count(*) from net.calls) = 1);
