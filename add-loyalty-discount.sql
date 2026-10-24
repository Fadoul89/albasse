-- Remise fidélité −10 % (articles) à la 7ᵉ commande, une seule fois par client : la commande note le montant de la remise pour l'équipe.
-- Table existante : pas de nouveau « grant » à ajouter. À lancer une fois dans Supabase › SQL Editor.
alter table public.orders add column if not exists loyalty_discount integer not null default 0;
