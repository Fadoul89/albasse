#!/bin/sh
# Joue add-client-birth-marital.sql sur un Postgres local JETABLE (jamais la vraie base) et lance les contrôles.
# Prérequis : Postgres 16 installé, grappe « 16 main » démarrée (pg_ctlcluster 16 main start), lancé en root ou avec sudo.
# Lancer depuis la racine du projet : sh tests/sql/run-client-birth-marital.sh
set -e
DB=albasse_birth_marital_test
run() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $1" < "$2"; }
su postgres -c "dropdb --if-exists $DB"
su postgres -c "createdb $DB"
run $DB tests/sql/client-birth-marital-stubs.sql
run $DB add-client-birth-marital.sql
run $DB add-client-birth-marital.sql   # relancé : sans erreur ni doublon
run $DB tests/sql/client-birth-marital-checks.sql
su postgres -c "dropdb $DB"
