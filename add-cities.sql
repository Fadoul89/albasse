-- Liste des villes du Tchad, choisie par le client a l'inscription et a la commande,
-- avec frais de livraison et agence d'expedition par ville.
create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_active boolean not null default true,
  delivery_fee int, -- null = pas encore defini par l'admin ("A definir"), 0 = gratuit
  delivery_agency text, -- null = pas encore defini par l'admin ("A definir")
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cities_sort_idx on cities(sort_order);

alter table cities enable row level security;
create policy "cities_public_read" on cities for select using (true);
create policy "cities_admin_write" on cities for all using (
  public.is_admin()
) with check (public.is_admin());

insert into cities (name, sort_order) values
  ('N''Djamena', 1), ('Moundou', 2), ('Sarh', 3), ('Abéché', 4), ('Kélo', 5),
  ('Koumra', 6), ('Pala', 7), ('Bongor', 8), ('Doba', 9), ('Faya-Largeau', 10),
  ('Mongo', 11), ('Ati', 12), ('Am Timan', 13), ('Mao', 14), ('Moussoro', 15),
  ('Bol', 16), ('Massakory', 17), ('Biltine', 18), ('Fada', 19), ('Amdjarass', 20),
  ('Adré', 21), ('Iriba', 22), ('Goz Beïda', 23), ('Laï', 24), ('Fianga', 25),
  ('Léré', 26), ('Benoy', 27), ('Kyabé', 28), ('Moïssala', 29), ('Bousso', 30),
  ('Massaguet', 31), ('Massenya', 32), ('Ngouri', 33), ('Oum Hadjer', 34),
  ('Abou Deïa', 35), ('Am Dam', 36), ('Haraze', 37), ('Melfi', 38),
  ('Mbaïbokoum', 39), ('Beinamar', 40), ('Bébédjia', 41), ('Gounou-Gaya', 42),
  ('Guidiguir', 43)
on conflict (name) do nothing;

-- Frais de livraison et agences connus au lancement (les autres restent "A definir")
update cities set delivery_fee = 0, delivery_agency = 'Livraison' where name = 'N''Djamena';
update cities set delivery_fee = 2500, delivery_agency = 'STTL ou Sud Voyage' where name in ('Moundou', 'Sarh', 'Kélo', 'Koumra', 'Pala', 'Bongor', 'Doba');
update cities set delivery_fee = 2500, delivery_agency = 'Abou Aziza' where name in ('Abéché', 'Mongo');
update cities set delivery_fee = 2500 where name in ('Ati', 'Am Timan', 'Mao');
