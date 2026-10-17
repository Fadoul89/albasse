-- Service « emballage cadeau » (2 000 FCFA par commande) : le client le choisit a la commande,
-- ou l'ajoute ensuite dans Mes commandes tant que la commande est en attente.
-- Le total de la commande inclut deja les 2 000 FCFA ; cette colonne dit a l'equipe d'emballer le colis.
alter table orders add column if not exists gift_wrap boolean not null default false;
