-- Contrôles de add-client-birth-marital.sql sur un Postgres local jetable (voir tests/sql/run-client-birth-marital.sh).
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
create function t.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.b(n int) returns date language sql security definer as $$ select birth_date from public.profiles where id = t.u(n) $$;
create function t.m(n int) returns text language sql security definer as $$ select marital_status from public.profiles where id = t.u(n) $$;
create function t.today() returns date language sql as $$ select (now() at time zone 'Africa/Ndjamena')::date $$;

-- 1 = administrateur, 2 et 3 = clients (aucune réponse au départ : comme les comptes d'aujourd'hui)
insert into public.profiles (id, full_name, is_admin) values (t.u(1), 'Admin', true), (t.u(2), 'Amina', false), (t.u(3), 'Idriss', false);

-- 0. ce que le script crée
select t.ok('colonnes créées, vides pour tout le monde',
  (select count(*) from public.profiles where birth_date is null and marital_status is null) = 3);
select t.ok('types : birth_date = date, marital_status = text',
  (select data_type from information_schema.columns where table_name = 'profiles' and column_name = 'birth_date') = 'date'
  and (select data_type from information_schema.columns where table_name = 'profiles' and column_name = 'marital_status') = 'text');
select t.ok('le déclencheur de date est en place (un seul)', (select count(*) from pg_trigger where tgname = 'check_profile_birth_date' and not tgisinternal) = 1);
select t.ok('le script n''a pas créé de table de plus', (select count(*) from information_schema.tables where table_schema = 'public') = 1);

-- 1. le client écrit ses propres réponses (la protection des colonnes sensibles ne le gêne pas)
set role authenticated;
select set_config('test.is_admin', 'off', false), set_config('test.uid', t.u(2)::text, false);
update public.profiles set birth_date = date '1998-03-25', marital_status = 'marie' where id = t.u(2);
select t.ok('le client écrit sa date de naissance', t.b(2) = date '1998-03-25');
select t.ok('le client choisit « marie »', t.m(2) = 'marie');
update public.profiles set marital_status = 'celibataire' where id = t.u(2);
select t.ok('il peut changer d''avis : « celibataire »', t.m(2) = 'celibataire');
update public.profiles set birth_date = date '2000-02-29' where id = t.u(2);
select t.ok('29 février d''une année bissextile accepté', t.b(2) = date '2000-02-29');
update public.profiles set birth_date = t.today() where id = t.u(2);
select t.ok('né aujourd''hui accepté (pas dans le futur)', t.b(2) = t.today());

-- 2. valeurs refusées
select t.fails('situation inconnue refusée', format('update public.profiles set marital_status = %L where id = %L', 'divorce', t.u(2)), 'profiles_marital_status_check');
select t.fails('« Marié » avec une majuscule refusé (le site écrit celibataire / marie)', format('update public.profiles set marital_status = %L where id = %L', 'Marié', t.u(2)), 'profiles_marital_status_check');
select t.fails('texte vide refusé', format('update public.profiles set marital_status = %L where id = %L', '', t.u(2)), 'profiles_marital_status_check');
select t.fails('date avant 1900 refusée', format('update public.profiles set birth_date = %L where id = %L', '1899-12-31', t.u(2)), 'profiles_birth_date_check');
select t.fails('demain refusé', format('update public.profiles set birth_date = %L where id = %L', (t.today() + 1)::text, t.u(2)), 'Date de naissance dans le futur');
select t.fails('année 2999 refusée', format('update public.profiles set birth_date = %L where id = %L', '2999-01-01', t.u(2)), 'Date de naissance dans le futur');
select t.fails('date qui n''existe pas refusée (31 février)', format('update public.profiles set birth_date = %L where id = %L', '1998-02-31', t.u(2)), 'out of range');
select t.ok('les réponses n''ont pas bougé après les refus', t.m(2) = 'celibataire' and t.b(2) = t.today());
update public.profiles set birth_date = null, marital_status = null where id = t.u(2);
select t.ok('vider les deux réponses reste permis (la base les garde optionnelles ; c''est le site qui les exige à l''inscription)', t.b(2) is null and t.m(2) is null);

-- 3. la protection des colonnes sensibles marche toujours
select t.fails('un client ne se donne toujours pas les droits d''administrateur', format('update public.profiles set is_admin = true where id = %L', t.u(2)), 'Modification non autorisée');

-- 4. un client ne touche pas à la ligne d'un autre
update public.profiles set birth_date = date '1990-01-01', marital_status = 'marie' where id = t.u(3);
select t.ok('le client ne peut pas écrire sur la ligne d''un autre (aucune ligne modifiée)', t.b(3) is null and t.m(3) is null);
reset role;

-- 5. l'inscription : la ligne est créée vide, puis le site écrit les deux réponses ; la lecture
set role authenticated;
select set_config('test.is_admin', 'off', false), set_config('test.uid', t.u(4)::text, false);
insert into public.profiles (id, full_name) values (t.u(4), 'Nouveau');
update public.profiles set birth_date = date '2005-07-14', marital_status = 'celibataire' where id = t.u(4);
select t.ok('nouveau compte : ses deux réponses sont gardées', t.b(4) = date '2005-07-14' and t.m(4) = 'celibataire');
select t.fails('nouveau compte avec une date dans le futur refusé aussi à la création', format('insert into public.profiles (id, full_name, birth_date) values (%L, %L, %L)', t.u(5), 'Futur', (t.today() + 30)::text), 'Date de naissance dans le futur');
select t.ok('le client relit sa propre ligne avec les deux colonnes', (select count(*) from public.profiles where id = t.u(4) and birth_date is not null and marital_status is not null) = 1);
select t.ok('le client ne lit pas la ligne d''un autre', (select count(*) from public.profiles where id = t.u(2)) = 0);
reset role;

-- 6. l'administrateur lit les réponses de tous (Admin › Clients)
set role authenticated;
select set_config('test.is_admin', 'on', false), set_config('test.uid', t.u(1)::text, false);
select t.ok('l''administrateur lit les réponses du client 4', (select count(*) from public.profiles where id = t.u(4) and birth_date = date '2005-07-14' and marital_status = 'celibataire') = 1);
reset role;

-- 7. l'anonyme ne lit ni n'écrit rien
set role anon;
select set_config('test.is_admin', 'off', false), set_config('test.uid', '', false);
select t.ok('l''anonyme ne lit aucune ligne', (select count(*) from public.profiles) = 0);
reset role;
select t.ok('le client 4 est resté inchangé du début à la fin', t.b(4) = date '2005-07-14' and t.m(4) = 'celibataire');
