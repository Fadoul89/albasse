-- Compteur de « j'aime » (cœur ❤️) par article : visible par tous les visiteurs à côté du cœur, et par l'administrateur.
-- Le nombre est tenu à jour automatiquement à chaque cœur ajouté ou retiré (table favorites). L'administrateur peut aussi lire
-- qui a aimé quoi (page Clients : un client qui aime des articles est montré « Intérêt élevé »).
-- Tables existantes seulement : pas de nouveau « grant » à ajouter. À lancer une fois dans Supabase › SQL Editor.

alter table public.products add column if not exists likes_count integer not null default 0;

-- les « j'aime » déjà donnés
update public.products p set likes_count = (select count(*) from public.favorites f where f.product_id = p.id);

create or replace function public.sync_product_likes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update products set likes_count = likes_count + 1 where id = new.product_id;
  elsif tg_op = 'DELETE' then
    update products set likes_count = greatest(likes_count - 1, 0) where id = old.product_id;
  end if;
  return null;
end $$;
revoke all on function public.sync_product_likes() from public, anon, authenticated;

drop trigger if exists favorites_sync_likes on public.favorites;
create trigger favorites_sync_likes after insert or delete on public.favorites
  for each row execute function public.sync_product_likes();

drop policy if exists favorites_admin_read on public.favorites;
create policy favorites_admin_read on public.favorites for select using (public.is_admin());
