#!/bin/sh
# Joue add-push-history-cleanup.sql sur un Postgres local JETABLE (jamais la vraie base) et lance les contrôles.
# Prérequis : Postgres 16 installé, grappe « 16 main » démarrée (pg_ctlcluster 16 main start), lancé en root ou avec sudo.
# Lancer depuis la racine du projet : sh tests/sql/run-push-history.sh
set -e
DB=albasse_pushhistory_test
run() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $1" < "$2"; }
su postgres -c "dropdb --if-exists $DB"
su postgres -c "createdb $DB"
run $DB tests/sql/push-history-stubs.sql
run $DB add-push-history-cleanup.sql
run $DB add-push-history-cleanup.sql   # relancé : sans erreur ni doublon
run $DB tests/sql/push-history-checks.sql
su postgres -c "dropdb $DB"
