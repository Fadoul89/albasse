-- Contrôles de add-push-history-cleanup.sql sur un Postgres local jetable (voir tests/sql/run-push-history.sh).
create schema t;
grant usage on schema t to public;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.id(n int) returns uuid language sql immutable as $$ select ('11111111-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.has(n int) returns boolean language sql stable security definer as $$ select exists (select 1 from public.scheduled_pushes where id = t.id(n)) $$;
create function t.n() returns int language sql stable security definer as $$ select count(*)::int from public.scheduled_pushes $$;
grant execute on function t.has(int), t.n() to public;

-- 0. ce que le script a préparé (avant tout passage du minuteur)
select t.ok('la colonne existe et aucune ligne n''est vide', (select count(*) from public.scheduled_pushes where status_changed_at is null) = 0);
select t.ok('envoyée : le moment de départ est son envoi (il y a 3 jours)', (select abs(extract(epoch from (status_changed_at - sent_at))) < 1 from public.scheduled_pushes where id = t.id(1)));
select t.ok('annulée / pas envoyée : le moment de départ est leur création',
  (select status_changed_at = created_at from public.scheduled_pushes where id = t.id(3)) and (select status_changed_at = created_at from public.scheduled_pushes where id = t.id(4)));
select t.ok('le minuteur d''effacement est planifié une seule fois, toutes les 10 minutes',
  (select count(*) from cron.job where jobname = 'purge-old-scheduled-pushes') = 1 and (select schedule from cron.job where jobname = 'purge-old-scheduled-pushes') = '*/10 * * * *');
select t.ok('le minuteur d''envoi qui existait déjà n''a pas bougé', (select schedule from cron.job where jobname = 'albasse-scheduled-pushes') = '* * * * *');
select t.ok('droits : ni l''anonyme ni le client ne peuvent lancer l''effacement',
  not has_function_privilege('anon', 'public.purge_old_scheduled_pushes()', 'execute') and not has_function_privilege('authenticated', 'public.purge_old_scheduled_pushes()', 'execute'));
select t.ok('7 lignes avant le premier passage', t.n() = 7);

-- 1. premier passage du minuteur
select t.ok('le passage efface 3 lignes (envoyée il y a 3 jours, annulée de il y a 5 jours, pas envoyée de il y a 2 jours)', public.purge_old_scheduled_pushes() = 3);
select t.ok('effacées : l''envoyée d''il y a 3 jours, l''annulée de 5 jours, la pas-envoyée de 2 jours', not t.has(1) and not t.has(3) and not t.has(4));
select t.ok('gardées : l''envoyée d''il y a 2 heures (avec ses clics), l''annulée d''il y a 1 heure, les 2 programmées', t.has(2) and t.has(5) and t.has(6) and t.has(7));
select t.ok('l''envoyée d''il y a 2 heures a gardé ses 2 clics et ses 35 téléphones', (select clicks = 2 and recipients = 35 from public.scheduled_pushes where id = t.id(2)));
select t.ok('un deuxième passage tout de suite n''efface rien', public.purge_old_scheduled_pushes() = 0 and t.n() = 4);
select t.ok('une programmée créée il y a 6 jours n''est JAMAIS effacée (seulement l''historique fini)', t.has(6));

-- 2. le déclencheur : le moment du changement se met à jour avec l'état
update public.scheduled_pushes set status = 'cancelled' where id = t.id(7);
select t.ok('annuler maintenant : le départ des 24 h est MAINTENANT (pas la date de création, qui date de 30 h)',
  (select status_changed_at > now() - interval '1 minute' from public.scheduled_pushes where id = t.id(7)));
select t.ok('une annulation toute fraîche, même d''une notification créée il y a 30 h, n''est pas effacée tout de suite', public.purge_old_scheduled_pushes() = 0 and t.has(7));
update public.scheduled_pushes set clicks = clicks + 1 where id = t.id(2);
select t.ok('modifier autre chose que l''état (un clic) ne change pas le départ des 24 h',
  (select status_changed_at < now() - interval '1 hour' from public.scheduled_pushes where id = t.id(2)));
insert into public.scheduled_pushes (id, product_id, title, message, send_at) values (t.id(8), '22222222-0000-4000-8000-000000000001', 'T', 'nouvelle', now() + interval '1 day');
select t.ok('une nouvelle notification démarre à maintenant, état « programmée »', (select status = 'pending' and status_changed_at > now() - interval '1 minute' from public.scheduled_pushes where id = t.id(8)));
-- le minuteur d'envoi passe la programmée en « envoyée » : le départ devient l'instant de l'envoi
update public.scheduled_pushes set status = 'sent', sent_at = now() where id = t.id(8);
select t.ok('passer en « envoyée » : le départ est l''instant de l''envoi, la ligne reste 24 h', (select status_changed_at > now() - interval '1 minute' from public.scheduled_pushes where id = t.id(8)) and public.purge_old_scheduled_pushes() = 0);

-- 3. 24 heures plus tard : tout ce qui est fini depuis plus de 24 h part
update public.scheduled_pushes set status_changed_at = now() - interval '25 hours' where id in (t.id(2), t.id(5), t.id(7));
select t.ok('25 h plus tard : le passage efface 3 lignes (l''envoyée et les 2 annulées)', public.purge_old_scheduled_pushes() = 3);
select t.ok('25 h plus tard : elles sont parties, la dernière envoyée (maintenant) et la programmée restent', not t.has(2) and not t.has(5) and not t.has(7) and t.has(8) and t.has(6));
select t.ok('il reste exactement : la programmée (id 6) et la dernière envoyée (id 8)', t.n() = 2);

-- 4. le panneau administrateur : lecture et annulation continuent de marcher (même règles qu'avant)
set role authenticated;
select set_config('test.is_admin', 'on', false);
select t.ok('l''administrateur lit toujours les notifications', (select count(*) from public.scheduled_pushes) = 2);
update public.scheduled_pushes set status = 'cancelled' where id = t.id(6);
select t.ok('l''administrateur annule toujours une notification (le déclencheur ne gêne pas)', (select status = 'cancelled' from public.scheduled_pushes where id = t.id(6)));
select set_config('test.is_admin', 'off', false);
select t.ok('un client ne voit toujours rien', (select count(*) from public.scheduled_pushes) = 0);
select 'TOUS LES CONTROLES REUSSIS' as resultat;
