-- le catalogue du test de add-zara-seo.sql : la table products du décor reçoit la colonne « description » (comme la vraie base) et 5 articles
alter table public.products add column description text;
alter table public.products add column colors text[];
alter table public.products add column sizes text[];
insert into public.products(name, slug, price, stock, description) values
 ('Article A', 'a', 10000, 10, null),
 ('Article B', 'b',  5000, 10, ''),
 ('Article C', 'c',  7000, 10, 'Ancienne description de la boutique'),
 ('Article D', 'd',  3000,  0, 'Courte'),
 ('Article E', 'e',  9000, 10, 'Une description correcte écrite par la boutique elle-même, assez longue pour Google.');
