-- Alerte Telegram à l'administrateur à chaque nouvelle commande, même quand le site et l'application sont fermés.
-- Le message part du serveur (Supabase) vers le bot Telegram d'Albasse, seulement vers les comptes administrateurs
-- qui ont lié Telegram (Compte › Lier Telegram). Le son se choisit dans Telegram (son personnalisé pour ce bot).
--
-- AVANT DE LANCER : remplacez COLLEZ_LE_TOKEN_ICI par le token du bot Telegram
-- (Supabase › Edge Functions › telegram-broadcast › Code : la valeur entre guillemets de TELEGRAM_BOT_TOKEN).
-- Sans danger à relancer. Une commande n'échoue jamais à cause de l'alerte.
create or replace function public.telegram_notify_admin_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tok constant text := 'COLLEZ_LE_TOKEN_ICI';
  r record;
  articles text;
  txt text;
begin
  select string_agg('• ' || coalesce(i->>'product_name', 'Article') || ' × ' || coalesce(i->>'quantity', '1'), E'\n')
    into articles
    from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) i;
  txt := '🛒 Nouvelle commande' || E'\n'
      || coalesce(new.shipping_name, '') || ' · ' || coalesce(new.shipping_phone, '') || E'\n'
      || coalesce(new.shipping_city, '') || E'\n'
      || coalesce(articles || E'\n', '')
      || '💰 ' || replace(to_char(new.total, 'FM999,999,999'), ',', ' ') || ' FCFA';
  for r in select telegram_chat_id from public.profiles where is_admin and telegram_chat_id is not null loop
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
      body := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', txt)
    );
  end loop;
  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.telegram_notify_admin_new_order() from public, anon, authenticated;

drop trigger if exists on_order_created_telegram_admin on public.orders;
create trigger on_order_created_telegram_admin
  after insert on public.orders
  for each row execute function public.telegram_notify_admin_new_order();

-- message d'essai tout de suite, pour vérifier que l'alerte arrive bien sur Telegram
do $$
declare
  tok text := substring(pg_get_functiondef('public.telegram_notify_admin_new_order()'::regprocedure) from 'tok constant text := ''([^'']+)''');
  r record;
begin
  for r in select telegram_chat_id from public.profiles where is_admin and telegram_chat_id is not null loop
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
      body := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', '✅ Alertes de commandes activées : vous recevrez un message ici à chaque nouvelle commande.')
    );
  end loop;
end;
$$;
