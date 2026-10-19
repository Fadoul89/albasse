-- Notifications push programmées : le nombre de clics (et le nombre de téléphones qui l'ont reçue).
--
-- Quand un client touche une notification, le service worker (public/sw.js) ouvre la page avec une petite marque
-- « ?push=… » (les 16 premiers caractères du SHA-256 de « titre + retour à la ligne + message »). Le site appelle alors
-- record_push_click : la notification programmée envoyée qui correspond (30 derniers jours) gagne un clic.
-- recipients : le nombre de téléphones abonnés au moment de l'envoi.
-- À lancer après add-scheduled-push.sql. Sans danger à relancer.

alter table public.scheduled_pushes add column if not exists clicks integer not null default 0;
alter table public.scheduled_pushes add column if not exists recipients integer;

create or replace function public.run_scheduled_pushes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
  subs integer;
begin
  update scheduled_pushes set status = 'expired'
    where status = 'pending' and send_at < now() - interval '6 hours';
  select count(*) into subs from web_push_subscriptions;
  for r in
    select * from scheduled_pushes
    where status = 'pending' and send_at <= now()
    order by send_at
    limit 20
    for update skip locked
  loop
    insert into product_notifications (product_id, title, message) values (r.product_id, r.title, r.message);
    update scheduled_pushes set status = 'sent', sent_at = now(), recipients = subs where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.run_scheduled_pushes() from public, anon, authenticated;

-- Un clic sur une notification : appelé par le site (visiteurs compris). Ne fait rien si la marque ne correspond à aucune
-- notification programmée envoyée ces 30 derniers jours.
create or replace function public.record_push_click(p_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{16}$' then
    return false;
  end if;
  select id into v_id
    from scheduled_pushes
    where status = 'sent'
      and sent_at > now() - interval '30 days'
      and left(encode(sha256(convert_to(title || E'\n' || message, 'UTF8')), 'hex'), 16) = p_hash
    order by sent_at desc
    limit 1;
  if v_id is null then
    return false;
  end if;
  update scheduled_pushes set clicks = clicks + 1 where id = v_id;
  return true;
end;
$$;

revoke all on function public.record_push_click(text) from public;
grant execute on function public.record_push_click(text) to anon, authenticated;
