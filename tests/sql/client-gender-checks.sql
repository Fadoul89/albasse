-- Contrôles de add-client-gender.sql sur un Postgres local jetable (voir tests/sql/run-client-gender.sh).
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
create function t.g(n int) returns text language sql security definer as $$ select gender from public.profiles where id = t.u(n) $$;

-- 1 = administrateur, 2 et 3 = clients (aucun genre au départ : comme les 544 comptes d'aujourd'hui)
insert into public.profiles (id, full_name, is_admin) values (t.u(1), 'Admin', true), (t.u(2), 'Amina', false), (t.u(3), 'Idriss', false);

-- 0. ce que le script crée
select t.ok('colonne « gender » créée, vide pour tout le monde', (select count(*) from public.profiles where gender is null) = 3);
select t.ok('droits de la fonction : pas l''anonyme, oui le connecté',
  not has_function_privilege('anon', 'public.admin_set_client_gender(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.admin_set_client_gender(uuid, text)', 'execute'));

-- 1. le client choisit son propre genre
set role authenticated;
select set_config('test.is_admin', 'off', false), set_config('test.uid', t.u(2)::text, false);
update public.profiles set gender = 'femme' where id = t.u(2);
select t.ok('le client choisit « femme » pour lui-même', t.g(2) = 'femme');
select t.fails('valeur inconnue refusée', format('update public.profiles set gender = %L where id = %L', 'autre', t.u(2)), 'profiles_gender_check');
select t.fails('texte vide refusé (seulement homme, femme ou rien)', format('update public.profiles set gender = %L where id = %L', '', t.u(2)), 'profiles_gender_check');
select t.fails('« Homme » avec une majuscule refusé (le site écrit homme / femme)', format('update public.profiles set gender = %L where id = %L', 'Homme', t.u(2)), 'profiles_gender_check');
select t.ok('le genre n''a pas bougé après les refus', t.g(2) = 'femme');

-- 2. un client ne change pas le genre d'un autre, ni directement ni par la fonction
update public.profiles set gender = 'homme' where id = t.u(3);
select t.ok('le client ne peut pas écrire sur la ligne d''un autre (aucune ligne modifiée)', t.g(3) is null);
select t.fails('le client ne peut pas utiliser la fonction de l''administrateur', format('select public.admin_set_client_gender(%L, %L)', t.u(3), 'homme'), 'Non autorise');
select t.ok('toujours rien pour le client 3', t.g(3) is null);
reset role;

-- 3. l'administrateur ne peut pas modifier directement la ligne d'un client (règles de la base) : il passe par la fonction
set role authenticated;
select set_config('test.is_admin', 'on', false), set_config('test.uid', t.u(1)::text, false);
update public.profiles set gender = 'homme' where id = t.u(3);
select t.ok('en direct, l''administrateur ne modifie pas la ligne d''un client (la fonction est donc nécessaire)', t.g(3) is null);
select public.admin_set_client_gender(t.u(3), 'homme');
select t.ok('l''administrateur choisit « homme » pour le client 3 avec la fonction', t.g(3) = 'homme');
select public.admin_set_client_gender(t.u(3), 'femme');
select t.ok('il corrige en « femme »', t.g(3) = 'femme');
select public.admin_set_client_gender(t.u(3), null);
select t.ok('il peut aussi remettre « non précisé »', t.g(3) is null);
select t.fails('genre invalide refusé par la fonction', format('select public.admin_set_client_gender(%L, %L)', t.u(3), 'autre'), 'Genre invalide');
select t.fails('client inexistant refusé', format('select public.admin_set_client_gender(%L, %L)', t.u(99), 'homme'), 'Client introuvable');
reset role;

-- 4. l'anonyme n'a aucun accès
set role anon;
select t.fails('l''anonyme ne peut pas appeler la fonction', format('select public.admin_set_client_gender(%L, %L)', t.u(3), 'homme'), 'permission denied');
reset role;
select t.ok('le client 2 est resté « femme » du début à la fin', t.g(2) = 'femme');
