-- Décor de test pour add-menu-ad.sql sur un Postgres local JETABLE (jamais la vraie base) : la table des réglages avec ses publicités de l'accueil.
create table public.store_settings (id int primary key, shop_name text, left_ad_items jsonb not null default '[]'::jsonb, right_ad_items jsonb not null default '[]'::jsonb);
insert into public.store_settings (id, shop_name, left_ad_items) values (1, 'Albasse Shopping', '[{"image_url":"https://x/a.jpg","link":null}]');
