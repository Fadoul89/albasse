-- Publicité mouvementée du menu ☰ (demande du patron, 16 novembre 2026 : « Possibilité de mettre publicité personnalisée ici », « Publicité mouvementée »).
-- Voir docs/menu-accueil.md. À lancer dans Supabase › SQL Editor. Relançable.
--
-- UNE colonne ajoutée à la table existante store_settings : la liste des images de la publicité du menu, comme left_ad_items / right_ad_items :
--   [{ "image_url": "https://…", "link": "https://www.albasseshopping.com/produit/…" | null }, …]   (12 images au plus)
-- Aucune nouvelle table : les droits de la table (lecture publique, écriture administrateur seulement, règles RLS) restent les mêmes.

alter table public.store_settings add column if not exists menu_ad_items jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'store_settings_menu_ad_items_list' and conrelid = 'public.store_settings'::regclass) then
    alter table public.store_settings
      add constraint store_settings_menu_ad_items_list check (jsonb_typeof(menu_ad_items) = 'array' and jsonb_array_length(menu_ad_items) <= 12);
  end if;
end $$;
