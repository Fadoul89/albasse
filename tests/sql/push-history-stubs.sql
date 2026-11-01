-- Décor de test pour add-push-history-cleanup.sql sur un Postgres local JETABLE (jamais la vraie base) :
-- rôles anon / authenticated, is_admin(), la table des notifications programmées telle qu'elle est AVANT le script
-- (add-scheduled-push.sql + add-push-clicks.sql), sa règle d'accès administrateur, et pg_cron simulé.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema cron;
create table cron.job (jobid serial primary key, jobname text, schedule text, command text);
create function cron.schedule(job_name text, sched text, cmd text) returns bigint language plpgsql as $$ declare n bigint; begin insert into cron.job(jobname, schedule, command) values (job_name, sched, cmd) returning jobid into n; return n; end $$;
create function cron.unschedule(job_name text) returns boolean language plpgsql as $$ begin delete from cron.job where jobname = job_name; return true; end $$;
-- le minuteur d'envoi qui existe déjà : il ne doit pas bouger
select cron.schedule('albasse-scheduled-pushes', '* * * * *', 'select public.run_scheduled_pushes()');

create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(current_setting('test.is_admin', true), '') = 'on' $$;

create table public.products (id uuid primary key default gen_random_uuid(), name text);
create table public.scheduled_pushes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  message text not null check (char_length(message) between 1 and 160),
  send_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'expired', 'cancelled')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  clicks integer not null default 0,
  recipients integer
);
grant usage on schema public to anon, authenticated;
revoke all on public.scheduled_pushes from anon;
grant select, insert, update, delete on public.scheduled_pushes to authenticated;
alter table public.scheduled_pushes enable row level security;
create policy "scheduled_pushes_admin_all" on public.scheduled_pushes for all using (public.is_admin()) with check (public.is_admin());

-- l'état d'AVANT le script : une notification envoyée il y a 3 jours, une envoyée il y a 2 heures, une annulée créée il y a 5 jours,
-- une « pas envoyée » créée il y a 2 jours, une annulée créée il y a 1 heure, deux programmées (une dans le passé lointain de la table, une à venir)
insert into public.products (id, name) values ('22222222-0000-4000-8000-000000000001', 'Article test');
insert into public.scheduled_pushes (id, product_id, title, message, send_at, status, sent_at, created_at, clicks, recipients) values
  ('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'T', 'envoyée il y a 3 jours', now() - interval '3 days', 'sent', now() - interval '3 days', now() - interval '4 days', 7, 30),
  ('11111111-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'T', 'envoyée il y a 2 heures', now() - interval '2 hours', 'sent', now() - interval '2 hours', now() - interval '1 day', 2, 35),
  ('11111111-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000001', 'T', 'annulée créée il y a 5 jours', now() + interval '2 days', 'cancelled', null, now() - interval '5 days', 0, null),
  ('11111111-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000001', 'T', 'pas envoyée créée il y a 2 jours', now() - interval '40 hours', 'expired', null, now() - interval '2 days', 0, null),
  ('11111111-0000-4000-8000-000000000005', '22222222-0000-4000-8000-000000000001', 'T', 'annulée créée il y a 1 heure', now() + interval '3 days', 'cancelled', null, now() - interval '1 hour', 0, null),
  ('11111111-0000-4000-8000-000000000006', '22222222-0000-4000-8000-000000000001', 'T', 'programmée dans 3 jours', now() + interval '3 days', 'pending', null, now() - interval '6 days', 0, null),
  ('11111111-0000-4000-8000-000000000007', '22222222-0000-4000-8000-000000000001', 'T', 'programmée demain', now() + interval '1 day', 'pending', null, now() - interval '30 hours', 0, null);
