-- Corrige un bug : la fonction insérait dans product_notifications avec 3 colonnes
-- déclarées mais seulement 2 valeurs fournies (product_id manquant), ce qui bloquait
-- toute création de nouveau produit avec l'erreur "INSERT has more target columns
-- than expressions".
create or replace function public.notify_new_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.notify_on_publish then
    insert into product_notifications (product_id, title, message)
    values (new.id, '🛍️ Nouveau produit disponible', new.name || ' — ' || new.price || ' FCFA');
  end if;
  return new;
end;
$$;
