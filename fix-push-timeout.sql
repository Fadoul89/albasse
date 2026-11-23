-- send-web-push / send-product-push prennent reellement 6 a 12s (signature VAPID + envoi
-- a chaque abonne), mais le declencheur push_notify_product_notification() ne laissait que
-- 5000ms a pg_net avant d'abandonner. Chaque envoi reussissait pourtant cote fonction (200,
-- "sent"), mais Postgres l'enregistrait quand meme comme une erreur de timeout (net._http_response),
-- rendant le systeme illisible a surveiller (tout a l'air casse dans les logs alors que ca marche).
--
-- On laisse plus de marge (15s) sans rien changer d'autre : l'appel reste non bloquant (pg_net).
create or replace function public.push_notify_product_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1);
begin
  if secret is null then
    return new;
  end if;
  perform net.http_post(
    url := 'https://xtitsmmccpkelxfjyqyh.supabase.co/functions/v1/send-product-push',
    body := jsonb_build_object('title', new.title, 'message', new.message),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    timeout_milliseconds := 15000
  );
  perform net.http_post(
    url := 'https://xtitsmmccpkelxfjyqyh.supabase.co/functions/v1/send-web-push',
    body := jsonb_build_object('title', new.title, 'message', new.message, 'product_id', new.product_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    timeout_milliseconds := 15000
  );
  return new;
end;
$function$;
