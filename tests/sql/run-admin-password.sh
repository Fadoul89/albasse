#!/bin/sh
# Joue add-admin-reset-password.sql sur un Postgres local JETABLE (jamais la vraie base) et lance les contrôles.
# Prérequis : Postgres 16 installé, grappe « 16 main » démarrée (pg_ctlcluster 16 main start), lancé en root ou avec sudo.
# Lancer depuis la racine du projet : sh tests/sql/run-admin-password.sh
set -e
DB=albasse_adminpwd_test
run() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $1" < "$2"; }
su postgres -c "dropdb --if-exists $DB"
su postgres -c "createdb $DB"
run $DB tests/sql/admin-password-stubs.sql
run $DB add-admin-reset-password.sql
run $DB add-admin-reset-password.sql   # relancé : sans erreur ni doublon
run $DB tests/sql/admin-password-checks.sql
su postgres -c "dropdb $DB"
