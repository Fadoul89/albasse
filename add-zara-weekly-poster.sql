-- Rapport de Zara chaque lundi à 8 h (heure de N'Djamena) : maintenant en AFFICHE PHOTO (2 images) sur le Telegram des administrateurs,
-- à la place du texte (le texte reste le repli si l'image ne peut pas être dessinée).
--
-- À lancer une fois dans Supabase › SQL Editor APRÈS avoir déployé la fonction « zara-report-poster » (dossier supabase/functions/zara-report-poster).
-- Sans danger à relancer. Aucune nouvelle table : pas de « grant » à ajouter, seulement le droit « service_role » sur deux fonctions.
--
-- Ce que fait le script :
--   1. zara_weekly_report_data()  : les chiffres de la semaine passée (lundi à dimanche) en un seul bloc : articles les plus regardés (avec leur photo),
--                                   mots les plus cherchés, top 3 de chaque jour. Réservée à la fonction serveur (service_role).
--   2. zara_report_credentials()  : le code du bot Telegram (relu dans le coffre-fort, jamais écrit ici) et les administrateurs liés à Telegram.
--                                   Réservée à la fonction serveur (service_role).
--   3. zara_send_weekly_report()  : chaque lundi à 8 h, la base appelle la fonction « zara-report-poster » avec le secret partagé du coffre-fort
--                                   (le même que pour les e-mails). S'il n'y a pas de secret, elle envoie le texte comme avant.
-- Le planificateur du lundi (cron « zara-weekly-report ») ne change pas.

-- le secret partagé entre la base et les fonctions serveur (créé une seule fois ; déjà là si les e-mails automatiques sont installés)
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

-- 1. les chiffres de la semaine
create or replace function public.zara_weekly_report_data()
returns jsonb language sql stable security definer set search_path = public as $$
with d as (
  select ((now() at time zone 'Africa/Ndjamena')::date - 7) d0, ((now() at time zone 'Africa/Ndjamena')::date - 1) d1
),
pv as (
  select (v.viewed_at at time zone 'Africa/Ndjamena')::date as day, regexp_replace(trim(p.name), '\s+', ' ', 'g') as name, p.images[1] as image
  from product_views v join products p on p.id = v.product_id, d
  where (v.viewed_at at time zone 'Africa/Ndjamena')::date between d.d0 and d.d1
),
wk as (select row_number() over (order by count(*) desc, name) rn, name, max(image) image, count(*) n from pv group by name),
dr as (select day, name, row_number() over (partition by day order by count(*) desc, name) rk from pv group by day, name),
dl as (select day, jsonb_agg(name order by rk) names from dr where rk <= 3 group by day),
sr as (
  select row_number() over (order by count(*) desc, lower(trim(query))) rn, lower(trim(query)) q, count(*) n
  from browsing_searches, d
  where (searched_at at time zone 'Africa/Ndjamena')::date between d.d0 and d.d1 and length(trim(query)) >= 2
  group by 2
)
select jsonb_build_object(
  'd0', (select d0 from d), 'd1', (select d1 from d),
  'products', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'views', n, 'image', image) order by rn) from wk where rn <= 3), '[]'::jsonb),
  'searches', coalesce((select jsonb_agg(jsonb_build_object('q', q, 'n', n) order by rn) from sr where rn <= 5), '[]'::jsonb),
  'days', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'names', names) order by day) from dl), '[]'::jsonb)
);
$$;
revoke all on function public.zara_weekly_report_data() from public, anon, authenticated;
grant execute on function public.zara_weekly_report_data() to service_role;

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

-- 3. l'envoi du lundi : la fonction serveur dessine et envoie l'affiche (repli : le texte)
create or replace function public.zara_send_weekly_report()
returns void language plpgsql security definer set search_path = public as $$
declare tok text; sec text; r record; txt text;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'email_cron_secret' limit 1;
  if sec is not null then
    perform net.http_post(
      url := 'https://xtitsmmccpkelxfjyqyh.supabase.co/functions/v1/zara-report-poster',
      body := jsonb_build_object('action', 'weekly'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', sec),
      timeout_milliseconds := 60000
    );
    return;
  end if;
  -- pas de secret : le texte, comme avant
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if tok is null then return; end if;
  txt := public.zara_weekly_report_text();
  for r in select telegram_chat_id from public.profiles where is_admin and telegram_chat_id is not null loop
    perform net.http_post(url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
      body := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', txt));
  end loop;
end; $$;
revoke all on function public.zara_send_weekly_report() from public, anon, authenticated;

-- le planificateur du lundi 8 h (07:00 UTC) existe déjà ; on le remet au cas où
select cron.unschedule('zara-weekly-report') where exists (select 1 from cron.job where jobname = 'zara-weekly-report');
select cron.schedule('zara-weekly-report', '0 7 * * 1', 'select public.zara_send_weekly_report()');

-- POUR REVENIR AU TEXTE SEUL : relancer add-zara-weekly-report.sql.
