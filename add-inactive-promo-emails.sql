-- E-mails publicitaires automatiques (Brevo) aux clients absents depuis 7 jours : chaque matin à 9 h (N'Djamena), Zara met en file un petit
-- nombre d'e-mails avec de vrais articles du site. Éteints au départ : l'administrateur les allume avec l'interrupteur
-- (Admin › Assistant marketing, en plus de « E-mails automatiques aux clients »).
-- Règles : seulement les clients qui ont accepté les promotions (réglage « Promotions »), avec une vraie adresse e-mail, jamais un compte
-- bloqué ni l'administrateur ; pas de client qui a commandé ou visité le site depuis 7 jours ; au plus un e-mail publicitaire tous les 14 jours
-- par client ; 50 e-mails par jour au départ (colonne inactive_emails_daily_limit) ; les plus récemment absents d'abord.
-- Chaque e-mail a un lien « Me désinscrire » : il coupe seulement les e-mails publicitaires (pas ceux des commandes, pas les notifications).
-- Sans danger à relancer. À lancer une fois dans Supabase › SQL Editor, après add-order-emails.sql.

-- 1) l'interrupteur et la limite par jour
alter table public.store_settings add column if not exists inactive_emails_enabled boolean not null default false;
alter table public.store_settings add column if not exists inactive_emails_daily_limit integer not null default 50;

-- 2) la file d'envoi accepte le nouveau type d'e-mail (sans commande, comme « bienvenue »)
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check check (kind in ('welcome', 'order_received', 'order_delivered', 'promo_inactive'));
alter table public.email_outbox drop constraint if exists email_outbox_check;
alter table public.email_outbox add constraint email_outbox_check check (kind in ('welcome', 'promo_inactive') or order_id is not null);
create index if not exists email_outbox_user_kind_idx on public.email_outbox (user_id, kind, created_at);

-- 3) la désinscription : un code secret par client (dans le lien de l'e-mail), illisible depuis le site
create table if not exists public.email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.email_prefs enable row level security;
revoke all on public.email_prefs from anon, authenticated;
grant select, insert, update, delete on public.email_prefs to service_role;

-- appelée par la page albasseshopping.com/desinscription et par le bouton « Se désabonner » de la messagerie (via la fonction brevo-email)
create or replace function public.email_unsubscribe(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_token is null then return false; end if;
  update public.email_prefs set unsubscribed_at = coalesce(unsubscribed_at, now()) where token = p_token;
  get diagnostics n = row_count;
  return n > 0;
end; $$;
revoke all on function public.email_unsubscribe(uuid) from public;
grant execute on function public.email_unsubscribe(uuid) to anon, authenticated;

-- 4) chaque matin : mettre en file les clients absents depuis 7 jours (seulement si les deux interrupteurs sont allumés)
create or replace function public.enqueue_inactive_promos()
returns integer language plpgsql security definer set search_path = public as $$
declare lim integer; queued_recently integer; n integer := 0;
begin
  if not coalesce((select order_emails_enabled from public.store_settings where id = 1), false) then return 0; end if;
  if not coalesce((select inactive_emails_enabled from public.store_settings where id = 1), false) then return 0; end if;
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
      and not exists (select 1 from public.email_prefs e where e.user_id = c.id and e.unsubscribed_at is not null)
      and not exists (select 1 from public.email_outbox o where o.user_id = c.id and o.kind = 'promo_inactive' and o.status in ('pending', 'sending', 'sent') and o.created_at > now() - interval '14 days')
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

select cron.unschedule('enqueue-inactive-promos') where exists (select 1 from cron.job where jobname = 'enqueue-inactive-promos');
select cron.schedule('enqueue-inactive-promos', '0 8 * * *', 'select public.enqueue_inactive_promos()');
