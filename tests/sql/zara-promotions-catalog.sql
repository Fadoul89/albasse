-- le catalogue du test : voir les commentaires de zara-promotions-checks.sql (P1 à P10)
insert into public.products(name, slug, price, compare_at_price, stock, is_active, is_flash_sale, flash_sale_ends_at) values
 ('Article 1', 'p1', 10000, 12500, 10, true,  false, null),
 ('Article 2', 'p2',   970,  1000, 10, true,  false, null),
 ('Article 3', 'p3',   250,  1000, 10, true,  false, null),
 ('Article 4', 'p4',  5000,  null, 10, true,  false, null),
 ('Article 5', 'p5',  8000, 12000, 10, true,  true,  now() + interval '5 hours'),
 ('Article 6', 'p6',  6000,  9000, 10, true,  true,  now() - interval '3 hours'),
 ('Article 7', 'p7',  4000,  6000,  0, true,  false, null),
 ('Article 8', 'p8',  7000, 10000, 10, true,  false, null),
 ('Article 9', 'p9',  3000,  4500, 10, false, false, null),
 ('Article 10','p10', 5000,  7000, 10, true,  true,  null);
