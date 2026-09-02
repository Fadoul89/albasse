-- Les publicites laterales (gauche/droite) de l'accueil supportent
-- maintenant plusieurs photos par cote (defilement automatique), chacune
-- avec un lien optionnel. La migration add-side-ads.sql ne creait que les
-- anciennes colonnes a photo unique (left_ad_image_url / left_ad_link /
-- right_ad_image_url / right_ad_link) : le code utilise desormais
-- left_ad_items / right_ad_items (tableaux JSON), d'ou ces colonnes
-- manquantes qui empechaient toute sauvegarde/affichage des publicites.
alter table store_settings add column if not exists left_ad_items jsonb not null default '[]'::jsonb;
alter table store_settings add column if not exists right_ad_items jsonb not null default '[]'::jsonb;

-- Reprend l'ancienne photo unique (si presente) comme premiere image du
-- nouveau tableau, pour ne pas perdre une publicite deja configuree.
update store_settings
set left_ad_items = jsonb_build_array(jsonb_build_object('image_url', left_ad_image_url, 'link', left_ad_link))
where left_ad_image_url is not null and jsonb_array_length(left_ad_items) = 0;

update store_settings
set right_ad_items = jsonb_build_array(jsonb_build_object('image_url', right_ad_image_url, 'link', right_ad_link))
where right_ad_image_url is not null and jsonb_array_length(right_ad_items) = 0;
