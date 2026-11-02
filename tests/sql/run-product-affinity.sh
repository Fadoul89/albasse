#!/bin/sh
# Joue add-product-affinity.sql sur un Postgres local JETABLE (jamais la vraie base) et lance les contrôles.
# Prérequis : Postgres 16 installé, grappe « 16 main » démarrée (pg_ctlcluster 16 main start), lancé en root ou avec sudo.
# Lancer depuis la racine du projet : sh tests/sql/run-product-affinity.sh
set -e
DB=albasse_affinity_test
run() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $1" < "$2"; }
su postgres -c "dropdb --if-exists $DB"
su postgres -c "createdb $DB"
run $DB tests/sql/product-affinity-stubs.sql
run $DB add-product-affinity.sql
run $DB add-product-affinity.sql   # relancé : sans erreur ni doublon
run $DB tests/sql/product-affinity-checks.sql
su postgres -c "dropdb $DB"
