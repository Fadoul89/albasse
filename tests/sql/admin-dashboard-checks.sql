-- Contrôles de add-admin-dashboard.sql sur un Postgres local jetable (voir tests/sql/run-admin-dashboard.sh).
create schema t;
grant usage on schema t to public;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.uid(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
-- une visite : t.sess(numéro, appareil (visitor_id), compte, source, il y a combien de temps)
create function t.sess(n int, visitor text, account uuid, src text, age interval) returns void language sql as $$
  insert into public.visitor_sessions (id, user_id, visitor_id, referrer_source, started_at) values (t.uid(n), account, visitor, src, now() - age)
$$;
create function t.view(prod int, sess int, account uuid default null, age interval default '1 day') returns void language sql as $$
  insert into public.product_views (session_id, user_id, product_id, viewed_at) values (case when sess is null then null else t.uid(sess) end, account, t.uid(prod), now() - age)
$$;
create function t.r(p text) returns jsonb language sql as $$ select public.admin_dashboard_overview(p) $$;

-- comptes : 1, 2, 3 clients ; 9 administrateur
insert into public.profiles (id, is_admin, created_at) values
  (t.uid(1), false, now() - interval '10 days'),
  (t.uid(2), false, now() - interval '45 days'),
  (t.uid(3), false, now()),
  (t.uid(9), true, now() - interval '1 day');

-- VISITES
select t.sess(1000 + g, 'v' || g, null, 'TikTok', '2 days') from generate_series(1, 5) g;   -- 5 appareils
select t.sess(1006, 'v1', null, 'TikTok', '3 days');                                          -- le même appareil revient : 1 seule personne
select t.sess(1007, 'c1-telephone', t.uid(1), 'Facebook', '1 day');                          -- client 1 sur 2 appareils : 1 personne
select t.sess(1008, 'c1-ordinateur', t.uid(1), 'Facebook', '4 days');
select t.sess(1009, '', null, null, '1 day');                                                 -- appareil vide : la visite fait la personne ; source inconnue
select t.sess(1010, '', null, null, '1 day');
select t.sess(1011, 'appareil-admin', t.uid(9), 'TikTok', '1 day');                          -- administrateur : ne compte jamais
select t.sess(1012, 'ancien-1', null, 'Google', '40 days');                                  -- période d'avant (30 à 60 jours)
select t.sess(1013, 'ancien-2', null, 'Google', '35 days');
select t.sess(1014, 'maintenant', null, 'Publicité / campagne', '0 seconds');               -- aujourd'hui

-- COMMANDES
insert into public.orders (created_at, status, total, is_flagged_fake) values
  (now() - interval '2 days', 'delivered', 10000, false),
  (now() - interval '1 day', 'pending', 5000, false),
  (now() - interval '1 day', 'cancelled', 7000, false),   -- annulée : ne compte pas
  (now() - interval '1 day', 'delivered', 9000, true),    -- fausse commande : ne compte jamais
  (now() - interval '40 days', 'delivered', 3000, false); -- période d'avant

-- ARTICLES ET CATÉGORIES : M1 (avec sous-catégorie S1), M2, M3 ; articles 101 à 105
insert into public.categories (id, parent_id) values (t.uid(201), null), (t.uid(202), t.uid(201)), (t.uid(203), null), (t.uid(204), null);
insert into public.products (id, name, is_active, category_id) values
  (t.uid(101), 'A article', true, t.uid(202)),   -- sous-catégorie de M1
  (t.uid(102), 'B article', true, t.uid(201)),   -- M1
  (t.uid(103), 'C article', true, t.uid(203)),   -- M2
  (t.uid(104), 'D article', false, t.uid(204)),  -- inactif : ni compté, ni classé, sa catégorie M3 non plus
  (t.uid(105), 'E article', true, null);         -- sans catégorie

-- VUES D'ARTICLES
select t.view(101, 1000 + g) from generate_series(1, 5) g;                -- A : 5 appareils
select t.view(101, 1011); select t.view(101, null, t.uid(9));            -- A : l'administrateur (visite ou compte) : exclu
select t.view(102, 1007); select t.view(102, 1008); select t.view(102, 1001);  -- B : client 1 (2 appareils) + v1 = 2
select t.view(104, 1000 + g) from generate_series(1, 5) g; select t.view(104, 1009); select t.view(104, 1010);  -- D inactif
select t.view(103, 1012, null, '40 days');                               -- C : vu il y a 40 jours seulement
select t.view(105, 1014, null, '0 seconds');                             -- E : vu maintenant

set test.is_admin = 'on';

-- 30 JOURS (par défaut)
select t.ok('30 jours par défaut ; période inconnue = 30 jours', public.admin_dashboard_overview() ->> 'period' = '30d' and t.r('hier') ->> 'period' = '30d' and t.r(null) ->> 'period' = '30d');
select t.ok('visiteurs 30 j : 9 (appareil qui revient = 1, client sur 2 appareils = 1, appareils vides = 2, admin et anciens exclus)', (t.r('30d') ->> 'visitors')::int = 9);
select t.ok('visiteurs 30 j d''avant : 2', (t.r('30d') ->> 'visitors_prev')::int = 2);
select t.ok('nouveaux clients 30 j : 2 (admin exclu) ; avant : 1', (t.r('30d') ->> 'new_customers')::int = 2 and (t.r('30d') ->> 'new_customers_prev')::int = 1);
select t.ok('commandes 30 j : 2 (annulée et fausse exclues) ; avant : 1', (t.r('30d') ->> 'orders')::int = 2 and (t.r('30d') ->> 'orders_prev')::int = 1);
select t.ok('chiffre : seulement les commandes livrées (10 000, pas la fausse)', (t.r('30d') ->> 'revenue')::numeric = 10000);
select t.ok('articles en vente : 4 (inactif exclu)', (t.r('30d') ->> 'products')::int = 4);
select t.ok('catégories : 2 (sous-catégorie comptée dans sa catégorie, catégorie d''un article inactif exclue)', (t.r('30d') ->> 'categories')::int = 2);
select t.ok('sources 30 j : TikTok 5, Inconnue 2, Facebook 1, Publicité 1 (admin exclu)',
  t.r('30d') -> 'sources' = '[{"source":"TikTok","visitors":5},{"source":"Inconnue","visitors":2},{"source":"Facebook","visitors":1},{"source":"Publicité / campagne","visitors":1}]'::jsonb);
select t.ok('plus regardés 30 j : A 5, B 2, E 1 (admin, inactif et ancien exclus)',
  (select string_agg((x ->> 'name') || '=' || (x ->> 'visitors'), ',') from jsonb_array_elements(t.r('30d') -> 'top') x) = 'A article=5,B article=2,E article=1');
select t.ok('plus regardés : l''identifiant de l''article est renvoyé', t.r('30d') -> 'top' -> 0 ->> 'product_id' = t.uid(101)::text);
select t.ok('date de début renvoyée', (t.r('30d') ->> 'since')::timestamptz between now() - interval '30 days 1 minute' and now() - interval '29 days 23 hours');

-- 7 JOURS
select t.ok('7 jours : 9 visiteurs, 0 la semaine d''avant', (t.r('7d') ->> 'visitors')::int = 9 and (t.r('7d') ->> 'visitors_prev')::int = 0);
select t.ok('7 jours : 2 commandes, 1 nouveau client (le client 1 a 10 jours)', (t.r('7d') ->> 'orders')::int = 2 and (t.r('7d') ->> 'new_customers')::int = 1);

-- AUJOURD'HUI (depuis minuit à N'Djamena)
select t.ok('aujourd''hui : 1 visiteur, 1 nouveau client, 0 commande', (t.r('today') ->> 'visitors')::int = 1 and (t.r('today') ->> 'new_customers')::int = 1 and (t.r('today') ->> 'orders')::int = 0);
select t.ok('hier à la même heure : 3 visiteurs (client 1 + 2 appareils vides, admin exclu)', (t.r('today') ->> 'visitors_prev')::int = 3);
select t.ok('aujourd''hui commence à minuit à N''Djamena', (t.r('today') ->> 'since')::timestamptz = date_trunc('day', now() at time zone 'Africa/Ndjamena') at time zone 'Africa/Ndjamena');
select t.ok('aujourd''hui : sources et plus regardés de la journée', t.r('today') -> 'sources' = '[{"source":"Publicité / campagne","visitors":1}]'::jsonb and t.r('today') -> 'top' -> 0 ->> 'name' = 'E article');

-- TOUT
select t.ok('tout : 11 visiteurs, pas de période d''avant ni de date de début', (t.r('all') ->> 'visitors')::int = 11 and t.r('all') -> 'visitors_prev' = 'null'::jsonb and t.r('all') -> 'since' = 'null'::jsonb and t.r('all') -> 'orders_prev' = 'null'::jsonb and t.r('all') -> 'new_customers_prev' = 'null'::jsonb);
select t.ok('tout : 3 commandes, 13 000 livrés, 3 clients', (t.r('all') ->> 'orders')::int = 3 and (t.r('all') ->> 'revenue')::numeric = 13000 and (t.r('all') ->> 'new_customers')::int = 3);
select t.ok('tout : C (vu il y a 40 jours) revient, classé par nom à égalité avec E',
  (select string_agg((x ->> 'name') || '=' || (x ->> 'visitors'), ',') from jsonb_array_elements(t.r('all') -> 'top') x) = 'A article=5,B article=2,C article=1,E article=1');

-- LES 12 SEMAINES
select t.ok('12 semaines, toutes des lundis, qui se suivent', (select count(*) = 12 and bool_and(extract(isodow from (x ->> 'week')::date) = 1) and max((x ->> 'week')::date) - min((x ->> 'week')::date) = 77 from jsonb_array_elements(t.r('30d') -> 'weeks') x));
select t.ok('la dernière semaine est la semaine en cours (N''Djamena)', t.r('30d') -> 'weeks' -> 11 ->> 'week' = to_char(date_trunc('week', now() at time zone 'Africa/Ndjamena'), 'YYYY-MM-DD'));
select t.ok('semaine en cours : les personnes vues depuis lundi, admin exclu',
  (t.r('30d') -> 'weeks' -> 11 ->> 'visitors')::int = (select count(distinct coalesce(user_id::text, nullif(visitor_id, ''), id::text)) from public.visitor_sessions where started_at >= date_trunc('week', now() at time zone 'Africa/Ndjamena') at time zone 'Africa/Ndjamena' and user_id is distinct from t.uid(9)));
select t.ok('les semaines ne dépendent pas de la période choisie', t.r('30d') -> 'weeks' = t.r('today') -> 'weeks' and t.r('7d') -> 'weeks' = t.r('all') -> 'weeks');
select t.ok('la semaine d''il y a 35 jours compte ancien-2', (select (x ->> 'visitors')::int >= 1 from jsonb_array_elements(t.r('30d') -> 'weeks') x where (x ->> 'week')::date = date_trunc('week', (now() - interval '35 days') at time zone 'Africa/Ndjamena')::date));

-- SÉCURITÉ
set test.is_admin = 'off';
do $$ begin
  perform public.admin_dashboard_overview('30d');
  raise exception 'ECHEC un non-administrateur a lu le tableau de bord';
exception when insufficient_privilege then
  if sqlerrm = 'Non autorise' then raise notice 'OK    non-administrateur : refusé (Non autorise)'; else raise; end if;
end $$;
set role authenticated;
do $$ begin
  perform public.admin_dashboard_overview('30d');
  raise exception 'ECHEC un client connecté a lu le tableau de bord';
exception when insufficient_privilege then
  if sqlerrm = 'Non autorise' then raise notice 'OK    client connecté (pas admin) : refusé'; else raise; end if;
end $$;
set test.is_admin = 'on';
select t.ok('administrateur connecté (rôle authenticated) : lit les chiffres', (public.admin_dashboard_overview('30d') ->> 'visitors')::int = 9);
reset role;
set role anon;
do $$ begin
  perform public.admin_dashboard_overview('30d');
  raise exception 'ECHEC un visiteur anonyme a pu appeler la fonction';
exception when insufficient_privilege then
  if sqlerrm like 'permission denied%' then raise notice 'OK    visiteur anonyme : ne peut même pas appeler la fonction'; else raise; end if;
end $$;
reset role;
select t.ok('droits : authenticated oui, anon et public non', has_function_privilege('authenticated', 'public.admin_dashboard_overview(text)', 'execute') and not has_function_privilege('anon', 'public.admin_dashboard_overview(text)', 'execute')
  and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.admin_dashboard_overview(text)'::regprocedure and a.grantee = 0));
select t.ok('chemin de recherche fixe (avis de sécurité Supabase) et security definer', (select prosecdef and proconfig::text like '%search_path=public, extensions%' from pg_proc where oid = 'public.admin_dashboard_overview(text)'::regprocedure));
select t.ok('aucune donnée de client renvoyée : seulement des totaux et des noms d''articles',
  (select array_agg(k order by k) from jsonb_object_keys(t.r('30d')) k) = array['categories','new_customers','new_customers_prev','orders','orders_prev','period','products','revenue','since','sources','top','visitors','visitors_prev','weeks']);
select t.ok('6 sources et 5 articles au plus', position('limit 6' in pg_get_functiondef('public.admin_dashboard_overview(text)'::regprocedure)) > 0 and position('limit 5' in pg_get_functiondef('public.admin_dashboard_overview(text)'::regprocedure)) > 0);
