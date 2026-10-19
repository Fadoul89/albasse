-- Compte obligatoire à l'entrée du site : le visiteur sans compte voit « Créez votre compte » (nom, téléphone, mot de passe).
-- Activé dès que ce script est lancé ; l'admin peut le couper ou le remettre sur la page « Clients ». Sans danger à relancer.
alter table public.store_settings add column if not exists account_required boolean not null default true;
