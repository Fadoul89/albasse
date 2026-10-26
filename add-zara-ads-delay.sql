-- Publicités de Zara : l'admin choisit après combien de secondes la publicité s'affiche (page Promotions intelligentes).
-- 5 secondes par défaut (0 = tout de suite, 120 au plus). Ajoute seulement une colonne à une table qui existe déjà (store_settings) :
-- aucun « grant » à ajouter, les règles actuelles s'appliquent. Sans danger à relancer.
-- Tant que ce script n'est pas lancé, la publicité s'affiche après 5 secondes et le choix du délai répond « Lancez d'abord le script ».
alter table public.store_settings add column if not exists zara_ads_delay_seconds integer not null default 5;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'store_settings_zara_ads_delay_check') then
    alter table public.store_settings add constraint store_settings_zara_ads_delay_check check (zara_ads_delay_seconds between 0 and 120);
  end if;
end $$;
