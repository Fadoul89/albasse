-- Relance quotidienne des clients absents depuis 7 jours, en même temps que Zara Marketing (demande du patron, 21 novembre 2026 :
-- « trouve une solution professionnelle pour que Zara envoie des e-mails chaque jour aux clients non connectés depuis 7 jours »).
--
-- Avant : l'ancienne publicité « absents » (enqueue_inactive_promos) s'arrêtait dès que Zara Marketing était en « live » ; or Zara
-- Marketing n'envoyait que des ventes flash : plus aucune relance des absents depuis le 7 novembre.
--
-- Maintenant, chaque jour à 8h45 (N'Djamena), avant le passage de Zara Marketing (9h05) :
--   • qui : les clients ni connectés ni venus sur le site depuis 7 jours, qui ont accepté les offres (notify_promotions), avec une
--     vraie adresse (pas …@tel.albasseshopping.com), jamais un administrateur ni un compte bloqué, jamais une adresse désinscrite
--     ou en suppression (rebond, plainte), jamais un client qui a commandé dans les 7 derniers jours ;
--   • rythme d'une absence : 1re relance à 7 jours, 2e à 14 jours, 3e à 30 jours, puis plus rien tant que le client ne revient pas
--     (dès qu'il revient sur le site ou se connecte, le compte repart de zéro) ;
--   • jamais plus d'un e-mail publicitaire par semaine à un même client, relances ET campagnes de Zara Marketing comprises
--     (Zara Marketing compte aussi ces relances dans ses propres limites : pas de doublon) ;
--   • au plus inactive_emails_daily_limit relances par jour (50 par défaut, 200 au plus) : les 1res relances d'abord, puis les
--     absents les plus récents ;
--   • les interrupteurs restent les mêmes : e-mails (order_emails_enabled) et publicité « absents » (inactive_emails_enabled).
-- L'e-mail lui-même ne change pas (« Vous nous manquez », 4 articles : ventes flash puis nouveautés), envoyé par la fonction brevo-email.
--
-- À lancer dans Supabase › SQL Editor. Sans danger si on le relance. Aucune table créée ni supprimée : une fonction remplacée et
-- l'heure de sa tâche quotidienne.

create or replace function public.enqueue_inactive_promos()
returns integer language plpgsql security definer set search_path = public as $$
declare lim integer; queued_today integer; n integer := 0;
begin
  if not coalesce((select order_emails_enabled from public.store_settings where id = 1), false) then return 0; end if;
  if not coalesce((select inactive_emails_enabled from public.store_settings where id = 1), false) then return 0; end if;
  select greatest(1, least(coalesce(inactive_emails_daily_limit, 50), 200)) into lim from public.store_settings where id = 1;
  select count(*) into queued_today from public.email_outbox where kind = 'promo_inactive' and created_at > now() - interval '20 hours';

  with cand as (
    select p.id,
           greatest(p.created_at, coalesce(p.last_login_at, p.created_at), coalesce((select max(v.last_seen_at) from public.visitor_sessions v where v.user_id = p.id), p.created_at)) as last_active
    from public.profiles p
    where p.notify_promotions is true
      and coalesce(p.banned, false) = false
      and coalesce(p.is_admin, false) = false
      and p.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and lower(p.email) not like '%@tel.albasseshopping.com'
  ), seq as (
    -- les relances déjà faites pendant CETTE absence (après la dernière venue du client)
    select c.id, c.last_active,
           (select count(*) from public.email_outbox o
             where o.user_id = c.id and o.kind = 'promo_inactive' and o.status in ('pending', 'sending', 'sent') and o.created_at > c.last_active) as relances
    from cand c
    where c.last_active < now() - interval '7 days'
  ), due as (
    select s.id
    from seq s
    where s.relances < 3
      and s.last_active < now() - case s.relances when 0 then interval '7 days' when 1 then interval '14 days' else interval '30 days' end
      and not exists (select 1 from public.email_prefs e where e.user_id = s.id and (e.unsubscribed_at is not null or e.suppressed_at is not null))
      and not exists (select 1 from public.email_outbox o where o.user_id = s.id and o.kind in ('promo_inactive', 'marketing') and o.status in ('pending', 'sending', 'sent') and o.created_at > now() - interval '7 days')
      and not exists (select 1 from public.orders o where o.user_id = s.id and o.created_at > now() - interval '7 days')
    order by s.relances, s.last_active desc
    limit greatest(lim - queued_today, 0)
  ), prefs as (
    insert into public.email_prefs (user_id) select id from due on conflict do nothing
  )
  insert into public.email_outbox (kind, user_id) select 'promo_inactive', id from due;
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.enqueue_inactive_promos() from public, anon, authenticated;

-- la tâche quotidienne : 8h45 à N'Djamena (7h45 UTC), juste avant le passage de Zara Marketing (9h05)
select cron.unschedule('enqueue-inactive-promos') where exists (select 1 from cron.job where jobname = 'enqueue-inactive-promos');
select cron.schedule('enqueue-inactive-promos', '45 7 * * *', 'select public.enqueue_inactive_promos()');
