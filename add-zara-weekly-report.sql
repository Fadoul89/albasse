-- Rapport de Zara chaque lundi à 8 h (heure de N'Djamena) sur le Telegram des administrateurs :
-- les 3 articles les plus regardés de la semaine, les 3 mots les plus cherchés, et le top 3 de chaque jour.
-- Le token du bot est lu dans le coffre-fort Supabase (vault, nom « telegram_bot_token »), jamais écrit ici.
-- À lancer une fois dans Supabase › SQL Editor. Un rapport d'essai part tout de suite à la fin.

create or replace function public.zara_weekly_report_text()
returns text language sql stable security definer set search_path = public as $$
with d as (
  select ((now() at time zone 'Africa/Ndjamena')::date - 7) d0, ((now() at time zone 'Africa/Ndjamena')::date - 1) d1
),
pv as (
  select (v.viewed_at at time zone 'Africa/Ndjamena')::date as day, regexp_replace(trim(p.name), '\s+', ' ', 'g') as name
  from product_views v join products p on p.id = v.product_id, d
  where (v.viewed_at at time zone 'Africa/Ndjamena')::date between d.d0 and d.d1
),
wk as (select row_number() over (order by count(*) desc, name) rn, name, count(*) n from pv group by name),
dr as (select day, name, row_number() over (partition by day order by count(*) desc, name) rk from pv group by day, name),
dl as (select day, string_agg(name, ', ' order by rk) names from dr where rk <= 3 group by day),
sr as (
  select row_number() over (order by count(*) desc, lower(trim(query))) rn, lower(trim(query)) q, count(*) n
  from browsing_searches, d
  where (searched_at at time zone 'Africa/Ndjamena')::date between d.d0 and d.d1 and length(trim(query)) >= 2
  group by 2
)
select '📊 Rapport de Zara — semaine du ' || to_char(d0, 'DD/MM') || ' au ' || to_char(d1, 'DD/MM')
  || E'\n\n🏆 Articles les plus regardés de la semaine :\n'
  || coalesce((select string_agg(rn || '. ' || name || ' — ' || n || ' vues', E'\n' order by rn) from wk where rn <= 3), 'Aucune visite')
  || E'\n\n🔎 Mots les plus cherchés de la semaine :\n'
  || coalesce((select string_agg('« ' || q || ' » (' || n || ')', ', ' order by rn) from sr where rn <= 3), 'Aucune recherche')
  || E'\n\n📅 Top 3 par jour :\n'
  || coalesce((select string_agg((array['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'])[extract(isodow from day)::int]
       || ' ' || to_char(day, 'DD/MM') || ' : ' || names, E'\n' order by day) from dl), '—')
from d;
$$;

create or replace function public.zara_send_weekly_report()
returns void language plpgsql security definer set search_path = public as $$
declare tok text; r record; txt text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if tok is null then return; end if;
  txt := public.zara_weekly_report_text();
  for r in select telegram_chat_id from public.profiles where is_admin and telegram_chat_id is not null loop
    perform net.http_post(url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
      body := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', txt));
  end loop;
end; $$;

revoke all on function public.zara_weekly_report_text() from public, anon, authenticated;
revoke all on function public.zara_send_weekly_report() from public, anon, authenticated;

-- chaque lundi à 07:00 UTC = 08:00 à N'Djamena
select cron.unschedule('zara-weekly-report') where exists (select 1 from cron.job where jobname = 'zara-weekly-report');
select cron.schedule('zara-weekly-report', '0 7 * * 1', 'select public.zara_send_weekly_report()');

-- rapport d'essai tout de suite
select public.zara_send_weekly_report();
