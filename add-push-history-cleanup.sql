-- Historique des notifications push programmées (Admin › Promotions intelligentes) : effacement automatique 24 heures après.
--
-- Avant : une notification envoyée, annulée ou « pas envoyée » restait dans l'historique pour toujours (les 20 dernières s'affichaient).
-- Maintenant : chaque ligne de l'historique est effacée toute seule 24 h après le moment où elle est devenue « envoyée »,
-- « annulée » ou « pas envoyée ». Les notifications « programmées » (à venir) ne sont jamais touchées.
--
-- Comment : une nouvelle colonne « status_changed_at » note le moment du dernier changement d'état (un déclencheur la met à jour
-- tout seul, y compris quand le minuteur envoie la notification ou la marque « pas envoyée »). Un minuteur de Supabase (pg_cron)
-- efface les lignes finies depuis plus de 24 h, toutes les 10 minutes.
-- Les lignes déjà dans l'historique : « envoyée » = depuis son envoi ; « annulée » ou « pas envoyée » = depuis sa création
-- (la base n'a pas gardé le moment exact de l'annulation) ; les plus anciennes disparaissent donc au premier passage du minuteur.
--
-- Attention : le nombre de clics d'une notification est gardé sur sa ligne : il disparaît avec elle, 24 h après l'envoi.
-- Un clic qui arrive plus tard n'est plus compté (la notification n'existe plus).
--
-- À lancer UNE FOIS dans Supabase › SQL Editor (après add-scheduled-push.sql, qui installe déjà pg_cron et la table). Sans danger si on le relance.
-- Aucune nouvelle table : pas de « grant » à ajouter (une colonne en plus sur « scheduled_pushes », même accès que les autres).

alter table public.scheduled_pushes add column if not exists status_changed_at timestamptz;

-- Les lignes qui existent déjà : envoyée = depuis son envoi ; les autres = depuis leur création
update public.scheduled_pushes
   set status_changed_at = coalesce(sent_at, created_at)
 where status_changed_at is null;

alter table public.scheduled_pushes alter column status_changed_at set default now();
alter table public.scheduled_pushes alter column status_changed_at set not null;

-- Le moment du dernier changement d'état se met à jour tout seul (création, envoi, annulation, « pas envoyée »)
create or replace function public.scheduled_pushes_touch_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists scheduled_pushes_touch_status on public.scheduled_pushes;
create trigger scheduled_pushes_touch_status
  before insert or update of status on public.scheduled_pushes
  for each row execute function public.scheduled_pushes_touch_status();

-- Efface l'historique fini depuis plus de 24 h (jamais les notifications « programmées »). Renvoie le nombre de lignes effacées.
create or replace function public.purge_old_scheduled_pushes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.scheduled_pushes
   where status in ('sent', 'cancelled', 'expired')
     and status_changed_at < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.purge_old_scheduled_pushes() from public, anon, authenticated;

-- toutes les 10 minutes
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-old-scheduled-pushes') then
    perform cron.unschedule('purge-old-scheduled-pushes');
  end if;
  perform cron.schedule('purge-old-scheduled-pushes', '*/10 * * * *', 'select public.purge_old_scheduled_pushes()');
end $$;
