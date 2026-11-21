-- Contrôles de add-source-report.sql sur un Postgres local jetable (voir tests/sql/run-source-report.sh).
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
create function t.sid(n int) returns uuid language sql immutable as $$ select ('11111111-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.uid(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
-- la ligne de la source / de la campagne demandée
create function t.src(r jsonb, name text) returns jsonb language sql immutable as $$ select e from jsonb_array_elements(r -> 'sources') e where e ->> 'source' = name $$;
create function t.camp(r jsonb, name text) returns jsonb language sql immutable as $$ select e from jsonb_array_elements(r -> 'campaigns') e where e ->> 'campaign' = name $$;

-- La période testée : du 10 au 16 octobre 2026 (bornes comprises : 10/10 à 00:00:00 et 16/10 à 23:59:59,999)
-- TikTok : v1 revient (déjà vu en septembre), v2 (2 visites), v5 et v6 pile sur les bornes ; v7 et v8 juste en dehors
insert into public.visitor_sessions (id, user_id, visitor_id, started_at, duration_seconds, page_views, referrer_source, utm_medium, utm_campaign) values
  (t.sid(1),  null, 'v1', '2026-09-20 10:00+00',        5, 1, 'TikTok', null, null),
  (t.sid(2),  null, 'v1', '2026-10-12 10:00+00',       40, 1, 'TikTok', 'paid', 'c-tik'),
  (t.sid(3),  null, 'v2', '2026-10-13 10:00+00',        0, 1, 'TikTok', null, null),
  (t.sid(4),  null, 'v2', '2026-10-14 10:00+00',        0, 3, 'TikTok', null, null),
  (t.sid(5),  null, 'v5', '2026-10-10 00:00:00+00',     0, 1, 'TikTok', null, null),
  (t.sid(6),  null, 'v6', '2026-10-16 23:59:59.999+00', 0, 1, 'TikTok', null, null),
  (t.sid(7),  null, 'v7', '2026-10-09 23:59:59.999+00', 0, 1, 'TikTok', null, null),
  (t.sid(8),  null, 'v8', '2026-10-17 00:00:00+00',     0, 1, 'TikTok', null, null),
-- Facebook : 2 visiteurs, même campagne, sans média
  (t.sid(9),  null, 'v3', '2026-10-15 09:00+00', 0, 1, 'Facebook', null, 'c-fb'),
  (t.sid(10), null, 'v4', '2026-10-15 09:05+00', 0, 1, 'Facebook', null, 'c-fb'),
-- Autre (source vide) : un compte connecté qui revient (visite de septembre + une d'octobre), et une visite sans aucun identifiant
  (t.sid(11), t.uid(1), null, '2026-09-10 08:00+00', 0, 1, null, null, null),
  (t.sid(12), t.uid(1), null, '2026-10-15 08:00+00', 0, 1, null, null, null),
  (t.sid(13), null,     null, '2026-10-15 08:30+00', 0, 1, null, null, null),
-- Google, avant la période
  (t.sid(14), null, 'v9', '2026-10-05 10:00+00', 90, 4, 'Google', null, null);
-- 1 500 pubs qui repartent tout de suite : bien plus que la limite de 1 000 lignes qui faussait la page
insert into public.visitor_sessions (visitor_id, started_at, duration_seconds, page_views, referrer_source, utm_medium, utm_campaign)
  select 'bulk' || n, '2026-10-14 12:00+00', 0, 1, 'Publicité / campagne', 'paid', 'c-bulk' from generate_series(1, 1500) n;

-- articles vus : 3 sur la visite 2 et 1 sur la visite 4 (TikTok), 1 sur la 9 (Facebook), 1 sur la 1 (avant la période), 1 sans visite
insert into public.product_views (session_id, product_id) values
  (t.sid(2), t.sid(100)), (t.sid(2), t.sid(100)), (t.sid(2), t.sid(101)), (t.sid(4), t.sid(100)),
  (t.sid(9), t.sid(100)), (t.sid(1), t.sid(100)), (null, t.sid(100));
insert into public.cart_events (session_id, product_id) values (t.sid(2), t.sid(100)), (t.sid(1), t.sid(100));
-- commandes : livrée (compte), livrée mais fausse, en attente, livrée AVANT la période, livrée dans la période (sans campagne), livrée pile sur la borne de fin
insert into public.orders (session_id, total, status, is_flagged_fake, created_at) values
  (t.sid(2), 20000,   'delivered', false, '2026-10-12 11:00+00'),
  (t.sid(2), 9999,    'delivered', true,  '2026-10-12 11:05+00'),
  (t.sid(2), 8888,    'pending',   false, '2026-10-12 11:10+00'),
  (t.sid(9), 5000,    'delivered', false, '2026-10-08 10:00+00'),
  (t.sid(3), 7500.5,  'delivered', false, '2026-10-13 12:00+00'),
  (t.sid(6), 3000,    'delivered', false, '2026-10-16 23:59:59.999+00');

-- 0. droits
select t.ok('droits : pas l''anonyme, oui le connecté (la fonction vérifie ensuite l''administrateur)',
  not has_function_privilege('anon', 'public.admin_source_report(timestamptz, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.admin_source_report(timestamptz, timestamptz)', 'execute'));

-- 1. un client est refusé
set role authenticated;
select set_config('test.is_admin', 'off', false);
select t.fails('un client ne lit pas le rapport', 'select public.admin_source_report(''2026-10-10 00:00+00'', ''2026-10-16 23:59:59.999+00'')', 'Non autorise');

-- 2. l'administrateur
select set_config('test.is_admin', 'on', false);
create temp table rep as select public.admin_source_report('2026-10-10 00:00:00+00', '2026-10-16 23:59:59.999+00') as r;
grant select on rep to public;

select t.ok('total : 1 509 visites (9 + 1 500, pas bloqué à 1 000), 1 508 visiteurs',
  (select (r -> 'totals' ->> 'sessions')::int from rep) = 1509 and (select (r -> 'totals' ->> 'visitors')::int from rep) = 1508);
select t.ok('total : 3 vraies visites, 3 vrais visiteurs (reste 20 s, 2 pages ou connecté)',
  (select (r -> 'totals' ->> 'real_sessions')::int from rep) = 3 and (select (r -> 'totals' ->> 'real_visitors')::int from rep) = 3);
select t.ok('les bornes : 10/10 à 00:00:00 et 16/10 à 23:59:59,999 sont comptées ; 1 ms avant et 1 ms après ne le sont pas',
  (t.src((select r from rep), 'TikTok') ->> 'sessions')::int = 5 and (t.src((select r from rep), 'TikTok') ->> 'visitors')::int = 4);

-- TikTok : v1 (revenant), v2, v5, v6
select t.ok('TikTok : 5 visites, 4 visiteurs, 3 nouveaux (v2, v5, v6) et 1 revenant (v1, déjà vu en septembre)',
  (t.src((select r from rep), 'TikTok') ->> 'new_visitors')::int = 3);
select t.ok('TikTok : temps moyen 8 s (40 s sur 5 visites), 7 pages vues',
  (t.src((select r from rep), 'TikTok') ->> 'avg_time_seconds')::int = 8 and (t.src((select r from rep), 'TikTok') ->> 'pages_viewed')::int = 7);
select t.ok('TikTok : 2 vraies visites, 2 vrais visiteurs',
  (t.src((select r from rep), 'TikTok') ->> 'real_sessions')::int = 2 and (t.src((select r from rep), 'TikTok') ->> 'real_visitors')::int = 2);
select t.ok('TikTok : 4 articles vus et 1 panier (ceux des visites de la période seulement)',
  (t.src((select r from rep), 'TikTok') ->> 'product_views')::int = 4 and (t.src((select r from rep), 'TikTok') ->> 'cart_adds')::int = 1);
select t.ok('TikTok : 3 commandes livrées et non fausses de la période = 30 500,50 (la fausse, l''en attente et l''ancienne ne comptent pas ; la borne de fin compte)',
  (t.src((select r from rep), 'TikTok') ->> 'orders')::int = 3 and (t.src((select r from rep), 'TikTok') ->> 'revenue')::numeric = 30500.5);

-- Facebook
select t.ok('Facebook : 2 visites, 2 visiteurs, 2 nouveaux, 0 vraie visite, 1 article vu, 0 commande (celle de avant la période ne compte pas)',
  (t.src((select r from rep), 'Facebook') ->> 'sessions')::int = 2 and (t.src((select r from rep), 'Facebook') ->> 'new_visitors')::int = 2
  and (t.src((select r from rep), 'Facebook') ->> 'real_sessions')::int = 0 and (t.src((select r from rep), 'Facebook') ->> 'product_views')::int = 1
  and (t.src((select r from rep), 'Facebook') ->> 'orders')::int = 0);

-- Autre : source vide
select t.ok('source vide = « Autre » : 2 visites, 2 visiteurs (le compte connecté et la visite sans identifiant)',
  (t.src((select r from rep), 'Autre') ->> 'sessions')::int = 2 and (t.src((select r from rep), 'Autre') ->> 'visitors')::int = 2);
select t.ok('Autre : 1 nouveau (la visite sans identifiant) et 1 revenant (le compte, vu en septembre) ; 1 vraie visite (connecté)',
  (t.src((select r from rep), 'Autre') ->> 'new_visitors')::int = 1 and (t.src((select r from rep), 'Autre') ->> 'real_visitors')::int = 1);

-- les pubs
select t.ok('Publicité / campagne : 1 500 visites, 1 500 visiteurs, 1 500 nouveaux, temps moyen 0, 1 500 pages, 0 vraie visite',
  (t.src((select r from rep), 'Publicité / campagne') ->> 'sessions')::int = 1500 and (t.src((select r from rep), 'Publicité / campagne') ->> 'visitors')::int = 1500
  and (t.src((select r from rep), 'Publicité / campagne') ->> 'new_visitors')::int = 1500 and (t.src((select r from rep), 'Publicité / campagne') ->> 'avg_time_seconds')::int = 0
  and (t.src((select r from rep), 'Publicité / campagne') ->> 'pages_viewed')::int = 1500 and (t.src((select r from rep), 'Publicité / campagne') ->> 'real_sessions')::int = 0);
select t.ok('Google (visite avant la période) : absent', t.src((select r from rep), 'Google') is null);
select t.ok('tri : la source qui a le plus de visites en premier, puis TikTok', (select r -> 'sources' -> 0 ->> 'source' from rep) = 'Publicité / campagne' and (select r -> 'sources' -> 1 ->> 'source' from rep) = 'TikTok');

-- campagnes
select t.ok('campagnes : c-tik (20 000 FCFA) d''abord, puis c-bulk (1 500 visiteurs), puis c-fb ; 3 campagnes',
  (select jsonb_array_length(r -> 'campaigns') from rep) = 3 and (select r -> 'campaigns' -> 0 ->> 'campaign' from rep) = 'c-tik'
  and (select r -> 'campaigns' -> 1 ->> 'campaign' from rep) = 'c-bulk' and (select r -> 'campaigns' -> 2 ->> 'campaign' from rep) = 'c-fb');
select t.ok('c-tik : média « paid », source TikTok, 1 visiteur, 1 vrai, 1 commande de 20 000 (sa commande, pas celles des autres visites TikTok)',
  t.camp((select r from rep), 'c-tik') ->> 'medium' = 'paid' and t.camp((select r from rep), 'c-tik') ->> 'source' = 'TikTok'
  and (t.camp((select r from rep), 'c-tik') ->> 'visitors')::int = 1 and (t.camp((select r from rep), 'c-tik') ->> 'real_visitors')::int = 1
  and (t.camp((select r from rep), 'c-tik') ->> 'orders')::int = 1 and (t.camp((select r from rep), 'c-tik') ->> 'revenue')::numeric = 20000);
select t.ok('c-fb : sans média (null), source Facebook, 2 visiteurs, 0 vrai, 0 commande',
  t.camp((select r from rep), 'c-fb') -> 'medium' = 'null'::jsonb and t.camp((select r from rep), 'c-fb') ->> 'source' = 'Facebook'
  and (t.camp((select r from rep), 'c-fb') ->> 'visitors')::int = 2 and (t.camp((select r from rep), 'c-fb') ->> 'real_visitors')::int = 0 and (t.camp((select r from rep), 'c-fb') ->> 'orders')::int = 0);
select t.ok('c-bulk : 1 500 visites, 1 500 visiteurs, 0 vrai, 0 commande', (t.camp((select r from rep), 'c-bulk') ->> 'sessions')::int = 1500 and (t.camp((select r from rep), 'c-bulk') ->> 'visitors')::int = 1500 and (t.camp((select r from rep), 'c-bulk') ->> 'real_visitors')::int = 0);

-- période sans visite : des zéros et des listes vides, jamais d'erreur
select t.ok('période sans aucune visite : tout à zéro, listes vides',
  (public.admin_source_report('2027-01-01 00:00+00', '2027-01-02 00:00+00') -> 'totals' ->> 'sessions')::int = 0
  and jsonb_array_length(public.admin_source_report('2027-01-01 00:00+00', '2027-01-02 00:00+00') -> 'sources') = 0
  and jsonb_array_length(public.admin_source_report('2027-01-01 00:00+00', '2027-01-02 00:00+00') -> 'campaigns') = 0);

-- 3. 21 novembre 2026 : ventes selon la PREMIÈRE visite, commandes sans visite, clics « Commander » site / WhatsApp, d'où vient « Autre »
reset role;
select t.ok('colonnes ajoutées : visitor_sessions.referrer_host et utm_source, cart_events.channel',
  (select count(*) from information_schema.columns where table_schema = 'public'
     and ((table_name = 'visitor_sessions' and column_name in ('referrer_host', 'utm_source')) or (table_name = 'cart_events' and column_name = 'channel'))) = 3);
select t.fails('clic « Commander » : seulement site ou whatsapp', 'insert into public.cart_events (channel) values (''facebook'')', 'cart_events_channel_check');
select t.fails('nom du site d''où vient le visiteur : 120 caractères au plus', 'insert into public.visitor_sessions (referrer_host) values (repeat(''a'', 121))', 'visitor_sessions_referrer_host_len');
select t.fails('utm_source : 120 caractères au plus', 'insert into public.visitor_sessions (utm_source) values (repeat(''a'', 121))', 'visitor_sessions_utm_source_len');

-- La période : du 1er au 7 novembre 2026.
insert into public.visitor_sessions (id, user_id, visitor_id, started_at, referrer_source, referrer_host, utm_source) values
  -- w1 découvre la boutique par TikTok en octobre, revient le 3 novembre en tapant l'adresse et commande (22 500)
  (t.sid(200), null,     'w1',    '2026-10-20 10:00+00', 'TikTok',       'www.tiktok.com', null),
  (t.sid(201), null,     'w1',    '2026-11-03 10:00+00', 'Accès direct', null, null),
  -- w2 vient de Facebook le 2, revient le 4 par Telegram et commande sans compte (son compte uid(5) est créé à la commande : 30 000)
  (t.sid(202), null,     'w2',    '2026-11-02 10:00+00', 'Facebook',     'm.facebook.com', null),
  (t.sid(203), t.uid(5), 'w2',    '2026-11-04 10:00+00', null,           'org.telegram.messenger', null),
  -- le compte uid(6) : venu par Instagram le 1er octobre sur un téléphone, commande le 5 novembre depuis un autre (Google : 12 000)
  (t.sid(204), t.uid(6), 'w3old', '2026-10-01 10:00+00', 'Instagram',    'l.instagram.com', null),
  (t.sid(205), t.uid(6), 'w3new', '2026-11-05 10:00+00', 'Google',       'www.google.com', null),
  -- la visite de la commande de w4 commence 10 minutes AVANT la période, la commande tombe dedans (5 000)
  (t.sid(206), null,     'w4',    '2026-10-31 23:50+00', 'WhatsApp',     'l.wl.co', null),
  -- le compte uid(7) : sa commande (ajoutée à la main, sans visite) date du 3 ; il visite le site seulement le 6 : ce n'est pas sa « première visite »
  (t.sid(210), t.uid(7), 'w8',    '2026-11-06 10:00+00', 'WhatsApp',     'l.wl.co', null),
  -- d'autres visiteurs « Autre » : Telegram, le code QR (utm_source inconnu), et une visite sans rien (d'avant la mise à jour)
  (t.sid(207), null,     'w5',    '2026-11-02 11:00+00', 'Autre',        'org.telegram.messenger', null),
  (t.sid(208), null,     'w6',    '2026-11-02 12:00+00', 'Autre',        null, 'qr'),
  (t.sid(209), null,     'w7',    '2026-11-02 13:00+00', 'Autre',        null, null);
insert into public.orders (user_id, session_id, total, status, is_flagged_fake, created_at) values
  (t.uid(4), t.sid(201), 22500, 'delivered', false, '2026-11-03 10:05+00'),
  (t.uid(4), t.sid(201), 99000, 'pending',   false, '2026-11-03 10:06+00'),
  (t.uid(5), t.sid(203), 30000, 'delivered', false, '2026-11-04 10:05+00'),
  (t.uid(6), t.sid(205), 12000, 'delivered', false, '2026-11-05 10:05+00'),
  (t.uid(8), t.sid(206), 5000,  'delivered', false, '2026-11-01 00:10+00'),
  (t.uid(7), null,       15000, 'delivered', false, '2026-11-03 09:00+00');
-- clics « Commander » de w1 le 3 : 2 sur le site, 1 sur WhatsApp, 1 d'avant la mise à jour (sans channel)
insert into public.cart_events (session_id, channel) values (t.sid(201), 'site'), (t.sid(201), 'site'), (t.sid(201), 'whatsapp'), (t.sid(201), null);

set role authenticated;
select set_config('test.is_admin', 'on', false);
create temp table rep2 as select public.admin_source_report('2026-11-01 00:00:00+00', '2026-11-07 23:59:59.999+00') as r;

select t.ok('visite de la commande : Accès direct 1 commande 22 500, Autre 1 commande 30 000, Google 1 commande 12 000',
  (t.src((select r from rep2), 'Accès direct') ->> 'orders')::int = 1 and (t.src((select r from rep2), 'Accès direct') ->> 'revenue')::numeric = 22500
  and (t.src((select r from rep2), 'Autre') ->> 'orders')::int = 1 and (t.src((select r from rep2), 'Autre') ->> 'revenue')::numeric = 30000
  and (t.src((select r from rep2), 'Google') ->> 'orders')::int = 1 and (t.src((select r from rep2), 'Google') ->> 'revenue')::numeric = 12000);
select t.ok('visite de la commande commencée 10 minutes avant la période : la vente compte quand même (WhatsApp 1 commande 5 000)',
  (t.src((select r from rep2), 'WhatsApp') ->> 'orders')::int = 1 and (t.src((select r from rep2), 'WhatsApp') ->> 'revenue')::numeric = 5000);
select t.ok('première visite : la vente de w1 va à TikTok (vu en octobre), même sans visite TikTok dans la période (0 visite)',
  (t.src((select r from rep2), 'TikTok') ->> 'orders_first')::int = 1 and (t.src((select r from rep2), 'TikTok') ->> 'revenue_first')::numeric = 22500
  and (t.src((select r from rep2), 'TikTok') ->> 'sessions')::int = 0 and (t.src((select r from rep2), 'TikTok') ->> 'orders')::int = 0
  and (t.src((select r from rep2), 'Accès direct') ->> 'orders_first')::int = 0);
select t.ok('première visite : la commande sans compte de w2 va à Facebook (même visiteur), pas à « Autre »',
  (t.src((select r from rep2), 'Facebook') ->> 'orders_first')::int = 1 and (t.src((select r from rep2), 'Facebook') ->> 'revenue_first')::numeric = 30000
  and (t.src((select r from rep2), 'Autre') ->> 'orders_first')::int = 0);
select t.ok('première visite : le compte uid(6) a commandé depuis un autre téléphone, la vente va à Instagram (son compte, 1er octobre)',
  (t.src((select r from rep2), 'Instagram') ->> 'orders_first')::int = 1 and (t.src((select r from rep2), 'Instagram') ->> 'revenue_first')::numeric = 12000
  and (t.src((select r from rep2), 'Google') ->> 'orders_first')::int = 0);
select t.ok('première visite : w4 (WhatsApp) reste WhatsApp ; la visite de uid(7) APRÈS sa commande ne compte pas',
  (t.src((select r from rep2), 'WhatsApp') ->> 'orders_first')::int = 1 and (t.src((select r from rep2), 'WhatsApp') ->> 'revenue_first')::numeric = 5000);
select t.ok('commande sans visite connue (uid(7), 15 000) : « sans visite » dans les deux rangements ; l''en attente ne compte nulle part',
  (select (r -> 'unattributed' ->> 'orders')::int from rep2) = 1 and (select (r -> 'unattributed' ->> 'revenue')::numeric from rep2) = 15000
  and (select (r -> 'unattributed' ->> 'orders_first')::int from rep2) = 1 and (select (r -> 'unattributed' ->> 'revenue_first')::numeric from rep2) = 15000);
select t.ok('les ventes livrées se retrouvent toutes : 84 500 = 69 500 dans les sources + 15 000 sans visite, dans les deux rangements',
  (select sum((e ->> 'revenue')::numeric) from jsonb_array_elements((select r -> 'sources' from rep2)) e) = 69500
  and (select sum((e ->> 'revenue_first')::numeric) from jsonb_array_elements((select r -> 'sources' from rep2)) e) = 69500);
select t.ok('clics « Commander » de w1 (Accès direct) : 4 en tout, 2 sur le site, 1 sur WhatsApp (le 4e : d''avant la mise à jour)',
  (t.src((select r from rep2), 'Accès direct') ->> 'cart_adds')::int = 4 and (t.src((select r from rep2), 'Accès direct') ->> 'checkout_site')::int = 2
  and (t.src((select r from rep2), 'Accès direct') ->> 'checkout_whatsapp')::int = 1);
select t.ok('« Autre » : Telegram (2 visiteurs) d''abord, puis « utm : qr » (1), puis inconnu (1) ; pas les visites des autres sources',
  (select jsonb_array_length(r -> 'other_hosts') from rep2) = 3
  and (select r -> 'other_hosts' -> 0 ->> 'label' from rep2) = 'org.telegram.messenger' and (select (r -> 'other_hosts' -> 0 ->> 'visitors')::int from rep2) = 2
  and (select r -> 'other_hosts' -> 1 ->> 'label' from rep2) = 'utm : qr' and (select (r -> 'other_hosts' -> 1 ->> 'visitors')::int from rep2) = 1
  and (select r -> 'other_hosts' -> 2 -> 'label' from rep2) = 'null'::jsonb and (select (r -> 'other_hosts' -> 2 ->> 'visitors')::int from rep2) = 1);
select t.ok('la première période (octobre) : la première visite donne aussi 3 ventes TikTok (30 500,50), rien sans visite, aucun « Autre » connu',
  (t.src((select r from rep), 'TikTok') ->> 'orders_first')::int = 3 and (t.src((select r from rep), 'TikTok') ->> 'revenue_first')::numeric = 30500.5
  and (select (r -> 'unattributed' ->> 'orders')::int from rep) = 0
  and (select r -> 'other_hosts' -> 0 -> 'label' from rep) = 'null'::jsonb);

-- le client est toujours refusé après
select set_config('test.is_admin', 'off', false);
select t.fails('un client est toujours refusé', 'select public.admin_source_report(''2026-10-10 00:00+00'', ''2026-10-16 23:59:59.999+00'')', 'Non autorise');
select 'TOUS LES CONTROLES REUSSIS' as resultat;
