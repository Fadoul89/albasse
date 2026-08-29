-- Signale automatiquement comme "fausse commande" toute commande encore
-- "en attente" (non payee, non en preparation) plus de 48h apres sa creation.
-- Reutilise le meme mecanisme que le signalement manuel (flag_fake_order) :
-- a la 3e commande signalee pour un meme client, son compte est banni.

create or replace function public.auto_flag_stale_orders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  stale record;
  new_count int;
  flagged_count int := 0;
begin
  for stale in
    select id, user_id from orders
    where status = 'pending'
      and not is_flagged_fake
      and created_at < now() - interval '48 hours'
  loop
    update orders set is_flagged_fake = true where id = stale.id;
    update profiles set fake_order_count = fake_order_count + 1 where id = stale.user_id
      returning fake_order_count into new_count;

    flagged_count := flagged_count + 1;

    if new_count >= 3 then
      update auth.users set banned_until = 'infinity' where id = stale.user_id;
      update profiles set banned = true where id = stale.user_id;
      insert into customer_sanctions (user_id, action, reason, admin_id)
      values (stale.user_id, 'ban', 'Automatique : 3 commandes signalées comme fausses (délai 48h dépassé)', null);
    end if;
  end loop;

  return flagged_count;
end;
$$;

-- Appelee depuis l'app (cote client connecte et cote admin) a chaque
-- ouverture de l'ecran des commandes : pas besoin de configuration
-- supplementaire pour que l'automatisation fonctionne.
grant execute on function public.auto_flag_stale_orders() to authenticated;

-- Optionnel : execution automatique toutes les heures via pg_cron, en plus
-- des appels depuis l'app, pour que le signalement se fasse meme si personne
-- n'ouvre l'app. Ignore silencieusement si l'extension pg_cron n'est pas
-- activee sur ce projet (Supabase > Database > Extensions > pg_cron).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'auto-flag-stale-orders') then
      perform cron.unschedule('auto-flag-stale-orders');
    end if;
    perform cron.schedule('auto-flag-stale-orders', '0 * * * *', 'select public.auto_flag_stale_orders();');
  end if;
end $$;
