-- Contrôles de add-zara-promotions.sql sur un Postgres local jetable (voir tests/sql/run-zara-promotions.sh).
create schema t;
grant usage on schema t to public;

create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.ok(label text, cond boolean, detail anyelement) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC % : %', label, detail; end if;
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

-- personnes
insert into public.profiles(id, is_admin) values ('aaaaaaaa-0000-4000-8000-000000000001', true), ('bbbbbbbb-0000-4000-8000-000000000002', false);
create function t.as_admin() returns void language sql as $$ select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false) $$;
create function t.as_client() returns void language sql as $$ select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', false) $$;
create function t.as_visitor() returns void language sql as $$ select set_config('request.jwt.claim.sub', '', false) $$;

-- le catalogue d'avant le script (déjà chargé avant add-zara-promotions.sql : voir run-zara-promotions.sh)
-- P1 remise vraie 20 %, P2 remise 3 % (trop petite), P3 remise 75 % (erreur de saisie), P4 sans ancien prix, P5 vente flash EN COURS avec ancien prix,
-- P6 vente flash TERMINÉE avec ancien prix, P7 en rupture, P8 remise vraie 30 %, P9 désactivé, P10 vente flash sans date de fin
select t.ok('le script a été joué une fois avant les contrôles (colonnes présentes)',
  (select count(*) from information_schema.columns where table_name = 'products' and column_name in ('promo_ends_at', 'old_price_saved')) = 2);

-- 1. le nettoyage du premier lancement
select t.ok('P1 : ancien prix mis de côté (20 000 → old_price_saved) et plus affiché', (select compare_at_price is null and old_price_saved = 12500 from public.products where slug = 'p1'));
select t.ok('le PRIX DE VENTE n''a jamais changé', (select price = 10000 from public.products where slug = 'p1') and (select price = 8000 from public.products where slug = 'p5'));
select t.ok('P4 (sans ancien prix) : rien à mettre de côté', (select compare_at_price is null and old_price_saved is null from public.products where slug = 'p4'));
select t.ok('P5 : vente flash en cours : l''ancien prix reste affiché', (select is_flash_sale and compare_at_price = 12000 from public.products where slug = 'p5'));
select t.ok('P6 : vente flash terminée : plus de flash, ancien prix mis de côté', (select not is_flash_sale and flash_sale_ends_at is null and compare_at_price is null and old_price_saved = 9000 from public.products where slug = 'p6'));
select t.ok('P10 : « flash » sans date de fin = pas une vraie vente flash : retiré', (select not is_flash_sale and compare_at_price is null and old_price_saved = 7000 from public.products where slug = 'p10'));
select t.ok('le nettoyage est planifié toutes les 5 minutes', (select count(*) = 1 and min(schedule) = '*/5 * * * *' from cron.job where jobname = 'zara-promotions-cleanup'));

-- 2. une vraie remise
select t.ok('remise vraie : 20 % → 20', public.zara_real_discount(10000, 12500) = 20);
select t.ok('remise de 3 % : pas vraie', public.zara_real_discount(970, 1000) is null);
select t.ok('remise de 5 % exactement : vraie', public.zara_real_discount(950, 1000) = 5);
select t.ok('remise de 60 % exactement : vraie', public.zara_real_discount(400, 1000) = 60);
select t.ok('remise de 75 % : erreur de saisie, pas vraie', public.zara_real_discount(250, 1000) is null);
select t.ok('prix plus grand que l''ancien prix, ou valeurs vides : pas vrai', public.zara_real_discount(1000, 900) is null and public.zara_real_discount(null, 900) is null and public.zara_real_discount(900, null) is null and public.zara_real_discount(0, 900) is null);

-- 3. les droits
select t.as_visitor();
set role anon;
select t.fails('un visiteur ne peut pas lire les statistiques', 'select public.zara_promotion_stats(7)', 'permission denied');
select t.fails('un visiteur ne peut pas publier', 'select public.zara_apply_promotions(array[]::uuid[], array[]::uuid[])', 'permission denied');
select t.fails('un visiteur ne peut pas tout arrêter', 'select public.zara_stop_promotions()', 'permission denied');
select t.fails('un visiteur ne peut pas lancer le nettoyage', 'select public.zara_promotions_cleanup()', 'permission denied');
reset role;
select t.as_client();
set role authenticated;
select t.fails('un client (pas administrateur) ne peut pas lire les statistiques', 'select public.zara_promotion_stats(7)', 'réservé aux administrateurs');
select t.fails('un client ne peut pas publier', 'select public.zara_apply_promotions(array[]::uuid[], array[]::uuid[])', 'réservé aux administrateurs');
select t.fails('un client ne peut pas tout arrêter', 'select public.zara_stop_promotions()', 'réservé aux administrateurs');
select t.fails('un client ne peut pas lancer le nettoyage', 'select public.zara_promotions_cleanup()', 'permission denied');
reset role;

-- 4. les statistiques (administrateur)
-- vues et paniers récents, anciens, ventes
insert into public.product_views(product_id, viewed_at)
select id, now() - interval '1 day' from public.products p, generate_series(1, 12) where p.slug = 'p1';
insert into public.product_views(product_id, viewed_at)
select id, now() - interval '20 days' from public.products p, generate_series(1, 5) where p.slug = 'p1';
insert into public.cart_events(product_id, created_at)
select id, now() - interval '2 days' from public.products p, generate_series(1, 3) where p.slug = 'p1';
insert into public.orders(items, status) select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 2)) , 'delivered' from public.products where slug = 'p1';
insert into public.orders(items, status) select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 5)), 'cancelled' from public.products where slug = 'p1';
insert into public.orders(items, status, is_flagged_fake) select jsonb_build_array(jsonb_build_object('product_id', id, 'quantity', 7)), 'pending', true from public.products where slug = 'p1';
select t.as_admin();
set role authenticated;
create temp table st as select jsonb_array_elements(public.zara_promotion_stats(7)) as j;
grant select on st to public;
select t.ok('statistiques : 8 articles (actifs et en stock : P7 en rupture et P9 désactivé absents)', (select count(*) = 8 from st), (select count(*) from st));
select t.ok('statistiques P1 : 12 vues sur 7 jours (les 5 vues d''il y a 20 jours ne comptent pas), 3 paniers', (select (j->>'views')::int = 12 and (j->>'carts')::int = 3 from st where j->>'slug' = 'p1'));
select t.ok('statistiques P1 : 2 vendus (commande annulée et « fausse » écartées)', (select (j->>'sold')::int = 2 from st where j->>'slug' = 'p1'), (select j->>'sold' from st where j->>'slug' = 'p1'));
select t.ok('statistiques : l''ancien prix mis de côté est rendu (P1 : 12 500)', (select (j->>'old_price')::numeric = 12500 from st where j->>'slug' = 'p1'));
select t.ok('statistiques : P5 en vente flash en cours = flash_active', (select (j->>'flash_active')::boolean from st where j->>'slug' = 'p5'));
select t.ok('statistiques : un article sans activité a 0 vue, 0 panier, 0 vente', (select (j->>'views')::int = 0 and (j->>'carts')::int = 0 and (j->>'sold')::int = 0 from st where j->>'slug' = 'p8'));
reset role;

-- 5. publier le choix (administrateur)
select t.as_admin();
set role authenticated;
create temp table res as select public.zara_apply_promotions(
  (select array_agg(id) from public.products where slug in ('p1', 'p2', 'p3', 'p7', 'p9')),
  (select array_agg(id) from public.products where slug in ('p8', 'p4', 'p5')),
  24, 7) as j;
grant select on res to public;
reset role;
select t.ok('publier : 1 article en vente flash (P1), 1 en promotion (P8)', (select (j->>'flash')::int = 1 and (j->>'promo')::int = 1 from res), (select j from res));
select t.ok('publier : P2 (remise 3 %), P3 (remise 75 %), P7 (rupture), P9 (désactivé), P4 (pas d''ancien prix) refusés, P5 (déjà en flash) refusé',
  (select jsonb_array_length(j->'skipped') = 6 from res), (select j->'skipped' from res));
select t.ok('P1 en vente flash 24 h : ancien prix affiché, fin dans ~24 h, plus de date de promotion',
  (select is_flash_sale and compare_at_price = 12500 and promo_ends_at is null and flash_sale_ends_at between now() + interval '23 hours 59 minutes' and now() + interval '24 hours 1 minute' from public.products where slug = 'p1'));
select t.ok('P8 en promotion 7 jours : ancien prix affiché, pas de vente flash',
  (select not is_flash_sale and compare_at_price = 10000 and promo_ends_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' from public.products where slug = 'p8'));
select t.ok('les articles refusés n''ont aucun ancien prix affiché', (select count(*) = 0 from public.products where slug in ('p2', 'p3', 'p4', 'p7', 'p9') and compare_at_price is not null));
select t.ok('AUCUN prix de vente n''a changé', (select string_agg(slug || '=' || price::text, ',' order by slug) from public.products) = 'p1=10000,p10=5000,p2=970,p3=250,p4=5000,p5=8000,p6=6000,p7=4000,p8=7000,p9=3000', (select string_agg(slug || '=' || price::text, ',' order by slug) from public.products));

-- 6. fin automatique : la vente flash et la promotion finies disparaissent, l'ancien prix repart de côté
update public.products set flash_sale_ends_at = now() - interval '1 minute' where slug = 'p1';
update public.products set promo_ends_at = now() - interval '1 minute' where slug = 'p8';
select public.zara_promotions_cleanup();
select t.ok('après 24 h : P1 n''est plus en vente flash, ancien prix de côté (12 500)', (select not is_flash_sale and compare_at_price is null and old_price_saved = 12500 from public.products where slug = 'p1'));
select t.ok('après 7 jours : P8 n''est plus en promotion, ancien prix de côté (10 000)', (select promo_ends_at is null and compare_at_price is null and old_price_saved = 10000 from public.products where slug = 'p8'));

-- 7. nouvelle publication : les promotions pas reconduites se terminent ; une promotion reconduite continue
select t.as_admin();
set role authenticated;
select public.zara_apply_promotions('{}', (select array_agg(id) from public.products where slug in ('p1', 'p8')), 24, 7);
select public.zara_apply_promotions('{}', (select array_agg(id) from public.products where slug in ('p1')), 24, 7);
reset role;
select t.ok('nouvelle liste : P1 reste en promotion, P8 (pas reconduit) est terminé et son ancien prix repart de côté', (select compare_at_price = 12500 and promo_ends_at is not null from public.products where slug = 'p1') and (select compare_at_price is null and promo_ends_at is null from public.products where slug = 'p8'));

-- 8. tout arrêter
select t.as_admin();
set role authenticated;
create temp table stopped as select public.zara_stop_promotions() as j;
grant select on stopped to public;
reset role;
select t.ok('arrêter : plus aucune vente flash ni promotion, aucun ancien prix affiché nulle part', (select count(*) = 0 from public.products where is_flash_sale or promo_ends_at is not null or compare_at_price is not null), (select j from stopped));
select t.ok('arrêter : tous les anciens prix sont toujours enregistrés (rien d''effacé)', (select old_price_saved = 12500 from public.products where slug = 'p1') and (select old_price_saved = 12000 from public.products where slug = 'p5'));

-- 9. l'ancien prix saisi à la main (sans promotion) est mis de côté au prochain nettoyage, sans perte
update public.products set compare_at_price = 6000 where slug = 'p4';
select public.zara_promotions_cleanup();
select t.ok('ancien prix saisi à la main hors promotion : mis de côté (pas perdu), plus affiché', (select compare_at_price is null and old_price_saved = 6000 from public.products where slug = 'p4'));

-- 10. relancer le nettoyage ne change plus rien
create temp table again as select public.zara_promotions_cleanup() as j;
select t.ok('nettoyage relancé : rien à faire', (select (j->>'flash_ended')::int = 0 and (j->>'promo_ended')::int = 0 and (j->>'old_price_saved')::int = 0 from again), (select j from again));
