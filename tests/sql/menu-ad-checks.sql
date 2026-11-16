-- Contrôles de add-menu-ad.sql sur un Postgres local jetable (voir tests/sql/run-menu-ad.sh).
create schema t;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.rejected(q text) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception when check_violation or not_null_violation then
  return true;
end $$;

select t.ok('la ligne des réglages existante reçoit une liste vide (rien ne change pour les clients)', (select menu_ad_items = '[]'::jsonb from public.store_settings where id = 1));
select t.ok('les autres publicités ne bougent pas', (select jsonb_array_length(left_ad_items) = 1 from public.store_settings where id = 1));
select t.ok('une liste d''images est acceptée', not t.rejected($q$update public.store_settings set menu_ad_items = '[{"image_url":"https://x/b.jpg","link":"https://www.albasseshopping.com/produit/ray-ban"},{"image_url":"https://x/c.jpg","link":null}]' where id = 1$q$));
select t.ok('12 images : accepté', not t.rejected($q$update public.store_settings set menu_ad_items = (select jsonb_agg(jsonb_build_object('image_url', 'https://x/' || g || '.jpg', 'link', null)) from generate_series(1, 12) g) where id = 1$q$));
select t.ok('13 images : refusé', t.rejected($q$update public.store_settings set menu_ad_items = (select jsonb_agg(jsonb_build_object('image_url', 'https://x/' || g || '.jpg', 'link', null)) from generate_series(1, 13) g) where id = 1$q$));
select t.ok('autre chose qu''une liste : refusé', t.rejected($q$update public.store_settings set menu_ad_items = '{"image_url":"https://x/b.jpg"}' where id = 1$q$) and t.rejected($q$update public.store_settings set menu_ad_items = '"texte"' where id = 1$q$));
select t.ok('vide (null) : refusé', t.rejected($q$update public.store_settings set menu_ad_items = null where id = 1$q$));
select t.ok('une seule colonne ajoutée, aucune nouvelle table', (select count(*) = 5 from information_schema.columns where table_schema = 'public' and table_name = 'store_settings') and (select count(*) = 1 from information_schema.tables where table_schema = 'public'));
