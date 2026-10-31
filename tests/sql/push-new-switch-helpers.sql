-- Aides pour les contrôles de l'interrupteur « nouveaux articles » (voir tests/sql/run-push-new-switch.sh).
create schema t;
grant usage on schema t to public;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.pid(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.notifs() returns bigint language sql as $$ select count(*) from public.product_notifications $$;
create function t.pushes() returns bigint language sql as $$ select count(*) from net.calls where url like '%send-web-push' $$;
