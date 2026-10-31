-- Telegram aux clients absents depuis 7 jours + rapport quotidien dans le Telegram de l'administrateur.
--
-- Ce que fait ce script :
--   1. Deux réglages dans store_settings : l'interrupteur « Telegram aux clients absents » (ÉTEINT au départ) et la limite par jour (50).
--   2. telegram_prefs  : pour chaque client, « a lié Telegram en sachant qu'il recevra les offres » et « a écrit STOP » (ou a bloqué le bot).
--      telegram_promos : le journal des messages envoyés (envoyé / échec / bot bloqué), pour ne jamais écrire deux fois et pour le rapport.
--      Ces deux tables ne sont lisibles que par les fonctions serveur (service_role) : aucun client ni visiteur n'y a accès.
--   3. telegram_absent_claim()  : choisit les clients à qui écrire aujourd'hui (les règles sont plus bas) et les réserve.
--      telegram_absent_record() : note le résultat de chaque envoi. Un client qui a bloqué le bot n'est plus jamais contacté.
--   4. telegram_promos_report() : les chiffres du rapport quotidien (e-mails publicitaires + Telegram : envoyés, revenus, commandes).
--      telegram_linked_stats()  : le nombre de clients liés à Telegram, affiché dans Admin › Assistant marketing (administrateurs seulement).
--   5. Planification : chaque matin à 9 h 30 (N'Djamena, après les e-mails de 9 h) la base appelle la fonction « telegram-promo » ;
--      chaque jour à 17 h elle lui demande d'envoyer le rapport sur le Telegram des administrateurs.
--
-- Règles de ciblage (mêmes principes que les e-mails publicitaires) : le client a LIÉ son Telegram (bouton « Lier Telegram » puis « Démarrer »
-- dans le bot, qui annonce les offres et le mot STOP) ; il n'a pas écrit STOP ; ni compte bloqué ni administrateur ; ni commande ni visite
-- depuis 7 jours ; au plus un message tous les 14 jours ; 50 messages par jour au départ ; les plus récemment absents d'abord.
--
-- À lancer une fois dans Supabase › SQL Editor, APRÈS add-order-emails.sql et APRÈS avoir déployé la fonction « telegram-promo »
-- (dossier supabase/functions/telegram-promo) et la nouvelle version de « telegram-webhook ». Sans danger à relancer.
-- Les nouvelles tables ont leurs « grant » explicites (service_role seulement : le site n'en a pas besoin).

-- 1) réglages (éteint au départ : l'administrateur l'allume avec l'interrupteur, Admin › Assistant marketing)
alter table public.store_settings add column if not exists telegram_absent_enabled boolean not null default false;
alter table public.store_settings add column if not exists telegram_absent_daily_limit integer not null default 50;

-- 2) les préférences Telegram de chaque client
create table if not exists public.telegram_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  promos_ok boolean not null default false,
  consented_at timestamptz,
  stopped_at timestamptz,
  stop_reason text,
  updated_at timestamptz not null default now()
);
alter table public.telegram_prefs enable row level security;
revoke all on public.telegram_prefs from anon, authenticated;
grant select, insert, update, delete on public.telegram_prefs to service_role;

-- le journal des messages envoyés aux clients absents
create table if not exists public.telegram_promos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'promo_absent' check (kind in ('promo_absent')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'blocked')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists telegram_promos_user_idx on public.telegram_promos (user_id, created_at);
create index if not exists telegram_promos_created_idx on public.telegram_promos (created_at);
alter table public.telegram_promos enable row level security;
revoke all on public.telegram_promos from anon, authenticated;
grant select, insert, update, delete on public.telegram_promos to service_role;

-- 3) choisir et réserver les clients à qui écrire (réservé à la fonction serveur)
create or replace function public.telegram_absent_claim()
returns table (o_user_id uuid, o_name text, o_chat_id bigint)
language plpgsql security definer set search_path = public as $$
declare lim integer; done_recently integer;
begin
  if not coalesce((select s.telegram_absent_enabled from public.store_settings s where s.id = 1), false) then return; end if;
  select greatest(1, coalesce(s.telegram_absent_daily_limit, 50)) into lim from public.store_settings s where s.id = 1;
  select count(*) into done_recently from public.telegram_promos t where t.created_at > now() - interval '20 hours';
  return query
  with cand as (
    select p.id, p.full_name, p.telegram_chat_id,
           greatest(p.created_at, coalesce(p.last_login_at, p.created_at), coalesce((select max(v.last_seen_at) from public.visitor_sessions v where v.user_id = p.id), p.created_at)) as last_active
    from public.profiles p
    join public.telegram_prefs tp on tp.user_id = p.id
    where p.telegram_chat_id is not null
      and tp.promos_ok is true
      and tp.stopped_at is null
      and coalesce(p.banned, false) = false
      and coalesce(p.is_admin, false) = false
  ), due as (
    select c.id, c.full_name, c.telegram_chat_id, c.last_active
    from cand c
    where c.last_active < now() - interval '7 days'
      and not exists (select 1 from public.telegram_promos t where t.user_id = c.id and t.status in ('pending', 'sent') and t.created_at > now() - interval '14 days')
      and not exists (select 1 from public.orders o where o.user_id = c.id and o.created_at > now() - interval '7 days')
    order by c.last_active desc
    limit greatest(lim - done_recently, 0)
  ), reserved as (
    insert into public.telegram_promos (user_id, status) select d.id, 'pending' from due d returning user_id
  )
  select d.id, d.full_name, d.telegram_chat_id from due d order by d.last_active desc;
end; $$;
revoke all on function public.telegram_absent_claim() from public, anon, authenticated;
grant execute on function public.telegram_absent_claim() to service_role;

-- noter le résultat d'un envoi ; un client qui a bloqué le bot n'est plus jamais contacté (réservé à la fonction serveur)
create or replace function public.telegram_absent_record(p_user uuid, p_status text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('sent', 'failed', 'blocked') then raise exception 'statut inconnu'; end if;
  update public.telegram_promos
     set status = p_status, error = left(p_error, 200), sent_at = case when p_status = 'sent' then now() else null end
   where id = (select t.id from public.telegram_promos t where t.user_id = p_user and t.status = 'pending' order by t.created_at desc limit 1);
  if p_status = 'blocked' then
    insert into public.telegram_prefs (user_id, stopped_at, stop_reason) values (p_user, now(), 'bot bloqué')
    on conflict (user_id) do update
      set stopped_at = coalesce(public.telegram_prefs.stopped_at, now()),
          stop_reason = coalesce(public.telegram_prefs.stop_reason, 'bot bloqué'),
          updated_at = now();
  end if;
end; $$;
revoke all on function public.telegram_absent_record(uuid, text, text) from public, anon, authenticated;
grant execute on function public.telegram_absent_record(uuid, text, text) to service_role;

-- 4) le rapport quotidien : e-mails publicitaires et Telegram, sur les envois des 7 derniers jours (réservé à la fonction serveur)
-- « revenus » = clients contactés qui ont ouvert une visite sur le site APRÈS le message ; « commandes » = clients contactés qui ont commandé APRÈS le message.
create or replace function public.telegram_promos_report()
returns jsonb language sql stable security definer set search_path = public as $$
with em as (
  select o.user_id, o.sent_at from public.email_outbox o where o.kind = 'promo_inactive' and o.status = 'sent' and o.sent_at > now() - interval '7 days'
), tg as (
  select t.user_id, t.sent_at from public.telegram_promos t where t.status = 'sent' and t.sent_at > now() - interval '7 days'
), today as (
  select (now() at time zone 'Africa/Ndjamena')::date as d
)
select jsonb_build_object(
  'day', (select d from today),
  'emails_enabled', coalesce((select s.inactive_emails_enabled from public.store_settings s where s.id = 1), false),
  'telegram_enabled', coalesce((select s.telegram_absent_enabled from public.store_settings s where s.id = 1), false),
  'emails', jsonb_build_object(
    'today', (select count(*) from em, today where (em.sent_at at time zone 'Africa/Ndjamena')::date = today.d),
    'week', (select count(*) from em),
    'returned', (select count(distinct em.user_id) from em where exists (select 1 from public.visitor_sessions v where v.user_id = em.user_id and v.last_seen_at > em.sent_at)),
    'orders', (select count(distinct em.user_id) from em where exists (select 1 from public.orders o where o.user_id = em.user_id and o.created_at > em.sent_at))
  ),
  'telegram', jsonb_build_object(
    'today', (select count(*) from tg, today where (tg.sent_at at time zone 'Africa/Ndjamena')::date = today.d),
    'week', (select count(*) from tg),
    'returned', (select count(distinct tg.user_id) from tg where exists (select 1 from public.visitor_sessions v where v.user_id = tg.user_id and v.last_seen_at > tg.sent_at)),
    'orders', (select count(distinct tg.user_id) from tg where exists (select 1 from public.orders o where o.user_id = tg.user_id and o.created_at > tg.sent_at)),
    'failed', (select count(*) from public.telegram_promos t where t.status = 'failed' and t.created_at > now() - interval '7 days'),
    'blocked', (select count(*) from public.telegram_promos t where t.status = 'blocked' and t.created_at > now() - interval '7 days')
  ),
  'linked', jsonb_build_object(
    'linked', (select count(*) from public.profiles p where p.telegram_chat_id is not null and not coalesce(p.is_admin, false)),
    'consented', (select count(*) from public.profiles p join public.telegram_prefs t on t.user_id = p.id where p.telegram_chat_id is not null and not coalesce(p.is_admin, false) and t.promos_ok and t.stopped_at is null),
    'stopped', (select count(*) from public.telegram_prefs t where t.stopped_at is not null)
  )
);
$$;
revoke all on function public.telegram_promos_report() from public, anon, authenticated;
grant execute on function public.telegram_promos_report() to service_role;

-- le nombre de clients liés à Telegram, pour l'écran Admin › Assistant marketing (administrateurs seulement : sinon rien)
create or replace function public.telegram_linked_stats()
returns jsonb language sql stable security definer set search_path = public as $$
select case when public.is_admin() then jsonb_build_object(
  'linked', (select count(*) from public.profiles p where p.telegram_chat_id is not null and not coalesce(p.is_admin, false)),
  'consented', (select count(*) from public.profiles p join public.telegram_prefs t on t.user_id = p.id where p.telegram_chat_id is not null and not coalesce(p.is_admin, false) and t.promos_ok and t.stopped_at is null),
  'stopped', (select count(*) from public.telegram_prefs t where t.stopped_at is not null)
) end;
$$;
revoke all on function public.telegram_linked_stats() from public, anon;
grant execute on function public.telegram_linked_stats() to authenticated;

-- 5) la planification : la base appelle la fonction « telegram-promo » avec le secret partagé du coffre-fort (le même que pour les e-mails)
create or replace function public.run_telegram_absent()
returns void language plpgsql security definer set search_path = public as $$
declare sec text;
begin
  if not coalesce((select s.telegram_absent_enabled from public.store_settings s where s.id = 1), false) then return; end if;
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'email_cron_secret' limit 1;
  if sec is null then return; end if;
  perform net.http_post(
    url := 'https://xtitsmmccpkelxfjyqyh.supabase.co/functions/v1/telegram-promo',
    body := jsonb_build_object('action', 'absent'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', sec),
    timeout_milliseconds := 60000
  );
end; $$;
revoke all on function public.run_telegram_absent() from public, anon, authenticated;

create or replace function public.run_telegram_promos_report()
returns void language plpgsql security definer set search_path = public as $$
declare sec text;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'email_cron_secret' limit 1;
  if sec is null then return; end if;
  perform net.http_post(
    url := 'https://xtitsmmccpkelxfjyqyh.supabase.co/functions/v1/telegram-promo',
    body := jsonb_build_object('action', 'report'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', sec),
    timeout_milliseconds := 60000
  );
end; $$;
revoke all on function public.run_telegram_promos_report() from public, anon, authenticated;

-- 9 h 30 à N'Djamena = 8 h 30 UTC ; 17 h à N'Djamena = 16 h UTC
select cron.unschedule('telegram-absent-daily') where exists (select 1 from cron.job where jobname = 'telegram-absent-daily');
select cron.schedule('telegram-absent-daily', '30 8 * * *', 'select public.run_telegram_absent()');
select cron.unschedule('telegram-promos-report') where exists (select 1 from cron.job where jobname = 'telegram-promos-report');
select cron.schedule('telegram-promos-report', '0 16 * * *', 'select public.run_telegram_promos_report()');
