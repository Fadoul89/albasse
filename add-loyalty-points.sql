-- Programme de fidelite : 1000 FCFA depenses = 1 point (donc 5000 FCFA = 5
-- points), credites automatiquement quand une commande passe au statut
-- "livree". Les points debloquent des paliers jusqu'a 100 points (Diamond).
alter table profiles add column if not exists loyalty_points integer not null default 0;

create or replace function public.award_loyalty_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    update profiles set loyalty_points = loyalty_points + floor(new.total / 1000)
    where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_delivered_award_points on orders;
create trigger on_order_delivered_award_points
  after update on orders
  for each row execute procedure public.award_loyalty_points();
