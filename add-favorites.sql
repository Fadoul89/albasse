-- Migration : Favoris (❤️)
-- A executer dans Supabase SQL Editor.

create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists favorites_user_idx on favorites(user_id);

alter table favorites enable row level security;
drop policy if exists "favorites_own_all" on favorites;
create policy "favorites_own_all" on favorites for all using (
  auth.uid() = user_id
) with check (auth.uid() = user_id);
