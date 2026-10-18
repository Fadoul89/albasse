-- Réapprovisionnement automatique : quand un article tombe à 0 (ou moins), la base lui ajoute 12.
-- Et, une seule fois à l'application du script, tous les articles déjà en rupture reçoivent +12.
--
-- ATTENTION : ce stock est AUTOMATIQUE, pas compté. Si la marchandise n'existe pas vraiment, des clients peuvent commander
-- des articles que la boutique n'a pas. Pour garder un article « en rupture » (arrêté, plus fourni) :
--   update public.products set auto_restock = false, stock = 0 where id = 'ID_DE_L_ARTICLE';
-- Pour annuler tout :
--   drop trigger if exists auto_restock_on_zero on public.products;
--   drop function if exists public.auto_restock_on_zero();
--   alter table public.products drop column if exists auto_restock;

alter table public.products add column if not exists auto_restock boolean not null default true;

create or replace function public.auto_restock_on_zero() returns trigger
language plpgsql
as $$
begin
  new.stock := new.stock + 12;
  return new;
end;
$$;

drop trigger if exists auto_restock_on_zero on public.products;
create trigger auto_restock_on_zero
  before update of stock on public.products
  for each row
  when (new.auto_restock and new.stock <= 0 and coalesce(old.stock, 0) > 0)
  execute function public.auto_restock_on_zero();

-- une seule fois : les articles déjà en rupture reçoivent +12 (le déclencheur ne s'applique pas : ils étaient déjà à 0)
update public.products set stock = stock + 12 where auto_restock and coalesce(stock, 0) <= 0;

notify pgrst, 'reload schema';
