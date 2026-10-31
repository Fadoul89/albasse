#!/bin/sh
# Joue add-push-new-products-switch.sql sur un Postgres local JETABLE (jamais la vraie base) : seul, puis avec le gardien (add-push-gate.sql),
# dans les deux ordres d'installation. Prérequis : Postgres 16 installé, grappe « 16 main » démarrée (pg_ctlcluster 16 main start), root ou sudo.
# Lancer depuis la racine du projet : sh tests/sql/run-push-new-switch.sh
set -e
run() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $1" < "$2"; }
fresh() { su postgres -c "dropdb --if-exists $1"; su postgres -c "createdb $1"; run $1 tests/sql/push-gate-stubs.sql; run $1 tests/sql/push-new-switch-helpers.sql; }

echo "== A. le petit script seul (relancé deux fois)"
DB=albasse_pushnew_a
fresh $DB
run $DB add-push-new-products-switch.sql
run $DB add-push-new-products-switch.sql
run $DB tests/sql/push-new-switch-alone.sql
echo "== A2. puis le gardien par-dessus"
run $DB add-push-gate.sql
run $DB tests/sql/push-new-switch-with-gate.sql
su postgres -c "dropdb $DB"

echo "== B. le gardien d'abord, puis le petit script"
DB=albasse_pushnew_b
fresh $DB
run $DB add-push-gate.sql
run $DB add-push-new-products-switch.sql
run $DB tests/sql/push-new-switch-with-gate.sql
su postgres -c "dropdb $DB"
