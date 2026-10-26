-- Facture PDF sur le Telegram des administrateurs à chaque nouvelle commande (en plus de l'alerte texte « 🛒 Nouvelle commande », qui ne change pas).
--
-- À lancer une fois dans Supabase › SQL Editor APRÈS avoir déployé la fonction « order-invoice » (dossier supabase/functions/order-invoice).
-- Sans danger à relancer. Aucune nouvelle table : pas de « grant » à ajouter. Une commande n'échoue JAMAIS à cause de la facture.
--
-- Ce que fait le script :
--   1. le secret partagé entre la base et les fonctions serveur (le même que pour les e-mails et le rapport de Zara : déjà là, sinon créé ici) ;
--   2. zara_report_credentials() : le code du bot Telegram (relu dans le coffre-fort, jamais écrit ici) et les administrateurs liés à Telegram.
--      Réservée à la fonction serveur (service_role). Déjà là si add-zara-weekly-poster.sql est lancé : elle est simplement remise à l'identique ;
--   3. send_order_invoice_telegram() + le déclencheur « on_order_created_invoice_telegram » : après chaque commande, la base appelle la fonction
--      « order-invoice », qui dessine la facture en PDF et l'envoie en document sur Telegram (le client, lui, la télécharge sur le site).

-- 1. le secret partagé
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'email_cron_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'email_cron_secret');
  end if;
end $$;

create or replace function public.email_cron_secret()
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret' limit 1;
$$;
revoke all on function public.email_cron_secret() from public, anon, authenticated;
grant execute on function public.email_cron_secret() to service_role;

-- 2. le bot Telegram et les administrateurs à prévenir
create or replace function public.zara_report_credentials()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'token', (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1),
    'chat_ids', coalesce((select jsonb_agg(telegram_chat_id) from public.profiles where is_admin and telegram_chat_id is not null), '[]'::jsonb)
  );
$$;
revoke all on function public.zara_report_credentials() from public, anon, authenticated;
grant execute on function public.zara_report_credentials() to service_role;

-- 3. la facture après chaque commande (l'appel part APRÈS l'enregistrement de la commande : la fonction la relit dans la base)
create or replace function public.send_order_invoice_telegram()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sec text;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'email_cron_secret' limit 1;
  if sec is null then
    return new;
  end if;
  perform net.http_post(
    url := 'https://xtitsmmccpkelxfjyqyh.supabase.co/functions/v1/order-invoice',
    body := jsonb_build_object('action', 'telegram', 'order_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', sec),
    timeout_milliseconds := 60000
  );
  return new;
exception when others then
  return new; -- la commande est toujours enregistrée, même si la facture ne part pas
end;
$$;
revoke all on function public.send_order_invoice_telegram() from public, anon, authenticated;

drop trigger if exists on_order_created_invoice_telegram on public.orders;
create trigger on_order_created_invoice_telegram
  after insert on public.orders
  for each row execute function public.send_order_invoice_telegram();

-- POUR ARRÊTER L'ENVOI DES FACTURES SUR TELEGRAM (l'alerte texte et le téléchargement par le client continuent) :
--   drop trigger if exists on_order_created_invoice_telegram on public.orders;
