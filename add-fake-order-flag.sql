-- Permet a l'admin de signaler une commande comme "fausse" (non honoree).
-- A la 3e commande signalee pour un meme client, son compte est banni
-- automatiquement (meme mecanisme que le bannissement manuel existant).
alter table orders add column if not exists is_flagged_fake boolean not null default false;
alter table profiles add column if not exists fake_order_count int not null default 0;

create or replace function public.flag_fake_order(target_order_id uuid)
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

  select user_id into target_user_id from orders where id = target_order_id and not is_flagged_fake;
  if target_user_id is null then
    return;
  end if;

  update orders set is_flagged_fake = true where id = target_order_id;
  update profiles set fake_order_count = fake_order_count + 1 where id = target_user_id
    returning fake_order_count into new_count;

  if new_count >= 3 then
    update auth.users set banned_until = 'infinity' where id = target_user_id;
    update profiles set banned = true where id = target_user_id;
    insert into customer_sanctions (user_id, action, reason, admin_id)
    values (target_user_id, 'ban', 'Automatique : 3 commandes signalées comme fausses', auth.uid());
  end if;
end;
$$;

grant execute on function public.flag_fake_order(uuid) to authenticated;
