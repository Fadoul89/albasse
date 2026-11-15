-- Nom du titulaire de chaque compte Mobile Money (Moov Money, Airtel Money), affiché sous le numéro, en bas de la page de commande
-- (cartes « Informations de paiement », docs/airtel-moov-retires.md). Le patron l'écrit lui-même dans Admin › Moyens de paiement, après avoir lancé ce script.
-- Table existante : les règles RLS en place (lecture pour tous, modification pour l'administrateur seulement) et les accès de la table s'appliquent aux nouvelles colonnes.
-- Aucune nouvelle table : aucun « grant » à ajouter. Le script se relance sans erreur.
alter table public.payment_settings add column if not exists airtel_holder_name text;
alter table public.payment_settings add column if not exists moov_holder_name text;
