#!/bin/sh
# Joue add-zara-promotions.sql sur un Postgres local JETABLE (jamais la vraie base) et lance les contrôles.
# Prérequis : Postgres 16 installé, grappe « 16 main » démarrée (pg_ctlcluster 16 main start), lancé en root ou avec sudo.
# Lancer depuis la racine du projet : sh tests/sql/run-zara-promotions.sh
set -e
DB=albasse_promo_test
run() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $1" < "$2"; }
su postgres -c "dropdb --if-exists $DB"
su postgres -c "createdb $DB"
run $DB tests/sql/zara-promotions-stubs.sql
# le catalogue d'avant le script (les prix de vente ne changeront jamais)
run $DB tests/sql/zara-promotions-catalog.sql
run $DB add-zara-promotions.sql
run $DB add-zara-promotions.sql   # relancé : sans erreur ni doublon
run $DB tests/sql/zara-promotions-checks.sql
su postgres -c "dropdb $DB"
