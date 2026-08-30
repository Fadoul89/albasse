-- Permet de commander sans creer de compte (checkout invite). Le nom,
-- telephone et adresse restent obligatoires dans le formulaire de commande,
-- seul le compte devient optionnel. Reduit la friction au paiement.
alter table orders alter column user_id drop not null;

create policy "orders_guest_insert" on orders for insert with check (
  user_id is null and not public.is_banned()
);
