-- Contrôles de add-admin-reset-password.sql sur un Postgres local jetable (voir tests/sql/run-admin-password.sh).
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
create function t.hash(n int) returns text language sql as $$ select encrypted_password from auth.users where id = t.u(n) $$;

-- les gens : 1 = administrateur, 2 = client avec un compte créé par numéro, 3 = ancien compte avec un vrai e-mail
insert into auth.users (id, email, encrypted_password, updated_at) values
  (t.u(1), 'admin@exemple.com', extensions.crypt('adminpass', extensions.gen_salt('bf', 10)), '2026-01-01'),
  (t.u(2), '23566123456@tel.albasseshopping.com', extensions.crypt('482915', extensions.gen_salt('bf', 10)), '2026-01-01'),
  (t.u(3), 'amina@gmail.com', extensions.crypt('ancien-mdp', extensions.gen_salt('bf', 10)), '2026-01-01');
insert into public.profiles (id, is_admin) values (t.u(1), true), (t.u(2), false), (t.u(3), false);

create temp table before_hash as select id, encrypted_password from auth.users;
grant select on before_hash to public;

-- 0. ce que le script crée
select t.ok('journal créé, sécurité par ligne activée', (select relrowsecurity from pg_class where relname = 'admin_password_resets'));
select t.ok('journal : seulement id, client, administrateur, date (le code n''est JAMAIS gardé)',
  (select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'admin_password_resets') = 'admin_id,created_at,id,user_id');
select t.ok('droits du journal : l''anonyme n''a rien, le connecté peut seulement lire',
  not has_table_privilege('anon', 'public.admin_password_resets', 'select')
  and has_table_privilege('authenticated', 'public.admin_password_resets', 'select')
  and not has_table_privilege('authenticated', 'public.admin_password_resets', 'insert')
  and not has_table_privilege('authenticated', 'public.admin_password_resets', 'update')
  and not has_table_privilege('authenticated', 'public.admin_password_resets', 'delete'));
select t.ok('droits de la fonction : pas l''anonyme, oui le connecté',
  not has_function_privilege('anon', 'public.admin_set_client_password(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.admin_set_client_password(uuid, text)', 'execute'));

-- 1. un visiteur ou un client qui n'est pas administrateur est refusé, rien ne change
set role authenticated;
select set_config('test.is_admin', 'off', false), set_config('test.uid', t.u(2)::text, false);
select t.fails('client non administrateur : refusé', format('select public.admin_set_client_password(%L, %L)', t.u(2), '111222'), 'Non autorise');
select t.fails('client non administrateur : ne peut pas changer le code d''un autre non plus', format('select public.admin_set_client_password(%L, %L)', t.u(3), '111222'), 'Non autorise');
reset role;
select t.ok('rien n''a changé (3 codes identiques)', (select count(*) from auth.users u join before_hash b using (id) where u.encrypted_password = b.encrypted_password) = 3);
select t.ok('aucune ligne dans le journal', (select count(*) from public.admin_password_resets) = 0);

-- 2. l'administrateur donne un nouveau code à un client « numéro »
set role authenticated;
select set_config('test.is_admin', 'on', false), set_config('test.uid', t.u(1)::text, false);
create temp table res (login text);
grant all on res to public;
insert into res select public.admin_set_client_password(t.u(2), '730591');
reset role;
select t.ok('la fonction renvoie l''identifiant de connexion (l''adresse tirée du numéro)', (select login from res) = '23566123456@tel.albasseshopping.com');
select t.ok('le NOUVEAU code ouvre le compte (même vérification que Supabase)', t.hash(2) = extensions.crypt('730591', t.hash(2)));
select t.ok('l''ANCIEN code ne marche plus', t.hash(2) <> extensions.crypt('482915', t.hash(2)));
select t.ok('le code n''est pas écrit en clair, c''est un bcrypt de coût 10 comme celui de Supabase', t.hash(2) like '$2a$10$%' and t.hash(2) not like '%730591%');
select t.ok('la date de mise à jour du compte a bougé', (select updated_at > '2026-01-01' from auth.users where id = t.u(2)));
select t.ok('les autres comptes n''ont pas bougé (administrateur et ancien compte)',
  (select count(*) from auth.users u join before_hash b using (id) where u.id in (t.u(1), t.u(3)) and u.encrypted_password = b.encrypted_password) = 2);
select t.ok('le journal note : ce client, cet administrateur, maintenant',
  (select count(*) from public.admin_password_resets where user_id = t.u(2) and admin_id = t.u(1) and created_at > now() - interval '1 minute') = 1);

-- 3. un ancien compte (e-mail) : la fonction renvoie son e-mail
set role authenticated;
truncate res;
insert into res select public.admin_set_client_password(t.u(3), 'nouveau-mdp');
reset role;
select t.ok('ancien compte : renvoie son vrai e-mail, et le code marche (les lettres sont permises)', (select login from res) = 'amina@gmail.com' and t.hash(3) = extensions.crypt('nouveau-mdp', t.hash(3)));

-- 4. les refus
set role authenticated;
select t.fails('code trop court (5)', format('select public.admin_set_client_password(%L, %L)', t.u(2), '12345'), 'Mot de passe invalide');
select t.fails('code absent', format('select public.admin_set_client_password(%L, null)', t.u(2)), 'Mot de passe invalide');
select t.fails('code trop long (73)', format('select public.admin_set_client_password(%L, %L)', t.u(2), repeat('a', 73)), 'Mot de passe invalide');
select t.fails('compte administrateur : refusé', format('select public.admin_set_client_password(%L, %L)', t.u(1), '730591'), 'administrateur');
select t.fails('client qui n''existe pas : introuvable', format('select public.admin_set_client_password(%L, %L)', t.u(99), '730591'), 'introuvable');
reset role;
select t.ok('après les refus : le code du client est toujours 730591, le journal compte 2 lignes seulement',
  t.hash(2) = extensions.crypt('730591', t.hash(2)) and (select count(*) from public.admin_password_resets) = 2);
select t.ok('72 caractères : accepté (limite de bcrypt)', (select true from (select set_config('test.is_admin', 'on', false)) s, lateral (select public.admin_set_client_password(t.u(2), repeat('b', 72))) x));
select t.ok('…et le code de 72 caractères ouvre le compte', t.hash(2) = extensions.crypt(repeat('b', 72), t.hash(2)));

-- 5. le journal : lisible par l'administrateur seulement (sécurité par ligne)
set role authenticated;
select set_config('test.is_admin', 'on', false);
select t.ok('administrateur : voit le journal (3 lignes)', (select count(*) from public.admin_password_resets) = 3);
select set_config('test.is_admin', 'off', false);
select t.ok('client ordinaire : ne voit rien dans le journal', (select count(*) from public.admin_password_resets) = 0);
select t.fails('client ordinaire : ne peut pas écrire dans le journal', format('insert into public.admin_password_resets (user_id) values (%L)', t.u(2)), 'permission denied');
reset role;
set role anon;
select t.fails('anonyme : ne peut pas lire le journal', 'select count(*) from public.admin_password_resets', 'permission denied');
select t.fails('anonyme : ne peut pas appeler la fonction', format('select public.admin_set_client_password(%L, %L)', t.u(2), '730591'), 'permission denied');
reset role;
