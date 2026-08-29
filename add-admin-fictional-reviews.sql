-- Permet a l'admin d'ajouter des avis clients fictifs (nom, etoiles,
-- commentaire) sur un produit, et de les supprimer. Garde la moyenne des
-- etoiles et le nombre d'avis du produit toujours synchronises avec les
-- avis reellement presents (vrais + fictifs).

drop policy if exists "reviews_admin_all" on reviews;
create policy "reviews_admin_all" on reviews for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.sync_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.product_id, old.product_id);
  update products set
    review_count = (select count(*) from reviews where product_id = pid),
    rating = coalesce((select round(avg(rating)::numeric, 1) from reviews where product_id = pid), 0)
  where id = pid;
  return null;
end;
$$;

drop trigger if exists on_review_change on reviews;
create trigger on_review_change
  after insert or update or delete on reviews
  for each row execute procedure public.sync_product_rating();
