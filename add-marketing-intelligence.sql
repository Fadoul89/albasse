-- Zara Marketing Intelligence : campagnes e-mail quotidiennes, ciblées et vérifiées (Brevo).
-- À lancer une fois dans Supabase › SQL Editor, APRÈS add-order-emails.sql et add-inactive-promo-emails.sql. Sans danger à relancer.
--
-- RIEN NE PART À L'INSTALLATION : le mode est « off » (éteint). Trois modes :
--   off         : rien ne se passe ;
--   simulation  : chaque jour Zara prépare le plan et le rapport, SANS mettre aucun e-mail en file ni en envoyer ;
--   live        : seulement après les contrôles (Brevo joignable, simulation sans blocage, e-mail de test confirmé par Brevo) ET la validation
--                 de l'administrateur ; par défaut chaque campagne attend en plus son approbation (require_approval).
-- Le verrou est posé deux fois : dans la fonction serveur, et ici dans la base (déclencheur marketing_ai_guard) : même une erreur de
-- programme ne peut pas passer en « live » sans les contrôles.
-- Les clés Brevo restent dans les Secrets de la fonction « brevo-email » (BREVO_API_KEY) ; rien de secret n'est écrit dans ce fichier.

-- 1) les réglages (une seule ligne). L'administrateur peut changer l'heure, la limite par jour et la fréquence ; le mode et le verrou
--    ne sont écrits que par la fonction serveur.
create table if not exists public.marketing_ai_settings (
  id integer primary key default 1 check (id = 1),
  mode text not null default 'off' check (mode in ('off', 'simulation', 'live')),
  run_hour integer not null default 9 check (run_hour between 0 and 23),
  daily_limit integer not null default 50 check (daily_limit between 1 and 200),
  min_days_between integer not null default 7 check (min_days_between between 1 and 60),
  max_per_30_days integer not null default 3 check (max_per_30_days between 1 and 15),
  require_approval boolean not null default true,
  -- le verrou
  brevo_ok boolean,
  brevo_checked_at timestamptz,
  brevo_detail jsonb,
  last_simulation_at timestamptz,
  last_simulation_blocking integer,
  test_email_at timestamptz,
  test_email_message_id text,
  validated_at timestamptz,
  validated_by uuid,
  last_run_date date,
  updated_at timestamptz not null default now()
);
insert into public.marketing_ai_settings (id) values (1) on conflict do nothing;

alter table public.marketing_ai_settings enable row level security;
revoke all on public.marketing_ai_settings from anon, authenticated;
grant select on public.marketing_ai_settings to authenticated;
grant update (run_hour, daily_limit, min_days_between, max_per_30_days, require_approval, updated_at) on public.marketing_ai_settings to authenticated;
grant select, insert, update, delete on public.marketing_ai_settings to service_role;
drop policy if exists marketing_ai_settings_admin_read on public.marketing_ai_settings;
create policy marketing_ai_settings_admin_read on public.marketing_ai_settings for select to authenticated using (public.is_admin());
drop policy if exists marketing_ai_settings_admin_update on public.marketing_ai_settings;
create policy marketing_ai_settings_admin_update on public.marketing_ai_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- le deuxième verrou : « live » est refusé sans les contrôles récents et la validation ; quitter « live » efface la validation
create or replace function public.marketing_ai_guard()
returns trigger language plpgsql as $$
begin
  if new.mode = 'live' then
    if new.validated_at is null
       or new.brevo_ok is not true or new.brevo_checked_at is null or new.brevo_checked_at < now() - interval '24 hours'
       or new.last_simulation_at is null or new.last_simulation_at < now() - interval '48 hours' or coalesce(new.last_simulation_blocking, 1) > 0
       or new.test_email_at is null or new.test_email_message_id is null or new.test_email_at < now() - interval '30 days'
    then
      raise exception 'marketing_ai: passage en live refusé (contrôles ou validation manquants)';
    end if;
  elsif old.mode = 'live' then
    new.validated_at := null;
    new.validated_by := null;
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists marketing_ai_settings_guard on public.marketing_ai_settings;
create trigger marketing_ai_settings_guard before update on public.marketing_ai_settings for each row execute function public.marketing_ai_guard();

-- 2) le journal des passages (un par jour et par mode) : le plan, les destinataires retenus, le rapport
create table if not exists public.marketing_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_date date not null,
  mode text not null check (mode in ('simulation', 'live')),
  status text not null check (status in ('simulated', 'pending_approval', 'queued', 'expired', 'blocked', 'error')),
  summary jsonb not null default '{}'::jsonb,
  recipients jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  approved_by uuid,
  error text
);
create index if not exists marketing_runs_created_idx on public.marketing_runs (created_at desc);
alter table public.marketing_runs enable row level security;
revoke all on public.marketing_runs from anon, authenticated;
grant select on public.marketing_runs to authenticated;
grant select, insert, update, delete on public.marketing_runs to service_role;
drop policy if exists marketing_runs_admin_read on public.marketing_runs;
create policy marketing_runs_admin_read on public.marketing_runs for select to authenticated using (public.is_admin());

-- 3) une campagne = un segment d'un passage « live »
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.marketing_runs(id) on delete cascade,
  created_at timestamptz not null default now(),
  segment text not null,
  planned integer not null default 0,
  tag text not null
);
create index if not exists marketing_campaigns_run_idx on public.marketing_campaigns (run_id);
alter table public.marketing_campaigns enable row level security;
revoke all on public.marketing_campaigns from anon, authenticated;
grant select on public.marketing_campaigns to authenticated;
grant select, insert, update, delete on public.marketing_campaigns to service_role;
drop policy if exists marketing_campaigns_admin_read on public.marketing_campaigns;
create policy marketing_campaigns_admin_read on public.marketing_campaigns for select to authenticated using (public.is_admin());

-- 4) la file d'envoi accepte les e-mails de campagne et garde ce que Brevo confirme (identifiant du message, livraison, clics, rebonds, plaintes)
alter table public.email_outbox add column if not exists campaign_id uuid references public.marketing_campaigns(id) on delete set null;
alter table public.email_outbox add column if not exists segment text;
alter table public.email_outbox add column if not exists topic text; -- segments par centre d'intérêt : la rubrique (parfums, vetements, cat:Nom de la catégorie…)
alter table public.email_outbox add column if not exists variant text;
alter table public.email_outbox add column if not exists lang text;
alter table public.email_outbox add column if not exists product_ids uuid[];
alter table public.email_outbox add column if not exists provider_message_id text;
alter table public.email_outbox add column if not exists delivered_at timestamptz;
alter table public.email_outbox add column if not exists click_count integer not null default 0;
alter table public.email_outbox add column if not exists clicked_slugs text[]; -- articles du site cliqués dans l'e-mail (lus chez Brevo) : nourrissent les centres d'intérêt
alter table public.email_outbox add column if not exists bounce_type text;
alter table public.email_outbox add column if not exists complaint_at timestamptz;
alter table public.email_outbox add column if not exists events_synced_at timestamptz;
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check check (kind in ('welcome', 'order_received', 'order_delivered', 'promo_inactive', 'marketing'));
alter table public.email_outbox drop constraint if exists email_outbox_check;
alter table public.email_outbox add constraint email_outbox_check check (kind in ('welcome', 'promo_inactive', 'marketing') or order_id is not null);
create unique index if not exists email_outbox_marketing_once on public.email_outbox (campaign_id, user_id) where kind = 'marketing';
create index if not exists email_outbox_marketing_idx on public.email_outbox (kind, status, sent_at);

-- 5) adresses en suppression (rebond dur, plainte, blocage signalés par Brevo) et langue du client si elle est connue
alter table public.email_prefs add column if not exists suppressed_at timestamptz;
alter table public.email_prefs add column if not exists suppressed_reason text;
alter table public.email_prefs add column if not exists lang text check (lang in ('fr', 'ar'));

-- 6) l'ancienne publicité « absents depuis 7 jours » s'efface devant Zara Marketing quand celui-ci est en « live » (pas de double envoi),
--    et elle respecte aussi les adresses en suppression
create or replace function public.enqueue_inactive_promos()
returns integer language plpgsql security definer set search_path = public as $$
declare lim integer; queued_recently integer; n integer := 0;
begin
  if not coalesce((select order_emails_enabled from public.store_settings where id = 1), false) then return 0; end if;
  if not coalesce((select inactive_emails_enabled from public.store_settings where id = 1), false) then return 0; end if;
  if coalesce((select mode from public.marketing_ai_settings where id = 1), 'off') = 'live' then return 0; end if;
  select greatest(1, coalesce(inactive_emails_daily_limit, 50)) into lim from public.store_settings where id = 1;
  select count(*) into queued_recently from public.email_outbox where kind = 'promo_inactive' and created_at > now() - interval '20 hours';

  with cand as (
    select p.id,
           greatest(p.created_at, coalesce(p.last_login_at, p.created_at), coalesce((select max(v.last_seen_at) from public.visitor_sessions v where v.user_id = p.id), p.created_at)) as last_active
    from public.profiles p
    where p.notify_promotions is true
      and coalesce(p.banned, false) = false
      and coalesce(p.is_admin, false) = false
      and p.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and lower(p.email) not like '%@tel.albasseshopping.com'
  ), due as (
    select c.id
    from cand c
    where c.last_active < now() - interval '7 days'
      and not exists (select 1 from public.email_prefs e where e.user_id = c.id and (e.unsubscribed_at is not null or e.suppressed_at is not null))
      and not exists (select 1 from public.email_outbox o where o.user_id = c.id and o.kind in ('promo_inactive', 'marketing') and o.status in ('pending', 'sending', 'sent') and o.created_at > now() - interval '14 days')
      and not exists (select 1 from public.orders o where o.user_id = c.id and o.created_at > now() - interval '7 days')
    order by c.last_active desc
    limit greatest(lim - queued_recently, 0)
  ), prefs as (
    insert into public.email_prefs (user_id) select id from due on conflict do nothing
  )
  insert into public.email_outbox (kind, user_id) select 'promo_inactive', id from due;
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.enqueue_inactive_promos() from public, anon, authenticated;

-- 7) chaque heure (à :05) la base réveille la fonction ; elle ne fait rien tant que le mode est « off », et décide elle-même s'il est l'heure du passage
create or replace function public.process_marketing_tick()
returns void language plpgsql security definer set search_path = public as $$
declare sec text;
begin
  if coalesce((select mode from public.marketing_ai_settings where id = 1), 'off') = 'off' then return; end if;
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'email_cron_secret' limit 1;
  if sec is null then return; end if;
  perform net.http_post(
    url := 'https://xtitsmmccpkelxfjyqyh.supabase.co/functions/v1/brevo-email',
    body := jsonb_build_object('action', 'marketing_tick'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', sec)
  );
end; $$;
revoke all on function public.process_marketing_tick() from public, anon, authenticated;

select cron.unschedule('zara-marketing-tick') where exists (select 1 from cron.job where jobname = 'zara-marketing-tick');
select cron.schedule('zara-marketing-tick', '5 * * * *', 'select public.process_marketing_tick()');
