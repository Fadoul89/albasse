-- Notifications push programmées (page administrateur « Promotions intelligentes »).
--
-- L'administrateur choisit un article, écrit un message court et choisit le jour et l'heure (heure du Tchad).
-- À l'heure dite, la notification part vers tous les téléphones abonnés aux notifications : la ligne est ajoutée
-- dans product_notifications, et le déclencheur déjà en place (push_on_product_notification) l'envoie par
-- send-web-push / send-product-push, avec la photo et le lien de l'article. On peut en programmer autant qu'on veut.
--
-- Un minuteur de Supabase (pg_cron) regarde toutes les minutes s'il y a des notifications à envoyer.
-- Une notification en retard de plus de 6 heures (panne) n'est pas envoyée : elle passe en « expirée ».
-- Sans danger à relancer.

create extension if not exists pg_cron;

create table if not exists public.scheduled_pushes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  message text not null check (char_length(message) between 1 and 160),
  send_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'expired', 'cancelled')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_pushes_due_idx on public.scheduled_pushes (send_at) where status = 'pending';
create index if not exists scheduled_pushes_send_at_idx on public.scheduled_pushes (send_at desc);

-- Réservé aux administrateurs (lire, programmer, annuler, avancer à « maintenant »).
alter table public.scheduled_pushes enable row level security;
drop policy if exists "scheduled_pushes_admin_all" on public.scheduled_pushes;
create policy "scheduled_pushes_admin_all" on public.scheduled_pushes
  for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.scheduled_pushes from anon;
grant select, insert, update, delete on public.scheduled_pushes to authenticated;

-- Envoie les notifications arrivées à leur heure (20 au plus par minute).
create or replace function public.run_scheduled_pushes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  update scheduled_pushes set status = 'expired'
    where status = 'pending' and send_at < now() - interval '6 hours';
  for r in
    select * from scheduled_pushes
    where status = 'pending' and send_at <= now()
    order by send_at
    limit 20
    for update skip locked
  loop
    insert into product_notifications (product_id, title, message) values (r.product_id, r.title, r.message);
    update scheduled_pushes set status = 'sent', sent_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.run_scheduled_pushes() from public, anon, authenticated;

-- Le minuteur : toutes les minutes (remplacé s'il existe déjà).
select cron.unschedule(jobid) from cron.job where jobname = 'albasse-scheduled-pushes';
select cron.schedule('albasse-scheduled-pushes', '* * * * *', 'select public.run_scheduled_pushes()');
