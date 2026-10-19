-- Bouton « Commander sur WhatsApp » des fiches produit : l'admin peut le cacher ou le remettre (page Produits).
-- Activé par défaut. Les visiteurs lisent déjà store_settings ; seul l'admin peut le modifier. Sans danger à relancer.
alter table public.store_settings add column if not exists whatsapp_order_enabled boolean not null default true;
