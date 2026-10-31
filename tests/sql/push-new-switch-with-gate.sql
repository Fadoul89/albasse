-- Le petit script ET le gardien installés (dans n'importe quel ordre) : le nouvel article attend dans la file, au lieu de partir tout de suite.
-- (la base peut déjà contenir des notifications d'un test précédent : on compare avec l'état de départ)
create table t.depart as select t.notifs() as notifs, t.pushes() as pushes, (select count(*) from public.push_outbox) as file;
select t.ok('le script se relance sans erreur ; l''interrupteur reste éteint tant qu''on ne l''a pas rallumé', (select push_new_products_enabled = false from public.store_settings where id = 1));
insert into public.products(id, name, price, stock, notify_on_publish) values (t.pid(21), 'Montre U', 19000, 5, true);
select t.ok('éteint : publier n''envoie rien et ne met rien en attente',
  t.notifs() = (select notifs from t.depart) and t.pushes() = (select pushes from t.depart) and (select count(*) from public.push_outbox) = (select file from t.depart));
update public.store_settings set push_new_products_enabled = true where id = 1;
insert into public.products(id, name, price, stock, notify_on_publish) values (t.pid(22), 'Montre V', 20000, 5, true);
select t.ok('rallumé : le nouvel article attend dans la file du gardien, rien ne part tout de suite',
  (select count(*) from public.push_outbox where product_id = t.pid(22) and status = 'pending') = 1
  and t.notifs() = (select notifs from t.depart) and t.pushes() = (select pushes from t.depart));
select 'TOUS LES CONTROLES SONT PASSES' as resultat;
