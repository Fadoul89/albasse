-- Deux bandeaux publicitaires (gauche/droite) affiches sur la page
-- d'accueil, uniquement sur les grands ecrans web (assez de place autour
-- du contenu). Geres depuis Espace Admin > Promotions intelligentes.
alter table store_settings add column if not exists left_ad_image_url text;
alter table store_settings add column if not exists left_ad_link text;
alter table store_settings add column if not exists right_ad_image_url text;
alter table store_settings add column if not exists right_ad_link text;
