-- Contrôles de add-subcategories.sql sur un Postgres local jetable (voir tests/sql/run-subcategories.sh).
create schema t;
grant usage on schema t to public;

create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.fails(label text, stmt text, expect text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like '%' || expect || '%' then raise notice 'OK    % (refusé : %)', label, sqlerrm; return; end if;
    raise exception 'ECHEC % : refusé mais autre message : %', label, sqlerrm;
  end;
  raise exception 'ECHEC % : aurait dû être refusé', label;
end $$;
create function t.u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- les catégories d'aujourd'hui : 1 Vêtements, 2 Chaussures, 3 Montres (aucune n'a de parent au départ)
-- (avant le script : les catégories sont déjà là ; le script est joué APRÈS ces lignes par run-subcategories.sh, voir le fichier précédent)
select t.ok('colonne « parent_id » créée, vide pour toutes les catégories d''aujourd''hui', (select count(*) from public.categories where parent_id is null) = 3);
select t.ok('aucune catégorie ni aucun article modifié par le script', (select count(*) from public.categories) = 3 and (select count(*) from public.products) = 3);

-- créer des sous-catégories (administrateur)
set role authenticated;
set test.is_admin = 'on';
insert into public.categories (id, slug, name, parent_id) values (t.u(11), 'chemises', 'Chemises', t.u(1)), (t.u(12), 'costumes', 'Costumes', t.u(1));
select t.ok('l''administrateur crée deux sous-catégories de « Vêtements »', (select count(*) from public.categories where parent_id = t.u(1)) = 2);

-- le client ne peut rien écrire, mais lit tout
set test.is_admin = 'off';
select t.fails('un client ne peut pas créer une sous-catégorie', $q$insert into public.categories (slug, name, parent_id) values ('x', 'X', t.u(1))$q$, 'row-level security');
select t.ok('un client (même anonyme) lit les sous-catégories avec leur parent', (select count(*) from public.categories where parent_id = t.u(1)) = 2);
set test.is_admin = 'on';

-- règles : un seul niveau, jamais sa propre sous-catégorie
select t.fails('une sous-catégorie ne peut pas avoir de sous-catégorie', $q$insert into public.categories (slug, name, parent_id) values ('petites', 'Petites', t.u(11))$q$, 'un seul niveau');
select t.fails('une catégorie n''est pas sa propre sous-catégorie', $q$update public.categories set parent_id = t.u(2) where id = t.u(2)$q$, 'propre catégorie principale');
select t.fails('une catégorie qui a des sous-catégories ne devient pas une sous-catégorie', $q$update public.categories set parent_id = t.u(2) where id = t.u(1)$q$, 'a déjà des sous-catégories');
select t.fails('on ne met pas une catégorie sous une sous-catégorie', $q$update public.categories set parent_id = t.u(11) where id = t.u(3)$q$, 'un seul niveau');
select t.ok('rien n''a changé après ces refus', (select count(*) from public.categories where parent_id is not null) = 2);

-- changer de parent, devenir principale
update public.categories set parent_id = t.u(2) where id = t.u(12);
select t.ok('« Costumes » passe sous « Chaussures »', (select parent_id from public.categories where id = t.u(12)) = t.u(2));
update public.categories set parent_id = null where id = t.u(12);
select t.ok('« Costumes » redevient une catégorie principale', (select parent_id from public.categories where id = t.u(12)) is null);
update public.categories set name = 'Chemises homme' where id = t.u(11);
select t.ok('renommer une sous-catégorie est permis', (select name from public.categories where id = t.u(11)) = 'Chemises homme');

-- les articles se rangent dans une sous-catégorie
update public.products set category_id = t.u(11) where id = t.u(21);
select t.ok('un article peut être rangé dans une sous-catégorie', (select category_id from public.products where id = t.u(21)) = t.u(11));

-- supprimer une catégorie principale : ses sous-catégories deviennent principales, leurs articles restent classés
delete from public.categories where id = t.u(1);
select t.ok('« Vêtements » supprimée : « Chemises homme » existe toujours, devenue principale', (select parent_id from public.categories where id = t.u(11)) is null and (select count(*) from public.categories where id = t.u(11)) = 1);
select t.ok('l''article de la sous-catégorie reste dans sa catégorie', (select category_id from public.products where id = t.u(21)) = t.u(11));
select t.ok('l''article rangé directement dans « Vêtements » reste sans catégorie (comme avant)', (select category_id from public.products where id = t.u(20)) is null);

-- supprimer une sous-catégorie : son parent et les autres sous-catégories ne bougent pas
insert into public.categories (id, slug, name, parent_id) values (t.u(13), 'ceintures', 'Ceintures', t.u(3)), (t.u(14), 'bracelets', 'Bracelets', t.u(3));
delete from public.categories where id = t.u(13);
select t.ok('supprimer une sous-catégorie ne touche ni son parent ni ses sœurs', (select count(*) from public.categories where id = t.u(3)) = 1 and (select parent_id from public.categories where id = t.u(14)) = t.u(3));

reset role;
