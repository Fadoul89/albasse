-- Sécurité : le déclencheur des notifications lit le secret du webhook dans le coffre-fort (au lieu de l'avoir écrit dans son code).
-- À lancer APRÈS add-push-secrets-vault.sql. Relançable. Même comportement qu'avant (mêmes adresses, mêmes données envoyées).
-- Si le secret manquait, la notification n'est pas envoyée mais l'enregistrement se fait quand même (jamais d'erreur pour l'admin).
create or replace function public.push_notify_product_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
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
    timeout_milliseconds := 5000
  );
  perform net.http_post(
    url := 'https://xtitsmmccpkelxfjyqyh.supabase.co/functions/v1/send-web-push',
    body := jsonb_build_object('title', new.title, 'message', new.message, 'product_id', new.product_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    timeout_milliseconds := 5000
  );
  return new;
end;
$function$;
