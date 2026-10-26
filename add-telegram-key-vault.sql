-- Clé du bot Telegram : gardée dans le coffre-fort Supabase (vault), jamais dans le code des fonctions.
-- Ce script (sans danger à relancer) :
--   1. crée le mot de passe du lien Telegram (webhook) s'il n'existe pas encore, avec sa fonction de lecture ;
--   2. ajoute set_telegram_bot_token(), utilisée par la fonction « telegram-webhook » quand un administrateur envoie la NOUVELLE clé au bot
--      (voir docs/telegram-cle.md). Elle refuse tout ce qui n'a pas la forme d'une clé Telegram et la clé d'un autre bot.
-- Pas de nouvelle table : pas de « grant » de table à ajouter.

select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'telegram_webhook_secret',
  'Mot de passe du lien (webhook) Telegram'
)
where not exists (select 1 from vault.secrets where name = 'telegram_webhook_secret');

create or replace function public.telegram_webhook_secret()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'telegram_webhook_secret' limit 1;
$$;
revoke all on function public.telegram_webhook_secret() from public, anon, authenticated;
grant execute on function public.telegram_webhook_secret() to service_role;

create or replace function public.set_telegram_bot_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := regexp_replace(coalesce(p_token, ''), '\s', '', 'g');
  v_id uuid;
  v_old text;
begin
  if v_token !~ '^[0-9]{6,12}:[A-Za-z0-9_-]{30,}$' then
    raise exception 'clé Telegram invalide';
  end if;

  select id, decrypted_secret into v_id, v_old
  from vault.decrypted_secrets
  where name = 'telegram_bot_token'
  limit 1;

  -- même numéro de bot obligatoire (si l'ancienne clé a la forme d'une clé Telegram)
  if v_old ~ '^[0-9]{6,12}:' and split_part(v_old, ':', 1) <> split_part(v_token, ':', 1) then
    raise exception 'cette clé est celle d''un autre bot';
  end if;

  if v_id is null then
    perform vault.create_secret(v_token, 'telegram_bot_token', 'Clé du bot Telegram');
  else
    perform vault.update_secret(v_id, v_token);
  end if;
  return true;
end;
$$;
revoke all on function public.set_telegram_bot_token(text) from public, anon, authenticated;
grant execute on function public.set_telegram_bot_token(text) to service_role;

-- Petit journal du changement de clé (jamais le texte du message ni la clé : seulement la longueur et le résultat), pour comprendre
-- ce qui arrive quand une clé est envoyée au bot. Réservé au serveur : pas de droit pour les visiteurs.
create table if not exists public.telegram_key_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  chat_id bigint,
  text_length integer not null default 0,
  key_found boolean not null default false,
  outcome text
);
alter table public.telegram_key_events enable row level security;
revoke all on public.telegram_key_events from public, anon, authenticated;
grant select, insert, delete on public.telegram_key_events to service_role;
