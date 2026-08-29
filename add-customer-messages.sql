-- Messagerie Admin -> Client : l'admin envoie un message a un client precis
-- (depuis sa fiche) ou a tous les clients d'un coup (diffusion), visible dans
-- le compte du client concerne.
create table if not exists customer_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  admin_id uuid references profiles(id),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_messages_user_idx on customer_messages(user_id, created_at desc);

alter table customer_messages enable row level security;
create policy "customer_messages_own_read" on customer_messages for select using (
  auth.uid() = user_id or public.is_admin()
);
create policy "customer_messages_own_update" on customer_messages for update using (
  auth.uid() = user_id
) with check (auth.uid() = user_id);
create policy "customer_messages_admin_write" on customer_messages for insert with check (
  public.is_admin()
);
create policy "customer_messages_admin_delete" on customer_messages for delete using (
  public.is_admin()
);
