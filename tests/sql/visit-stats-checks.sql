-- Contrôles de add-visit-stats.sql sur un Postgres local jetable (voir tests/sql/run-visit-stats.sh).
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
create function t.sid(n int) returns uuid language sql immutable as $$ select ('11111111-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.pid(n int) returns uuid language sql immutable as $$ select ('22222222-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
-- la ligne de la source demandée dans le résultat
create function t.src(r jsonb, name text) returns jsonb language sql immutable as $$ select e from jsonb_array_elements(r -> 'by_source') e where e ->> 'source' = name $$;

insert into public.profiles (id, full_name, is_admin) values (t.u(1), 'Admin', true), (t.u(2), 'Amina', false), (t.u(3), 'Idriss', false);

-- ---- les visites d'aujourd'hui
-- 1 et 2 : pubs Facebook qui repartent tout de suite (campagne c1) ; 3 : reste 25 s ; 4 : voit 3 pages ; 5 : même visiteur que 4, repart tout de suite ;
-- 6 : sans identifiant de visiteur, mais connecté (Amina) ; 7 : visite d'il y a 3 jours (hors période)
insert into public.visitor_sessions (id, user_id, visitor_id, started_at, last_seen_at, duration_seconds, page_views, referrer_source, utm_medium, utm_campaign) values
  (t.sid(1), null, 'v1', now() - interval '2 hours', now() - interval '2 hours', 0, 1, 'Publicité / campagne', 'paid', 'c1'),
  (t.sid(2), null, 'v2', now() - interval '3 hours', now() - interval '3 hours', 0, 1, 'Publicité / campagne', 'paid', 'c1'),
  (t.sid(3), null, 'v3', now() - interval '4 hours', now() - interval '4 hours', 25, 1, 'Accès direct', null, null),
  (t.sid(4), null, 'v4', now() - interval '5 hours', now() - interval '5 hours', 0, 3, 'Accès direct', null, null),
  (t.sid(5), null, 'v4', now() - interval '1 hour', now() - interval '1 hour', 0, 1, 'Accès direct', null, null),
  (t.sid(6), t.u(2), null, now() - interval '6 hours', now() - interval '6 hours', 0, 1, null, null, null),
  (t.sid(7), null, 'v9', now() - interval '3 days', now() - interval '3 days', 40, 1, 'Facebook', null, null);
-- 1 500 autres pubs qui repartent tout de suite : bien plus que la limite de 1 000 lignes qui faussait le tableau de bord
insert into public.visitor_sessions (visitor_id, started_at, last_seen_at, duration_seconds, page_views, referrer_source, utm_medium, utm_campaign)
  select 'bulk' || n, now() - interval '30 minutes', now() - interval '30 minutes', 0, 1, 'Publicité / campagne', 'paid', 'c2' from generate_series(1, 1500) n;

-- articles regardés : P1 trois fois, P2 deux fois, P3 une fois dans la période ; P4 seulement il y a 10 jours (hors période)
insert into public.product_views (session_id, user_id, product_id, viewed_at) values
  (t.sid(3), null, t.pid(1), now() - interval '4 hours'),
  (t.sid(3), null, t.pid(1), now() - interval '4 hours'),
  (t.sid(4), null, t.pid(1), now() - interval '5 hours'),
  (t.sid(4), null, t.pid(2), now() - interval '5 hours'),
  (t.sid(1), null, t.pid(2), now() - interval '2 hours'),
  (null,     null, t.pid(3), now() - interval '1 hour'),
  (t.sid(3), null, t.pid(4), now() - interval '10 days');
insert into public.cart_events (session_id, user_id, product_id) values (t.sid(3), null, t.pid(1));
-- commandes : livrée (compte), en attente (ne compte pas), livrée mais fausse (ne compte pas)
insert into public.orders (session_id, total, status, is_flagged_fake) values
  (t.sid(3), 15000, 'delivered', false),
  (t.sid(4), 9000, 'pending', false),
  (t.sid(1), 7000, 'delivered', true);

-- ---- activité des clients connectés (Amina = 2, Idriss = 3)
insert into public.visitor_sessions (user_id, visitor_id, started_at, last_seen_at, duration_seconds, referrer_source) values
  (t.u(2), 'a1', now() - interval '20 days', now() - interval '20 days', 100, 'Facebook'),
  (t.u(2), 'a2', now() - interval '15 days', now() - interval '15 days', 50, 'Facebook'),
  (t.u(2), 'a3', now() - interval '10 days', now() - interval '10 days', 10, 'Accès direct');
insert into public.product_views (session_id, user_id, product_id, viewed_at) values
  (null, t.u(2), t.pid(5), now() - interval '9 days'), (null, t.u(2), t.pid(6), now() - interval '9 days'),
  (null, t.u(3), t.pid(5), now() - interval '9 days'), (null, t.u(3), t.pid(6), now() - interval '9 days');
insert into public.cart_events (session_id, user_id, product_id, created_at) values (null, t.u(2), t.pid(5), now() - interval '9 days');

-- 0. les droits des fonctions
select t.ok('droits : pas l''anonyme, oui le connecté (la fonction vérifie ensuite l''administrateur)',
  not has_function_privilege('anon', 'public.admin_visit_overview(timestamptz, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.admin_visit_overview(timestamptz, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.admin_customer_activity()', 'execute')
  and has_function_privilege('authenticated', 'public.admin_customer_activity()', 'execute'));

-- 1. un client (non administrateur) est refusé
set role authenticated;
select set_config('test.is_admin', 'off', false), set_config('test.uid', t.u(2)::text, false);
select t.fails('un client ne lit pas les visites', 'select public.admin_visit_overview(now() - interval ''1 day'')', 'Non autorise');
select t.fails('un client ne lit pas l''activité des clients', 'select public.admin_customer_activity()', 'Non autorise');

-- 2. l'administrateur : visites d'aujourd'hui (depuis il y a 1 jour)
select set_config('test.is_admin', 'on', false), set_config('test.uid', t.u(1)::text, false);
create temp table today as select public.admin_visit_overview(now() - interval '1 day') as r;
grant select on today to public;
select t.ok('visites : 6 + 1 500 = 1 506 (pas bloqué à 1 000)', (select (r ->> 'sessions')::int from today) = 1506);
select t.ok('visiteurs : v1 v2 v3 v4 + la personne connectée + 1 500 = 1 505 (v4 compté une seule fois)', (select (r ->> 'visitors')::int from today) = 1505);
select t.ok('vraies visites : 3 (reste 25 s, voit 3 pages, connectée)', (select (r ->> 'real_sessions')::int from today) = 3);
select t.ok('vrais visiteurs : 3', (select (r ->> 'real_visitors')::int from today) = 3);
select t.ok('la visite d''il y a 3 jours n''est pas comptée', (select (r ->> 'sessions')::int from today) = 1506);

select t.ok('source « Publicité / campagne » : 1 502 visites, 1 502 visiteurs, 0 vraie visite',
  (t.src((select r from today), 'Publicité / campagne') ->> 'sessions')::int = 1502
  and (t.src((select r from today), 'Publicité / campagne') ->> 'visitors')::int = 1502
  and (t.src((select r from today), 'Publicité / campagne') ->> 'real_sessions')::int = 0);
select t.ok('source « Accès direct » : 3 visites, 2 visiteurs, 2 vraies visites, 2 vrais visiteurs',
  (t.src((select r from today), 'Accès direct') ->> 'sessions')::int = 3
  and (t.src((select r from today), 'Accès direct') ->> 'visitors')::int = 2
  and (t.src((select r from today), 'Accès direct') ->> 'real_sessions')::int = 2
  and (t.src((select r from today), 'Accès direct') ->> 'real_visitors')::int = 2);
select t.ok('source sans nom : « Inconnue », 1 vraie visite (la personne est connectée)',
  (t.src((select r from today), 'Inconnue') ->> 'sessions')::int = 1 and (t.src((select r from today), 'Inconnue') ->> 'real_sessions')::int = 1);
select t.ok('la source « Facebook » (visite d''il y a 3 jours) n''apparaît pas aujourd''hui', t.src((select r from today), 'Facebook') is null);
select t.ok('articles vus par source (vus pendant les visites de la période) : Accès direct 5, Publicité 1',
  (t.src((select r from today), 'Accès direct') ->> 'product_views')::int = 5 and (t.src((select r from today), 'Publicité / campagne') ->> 'product_views')::int = 1);
select t.ok('ajouts au panier par source : Accès direct 1', (t.src((select r from today), 'Accès direct') ->> 'cart_adds')::int = 1);
select t.ok('commandes : seule la livrée et non fausse compte (1 commande, 15 000)',
  (t.src((select r from today), 'Accès direct') ->> 'orders')::int = 1 and (t.src((select r from today), 'Accès direct') ->> 'revenue')::numeric = 15000
  and (t.src((select r from today), 'Publicité / campagne') ->> 'orders')::int = 0);
select t.ok('tri : la source la plus visitée en premier', (select r -> 'by_source' -> 0 ->> 'source' from today) = 'Publicité / campagne');

select t.ok('campagnes : c2 (1 500) avant c1 (2), 0 vraie visite chacune',
  (select r -> 'by_campaign' -> 0 ->> 'campaign' from today) = 'c2' and (select (r -> 'by_campaign' -> 0 ->> 'sessions')::int from today) = 1500
  and (select r -> 'by_campaign' -> 1 ->> 'campaign' from today) = 'c1' and (select (r -> 'by_campaign' -> 1 ->> 'real_sessions')::int from today) = 0
  and (select r -> 'by_campaign' -> 1 ->> 'medium' from today) = 'paid');
select t.ok('articles les plus vus : P1 (3), P2 (2), P3 (1) ; P4 d''il y a 10 jours exclu',
  (select jsonb_array_length(r -> 'top_viewed') from today) = 3
  and (select r -> 'top_viewed' -> 0 ->> 'product_id' from today) = t.pid(1)::text and (select (r -> 'top_viewed' -> 0 ->> 'views')::int from today) = 3
  and (select r -> 'top_viewed' -> 1 ->> 'product_id' from today) = t.pid(2)::text and (select (r -> 'top_viewed' -> 1 ->> 'views')::int from today) = 2
  and (select r -> 'top_viewed' -> 2 ->> 'product_id' from today) = t.pid(3)::text);

-- 3. une période passée (de -10 jours à -2 jours) : seulement les visites de ces jours-là
create temp table past as select public.admin_visit_overview(now() - interval '10 days', now() - interval '2 days') as r;
grant select on past to public;
select t.ok('période passée (de -10 j à -2 j) : une seule visite, celle d''il y a 3 jours (Facebook)',
  (select (r ->> 'sessions')::int from past) = 1 and t.src((select r from past), 'Facebook') is not null and t.src((select r from past), 'Publicité / campagne') is null);

-- 4. période sans visite : des zéros, jamais d'erreur
select t.ok('période sans aucune visite : tout à zéro, listes vides',
  (select (public.admin_visit_overview(now() + interval '1 day') ->> 'sessions')::int) = 0
  and (select jsonb_array_length(public.admin_visit_overview(now() + interval '1 day') -> 'by_source')) = 0
  and (select jsonb_array_length(public.admin_visit_overview(now() + interval '1 day') -> 'top_viewed')) = 0);

-- 5. activité des clients connectés
create temp table act as select public.admin_customer_activity() as r;
grant select on act to public;
reset role;
create function t.act(n int) returns jsonb language sql stable as $$ select e from act, jsonb_array_elements(act.r) e where e ->> 'user_id' = t.u(n)::text $$;
grant execute on function t.act(int) to public;
set role authenticated;
select t.ok('Amina : 4 visites (1 d''aujourd''hui + 3), durée 160 s, 2 articles vus, 1 ajout, source principale Facebook',
  (t.act(2) ->> 'sessions')::int = 4 and (t.act(2) ->> 'duration_seconds')::int = 160 and (t.act(2) ->> 'views')::int = 2 and (t.act(2) ->> 'cart_adds')::int = 1 and t.act(2) ->> 'top_source' = 'Facebook');
select t.ok('Amina : dernière vue = la plus récente (aujourd''hui, il y a 6 heures)', (t.act(2) ->> 'last_seen_at')::timestamptz > now() - interval '7 hours');
select t.ok('Idriss : aucune visite mais 2 articles vus', (t.act(3) ->> 'sessions')::int = 0 and (t.act(3) ->> 'views')::int = 2 and t.act(3) -> 'last_seen_at' = 'null'::jsonb and t.act(3) -> 'top_source' = 'null'::jsonb);
select t.ok('l''administrateur sans activité n''apparaît pas', t.act(1) is null);
select t.ok('2 personnes dans la liste', (select jsonb_array_length(r) from act) = 2);

-- 6. un client est refusé aussi après
select set_config('test.is_admin', 'off', false), set_config('test.uid', t.u(3)::text, false);
select t.fails('un client ne lit toujours pas l''activité', 'select public.admin_customer_activity()', 'Non autorise');
select 'TOUS LES CONTROLES REUSSIS' as resultat;
