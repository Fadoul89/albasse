-- Contrôles de add-friend-invites.sql sur un Postgres local jetable (voir tests/sql/run-friend-invites.sh).
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
-- se met à la place d'un client connecté (0 = personne)
create function t.as_user(n int) returns void language plpgsql as $$
begin
  perform set_config('test.uid', case when n = 0 then '' else t.u(n)::text end, false);
  perform set_config('test.is_admin', 'off', false);
end $$;
grant execute on function t.u(int), t.as_user(int) to public;

-- 1 = Amina (celle qui invite), 2..9 = ses amis, 10 = Idriss (autre client), 11 = administrateur
insert into public.profiles (id, email, full_name, phone, whatsapp_number) values
  (t.u(1), 'a@x.td', 'Amina Hassan', '66000001', '66000001'),
  (t.u(2), 'f2@x.td', 'Fatimé Oumar', '66000002', null),
  (t.u(3), 'f3@x.td', 'Moussa Ali', '66000003', null),
  (t.u(4), 'f4@x.td', 'Khadija Idriss', '66000004', null),
  (t.u(5), 'f5@x.td', 'Abakar Saleh', '66000005', null),
  (t.u(6), 'f6@x.td', 'Zara Mahamat', '66000006', null),
  (t.u(7), 'f7@x.td', 'Hawa Brahim', '66000007', null),
  (t.u(8), 'f8@x.td', 'Ibrahim Tahir', '66000008', null),
  (t.u(9), 'f9@x.td', 'Mariam Yacoub', '66000009', null),
  (t.u(10), 'i@x.td', 'Idriss Adam', '66000010', null),
  (t.u(11), 'adm@x.td', 'Admin', '66000011', null);
insert into public.profiles (id, email, full_name, phone, created_at) values (t.u(12), 'old@x.td', 'Vieux Compte', '66000012', now() - interval '5 days');
insert into public.profiles (id, email, full_name, phone) select t.u(20 + g), 'x' || g || '@x.td', 'Ami ' || g, '660001' || lpad(g::text, 2, '0') from generate_series(1, 12) g;

-- 0. ce que le script crée
select t.ok('4 colonnes ajoutées à profiles, vides pour tout le monde', (select count(*) from public.profiles where invite_code is null and invited_by is null and invited_at is null and app_opened_at is null) = (select count(*) from public.profiles));
select t.ok('droits : les clients lisent leurs gains, pas l''anonyme ; les fonctions pour le client connecté seulement',
  has_table_privilege('authenticated', 'public.invite_rewards', 'select') and not has_table_privilege('anon', 'public.invite_rewards', 'select')
  and not has_table_privilege('authenticated', 'public.invite_rewards', 'insert') and not has_table_privilege('authenticated', 'public.invite_rewards', 'update')
  and has_function_privilege('authenticated', 'public.invite_claim(text)', 'execute') and not has_function_privilege('anon', 'public.invite_claim(text)', 'execute')
  and has_function_privilege('anon', 'public.invite_lookup(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.invite_refresh_rewards(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.invite_qualified_count(uuid)', 'execute'));

set role authenticated;

-- 1. mon code
select t.as_user(1);
select t.ok('mon code : 8 lettres et chiffres faciles à lire (jamais I, L, O, 0, 1)', public.invite_my_code() ~ '^[A-HJKMNP-Z2-9]{8}$');
create temp table t_code as select public.invite_my_code() as c;
select t.ok('le même code à chaque fois', (select c from t_code) = public.invite_my_code());
select t.as_user(10);
select t.ok('deux clients, deux codes différents', public.invite_my_code() <> (select c from t_code));
select t.as_user(0);
select t.ok('personne de connecté : pas de code', public.invite_my_code() is null);

-- 2. impossible de s'écrire des amis soi-même
select t.as_user(10);
select t.fails('un client ne peut pas écrire invited_by lui-même', $q$update public.profiles set invited_by = t.u(1) where id = t.u(10)$q$, 'non autorisée');
select t.fails('un client ne peut pas écrire app_opened_at lui-même', $q$update public.profiles set app_opened_at = now() where id = t.u(10)$q$, 'non autorisée');
select t.fails('un client ne peut pas changer son code', $q$update public.profiles set invite_code = 'AAAAAAAA' where id = t.u(10)$q$, 'non autorisée');
update public.profiles set full_name = 'Idriss A.' where id = t.u(10);
select t.ok('il garde le droit de changer son nom', (select full_name from public.profiles where id = t.u(10)) = 'Idriss A.');

-- 3. « Invité par … »
select t.as_user(0);
select t.ok('lookup : le prénom de la personne qui invite', public.invite_lookup((select c from t_code)) = 'Amina' and public.invite_lookup(lower((select c from t_code))) = 'Amina');
select t.ok('lookup : code inconnu ou vide = rien', public.invite_lookup('ZZZZZZZZ') is null and public.invite_lookup('') is null and public.invite_lookup(null) is null);

-- 4. se déclarer invité
select t.as_user(0);
select t.ok('claim sans être connecté : « login »', public.invite_claim((select c from t_code)) = 'login');
select t.as_user(1);
select t.ok('claim avec son propre code : « self »', public.invite_claim((select c from t_code)) = 'self');
select t.as_user(2);
select t.ok('claim avec un code qui n''existe pas : « invalid »', public.invite_claim('QQQQQQQQ') = 'invalid');
select t.ok('claim avec le bon code : « ok » (même écrit en minuscules, avec des espaces)', public.invite_claim('  ' || lower((select c from t_code)) || ' ') = 'ok');
select t.ok('2e claim : « already » (on ne change pas d''invitant)', public.invite_claim((select c from t_code)) = 'already');
select t.as_user(12);
select t.ok('compte créé il y a 5 jours : « too_late »', public.invite_claim((select c from t_code)) = 'too_late');
select t.as_user(1);
select t.as_user(2);
create temp table t_code2 as select public.invite_my_code() as c;
select t.as_user(1);
select t.ok('boucle : Amina invitée par Fatimé qu''elle a invitée = « loop »', public.invite_claim((select c from t_code2)) = 'loop');
select t.ok('rien n''a changé pour Amina après ces refus', (select invited_by from public.profiles where id = t.u(1)) is null);

-- 5. 4 amis inscrits (le 2 est déjà inscrit) ; l'application installée ouverte les fait compter
select t.as_user(3); select t.ok('ami 3 inscrit', public.invite_claim((select c from t_code)) = 'ok');
select t.as_user(4); select t.ok('ami 4 inscrit', public.invite_claim((select c from t_code)) = 'ok');
select t.as_user(5); select t.ok('ami 5 inscrit', public.invite_claim((select c from t_code)) = 'ok');
select t.as_user(6); select t.ok('ami 6 inscrit', public.invite_claim((select c from t_code)) = 'ok');
select t.as_user(1);
select t.ok('progression : 5 inscrits, 0 installé, aucun gain', (public.invite_my_progress()->>'joined')::int = 5 and (public.invite_my_progress()->>'installed')::int = 0 and public.invite_my_progress()->'rewards' = '[]'::jsonb);

select t.as_user(2); select public.invite_mark_app_opened();
select t.as_user(3); select public.invite_mark_app_opened();
select t.as_user(4); select public.invite_mark_app_opened();
select t.as_user(5); select public.invite_mark_app_opened();
select t.as_user(1);
select t.ok('4 amis installés : pas encore de gain', (public.invite_my_progress()->>'installed')::int = 4 and public.invite_my_progress()->'rewards' = '[]'::jsonb);
select t.as_user(10); select public.invite_mark_app_opened();
select t.as_user(1);
select t.ok('un client qui n''est l''ami de personne ouvre l''application : ça ne compte pour personne', (public.invite_my_progress()->>'installed')::int = 4);
select t.as_user(5); select public.invite_mark_app_opened();
select t.as_user(1);
select t.ok('ouvrir l''application une 2e fois ne compte pas deux fois', (public.invite_my_progress()->>'installed')::int = 4);
select t.as_user(6); select public.invite_mark_app_opened();
select t.as_user(1);
select t.ok('le 5e ami installe : 1 gain « à valider » (n° 1, 5 amis)', (public.invite_my_progress()->>'installed')::int = 5 and jsonb_array_length(public.invite_my_progress()->'rewards') = 1 and public.invite_my_progress()->'rewards'->0->>'status' = 'a_valider' and (public.invite_my_progress()->'rewards'->0->>'number')::int = 1);
select t.ok('on voit seulement les prénoms de ses amis (aucun téléphone ni nom de famille)', (public.invite_my_progress()::text) !~ '66000' and (public.invite_my_progress()::text) !~ 'Oumar|Ali|Idriss|Saleh|Mahamat');
select t.ok('les amis sont listés avec leur état (installé ou non)', jsonb_array_length(public.invite_my_progress()->'friends') = 5);

-- 6. on peut lire ses gains, pas ceux des autres ni les écrire
select t.ok('Amina lit son gain', (select count(*) from public.invite_rewards) = 1);
select t.as_user(10);
select t.ok('un autre client ne voit aucun gain', (select count(*) from public.invite_rewards) = 0);
select t.fails('un client ne peut pas se donner un gain', $q$insert into public.invite_rewards (user_id, number, friends_needed) values (t.u(10), 1, 5)$q$, 'permission denied');
select t.as_user(1);
select t.fails('Amina ne peut pas changer l''état de son gain', $q$update public.invite_rewards set status = 'remis'$q$, 'permission denied');

-- 7. 2e tranche : 5 amis de plus = gain n° 2 (jamais de doublon)
select t.as_user(1);
select t.ok('pas de 2e gain avant 10 amis', (select count(*) from public.invite_rewards) = 1);
do $$
declare g integer;
begin
  for g in 21..25 loop
    perform t.as_user(g);
    perform public.invite_claim((select c from t_code));
    perform public.invite_mark_app_opened();
  end loop;
  perform t.as_user(1);
end $$;
select t.ok('10 amis installés : 2 gains (n° 1 et n° 2), sans doublon', (public.invite_my_progress()->>'installed')::int = 10 and (select count(*) from public.invite_rewards) = 2 and (select string_agg(number::text, ',' order by number) from public.invite_rewards) = '1,2');
select t.as_user(26); select public.invite_claim((select c from t_code)); select public.invite_mark_app_opened();
select t.as_user(1);
select t.ok('un 11e ami : pas de 3e gain avant 15', (public.invite_my_progress()->>'installed')::int = 11 and (select count(*) from public.invite_rewards) = 2);

-- 8. un ami qui ouvre l'application AVANT de se déclarer invité compte aussi dès qu'il se déclare
select t.as_user(27); select public.invite_mark_app_opened();
select t.as_user(1);
select t.ok('l''ami 27 a ouvert l''application mais n''est pas encore invité : ne compte pas', (public.invite_my_progress()->>'installed')::int = 11);
select t.as_user(27); select t.ok('puis il se déclare invité', public.invite_claim((select c from t_code)) = 'ok');
select t.as_user(1);
select t.ok('il compte maintenant (12)', (public.invite_my_progress()->>'installed')::int = 12);

reset role;

-- 9. un ami banni ne compte plus (le gain déjà gagné reste : le patron décide)
update public.profiles set banned = true where id = t.u(22);
set role authenticated;
select t.as_user(1);
select t.ok('ami banni : plus compté (11), le gain déjà gagné reste', (public.invite_my_progress()->>'installed')::int = 11 and (select count(*) from public.invite_rewards) = 2);

-- 10. administrateur
select t.as_user(10);
select t.fails('un client ne peut pas lire le tableau de l''administrateur', $q$select public.admin_invite_overview()$q$, 'réservé aux administrateurs');
select t.fails('un client ne peut pas changer l''état d''un gain', $q$select public.admin_invite_reward_set((select id from public.invite_rewards limit 1), 'remis', null)$q$, 'réservé aux administrateurs');
select t.as_user(11);
select set_config('test.is_admin', 'on', false);
select t.ok('admin : totaux (1 qui invite, 2 gains à valider)', (public.admin_invite_overview()->'totals'->>'inviters')::int = 1 and (public.admin_invite_overview()->'totals'->>'to_validate')::int = 2 and (public.admin_invite_overview()->>'goal')::int = 5);
select t.ok('admin : chaque gain montre le client (nom, téléphone) et ses amis (nom, téléphone, installé)', public.admin_invite_overview()->'rewards'->0->'user'->>'name' = 'Amina Hassan' and public.admin_invite_overview()->'rewards'->0->'user'->>'phone' = '66000001' and jsonb_array_length(public.admin_invite_overview()->'rewards'->0->'friends') >= 12 and public.admin_invite_overview()->'rewards'->0->'friends'->0->>'phone' ~ '^66000');
select t.ok('admin : la liste des clients qui invitent (12 inscrits)', (public.admin_invite_overview()->'inviters'->0->>'joined')::int = 12 and public.admin_invite_overview()->'inviters'->0->>'name' = 'Amina Hassan');
select public.admin_invite_reward_set((select id from public.invite_rewards where number = 1), 'valide', 'Parfum choisi par téléphone');
select t.ok('admin : gain n° 1 validé, avec sa note et sa date', (select status from public.invite_rewards where number = 1) = 'valide' and (select note from public.invite_rewards where number = 1) = 'Parfum choisi par téléphone' and (select handled_at from public.invite_rewards where number = 1) is not null);
select public.admin_invite_reward_set((select id from public.invite_rewards where number = 1), 'remis', null);
select t.ok('admin : gain n° 1 remis (la note reste)', (select status from public.invite_rewards where number = 1) = 'remis' and (select note from public.invite_rewards where number = 1) = 'Parfum choisi par téléphone');
select public.admin_invite_reward_set((select id from public.invite_rewards where number = 2), 'refuse', 'Faux comptes');
select t.ok('admin : gain n° 2 refusé', (select status from public.invite_rewards where number = 2) = 'refuse');
select public.admin_invite_reward_set((select id from public.invite_rewards where number = 2), 'a_valider', null);
select t.ok('admin : on peut le remettre « à valider » (date effacée)', (select status from public.invite_rewards where number = 2) = 'a_valider' and (select handled_at from public.invite_rewards where number = 2) is null);
select t.fails('admin : un état inconnu est refusé', $q$select public.admin_invite_reward_set((select id from public.invite_rewards limit 1), 'nimporte', null)$q$, 'État inconnu');
select t.fails('admin : un gain qui n''existe pas est refusé', $q$select public.admin_invite_reward_set(t.u(999), 'remis', null)$q$, 'introuvable');
select t.ok('admin : totaux à jour (1 à valider, 1 remis)', (public.admin_invite_overview()->'totals'->>'to_validate')::int = 1 and (public.admin_invite_overview()->'totals'->>'delivered')::int = 1);

-- 11. le client voit l'état de ses gains
select t.as_user(1);
select t.ok('Amina voit « remis » pour le n° 1 et « à valider » pour le n° 2', public.invite_my_progress()->'rewards'->0->>'status' = 'remis' and public.invite_my_progress()->'rewards'->1->>'status' = 'a_valider');

reset role;
-- 12. rien d'autre n'a changé : aucun client n'a perdu ni gagné autre chose
select t.ok('aucun compte supprimé ni modifié (nom, téléphone)', (select count(*) from public.profiles) = 24 and (select full_name from public.profiles where id = t.u(2)) = 'Fatimé Oumar');
