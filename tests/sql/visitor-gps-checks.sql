-- Contrôles de add-visitor-gps.sql. Chaque ligne affiche OK ou ECHEC.
create temp table r (n serial, label text, ok boolean);
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('test.uid', coalesce(uid, ''), false);
end $$;
grant all on r, r_n_seq to anon, authenticated;

-- 1) droits explicites (le script doit les donner lui-même, voir AGENTS.md)
insert into r (label, ok) values ('droit d''insertion donné à anon', has_table_privilege('anon', 'public.visitor_locations', 'insert'));
insert into r (label, ok) values ('droit d''insertion donné à authenticated', has_table_privilege('authenticated', 'public.visitor_locations', 'insert'));
insert into r (label, ok) values ('droit de lecture donné à authenticated', has_table_privilege('authenticated', 'public.visitor_locations', 'select'));

-- 2) un visiteur anonyme peut enregistrer sa position
set role anon;
insert into public.visitor_locations (visitor_id, latitude, longitude) values ('v-anon', 12.1, 15.0);
reset role;
insert into r (label, ok) values ('visiteur anonyme : insertion acceptée', (select count(*) from public.visitor_locations where visitor_id = 'v-anon') = 1);

-- 3) un client connecté peut enregistrer sa position, avec son user_id
set role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into public.visitor_locations (visitor_id, user_id, latitude, longitude) values ('v-client', '22222222-2222-2222-2222-222222222222', 12.2, 15.1);
reset role;
insert into r (label, ok) values ('client connecté : insertion acceptée avec son user_id', (select count(*) from public.visitor_locations where visitor_id = 'v-client' and user_id = '22222222-2222-2222-2222-222222222222') = 1);

-- 4) coordonnées hors limites refusées
do $$ begin
  begin
    insert into public.visitor_locations (visitor_id, latitude, longitude) values ('v-bad', 999, 15.0);
    insert into r (label, ok) values ('latitude hors limites : refusée', false);
  exception when check_violation then
    insert into r (label, ok) values ('latitude hors limites : refusée', true);
  end;
end $$;

-- 5) lecture : un client ne voit rien, l'admin voit tout (RLS)
set role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into r (label, ok) values ('RLS : un client ne lit aucune position', (select count(*) from public.visitor_locations) = 0);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into r (label, ok) values ('RLS : l''administrateur lit toutes les positions', (select count(*) from public.visitor_locations) = (select count(*) from public.visitor_locations where true));
reset role;

-- 6) admin_visitor_regions_overview() : réservée à l'administrateur
set role authenticated;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$ begin
  begin
    perform public.admin_visitor_regions_overview();
    insert into r (label, ok) values ('admin_visitor_regions_overview : refusée à un client', false);
  exception when others then
    insert into r (label, ok) values ('admin_visitor_regions_overview : refusée à un client', true);
  end;
end $$;
reset role;

-- 7) admin_visitor_regions_overview() : regroupe par région et par ville, une seule fois par visiteur
--    (seule la position la plus récente de chaque visiteur compte)
insert into public.visitor_locations (visitor_id, latitude, longitude, city, region, country, created_at) values
  ('v1', 12.1, 15.0, 'Ndjamena', 'Ndjamena', 'Tchad', now() - interval '2 days'),   -- ancienne position de v1 : ignorée
  ('v1', 12.1, 15.0, 'Moundou', 'Logone Occidental', 'Tchad', now()),               -- la plus récente de v1 : comptée
  ('v2', 12.1, 15.0, 'Ndjamena', 'Ndjamena', 'Tchad', now()),
  ('v3', 12.1, 15.0, null, null, null, now());                                      -- adresse introuvable : "Inconnu"

set role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.admin_visitor_regions_overview() as overview \gset
reset role;

insert into r (label, ok) values (
  'overview : v-anon + v-client + v1 + v2 + v3 = 5 visiteurs localisés',
  (:'overview'::jsonb ->> 'total_visitors_located')::int = 5
);
insert into r (label, ok) values (
  'overview : la position la plus récente de v1 (Moundou) compte, pas l''ancienne',
  exists (select 1 from jsonb_array_elements(:'overview'::jsonb -> 'cities') c where c ->> 'city' = 'Moundou')
  and not exists (select 1 from jsonb_array_elements(:'overview'::jsonb -> 'regions') r2 where r2 ->> 'region' = 'Ndjamena' and (r2 ->> 'visitors')::int > 1)
);
insert into r (label, ok) values (
  'overview : position sans adresse comptée "Inconnu"',
  exists (select 1 from jsonb_array_elements(:'overview'::jsonb -> 'regions') r2 where r2 ->> 'region' = 'Inconnu' and r2 ->> 'country' = 'Inconnu')
);

select case when ok then 'OK   ' else 'ECHEC' end || ' ' || label from r order by n;
select case when bool_and(ok) then 'TOUT EST BON (' || count(*) || ' contrôles)' else 'AVEC DES ECHECS' end from r;
