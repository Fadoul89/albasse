-- BROUILLON : statistiques spéciales de Zara Kings. PAS ENCORE APPLIQUÉ à la vraie base.
--
-- But : savoir ce que Zara apporte à la boutique, et sur quel téléphone :
--   * combien de ventes (commandes) passées par Zara, et pour quel montant ;
--   * combien de comptes créés grâce à Zara ;
--   * combien d'installations de l'application grâce à Zara ;
--   * combien de conversations sur iPhone, Android, tablette ou ordinateur.
--
-- À appliquer APRÈS add-assistant-client-counter.sql (la table assistant_chats doit déjà exister).
--
-- Rien de personnel n'est gardé : seulement le type d'appareil (« iPhone », « Android », « Tablette » ou « PC »).
-- Les colonnes ajoutées sont vides pour tout ce qui ne vient pas de Zara ; les commandes, comptes et installations
-- existants ne changent pas. Seul l'administrateur peut lire les statistiques.
--
-- Tant que ce script n'est pas appliqué, le site marche comme avant : Zara ne note rien et la page
-- « Statistiques de Zara » le dit clairement.
--
-- Pour annuler (tout supprimer) :
--   drop function if exists public.assistant_stats(timestamptz, timestamptz);
--   drop function if exists public.assistant_log_event(text, text);
--   drop table if exists public.assistant_events;
--   alter table public.orders drop column if exists assistant_device;
--   alter table public.profiles drop column if exists assistant_device;
--   alter table public.app_installs drop column if exists via_assistant;
--   (garder assistant_chat_start(p_device) tel quel : il marche aussi sans paramètre)

-- 1. Ce qui vient de Zara, et sur quel appareil (vide = ne vient pas de Zara)
alter table public.orders add column if not exists assistant_device text;
alter table public.profiles add column if not exists assistant_device text;
alter table public.app_installs add column if not exists via_assistant boolean not null default false;
alter table public.assistant_chats add column if not exists device text;

-- 2. Les quatre types d'appareil connus ; tout le reste devient « Autre »
create or replace function public.assistant_device_label(p text) returns text
language sql
immutable
as $$
  select case when p in ('iPhone', 'Android', 'Tablette', 'PC') then p else 'Autre' end
$$;

-- 3. Les gestes de Zara autour de l'installation (aucun texte libre, aucune donnée personnelle)
create table if not exists public.assistant_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event text not null check (event in ('install_question', 'install_already', 'install_later', 'install_ios_guide')),
  device text not null default 'Autre'
);

create index if not exists assistant_events_created_at_idx on public.assistant_events (created_at);

alter table public.assistant_events enable row level security;

drop policy if exists assistant_events_admin_read on public.assistant_events;
create policy assistant_events_admin_read on public.assistant_events
  for select
  using (public.is_admin());

create or replace function public.assistant_log_event(p_event text, p_device text default null) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- un nom d'événement inconnu est simplement ignoré (le site ne doit jamais avoir d'erreur à cause d'une statistique)
  if p_event in ('install_question', 'install_already', 'install_later', 'install_ios_guide') then
    insert into public.assistant_events (event, device) values (p_event, public.assistant_device_label(p_device));
  end if;
end;
$$;

revoke all on function public.assistant_log_event(text, text) from public;
grant execute on function public.assistant_log_event(text, text) to anon, authenticated;

-- 4. Le compteur de conversations garde aussi l'appareil. L'ancienne version sans paramètre est remplacée par celle-ci,
--    qui marche avec ou sans appareil : le numéro de client du jour continue de s'afficher.
drop function if exists public.assistant_chat_start();

create or replace function public.assistant_chat_start(p_device text default null) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'Africa/Ndjamena') at time zone 'Africa/Ndjamena';
  n integer;
begin
  insert into public.assistant_chats (device) values (public.assistant_device_label(p_device));
  select count(*) into n from public.assistant_chats where started_at >= today_start;
  return n;
end;
$$;

revoke all on function public.assistant_chat_start(text) from public;
grant execute on function public.assistant_chat_start(text) to anon, authenticated;

-- 5. Les chiffres, pour l'administrateur seulement. Une seule demande, calculée dans la base (pas de limite de lignes).
--    p_since : début de la période (inclus) ; p_until : fin (exclue) ; vides = depuis toujours / jusqu'à maintenant.
create or replace function public.assistant_stats(p_since timestamptz default null, p_until timestamptz default null) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since timestamptz := coalesce(p_since, '-infinity'::timestamptz);
  until timestamptz := coalesce(p_until, 'infinity'::timestamptz);
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object('device', d, 'n', n))
      from (
        select public.assistant_device_label(device) as d, count(*) as n
        from public.assistant_chats
        where started_at >= since and started_at < until
        group by 1
      ) t
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('event', event, 'device', d, 'n', n))
      from (
        select event, public.assistant_device_label(device) as d, count(*) as n
        from public.assistant_events
        where created_at >= since and created_at < until
        group by 1, 2
      ) t
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('device', d, 'status', status, 'n', n, 'amount', amount))
      from (
        select public.assistant_device_label(assistant_device) as d, status, count(*) as n, coalesce(sum(total), 0) as amount
        from public.orders
        where assistant_device is not null
          and coalesce(is_flagged_fake, false) = false
          and created_at >= since and created_at < until
        group by 1, 2
      ) t
    ), '[]'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object('device', d, 'n', n))
      from (
        select public.assistant_device_label(assistant_device) as d, count(*) as n
        from public.profiles
        where assistant_device is not null
          and coalesce(is_admin, false) = false
          and created_at >= since and created_at < until
        group by 1
      ) t
    ), '[]'::jsonb),
    'installs', coalesce((
      select jsonb_agg(jsonb_build_object('device', d, 'n', n))
      from (
        select public.assistant_device_label(device_type) as d, count(*) as n
        from public.app_installs
        where via_assistant
          and created_at >= since and created_at < until
        group by 1
      ) t
    ), '[]'::jsonb),
    -- pour comparer : tout ce qui s'est passé sur la boutique pendant la même période, venu de Zara ou non
    'totals', jsonb_build_object(
      'orders', (select count(*) from public.orders where coalesce(is_flagged_fake, false) = false and status <> 'cancelled' and created_at >= since and created_at < until),
      'orders_amount', (select coalesce(sum(total), 0) from public.orders where coalesce(is_flagged_fake, false) = false and status <> 'cancelled' and created_at >= since and created_at < until),
      'accounts', (select count(*) from public.profiles where coalesce(is_admin, false) = false and created_at >= since and created_at < until),
      'installs', (select count(*) from public.app_installs where created_at >= since and created_at < until)
    )
  );
end;
$$;

revoke all on function public.assistant_stats(timestamptz, timestamptz) from public;
revoke all on function public.assistant_stats(timestamptz, timestamptz) from anon;
grant execute on function public.assistant_stats(timestamptz, timestamptz) to authenticated;

-- Demande à l'API du site de relire la liste des tables et fonctions tout de suite
notify pgrst, 'reload schema';
