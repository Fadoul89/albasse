#!/bin/sh
# Joue add-client-number.sql sur un Postgres local JETABLE (jamais la vraie base) et lance les contrôles.
# Prérequis : Postgres 16 installé, grappe « 16 main » démarrée (pg_ctlcluster 16 main start), lancé en root ou avec sudo.
# Lancer depuis la racine du projet : sh tests/sql/run-client-number.sh
set -e
DB=albasse_clientnumber_test
run() { su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $1" < "$2"; }
su postgres -c "dropdb --if-exists $DB"
su postgres -c "createdb $DB"
run $DB tests/sql/password-alert-stubs.sql
run $DB tests/sql/client-number-stubs.sql
# 1re passe : l'alerte « mot de passe oublié » AVANT le numéro client (la colonne n'existe pas encore) : elle marche comme avant, sans la ligne du numéro
run $DB add-password-request-alert.sql
cat <<'SQL' | su postgres -c "psql -q -X -v ON_ERROR_STOP=1 -d $DB"
set role anon;
select public.notify_admin_password_request('66 12 34 56');
reset role;
do $$ declare txt text; begin
  select body->>'text' into txt from net.calls order by id desc limit 1;
  if txt is null then raise exception 'ECHEC aucune alerte sans la colonne du numéro'; end if;
  if txt like '%N° client%' then raise exception 'ECHEC ligne du numéro alors que la colonne n''existe pas'; end if;
  raise notice 'OK    sans la colonne du numéro client : l''alerte part comme avant, sans la ligne du numéro';
end $$;
delete from net.calls;
delete from public.password_request_alerts;
SQL
run $DB add-client-number.sql
run $DB add-client-number.sql   # relancé : sans erreur, sans renumérotation
run $DB add-password-request-alert.sql   # relancé après le numéro : la ligne du numéro apparaît
run $DB tests/sql/client-number-checks.sql
su postgres -c "dropdb $DB"
