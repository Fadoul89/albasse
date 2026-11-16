-- Contrôles de add-zara-most-viewed.sql sur un Postgres local jetable (voir tests/sql/run-most-viewed.sh).
create schema t;
grant usage on schema t to public;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.uid(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.pid(c text) returns uuid language sql immutable as $$ select ('10000000-0000-4000-8000-' || lpad(ascii(c)::text, 12, '0'))::uuid $$;
-- une visite : t.view(article, session, appareil (visitor_id), compte de la visite, compte noté sur la vue, âge en jours)
create function t.view(prod text, sess int, visitor text default null, sess_user uuid default null, view_user uuid default null, age int default 1) returns void language plpgsql as $$
begin
  insert into public.visitor_sessions (id, user_id, visitor_id) values (t.uid(100000 + sess), sess_user, visitor) on conflict (id) do nothing;
  insert into public.product_views (session_id, user_id, product_id, viewed_at) values (t.uid(100000 + sess), view_user, t.pid(prod), now() - make_interval(days => age));
end $$;
create function t.n(prod text, days int default 30) returns integer language sql as $$ select visitors from public.assistant_product_views(days) where product_id = t.pid(prod)::text $$;

insert into public.products (id, name, is_active) values (t.pid('A'), 'A', true), (t.pid('B'), 'B', true), (t.pid('C'), 'C', true), (t.pid('D'), 'D', false), (t.pid('E'), 'E', true), (t.pid('F'), 'F', true);
insert into public.profiles (id, is_admin) values (t.uid(1), false), (t.uid(2), false), (t.uid(9), true);

-- ARTICLE A : 60 appareils différents, une visite chacun
select t.view('A', g, 'appareil-' || g) from generate_series(1, 60) g;
-- le même appareil revient 3 fois (3 visites) : compté UNE fois
select t.view('A', 1001, 'appareil-1'); select t.view('A', 1002, 'appareil-1'); select t.view('A', 1003, 'appareil-1');
-- un client connecté sur 2 appareils (compte noté sur la vue) : UNE personne
select t.view('A', 1004, 'telephone-client-1', null, t.uid(1)); select t.view('A', 1005, 'ordinateur-client-1', null, t.uid(1));
-- un client connecté dont le compte est noté seulement sur la visite : le compte fait la personne (même client que la vue précédente)
select t.view('A', 1006, 'tablette-client-1', t.uid(1), null);
-- un autre client : +1
select t.view('A', 1007, 'appareil-x', t.uid(2), null);
-- l'administrateur (compte sur la vue OU sur la visite) : ne compte pas
select t.view('A', 1008, 'appareil-admin', null, t.uid(9)); select t.view('A', 1009, 'appareil-admin-2', t.uid(9), null);
-- trop ancien (40 jours) : ne compte pas dans les 30 jours
select t.view('A', 1010, 'appareil-ancien', null, null, 40);
-- vue sans visite connue ni compte : on ne peut pas savoir qui : ne compte pas
insert into public.product_views (session_id, user_id, product_id) values (null, null, t.pid('A'));
-- appareil vide ('') : la visite fait la personne (pas de regroupement de tous les appareils vides)
select t.view('A', 1011, ''); select t.view('A', 1012, '');

-- ARTICLE B : 10 personnes (le minimum renvoyé) ; ARTICLE C : 9 personnes (pas renvoyé)
select t.view('B', 2000 + g, 'b-' || g) from generate_series(1, 10) g;
select t.view('C', 3000 + g, 'c-' || g) from generate_series(1, 9) g;
-- ARTICLE D : très regardé mais INACTIF : jamais renvoyé
select t.view('D', 4000 + g, 'd-' || g) from generate_series(1, 80) g;
-- ARTICLE E : 15 personnes, toutes il y a 5 jours (pour la fenêtre de 1 jour)
select t.view('E', 5000 + g, 'e-' || g, null, null, 5) from generate_series(1, 15) g;

-- 60 appareils + client 1 + client 2 + 2 visites à appareil vide = 64
select t.ok('A : 64 personnes (appareil qui revient = 1, client sur 2 appareils = 1, admin, ancien et inconnu exclus)', t.n('A') = 64);
select t.ok('B : 10 personnes : renvoyé (minimum)', t.n('B') = 10);
select t.ok('C : 9 personnes : pas renvoyé', t.n('C') is null);
select t.ok('D : article inactif : jamais renvoyé', t.n('D') is null);
select t.ok('F : jamais regardé : pas renvoyé', t.n('F') is null);
select t.ok('fenêtre : 30 jours par défaut ; E (vu il y a 5 jours) compte sur 30 jours mais pas sur 1 jour', t.n('E') = 15 and t.n('E', 1) is null and (select visitors from public.assistant_product_views() where product_id = t.pid('E')::text) = 15);
select t.ok('fenêtre bornée : 999 jours = 30 jours (l''ancienne visite de 40 jours ne revient pas) ; null = 30', t.n('A', 999) = 64 and t.n('A', null) = 64);
select t.ok('ordre : du plus regardé au moins regardé', (select string_agg(product_id, ',' order by ord) from (select product_id, row_number() over () as ord from public.assistant_product_views(30)) x) = t.pid('A')::text || ',' || t.pid('E')::text || ',' || t.pid('B')::text);
select t.ok('aucune donnée de client : seulement (product_id, visitors)', pg_get_function_result('public.assistant_product_views(integer)'::regprocedure) = 'TABLE(product_id text, visitors integer)');
select t.ok('300 articles au plus', position('limit 300' in lower(pg_get_functiondef('public.assistant_product_views(integer)'::regprocedure))) > 0);
select t.ok('chemin de recherche fixe (avis de sécurité Supabase)', (select proconfig::text from pg_proc where oid = 'public.assistant_product_views(integer)'::regprocedure) like '%search_path=public, extensions%');
select t.ok('index sur la date des visites', exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'product_views' and indexname = 'product_views_viewed_idx'));
select t.ok('droits : visiteurs (anon) et clients connectés peuvent appeler la fonction', has_function_privilege('anon', 'public.assistant_product_views(integer)', 'execute') and has_function_privilege('authenticated', 'public.assistant_product_views(integer)', 'execute'));
do $$ begin if not exists (select 1 from pg_roles where rolname = 't_stranger') then create role t_stranger nologin; end if; end $$;
select t.ok('droits : un autre rôle (public) ne peut pas', not has_function_privilege('t_stranger', 'public.assistant_product_views(integer)', 'execute'));

-- appelée par un visiteur (anon) : les totaux arrivent malgré la protection des tables (il ne lit jamais les visites elles-mêmes)
set role anon;
select t.ok('anon : la fonction répond avec les totaux', (select visitors from public.assistant_product_views(30) where product_id = t.pid('A')::text) = 64);
do $$ begin
  perform 1 from public.product_views limit 1;
  raise exception 'ECHEC anon ne doit pas lire la table des visites';
exception when insufficient_privilege then raise notice 'OK    anon ne lit pas la table des visites elle-même';
end $$;
reset role;
