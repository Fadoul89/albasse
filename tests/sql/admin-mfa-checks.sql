-- Contrôles de add-admin-mfa.sql. Chaque ligne affiche OK ou ECHEC.
create temp table r (n serial, label text, ok boolean);
create function pg_temp.as_user(uid text, aal text) returns void language plpgsql as $$
begin
  perform set_config('test.uid', coalesce(uid, ''), false);
  perform set_config('test.jwt', case when uid is null then '' else json_build_object('sub', uid, 'aal', aal)::text end, false);
end $$;
grant all on r, r_n_seq to authenticated;

-- 1) admin SANS double vérification : comme avant
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'aal1');
insert into r (label, ok) values ('admin sans double vérification (aal1) : admin comme avant', public.is_admin());
select pg_temp.as_user('22222222-2222-2222-2222-222222222222', 'aal1');
insert into r (label, ok) values ('client (aal1) : jamais admin', not public.is_admin());
select pg_temp.as_user(null, null);
insert into r (label, ok) values ('visiteur sans compte : jamais admin', not public.is_admin());

-- 2) mise en route commencée mais pas terminée : rien ne change
insert into auth.mfa_factors (user_id, factor_type, status) values ('11111111-1111-1111-1111-111111111111', 'totp', 'unverified');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'aal1');
insert into r (label, ok) values ('mise en route pas terminée (facteur non vérifié) : toujours admin en aal1', public.is_admin());

-- 3) double vérification ACTIVÉE
update auth.mfa_factors set status = 'verified' where user_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'aal1');
insert into r (label, ok) values ('activée + mot de passe seul (aal1) : PAS admin', not public.is_admin());
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'aal2');
insert into r (label, ok) values ('activée + code tapé (aal2) : admin', public.is_admin());
select set_config('test.jwt', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, false);
insert into r (label, ok) values ('activée + jeton sans « aal » : PAS admin (prudence)', not public.is_admin());
select pg_temp.as_user('33333333-3333-3333-3333-333333333333', 'aal1');
insert into r (label, ok) values ('l''autre admin (sans double vérification) n''est pas touché', public.is_admin());
select pg_temp.as_user('22222222-2222-2222-2222-222222222222', 'aal2');
insert into r (label, ok) values ('client avec un jeton aal2 : jamais admin', not public.is_admin());

-- 4) les règles d'accès (RLS) suivent : les commandes
set role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'aal1');
insert into r (label, ok) values ('RLS : admin activé, mot de passe seul -> 0 commande visible', (select count(*) from public.orders) = 0);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111', 'aal2');
insert into r (label, ok) values ('RLS : admin activé, code tapé -> les 2 commandes', (select count(*) from public.orders) = 2);
select pg_temp.as_user('33333333-3333-3333-3333-333333333333', 'aal1');
insert into r (label, ok) values ('RLS : admin sans double vérification -> les 2 commandes (comme avant)', (select count(*) from public.orders) = 2);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222', 'aal2');
insert into r (label, ok) values ('RLS : client -> 0 commande', (select count(*) from public.orders) = 0);
reset role;

-- 5) droits inchangés
insert into r (label, ok) values ('droits d''appel conservés (anon, authenticated)', has_function_privilege('anon', 'public.is_admin()', 'execute') and has_function_privilege('authenticated', 'public.is_admin()', 'execute'));
insert into r (label, ok) values ('toujours security definer + search_path fixe', (select prosecdef and proconfig @> array['search_path=public'] from pg_proc where oid = 'public.is_admin()'::regprocedure));

select case when ok then 'OK   ' else 'ECHEC' end || ' ' || label from r order by n;
select case when bool_and(ok) then 'TOUT EST BON (' || count(*) || ' contrôles)' else 'AVEC DES ECHECS' end from r;
