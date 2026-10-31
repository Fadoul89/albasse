-- Gardien des notifications push : « Zara décide » de l'heure, et jamais plusieurs notifications en même temps.
--
-- Avant : chaque ligne ajoutée dans product_notifications envoyait tout de suite une notification à tous les téléphones abonnés.
-- Les nouveaux articles, les ventes flash (plusieurs articles à la même minute !) et les notifications programmées partaient donc sans limite
-- (jusqu'à 28 par jour). Cela dérange les clients.
--
-- Maintenant, les notifications AUTOMATIQUES (nouvel article, promotion) attendent dans une file (push_outbox) et un gardien, qui passe
-- chaque minute, en envoie UNE seule quand toutes ces règles sont vraies :
--   * l'écart minimum depuis la dernière notification est respecté (3 h par défaut) ;
--   * le plafond du jour n'est pas atteint (2 notifications automatiques par jour par défaut) ;
--   * l'heure est dans la fenêtre d'envoi (de 9 h à 20 h, heure du Tchad, par défaut) ;
--   * c'est une heure où le site est très fréquenté : Zara regarde les 30 derniers jours de visites et ne garde que les heures
--     au-dessus de la moyenne de la fenêtre (avec moins de 100 regards, toutes les heures de la fenêtre sont bonnes).
-- Plusieurs notifications du même genre en attente (ex. 4 ventes flash) sont REGROUPÉES en une seule, qui présente l'article le plus regardé.
-- Un article épuisé, désactivé, ou une promotion terminée n'est jamais annoncé. Une notification qui attend depuis plus de 24 h est abandonnée.
--
-- Les notifications PROGRAMMÉES par l'administrateur (page « Promotions intelligentes ») gardent l'heure qu'il a choisie (pas de fenêtre ni de
-- plafond), mais respectent l'écart minimum : jamais deux en même temps. Elles passent avant les automatiques.
--
-- Les notifications de NOUVEAUX ARTICLES sont éteintes par défaut (store_settings.push_new_products_enabled = false, voir aussi
-- add-push-new-products-switch.sql) : publier un article n'envoie rien tant que le patron ne rallume pas cet interrupteur.
--
-- Interrupteur et réglages : store_settings.push_gate_enabled (true = gardien actif ; false = comme avant, tout part tout de suite),
-- push_min_gap_minutes, push_max_per_day, push_window_start, push_window_end.
-- À lancer après add-scheduled-push.sql et add-push-clicks.sql. Sans danger à relancer.
--
-- Pour annuler : update store_settings set push_gate_enabled = false where id = 1; (le gardien envoie alors tout ce qui attend, comme avant).

-- 1. Réglages
alter table public.store_settings add column if not exists push_gate_enabled boolean not null default true;
alter table public.store_settings add column if not exists push_min_gap_minutes integer not null default 180;
alter table public.store_settings add column if not exists push_max_per_day integer not null default 2;
alter table public.store_settings add column if not exists push_window_start integer not null default 9;
alter table public.store_settings add column if not exists push_window_end integer not null default 20;
alter table public.store_settings add column if not exists push_new_products_enabled boolean not null default false;

-- 2. La file d'attente (lecture réservée aux administrateurs ; l'écriture se fait par les fonctions ci-dessous)
create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('new', 'promo')),
  title text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'merged', 'expired')),
  note text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists push_outbox_pending_idx on public.push_outbox (kind, created_at) where status = 'pending';

alter table public.push_outbox enable row level security;
drop policy if exists "push_outbox_admin_read" on public.push_outbox;
create policy "push_outbox_admin_read" on public.push_outbox for select using (public.is_admin());
revoke all on public.push_outbox from anon;
revoke all on public.push_outbox from authenticated;
grant select on public.push_outbox to authenticated;

-- 3. Mettre une notification dans la file (ou l'envoyer tout de suite si le gardien est éteint)
create or replace function public.push_enqueue(p_product uuid, p_kind text, p_title text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gate_on boolean;
begin
  select push_gate_enabled into gate_on from store_settings where id = 1;
  if coalesce(gate_on, true) then
    -- la même annonce n'attend pas deux fois
    if not exists (select 1 from push_outbox where status = 'pending' and kind = p_kind and product_id = p_product) then
      insert into push_outbox (product_id, kind, title, message) values (p_product, p_kind, p_title, p_message);
    end if;
  else
    insert into product_notifications (product_id, title, message) values (p_product, p_title, p_message);
  end if;
end;
$$;

revoke all on function public.push_enqueue(uuid, text, text, text) from public, anon, authenticated;

-- Les deux producteurs automatiques passent maintenant par la file (le reste de leur comportement est inchangé).
create or replace function public.notify_new_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_on boolean;
begin
  if new.notify_on_publish then
    select push_new_products_enabled into new_on from store_settings where id = 1;
    if coalesce(new_on, false) then
      if to_regprocedure('public.push_enqueue(uuid,text,text,text)') is not null then
        perform public.push_enqueue(new.id, 'new', '🛍️ Nouveau produit disponible', new.name || ' — ' || new.price || ' FCFA');
      else
        insert into product_notifications (product_id, title, message)
        values (new.id, '🛍️ Nouveau produit disponible', new.name || ' — ' || new.price || ' FCFA');
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_product_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_flash_sale and (old.is_flash_sale is distinct from new.is_flash_sale) then
    perform public.push_enqueue(new.id, 'promo', '🔥 Promotion en cours', new.name || ' est maintenant en vente flash — ' || new.price || ' FCFA');
  end if;
  return new;
end;
$$;

-- 4. Les bonnes heures : celles où le site est le plus fréquenté (30 derniers jours, heure du Tchad), dans la fenêtre d'envoi
create or replace function public.push_good_hours(p_start integer default 9, p_end integer default 20, p_now timestamptz default now())
returns integer[]
language sql
stable
security definer
set search_path = public
as $$
  with hrs as (select g as hr from generate_series(p_start, p_end - 1) g),
  act as (
    select extract(hour from last_viewed_at at time zone 'Africa/Ndjamena')::int as hr, count(distinct visitor_id) as v
    from visitor_product_interest
    where last_viewed_at > p_now - interval '30 days' and last_viewed_at <= p_now
    group by 1
  ),
  m as (select hrs.hr, coalesce(act.v, 0) as v from hrs left join act on act.hr = hrs.hr),
  s as (select coalesce(sum(v), 0) as total, coalesce(avg(v), 0) as mean from m)
  select case
    when (select total from s) < 100 then array(select hr from hrs order by hr)
    else array(select m.hr from m, s where m.v >= s.mean order by m.hr)
  end;
$$;

revoke all on function public.push_good_hours(integer, integer, timestamptz) from public, anon, authenticated;

-- 5. Le gardien : envoie UNE notification au plus par passage (p_now : l'heure à laquelle on regarde, pour les tests)
create or replace function public.run_push_gate(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  gate_on boolean;
  new_on boolean;
  gap_min integer;
  per_day integer;
  w_start integer;
  w_end integer;
  chad_hour integer := extract(hour from (p_now at time zone 'Africa/Ndjamena'))::integer;
  day_start timestamptz := date_trunc('day', p_now at time zone 'Africa/Ndjamena') at time zone 'Africa/Ndjamena';
  last_push timestamptz;
  today_n integer;
  subs integer;
  sp record;
  best record;
  pick text;
  waiting integer;
  t text;
  m text;
  sent_n integer := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('albasse-push-gate')) then
    return 0;
  end if;

  select push_gate_enabled, push_min_gap_minutes, push_max_per_day, push_window_start, push_window_end, push_new_products_enabled
    into gate_on, gap_min, per_day, w_start, w_end, new_on from store_settings where id = 1;
  gate_on := coalesce(gate_on, true);
  new_on := coalesce(new_on, false);
  gap_min := coalesce(gap_min, 180);
  per_day := coalesce(per_day, 2);
  w_start := coalesce(w_start, 9);
  w_end := coalesce(w_end, 20);
  if w_end <= w_start then w_start := 9; w_end := 20; end if;

  select count(*) into subs from web_push_subscriptions;

  -- Interrupteur « nouveaux articles » éteint : ceux qui attendaient encore dans la file ne partiront jamais
  if not new_on then
    update push_outbox set status = 'expired', note = 'nouveaux articles désactivés' where status = 'pending' and kind = 'new';
  end if;

  -- Gardien éteint : comme avant, tout ce qui attend part tout de suite (une ligne = une notification)
  if not gate_on then
    update scheduled_pushes set status = 'expired' where status = 'pending' and send_at < p_now - interval '6 hours';
    for sp in select * from scheduled_pushes where status = 'pending' and send_at <= p_now order by send_at limit 20 for update skip locked loop
      insert into product_notifications (product_id, title, message, created_at) values (sp.product_id, sp.title, sp.message, p_now);
      update scheduled_pushes set status = 'sent', sent_at = p_now, recipients = subs where id = sp.id;
      sent_n := sent_n + 1;
    end loop;
    for sp in select * from push_outbox where status = 'pending' order by created_at limit 20 for update skip locked loop
      insert into product_notifications (product_id, title, message, created_at) values (sp.product_id, sp.title, sp.message, p_now);
      update push_outbox set status = 'sent', sent_at = p_now, note = 'envoyée sans gardien' where id = sp.id;
      sent_n := sent_n + 1;
    end loop;
    return sent_n;
  end if;

  -- Ce qui n'a plus de sens n'est jamais annoncé
  update push_outbox set status = 'expired', note = 'trop ancienne (plus de 24 h)' where status = 'pending' and created_at < p_now - interval '24 hours';
  update scheduled_pushes set status = 'expired' where status = 'pending' and send_at < p_now - interval '24 hours';
  update push_outbox o set status = 'expired', note = 'article indisponible'
    from products p where o.product_id = p.id and o.status = 'pending' and (not coalesce(p.is_active, false) or coalesce(p.stock, 1) <= 0);
  update push_outbox o set status = 'expired', note = 'promotion terminée'
    from products p where o.product_id = p.id and o.status = 'pending' and o.kind = 'promo' and not coalesce(p.is_flash_sale, false);
  update scheduled_pushes s set status = 'expired'
    from products p where s.product_id = p.id and s.status = 'pending' and s.send_at <= p_now and (not coalesce(p.is_active, false) or coalesce(p.stock, 1) <= 0);

  -- Jamais deux notifications trop proches : on regarde la dernière qui est vraiment partie
  select max(created_at) into last_push from product_notifications where created_at <= p_now;
  if last_push is not null and last_push > p_now - make_interval(mins => gap_min) then
    return 0;
  end if;

  -- 1) Les notifications programmées par l'administrateur : à l'heure qu'il a choisie, passent avant tout
  select * into sp from scheduled_pushes where status = 'pending' and send_at <= p_now order by send_at limit 1 for update skip locked;
  if found then
    insert into product_notifications (product_id, title, message, created_at) values (sp.product_id, sp.title, sp.message, p_now);
    update scheduled_pushes set status = 'sent', sent_at = p_now, recipients = subs where id = sp.id;
    return 1;
  end if;

  -- 2) Les automatiques : fenêtre d'envoi, plafond du jour, bonne heure
  if chad_hour < w_start or chad_hour >= w_end then
    return 0;
  end if;
  select count(*) into today_n from product_notifications where created_at >= day_start and created_at <= p_now;
  if today_n >= per_day then
    return 0;
  end if;
  if not (chad_hour = any (public.push_good_hours(w_start, w_end, p_now))) then
    return 0;
  end if;

  -- les promotions d'abord, puis les nouveaux articles
  select kind into pick from push_outbox where status = 'pending' order by (kind = 'promo') desc limit 1;
  if pick is null then
    return 0;
  end if;
  select count(*) into waiting from push_outbox where status = 'pending' and kind = pick;
  if waiting = 0 then
    return 0;
  end if;
  -- l'article le plus regardé ces 7 jours passe en premier (à égalité : le plus récent)
  select o.id, o.product_id, o.title, o.message, p.name
    into best
    from push_outbox o join products p on p.id = o.product_id
    where o.status = 'pending' and o.kind = pick
    order by (select coalesce(sum(v.views), 0) from visitor_product_interest v where v.product_id = o.product_id::text and v.last_viewed_at > p_now - interval '7 days') desc,
             o.created_at desc
    limit 1;
  if best.id is null then
    return 0;
  end if;
  if waiting = 1 then
    t := best.title;
    m := best.message;
  elsif pick = 'promo' then
    t := '🔥 ' || waiting || ' promotions en cours';
    m := best.name || ' et ' || (waiting - 1) || case when waiting = 2 then ' autre article' else ' autres articles' end || ' en vente flash';
  else
    t := '🛍️ ' || waiting || ' nouveaux articles';
    m := best.name || ' et ' || (waiting - 1) || case when waiting = 2 then ' autre article' else ' autres articles' end || ' à découvrir';
  end if;
  insert into product_notifications (product_id, title, message, created_at) values (best.product_id, t, m, p_now);
  update push_outbox set status = case when id = best.id then 'sent' else 'merged' end,
                         sent_at = p_now,
                         note = case when waiting = 1 then 'envoyée' when id = best.id then 'envoyée avec ' || (waiting - 1) || ' autre(s)' else 'regroupée dans une seule notification' end
    where status = 'pending' and kind = pick;
  return 1;
end;
$$;

revoke all on function public.run_push_gate(timestamptz) from public, anon, authenticated;

-- L'ancien envoi des notifications programmées est remplacé par le gardien (le nom reste, au cas où quelque chose l'appellerait encore)
create or replace function public.run_scheduled_pushes()
returns integer
language sql
security definer
set search_path = public
as $$ select public.run_push_gate(); $$;

revoke all on function public.run_scheduled_pushes() from public, anon, authenticated;

-- Le minuteur : toutes les minutes (remplace l'ancien)
select cron.unschedule(jobid) from cron.job where jobname in ('albasse-scheduled-pushes', 'albasse-push-gate');
select cron.schedule('albasse-push-gate', '* * * * *', 'select public.run_push_gate()');
