-- Publicités de Zara à l'écran : l'admin peut laisser Zara choisir l'article et écrire le message (page Promotions intelligentes).
-- Éteint par défaut : rien ne change sur le site tant que l'interrupteur n'est pas activé dans l'admin.
-- Zara ne dit que des faits VRAIS : vraies commandes (au moins 3 ces 7 derniers jours) et vrai petit stock (5 au plus).
-- Ajoute seulement une colonne à une table qui existe déjà (store_settings) : aucun « grant » à ajouter, les règles actuelles s'appliquent.
-- Sans danger à relancer.
alter table public.store_settings add column if not exists zara_ads_enabled boolean not null default false;
