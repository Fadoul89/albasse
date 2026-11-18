#!/bin/sh
# Joue add-zara-memory.sql sur un Postgres local JETABLE (jamais la vraie base) et lance les contrôles.
# Prérequis : Postgres 16 installé, grappe « 16 main » démarrée (pg_ctlcluster 16 main start), lancé en root ou avec sudo.
# Lancer depuis la racine du projet : sh tests/sql/run-zara-memory.sh
set -e
DB=albasse_zara_memory_test
run() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $1" < "$2"; }
su postgres -c "dropdb --if-exists $DB"
su postgres -c "createdb $DB"
run $DB tests/sql/zara-memory-stubs.sql
run $DB add-zara-memory.sql
run $DB add-zara-memory.sql   # relancé : sans erreur ni doublon
run $DB tests/sql/zara-memory-checks.sql
su postgres -c "dropdb $DB"
