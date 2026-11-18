-- Contrôles de add-zara-memory.sql sur un Postgres local jetable (voir tests/sql/run-zara-memory.sh).
create schema t;
grant usage on schema t to anon, authenticated, service_role;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
grant execute on function t.ok(text, boolean) to anon, authenticated, service_role;
-- vrai si la requête est refusée (droits, règle RLS ou contrainte)
create function t.denied(q text) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception when insufficient_privilege or check_violation or not_null_violation or foreign_key_violation then
  return true;
end $$;
grant execute on function t.denied(text) to anon, authenticated, service_role;

-- la fonction serveur (service_role) écrit les notes des deux clients
set role service_role;
select t.ok('la fonction serveur écrit les notes d''un client', not t.denied($q$insert into public.zara_memory (user_id, notes) values ('11111111-1111-1111-1111-111111111111', '["pointure 42", "aime le doré"]')$q$));
select t.ok('… et celles d''un autre client', not t.denied($q$insert into public.zara_memory (user_id, notes) values ('22222222-2222-2222-2222-222222222222', '["taille M"]')$q$));
select t.ok('la fonction serveur met à jour (upsert)', not t.denied($q$insert into public.zara_memory (user_id, notes) values ('11111111-1111-1111-1111-111111111111', '["pointure 42", "aime le doré", "budget 20 000 FCFA"]') on conflict (user_id) do update set notes = excluded.notes, updated_at = now()$q$));
select t.ok('8 notes au plus', t.denied($q$update public.zara_memory set notes = (select jsonb_agg('note ' || g) from generate_series(1, 9) g) where user_id = '22222222-2222-2222-2222-222222222222'$q$));
select t.ok('autre chose qu''une liste refusé', t.denied($q$update public.zara_memory set notes = '{"a": 1}' where user_id = '22222222-2222-2222-2222-222222222222'$q$));
select t.ok('compte inexistant refusé', t.denied($q$insert into public.zara_memory (user_id) values ('99999999-9999-9999-9999-999999999999')$q$));
reset role;

-- le client 1 connecté : il lit SES notes seulement
set test.uid = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select t.ok('un client lit ses propres notes', (select count(*) = 1 and bool_and(jsonb_array_length(notes) = 3) from public.zara_memory));
select t.ok('un client ne voit pas les notes des autres', (select count(*) = 0 from public.zara_memory where user_id = '22222222-2222-2222-2222-222222222222'));
select t.ok('un client ne peut pas écrire ses notes lui-même (seule Zara écrit)', t.denied($q$insert into public.zara_memory (user_id, notes) values ('11111111-1111-1111-1111-111111111111', '["x"]') on conflict (user_id) do update set notes = excluded.notes$q$) and t.denied($q$update public.zara_memory set notes = '["admin"]'$q$));
delete from public.zara_memory where user_id = '22222222-2222-2222-2222-222222222222';
select t.ok('« Tout oublier » ne touche pas les notes des autres', (select count(*) = 0 from public.zara_memory where user_id = '22222222-2222-2222-2222-222222222222'));
delete from public.zara_memory;
select t.ok('« Tout oublier » efface ses propres notes', (select count(*) = 0 from public.zara_memory));
reset role;
select t.ok('… et seulement les siennes (celles du client 2 sont toujours là)', (select count(*) = 1 from public.zara_memory where user_id = '22222222-2222-2222-2222-222222222222'));

-- un visiteur sans compte : aucun accès
reset test.uid;
set role anon;
select t.ok('un visiteur sans compte ne lit rien', t.denied('select * from public.zara_memory'));
select t.ok('un visiteur sans compte n''efface rien', t.denied('delete from public.zara_memory'));
reset role;

-- un compte supprimé emporte ses notes
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select t.ok('compte supprimé : ses notes partent avec lui', (select count(*) = 0 from public.zara_memory));
select t.ok('une seule nouvelle table, RLS activée', (select count(*) = 1 from information_schema.tables where table_schema = 'public') and (select relrowsecurity from pg_class where oid = 'public.zara_memory'::regclass));
