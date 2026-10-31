-- Le petit script add-push-new-products-switch.sql SEUL (sans le gardien) : le comportement d'avant, mais éteint par défaut.
select t.ok('colonne ajoutée, ÉTEINTE par défaut', (select push_new_products_enabled = false from public.store_settings where id = 1));
insert into public.products(id, name, price, stock, notify_on_publish) values (t.pid(1), 'Montre A', 15000, 5, true);
select t.ok('éteint : publier un article n''envoie rien (ni cloche, ni téléphones)', t.notifs() = 0 and t.pushes() = 0);
update public.store_settings set push_new_products_enabled = true where id = 1;
insert into public.products(id, name, price, stock, notify_on_publish) values (t.pid(2), 'Montre B', 16000, 5, true);
select t.ok('rallumé, sans gardien : la notification part tout de suite, comme avant', t.notifs() = 1 and t.pushes() = 1);
select t.ok('… avec le bon texte', (select title = '🛍️ Nouveau produit disponible' and message like 'Montre B — %FCFA' and product_id = t.pid(2) from public.product_notifications));
insert into public.products(id, name, price, stock, notify_on_publish) values (t.pid(3), 'Montre C', 17000, 5, false);
select t.ok('rallumé, mais « notify_on_publish » faux pour l''article : rien', t.notifs() = 1);
update public.store_settings set push_new_products_enabled = false where id = 1;
insert into public.products(id, name, price, stock, notify_on_publish) values (t.pid(4), 'Montre D', 18000, 5, true);
select t.ok('éteint de nouveau : rien', t.notifs() = 1);
-- on laisse l'interrupteur éteint (état de départ du test suivant)
