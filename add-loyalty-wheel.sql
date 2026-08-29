-- ========== ROUE DE LA CHANCE (jeu fidelite) ==========
-- Un tour est gagne tous les 5 commandes livrees. Les lots et leur poids
-- (probabilite relative) sont configurables par l'admin.
create table if not exists wheel_prizes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  icon text not null default '🎁',
  weight int not null default 10,
  is_lose boolean not null default false,
  is_grand_prize boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists wheel_prizes_sort_idx on wheel_prizes(sort_order);

-- Palier 5 commandes livrees : tirage parmi les petits lots (grand_prize=false).
-- Palier 10 commandes livrees (multiple de 10) : lot garanti (grand_prize=true).
-- Montre et bague desactivees pour l'instant (l'admin peut les reactiver).
insert into wheel_prizes (label, icon, weight, is_lose, is_grand_prize, is_active, sort_order) values
  ('Chaussettes', '🧦', 25, false, false, true, 1),
  ('Parfum Hersh Lahab', '👑', 1, false, true, true, 2),
  ('Montre dorée', '⌚', 4, false, false, true, 3),
  ('T-shirt', '👕', 25, false, false, true, 4),
  ('Bague', '💍', 3, false, false, true, 5),
  ('Perdu', '❌', 1, true, false, true, 6),
  ('Stylo', '🖊️', 25, false, false, true, 7),
  ('Débardeur', '🎽', 25, false, false, true, 8)
on conflict do nothing;

-- Un tour enregistre par palier de 5 commandes livrees atteint (unique par
-- palier : impossible de reutiliser un meme palier deux fois).
create table if not exists wheel_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  milestone int not null,
  prize_id uuid references wheel_prizes(id),
  prize_label text not null,
  created_at timestamptz not null default now(),
  unique (user_id, milestone)
);

create index if not exists wheel_spins_user_idx on wheel_spins(user_id, created_at desc);

-- Tire un lot au hasard (pondere) et enregistre le tour, apres verification
-- que le client a bien un tour disponible (5 commandes livrees non encore
-- utilisees pour un tour). SECURITY DEFINER : le tirage doit etre fiable et
-- non manipulable depuis le client.
create or replace function public.spin_wheel()
returns table (prize_label text, prize_icon text, is_lose boolean)
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
  chosen record;
  lose_prize record;
begin
  select count(*) into completed_count from orders where user_id = auth.uid() and status = 'delivered';
  select coalesce(max(milestone), 0) + 1 into next_milestone from wheel_spins where user_id = auth.uid() and milestone > 0;

  if completed_count >= next_milestone * 5 then
    if (next_milestone * 5) % 10 = 0 then
      -- Palier 10, 20, 30... : lot garanti (parfum)
      select id, label, icon into chosen from wheel_prizes where is_grand_prize and is_active order by sort_order limit 1;
      if chosen.id is null then
        raise exception 'Aucun grand lot configure';
      end if;
      insert into wheel_spins (user_id, milestone, prize_id, prize_label)
      values (auth.uid(), next_milestone, chosen.id, chosen.label);
      return query select chosen.label, chosen.icon, false;
      return;
    end if;

    -- Palier 5, 15, 25... : tirage pondere parmi les petits lots
    select sum(weight) into total_weight from wheel_prizes where is_active and not is_grand_prize and not is_lose;
    if total_weight is null or total_weight <= 0 then
      raise exception 'Aucun lot configure';
    end if;

    r := random() * total_weight;

    for chosen in select * from wheel_prizes where is_active and not is_grand_prize and not is_lose order by sort_order loop
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

  select id, label, icon into lose_prize from wheel_prizes where is_lose and is_active order by sort_order limit 1;
  insert into wheel_spins (user_id, milestone, prize_id, prize_label)
  values (auth.uid(), weekly_key, lose_prize.id, coalesce(lose_prize.label, 'Perdu'));
  return query select coalesce(lose_prize.label, 'Perdu'), coalesce(lose_prize.icon, '❌'), true;
end;
$$;

grant execute on function public.spin_wheel() to authenticated;

alter table wheel_prizes enable row level security;
create policy "wheel_prizes_public_read" on wheel_prizes for select using (true);
create policy "wheel_prizes_admin_write" on wheel_prizes for all using (
  public.is_admin()
) with check (public.is_admin());

alter table wheel_spins enable row level security;
create policy "wheel_spins_own_read" on wheel_spins for select using (
  auth.uid() = user_id or public.is_admin()
);
