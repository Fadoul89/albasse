#!/bin/sh
# Joue add-absent-relance.sql sur un Postgres local JETABLE (jamais la vraie base) et lance les contrôles.
# Prérequis : Postgres 16 installé, grappe « 16 main » démarrée (pg_ctlcluster 16 main start), lancé en root ou avec sudo.
# Lancer depuis la racine du projet : sh tests/sql/run-absent-relance.sh
set -e
DB=albasse_relance_test
run() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $1" < "$2"; }
su postgres -c "dropdb --if-exists $DB"
su postgres -c "createdb $DB"
run $DB tests/sql/absent-relance-stubs.sql
run $DB add-absent-relance.sql
run $DB add-absent-relance.sql   # relancé : sans erreur ni doublon de tâche
run $DB tests/sql/absent-relance-checks.sql
su postgres -c "dropdb $DB"
