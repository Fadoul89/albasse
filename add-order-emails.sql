-- E-mails automatiques avec Brevo : « bienvenue » après la création d'un compte, « commande reçue » à la commande, « commande livrée »
-- quand la commande passe à « livrée ».
-- Éteints au départ : l'administrateur les allume avec l'interrupteur (Admin › Assistant marketing). Seuls les clients ayant une vraie
-- adresse e-mail en reçoivent ; rien n'est envoyé pour les commandes ni les comptes d'avant l'allumage.
-- La clé Brevo reste dans les Secrets des fonctions Supabase (BREVO_API_KEY). Le secret qui relie la base à la fonction est créé ici
-- dans le coffre-fort (vault, nom « email_cron_secret ») et n'est jamais écrit dans ce fichier.
-- À lancer une fois dans Supabase › SQL Editor.

-- 1) l'interrupteur
alter table public.store_settings add column if not exists order_emails_enabled boolean not null default false;

-- 2) la file d'envoi : une ligne par e-mail à envoyer (une seule par commande et par type, une seule « bienvenue » par client)
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null check (kind in ('welcome', 'order_received', 'order_delivered')),
  order_id uuid,
  user_id uuid,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  sent_at timestamptz,
  error text,
  unique (kind, order_id),
  check (kind = 'welcome' or order_id is not null)
);
create unique index if not exists email_outbox_welcome_once on public.email_outbox (user_id) where kind = 'welcome';
create index if not exists email_outbox_status_idx on public.email_outbox (status, created_at);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
-- le site n'écrit jamais ici ; l'administrateur peut seulement lire (pour suivre les envois)
grant select on public.email_outbox to authenticated;
drop policy if exists email_outbox_admin_read on public.email_outbox;
create policy email_outbox_admin_read on public.email_outbox for select to authenticated using (public.is_admin());
grant select, insert, update, delete on public.email_outbox to service_role;

-- 3) mettre un e-mail dans la file quand une commande arrive ou passe à « livrée »
--    (seulement si l'interrupteur est allumé ; une panne ici ne doit JAMAIS empêcher une commande)
create or replace function public.enqueue_order_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.user_id is null then return new; end if;
    if not coalesce((select order_emails_enabled from public.store_settings where id = 1), false) then return new; end if;
    if tg_op = 'INSERT' then
      insert into public.email_outbox (kind, order_id, user_id) values ('order_received', new.id, new.user_id) on conflict do nothing;
    elsif new.status = 'delivered' and old.status is distinct from 'delivered' then
      insert into public.email_outbox (kind, order_id, user_id) values ('order_delivered', new.id, new.user_id) on conflict do nothing;
    end if;
  exception when others then
    null;
  end;
  return new;
end; $$;
revoke all on function public.enqueue_order_email() from public, anon, authenticated;

drop trigger if exists orders_email_insert on public.orders;
create trigger orders_email_insert after insert on public.orders for each row execute function public.enqueue_order_email();
drop trigger if exists orders_email_status on public.orders;
create trigger orders_email_status after update of status on public.orders for each row execute function public.enqueue_order_email();

-- 3 bis) l'e-mail de bienvenue : à la création du compte (ou quand le compte reçoit sa vraie adresse dans les 10 premières minutes).
--        Jamais pour une fausse adresse de compte par téléphone, jamais pour un ancien compte, et une panne ici n'empêche jamais l'inscription.
create or replace function public.enqueue_welcome_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.email is null or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or lower(new.email) like '%@tel.albasseshopping.com' then return new; end if;
    if new.created_at < now() - interval '10 minutes' then return new; end if;
    if tg_op = 'UPDATE' and old.email is not distinct from new.email then return new; end if;
    if not coalesce((select order_emails_enabled from public.store_settings where id = 1), false) then return new; end if;
    insert into public.email_outbox (kind, user_id) values ('welcome', new.id) on conflict do nothing;
  exception when others then
    null;
  end;
  return new;
end; $$;
revoke all on function public.enqueue_welcome_email() from public, anon, authenticated;

drop trigger if exists profiles_welcome_email on public.profiles;
create trigger profiles_welcome_email after insert or update of email on public.profiles for each row execute function public.enqueue_welcome_email();

-- 4) le secret partagé entre la base et la fonction « brevo-email » (créé une seule fois dans le coffre-fort)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'email_cron_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'email_cron_secret');
  end if;
end $$;

-- la fonction (clé de service) relit le secret pour vérifier que l'appel vient bien de la base
create or replace function public.email_cron_secret()
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret' limit 1;
$$;
revoke all on function public.email_cron_secret() from public, anon, authenticated;
grant execute on function public.email_cron_secret() to service_role;

-- 5) chaque minute : s'il y a des e-mails en attente, la base appelle la fonction qui les envoie
create or replace function public.process_email_outbox()
returns void language plpgsql security definer set search_path = public as $$
declare sec text;
begin
  if not exists (select 1 from public.email_outbox where status in ('pending', 'sending')) then return; end if;
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'email_cron_secret' limit 1;
  if sec is null then return; end if;
  perform net.http_post(
    url := 'https://xtitsmmccpkelxfjyqyh.supabase.co/functions/v1/brevo-email',
    body := jsonb_build_object('action', 'drain'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', sec)
  );
end; $$;
revoke all on function public.process_email_outbox() from public, anon, authenticated;

select cron.unschedule('send-order-emails') where exists (select 1 from cron.job where jobname = 'send-order-emails');
select cron.schedule('send-order-emails', '* * * * *', 'select public.process_email_outbox()');
