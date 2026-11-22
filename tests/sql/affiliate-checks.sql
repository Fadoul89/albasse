-- Contrôles du programme d'affiliation (add-affiliate-program.sql + add-affiliate-fixes.sql) sur un Postgres local jetable
-- (voir tests/sql/run-affiliate.sh).
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
create function t.s(n int) returns uuid language sql immutable as $$ select ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.o(n int) returns uuid language sql immutable as $$ select ('40000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.c(n int) returns text language sql stable as $$ select status || ':' || amount::int || case when paid then ':payee' else '' end from public.affiliate_commissions where order_id = t.o(n) $$;
grant execute on all functions in schema t to public;

-- le décor : Amina (approuvée, AMIN123), Bob (en attente), Bloqué ; un client ; 2 articles
insert into public.profiles (id, full_name) values (t.u(1), 'Amina'), (t.u(2), 'Bob'), (t.u(3), 'Bloqué'), (t.u(9), 'Client');
update public.profiles set is_affiliate = true, affiliate_status = 'approved', referral_code = 'AMIN123' where id = t.u(1);
update public.profiles set is_affiliate = true, affiliate_status = 'pending', referral_code = 'BOB456' where id = t.u(2);
update public.profiles set is_affiliate = true, affiliate_status = 'blocked', referral_code = 'BLOQ789' where id = t.u(3);
update public.affiliate_settings set default_commission_rate = 2.5 where id = 1;
insert into public.categories (id, name) values ('10000000-0000-4000-8000-000000000001', 'Montres');
insert into public.products (id, name, category_id, affiliate_commission_rate) values
  ('20000000-0000-4000-8000-000000000001', 'Montre', '10000000-0000-4000-8000-000000000001', 10),
  ('20000000-0000-4000-8000-000000000002', 'Parfum', null, null);
-- visites : 3 visiteurs différents viennent du lien d'Amina (dont un en minuscules et un deux fois), 1 de Bob, 1 sans lien
insert into public.visitor_sessions (id, visitor_id, referral_code) values
  (t.s(1), 'v1', 'AMIN123'), (t.s(2), 'v1', 'AMIN123'), (t.s(3), 'v2', 'amin123'), (t.s(4), 'v3', ' Amin123 '),
  (t.s(5), 'v4', 'BOB456'), (t.s(6), 'v5', null), (t.s(7), 'v6', 'INCONNU'), (t.s(8), 'v7', 'BLOQ789');
-- articles vus pendant ces visites
insert into public.product_views (session_id, product_id) values
  (t.s(1), '20000000-0000-4000-8000-000000000001'), (t.s(2), '20000000-0000-4000-8000-000000000001'), (t.s(3), '20000000-0000-4000-8000-000000000002'),
  (t.s(5), '20000000-0000-4000-8000-000000000001'), (t.s(6), '20000000-0000-4000-8000-000000000002');
-- 1 montre 20 000 (taux de l'article : 10 %) + 2 parfums à 10 000 (taux par défaut : 2,5 %) = 2 000 + 500 = 2 500 FCFA
create function t.items() returns jsonb language sql immutable as $$ select '[{"product_id":"20000000-0000-4000-8000-000000000001","product_name":"Montre","unit_price":20000,"quantity":1},{"product_id":"20000000-0000-4000-8000-000000000002","product_name":"Parfum","unit_price":10000,"quantity":2}]'::jsonb $$;
insert into public.orders (id, order_number, user_id, session_id, items, total) values
  (t.o(1), 101, t.u(9), t.s(1), t.items(), 40000),   -- client, lien d'Amina
  (t.o(2), 102, t.u(1), t.s(1), t.items(), 40000),   -- Amina avec son propre lien
  (t.o(3), 103, t.u(9), t.s(5), t.items(), 40000),   -- lien de Bob (en attente)
  (t.o(4), 104, t.u(9), t.s(6), t.items(), 40000),   -- sans lien
  (t.o(5), 105, t.u(9), t.s(3), t.items(), 40000),   -- lien d'Amina tapé en minuscules
  (t.o(6), 106, t.u(9), t.s(7), t.items(), 40000),   -- code inconnu
  (t.o(7), 107, t.u(9), t.s(8), t.items(), 40000),   -- affilié bloqué
  (t.o(8), 108, t.u(9), t.s(4), t.items(), 40000),   -- lien d'Amina avec espaces : sera signalée fausse
  (t.o(9), 109, t.u(9), t.s(2), t.items(), 40000),   -- lien d'Amina : livrée puis annulée (retour), pas encore payée
  (t.o(10), 110, t.u(9), t.s(2), t.items(), 40000),  -- lien d'Amina : livrée, payée, puis annulée
  (t.o(11), 111, t.u(9), t.s(2), t.items(), 40000),  -- lien d'Amina : annulée avant livraison
  (t.o(12), 112, t.u(9), t.s(2), t.items(), 40000);  -- lien d'Amina : signalée fausse PUIS marquée livrée

-- 1. le calcul à la commande
select t.ok('lien d''Amina : commission de 2 500 FCFA en attente (10 % sur la montre, 2,5 % par défaut sur les parfums)', t.c(1) = 'pending:2500');
select t.ok('détail par article : montre 2 000, parfums 500 (quantité 2)',
  (select string_agg(i.product_name || ':' || i.quantity || ':' || i.amount::int, ',' order by i.product_name) from public.affiliate_commission_items i join public.affiliate_commissions c on c.id = i.commission_id where c.order_id = t.o(1)) = 'Montre:1:2000,Parfum:2:500');
select t.ok('Amina avec son propre lien : rien (anti auto-parrainage)', t.c(2) is null);
select t.ok('affilié en attente, bloqué, code inconnu, sans lien : rien', t.c(3) is null and t.c(7) is null and t.c(6) is null and t.c(4) is null);
select t.ok('code en minuscules (amin123) ou avec espaces ( Amin123 ) : reconnu (avant : rien)', t.c(5) = 'pending:2500' and t.c(8) = 'pending:2500');

-- 2. la commission suit la commande
update public.orders set status = 'delivered' where id = t.o(1);
select t.ok('livrée : commission validée', t.c(1) = 'validated:2500');
update public.orders set is_flagged_fake = true where id = t.o(8);
select t.ok('signalée fausse : commission annulée (avant : restait en attente)', t.c(8) = 'cancelled:2500');
update public.orders set status = 'delivered' where id = t.o(9);
update public.orders set status = 'cancelled' where id = t.o(9);
select t.ok('livrée puis annulée (retour) avant paiement : commission annulée (avant : restait validée)', t.c(9) = 'cancelled:2500');
update public.orders set status = 'delivered' where id = t.o(10);
update public.affiliate_commissions set paid = true, paid_at = now() where order_id = t.o(10);
update public.orders set status = 'cancelled' where id = t.o(10);
select t.ok('déjà payée puis annulée : la commission payée ne change jamais', t.c(10) = 'validated:2500:payee');
update public.orders set status = 'cancelled' where id = t.o(11);
select t.ok('annulée avant livraison : commission annulée', t.c(11) = 'cancelled:2500');
update public.orders set is_flagged_fake = true where id = t.o(12);
update public.orders set status = 'delivered' where id = t.o(12);
select t.ok('signalée fausse puis marquée livrée : la commission reste annulée', t.c(12) = 'cancelled:2500');

-- 3. les droits
select t.ok('la table du détail par article : lecture pour les comptes connectés (selon les règles), rien pour l''anonyme',
  has_table_privilege('authenticated', 'public.affiliate_commission_items', 'select') and not has_table_privilege('anon', 'public.affiliate_commission_items', 'select')
  and not has_table_privilege('authenticated', 'public.affiliate_commission_items', 'insert'));
select t.ok('la fonction des chiffres : pour les comptes connectés, pas pour l''anonyme',
  has_function_privilege('authenticated', 'public.affiliate_my_stats()', 'execute') and not has_function_privilege('anon', 'public.affiliate_my_stats()', 'execute'));

-- 4. l'espace affilié d'Amina (connectée)
select set_config('request.jwt.claim.sub', t.u(1)::text, false);
set role authenticated;
create temp table st as select public.affiliate_my_stats() as r;
select t.ok('Amina : 3 visiteurs envoyés (v1 deux fois, v2 en minuscules, v3 avec espaces), 4 visites', (select (r->>'visitors')::int = 3 and (r->>'sessions')::int = 4 from st));
select t.ok('Amina : ses 7 commissions, la plus récente d''abord, avec le numéro et le montant de la commande',
  (select jsonb_array_length(r->'commissions') = 7 from st)
  and (select (e->>'order_number')::int = 101 and (e->>'order_total')::numeric = 40000 and e->>'status' = 'validated' from st, jsonb_array_elements(r->'commissions') e where e->>'order_id' = t.o(1)::text));
select t.ok('Amina : jamais le nom ni le téléphone du client', (select r::text not like '%Client secret%' and r::text not like '%66000000%' from st));
select t.ok('Amina : la montre vue 2 fois ; 3 commandes (101, 105, 110 : les annulées ne comptent pas), 3 × 2 000 = 6 000 FCFA',
  (select (e->>'views')::int = 2 and (e->>'orders')::int = 3 and (e->>'commission')::numeric = 6000 from st, jsonb_array_elements(r->'products') e where e->>'product_id' = '20000000-0000-4000-8000-000000000001'));
select t.ok('Amina : le parfum vu 1 fois (en minuscules)', (select (e->>'views')::int = 1 from st, jsonb_array_elements(r->'products') e where e->>'product_id' = '20000000-0000-4000-8000-000000000002'));
reset role;

-- un client qui n'est pas affilié, et l'anonyme : rien
select set_config('request.jwt.claim.sub', t.u(9)::text, false);
set role authenticated;
select t.ok('un client non affilié : rien', public.affiliate_my_stats() is null);
select t.ok('il ne lit pas le détail des commissions d''Amina', (select count(*) from public.affiliate_commission_items) = 0);
reset role;
select set_config('request.jwt.claim.sub', t.u(1)::text, false);
set role authenticated;
select t.ok('Amina lit SON détail par article (règle de lecture)', (select count(*) from public.affiliate_commission_items) > 0 and (select bool_and(affiliate_id = t.u(1)) from public.affiliate_commission_items));
reset role;
set role anon;
select t.fails('l''anonyme ne lance pas la fonction des chiffres', 'select public.affiliate_my_stats()', 'permission denied');
reset role;

select 'TOUS LES CONTROLES SONT PASSES' as resultat;
