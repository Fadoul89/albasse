-- Sécurité : le secret partagé des notifications (base -> fonctions send-product-push et send-web-push) et la clé privée VAPID
-- (notifications du navigateur) quittent le code et vont dans le coffre-fort de Supabase (vault), comme les secrets de Telegram
-- et des e-mails (email_cron_secret, telegram_webhook_secret). AUCUNE valeur n'est écrite dans ce fichier.
-- Relançable. Ordre : 1) ce script ; 2) déployer les fonctions supabase/functions/send-product-push et send-web-push.
--
-- La clé privée VAPID se range une seule fois, à la main, dans l'éditeur SQL (la valeur ne doit jamais aller dans le dépôt) :
--   select vault.create_secret('<clé privée VAPID>', 'vapid_private_key', 'Clé privée VAPID des notifications du navigateur');
-- Ne JAMAIS changer cette clé : les abonnements des navigateurs y sont liés (il faudrait que chaque client se réabonne).

-- 1) le secret du webhook : repris tel quel de la fonction actuelle (les appels déjà en route restent valables)
do $$
declare
  def text := pg_get_functiondef('public.push_notify_product_notification()'::regprocedure);
  s text;
begin
  if not exists (select 1 from vault.secrets where name = 'push_webhook_secret') then
    s := substring(def from '''x-webhook-secret'', ''([^'']+)''');
    if s is null then
      raise exception 'secret du webhook introuvable dans push_notify_product_notification (déjà déplacé ?)';
    end if;
    perform vault.create_secret(s, 'push_webhook_secret', 'Secret partagé base -> fonctions send-product-push et send-web-push');
  end if;
end $$;

-- 2) lecture par les fonctions serveur seulement (service_role) : jamais par le site
create or replace function public.push_webhook_secret()
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
$$;
revoke all on function public.push_webhook_secret() from public, anon, authenticated;
grant execute on function public.push_webhook_secret() to service_role;

create or replace function public.vapid_private_key()
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key' limit 1;
$$;
revoke all on function public.vapid_private_key() from public, anon, authenticated;
grant execute on function public.vapid_private_key() to service_role;
