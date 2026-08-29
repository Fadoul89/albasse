-- Corrige un bug : conflit de nom entre la colonne is_lose de la table
-- wheel_prizes et un parametre de sortie de la fonction (erreur 'reference
-- ambigue'). A executer pour remplacer la fonction existante.

drop function if exists public.spin_wheel();

create or replace function public.spin_wheel()
returns table (out_label text, out_icon text, out_is_lose boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_count int;
  next_milestone int;
  weekly_key int;
  total_weight int;
  r numeric;
  running int := 0;
  chosen wheel_prizes%rowtype;
  lose_prize wheel_prizes%rowtype;
begin
  select count(*) into completed_count from orders where user_id = auth.uid() and status = 'delivered';
  select coalesce(max(milestone), 0) + 1 into next_milestone from wheel_spins where user_id = auth.uid() and milestone > 0;

  if completed_count >= next_milestone * 5 then
    if (next_milestone * 5) % 10 = 0 then
      -- Palier 10, 20, 30... : lot garanti (parfum)
      select * into chosen from wheel_prizes wp where wp.is_grand_prize and wp.is_active order by wp.sort_order limit 1;
      if chosen.id is null then
        raise exception 'Aucun grand lot configure';
      end if;
      insert into wheel_spins (user_id, milestone, prize_id, prize_label)
      values (auth.uid(), next_milestone, chosen.id, chosen.label);
      return query select chosen.label, chosen.icon, false;
      return;
    end if;

    -- Palier 5, 15, 25... : tirage pondere parmi les petits lots
    select sum(wp.weight) into total_weight from wheel_prizes wp where wp.is_active and not wp.is_grand_prize and not wp.is_lose;
    if total_weight is null or total_weight <= 0 then
      raise exception 'Aucun lot configure';
    end if;

    r := random() * total_weight;

    for chosen in select * from wheel_prizes wp where wp.is_active and not wp.is_grand_prize and not wp.is_lose order by wp.sort_order loop
      running := running + chosen.weight;
      if r <= running then
        insert into wheel_spins (user_id, milestone, prize_id, prize_label)
        values (auth.uid(), next_milestone, chosen.id, chosen.label);
        return query select chosen.label, chosen.icon, false;
        return;
      end if;
    end loop;
  end if;

  -- Pas de palier disponible : tour de consolation, une fois par semaine
  -- civile, toujours perdant (namespace negatif pour ne jamais entrer en
  -- collision avec un vrai palier, qui est toujours positif).
  weekly_key := -1 * (extract(isoyear from now())::int * 100 + extract(week from now())::int);

  if exists (select 1 from wheel_spins where user_id = auth.uid() and milestone = weekly_key) then
    raise exception 'Vous avez deja joue cette semaine. Revenez la semaine prochaine !';
  end if;

  select * into lose_prize from wheel_prizes wp where wp.is_lose and wp.is_active order by wp.sort_order limit 1;
  insert into wheel_spins (user_id, milestone, prize_id, prize_label)
  values (auth.uid(), weekly_key, lose_prize.id, coalesce(lose_prize.label, 'Perdu'));
  return query select coalesce(lose_prize.label, 'Perdu'), coalesce(lose_prize.icon, '❌'), true;
end;
$$;

grant execute on function public.spin_wheel() to authenticated;
