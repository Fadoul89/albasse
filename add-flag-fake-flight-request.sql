-- Permet a l'admin de signaler manuellement une demande de billet d'avion
-- comme "fausse" (non serieuse), avec le meme mecanisme de sanction que le
-- signalement des fausses commandes : a la 3e signalee (commande OU demande
-- de voyage), le compte du client est banni automatiquement.
alter table flight_requests add column if not exists is_flagged_fake boolean not null default false;

create or replace function public.flag_fake_flight_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  new_count int;
begin
  if not public.is_admin() then
    raise exception 'Non autorise';
  end if;

  select user_id into target_user_id from flight_requests
    where id = target_request_id and not is_flagged_fake;
  if target_user_id is null then
    return;
  end if;

  update flight_requests set is_flagged_fake = true where id = target_request_id;
  update profiles set fake_order_count = fake_order_count + 1 where id = target_user_id
    returning fake_order_count into new_count;

  if new_count >= 3 then
    update auth.users set banned_until = 'infinity' where id = target_user_id;
    update profiles set banned = true where id = target_user_id;
    insert into customer_sanctions (user_id, action, reason, admin_id)
    values (target_user_id, 'ban', 'Automatique : 3 signalements (commandes et/ou demandes de voyage) comme faux', auth.uid());
  end if;
end;
$$;

grant execute on function public.flag_fake_flight_request(uuid) to authenticated;
