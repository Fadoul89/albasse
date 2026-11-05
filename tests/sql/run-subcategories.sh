#!/bin/sh
# Joue add-subcategories.sql sur un Postgres local JETABLE (jamais la vraie base) et lance les contrôles.
# Prérequis : Postgres 16 installé, grappe « 16 main » démarrée (pg_ctlcluster 16 main start), lancé en root ou avec sudo.
# Lancer depuis la racine du projet : sh tests/sql/run-subcategories.sh
set -e
DB=albasse_subcat_test
run() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $1" < "$2"; }
su postgres -c "dropdb --if-exists $DB"
su postgres -c "createdb $DB"
run $DB tests/sql/subcategories-stubs.sql
# les catégories et les articles d'AUJOURD'HUI (avant le script) : 1 Vêtements, 2 Chaussures, 3 Montres ; articles 20 (dans Vêtements), 21 et 22 (sans catégorie)
su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $DB" <<'SQL'
insert into public.categories (id, slug, name, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'vetements', 'Vêtements', 1),
  ('00000000-0000-4000-8000-000000000002', 'chaussures', 'Chaussures', 2),
  ('00000000-0000-4000-8000-000000000003', 'montres', 'Montres', 3);
insert into public.products (id, name, category_id) values
  ('00000000-0000-4000-8000-000000000020', 'Chemise blanche', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000021', 'Chemise bleue', null),
  ('00000000-0000-4000-8000-000000000022', 'Montre or', '00000000-0000-4000-8000-000000000003');
SQL
run $DB add-subcategories.sql
run $DB add-subcategories.sql   # relancé : sans erreur ni doublon
run $DB tests/sql/subcategories-checks.sql
su postgres -c "dropdb $DB"
