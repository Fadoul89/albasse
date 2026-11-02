-- Contrôles de add-product-affinity.sql sur un Postgres local jetable (voir tests/sql/run-product-affinity.sh).
create schema t;
grant usage on schema t to public;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.uid(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
-- une commande : t.order(client, ['A','B'], statut, fausse ?, téléphone, âge en jours)
create function t.order(u uuid, prods text[], st text default 'pending', fake boolean default false, phone text default null, age int default 1) returns void language sql as $$
  insert into public.orders (user_id, items, status, shipping_phone, is_flagged_fake, created_at)
  values (u, (select jsonb_agg(jsonb_build_object('product_id', p, 'quantity', 1)) from unnest(prods) p), st, phone, fake, now() - make_interval(days => age))
$$;
-- le nombre de clients qui ont acheté aussi l'article demandé
create function t.with_n(r jsonb, key text, pid text) returns integer language sql immutable as $$ select (e ->> 'n')::integer from jsonb_array_elements(r -> key) e where e ->> 'product_id' = pid $$;

-- ACHATS de l'article A ------------------------------------------------------------------------------------------------
select t.order(t.uid(1), '{A,B}');
select t.order(t.uid(1), '{A,B}');                              -- même client, 2e commande : compté UNE fois
select t.order(t.uid(2), '{A,B}');
select t.order(t.uid(3), '{A,C}');
select t.order(t.uid(4), '{A}');
select t.order(t.uid(5), '{A,B,C}');
select t.order(null, '{A,B}', 'pending', false, '+235 66 11 22 33');     -- commande sans compte : le téléphone fait le client
select t.order(null, '{A,B}', 'pending', false, '66-11-22-33');          -- numéro différent (sans 235 devant) : compté comme un autre client
select t.order(t.uid(6), '{A,B}', 'cancelled');                  -- annulée : ne compte pas
select t.order(t.uid(7), '{A,B}', 'pending', true);              -- marquée fausse : ne compte pas
select t.order(t.uid(8), '{A,B}', 'pending', false, null, 400);  -- trop ancienne (plus de 365 jours) : ne compte pas
select t.order(null, '{A,B}');                                   -- ni compte ni téléphone : on ne peut pas savoir qui : ne compte pas
select t.order(t.uid(9), '{D}');                                 -- n'a pas acheté A
select t.order(t.uid(10), '{A,E,F,G,H,I}');                      -- beaucoup d'articles : pour la limite des 5 premiers
select t.order(t.uid(11), '{A,I}');
select t.order(t.uid(12), '{A,I}');
select t.order(t.uid(13), '{A,H}');

-- NAVIGATION : 25 visiteurs regardent A ; 8 regardent aussi B ; 3 aussi C --------------------------------------------------
insert into public.visitor_product_interest (visitor_id, product_id, views, first_viewed_at, last_viewed_at)
  select 'v' || g, 'A', 1, now() - interval '5 days', now() - interval '2 days' from generate_series(1, 25) g;
insert into public.visitor_product_interest (visitor_id, product_id, views, first_viewed_at, last_viewed_at)
  select 'v' || g, 'B', 2, now() - interval '5 days', now() - interval '1 day' from generate_series(1, 8) g;
insert into public.visitor_product_interest (visitor_id, product_id, views, first_viewed_at, last_viewed_at)
  select 'v' || g, 'C', 1, now() - interval '5 days', now() - interval '1 day' from generate_series(9, 11) g;
-- à ne PAS compter : une ligne à 0 vue, une vue de plus de 90 jours
insert into public.visitor_product_interest (visitor_id, product_id, views, first_viewed_at, last_viewed_at) values
  ('v12', 'D', 0, now() - interval '3 days', now() - interval '3 days'),
  ('v13', 'D', 3, now() - interval '200 days', now() - interval '100 days'),
  ('old1', 'A', 4, now() - interval '200 days', now() - interval '100 days'),
  ('old1', 'B', 4, now() - interval '200 days', now() - interval '100 days');

-- RÉSULTATS -------------------------------------------------------------------------------------------------------------
create temp table res as select public.product_affinity('A') as r;
select t.ok('11 clients ont acheté A : u1 (une seule fois malgré 2 commandes), u2, u3, u4, u5, u10, u11, u12, u13 et les 2 clients sans compte (2 numéros différents) ; la commande annulée, la fausse, la trop ancienne et celle sans identité ne comptent pas', (select (r ->> 'customers')::int = 11 from res));
select t.ok('B acheté avec A par 5 clients (u1, u2, u5 et les 2 clients sans compte), sans compter annulée / fausse / ancienne / anonyme', (select t.with_n(r, 'bought_with', 'B') = 5 from res));
select t.ok('C acheté avec A par 2 clients (u3, u5)', (select t.with_n(r, 'bought_with', 'C') = 2 from res));
select t.ok('A n''est jamais « acheté avec » lui-même', (select t.with_n(r, 'bought_with', 'A') is null from res));
select t.ok('D (acheté sans A) n''apparaît pas', (select t.with_n(r, 'bought_with', 'D') is null from res));
select t.ok('seulement les 5 premiers autres articles, le plus acheté d''abord (B 5, I 3, puis C et H à 2, puis E à 1)', (select jsonb_array_length(r -> 'bought_with') = 5 and r -> 'bought_with' -> 0 ->> 'product_id' = 'B' and r -> 'bought_with' -> 1 ->> 'product_id' = 'I' and (r -> 'bought_with' -> 1 ->> 'n')::int = 3 from res));
select t.ok('visiteurs qui ont regardé A : 25 (la ligne de plus de 90 jours n''est pas comptée)', (select (r ->> 'viewers')::int = 25 from res));
select t.ok('B regardé avec A par 8 visiteurs', (select t.with_n(r, 'viewed_with', 'B') = 8 from res));
select t.ok('C regardé avec A par 3 visiteurs', (select t.with_n(r, 'viewed_with', 'C') = 3 from res));
select t.ok('D : une ligne à 0 vue et une vue trop ancienne ne comptent pas', (select t.with_n(r, 'viewed_with', 'D') is null from res));
select t.ok('la réponse ne contient que des totaux : 4 champs, et chaque ligne n''a que product_id et n', (select (select count(*) from jsonb_object_keys(r)) = 4 and not exists (select 1 from jsonb_array_elements(r -> 'bought_with' || (r -> 'viewed_with')) e where (select count(*) from jsonb_object_keys(e)) <> 2) from res));

-- ARTICLE INCONNU ET ENTRÉES BIZARRES --------------------------------------------------------------------------------
select t.ok('article inconnu : 0 client, 0 visiteur, listes vides', (select public.product_affinity('zzz') = '{"customers":0,"bought_with":[],"viewers":0,"viewed_with":[]}'::jsonb));
select t.ok('identifiant vide ou absent : mêmes zéros, sans erreur', (select public.product_affinity(null) = public.product_affinity('zzz') and public.product_affinity('   ') = public.product_affinity('zzz')));
select t.ok('identifiant piégé (guillemets, point-virgule) : traité comme un simple texte, zéros', (select public.product_affinity('A''; drop table public.orders; --') = public.product_affinity('zzz')));
select t.ok('la table des commandes est toujours là', (select count(*) > 0 from public.orders));

-- DROITS ----------------------------------------------------------------------------------------------------------------
select t.ok('anon et authenticated peuvent lire la fonction', has_function_privilege('anon', 'public.product_affinity(text)', 'execute') and has_function_privilege('authenticated', 'public.product_affinity(text)', 'execute'));
set role anon;
select t.ok('en tant que visiteur (anon) : la fonction répond, sans lire directement les tables', (select (public.product_affinity('A') ->> 'customers')::int = 11));
do $$ begin
  begin perform count(*) from public.orders; raise exception 'ECHEC : anon lit les commandes'; exception when insufficient_privilege then raise notice 'OK    anon ne peut pas lire la table des commandes directement'; end;
end $$;
reset role;
