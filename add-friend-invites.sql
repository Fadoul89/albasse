-- Parrainage « Invite 5 amis, gagne un parfum » (demande du patron, 5 novembre 2026).
-- Un client qui a un compte reçoit un lien. Un ami COMPTE seulement s'il (1) crée son compte avec ce lien (dans les 2 jours qui suivent la création de son
-- compte) ET (2) ouvre l'application installée sur son téléphone (icône sur l'écran d'accueil) en étant connecté. À chaque tranche de 5 amis, le client
-- gagne 1 parfum gratuit. Le gain arrive « à valider » : c'est le patron qui vérifie les amis (Admin › Parrainages) avant de remettre le parfum.
-- Sans danger à relancer. Aucun compte, article ni commande n'est modifié ; les colonnes ajoutées sont vides pour tout le monde au départ.
-- Rien à voir avec le programme d'affiliation (commissions sur les ventes) : le code d'invitation est une autre colonne (invite_code).
--
-- Pour tout enlever : drop table public.invite_rewards; puis supprimer les fonctions invite_* / admin_invite_* et les 4 colonnes ajoutées à profiles.

alter table public.profiles add column if not exists invite_code text;
alter table public.profiles add column if not exists invited_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists invited_at timestamptz;
alter table public.profiles add column if not exists app_opened_at timestamptz;

create unique index if not exists profiles_invite_code_key on public.profiles(invite_code) where invite_code is not null;
create index if not exists profiles_invited_by_idx on public.profiles(invited_by) where invited_by is not null;

-- Un client connecté ne peut pas écrire lui-même ces 4 colonnes (il se donnerait des amis) : seules les fonctions ci-dessous les remplissent.
create or replace function public.protect_invite_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.invite_code is distinct from old.invite_code
    or new.invited_by is distinct from old.invited_by
    or new.invited_at is distinct from old.invited_at
    or new.app_opened_at is distinct from old.app_opened_at
  then
    raise exception 'Modification non autorisée de ce profil' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_invite_columns on public.profiles;
create trigger protect_invite_columns
  before update on public.profiles
  for each row execute function public.protect_invite_columns();

-- Les gains. Nouvelle table : droits donnés explicitement (lecture de ses propres gains ; l'écriture se fait seulement par les fonctions ci-dessous).
create table if not exists public.invite_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  number integer not null check (number >= 1), -- 1 = le 1er parfum (5 amis), 2 = le 2e (10 amis)…
  friends_needed integer not null,
  status text not null default 'a_valider' check (status in ('a_valider', 'valide', 'remis', 'refuse')),
  note text,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  unique (user_id, number)
);

alter table public.invite_rewards enable row level security;
drop policy if exists invite_rewards_read on public.invite_rewards;
create policy invite_rewards_read on public.invite_rewards for select using (user_id = auth.uid() or public.is_admin());

-- Supabase donne par défaut tous les droits aux nouvelles tables : on les retire, puis on ne rend que la lecture (la sécurité par ligne limite à SES gains).
revoke all on public.invite_rewards from public, anon, authenticated;
grant select on public.invite_rewards to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Fonctions internes (jamais appelées par le site)
-- ---------------------------------------------------------------------------------------------

-- Les amis qui comptent : invités par ce client, application installée ouverte, compte non banni
create or replace function public.invite_qualified_count(p_inviter uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.profiles f
  where f.invited_by = p_inviter and f.app_opened_at is not null and coalesce(f.banned, false) = false;
$$;

-- 1 gain par tranche de 5 amis (5 → n° 1, 10 → n° 2…). Sans doublon.
create or replace function public.invite_refresh_rewards(p_inviter uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tranches integer := public.invite_qualified_count(p_inviter) / 5;
  k integer;
begin
  for k in 1..tranches loop
    insert into public.invite_rewards (user_id, number, friends_needed) values (p_inviter, k, k * 5) on conflict (user_id, number) do nothing;
  end loop;
end;
$$;

revoke all on function public.invite_qualified_count(uuid) from public, anon, authenticated;
revoke all on function public.invite_refresh_rewards(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Ce que le site appelle
-- ---------------------------------------------------------------------------------------------

-- Mon code (créé la première fois : 8 lettres et chiffres faciles à lire)
create or replace function public.invite_my_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  code text;
  tries integer := 0;
begin
  if uid is null then
    return null;
  end if;
  select invite_code into code from public.profiles where id = uid;
  if code is not null then
    return code;
  end if;
  loop
    code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::integer, 1), '') from generate_series(1, 8));
    begin
      update public.profiles set invite_code = code where id = uid and invite_code is null;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 20 then
        raise;
      end if;
    end;
  end loop;
  select invite_code into code from public.profiles where id = uid;
  return code;
end;
$$;

-- Le prénom de la personne qui invite (pour écrire « Invité par Amina » à l'inscription) ; rien si le code n'existe pas
create or replace function public.invite_lookup(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(split_part(trim(coalesce(full_name, '')), ' ', 1), '')
  from public.profiles
  where invite_code = upper(trim(coalesce(p_code, '')))
  limit 1;
$$;

-- Le nouveau client dit qui l'a invité. Réponses : ok, login, already, too_late, invalid, self, loop
create or replace function public.invite_claim(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me record;
  inv record;
begin
  if uid is null then
    return 'login';
  end if;
  select id, invited_by, created_at into me from public.profiles where id = uid;
  if not found then
    return 'login';
  end if;
  if me.invited_by is not null then
    return 'already';
  end if;
  if me.created_at < now() - interval '2 days' then
    return 'too_late';
  end if;
  select id, invited_by into inv from public.profiles where invite_code = upper(trim(coalesce(p_code, '')));
  if not found then
    return 'invalid';
  end if;
  if inv.id = uid then
    return 'self';
  end if;
  if inv.invited_by = uid then
    return 'loop';
  end if;
  update public.profiles set invited_by = inv.id, invited_at = now() where id = uid;
  perform public.invite_refresh_rewards(inv.id);
  return 'ok';
end;
$$;

-- L'application installée vient de s'ouvrir avec ce client connecté (une seule fois pour lui)
create or replace function public.invite_mark_app_opened()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inviter uuid;
begin
  if uid is null then
    return;
  end if;
  update public.profiles set app_opened_at = now() where id = uid and app_opened_at is null returning invited_by into inviter;
  if found and inviter is not null then
    perform public.invite_refresh_rewards(inviter);
  end if;
end;
$$;

-- Ma progression : mon code, mes amis (prénoms seulement) et mes gains
create or replace function public.invite_my_progress()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return null;
  end if;
  return jsonb_build_object(
    'code', public.invite_my_code(),
    'goal', 5,
    'joined', (select count(*) from public.profiles f where f.invited_by = uid and coalesce(f.banned, false) = false),
    'installed', public.invite_qualified_count(uid),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(nullif(split_part(trim(coalesce(f.full_name, '')), ' ', 1), ''), 'Un ami'), 'installed', f.app_opened_at is not null, 'joined_at', f.invited_at) order by f.invited_at desc)
      from (select * from public.profiles where invited_by = uid and coalesce(banned, false) = false order by invited_at desc limit 100) f
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('number', r.number, 'status', r.status, 'created_at', r.created_at) order by r.number)
      from public.invite_rewards r where r.user_id = uid
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Administrateur
-- ---------------------------------------------------------------------------------------------

-- Tout le tableau : totaux, gains (avec les amis), clients qui invitent
create or replace function public.admin_invite_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'goal', 5,
    'totals', jsonb_build_object(
      'inviters', (select count(distinct invited_by) from public.profiles where invited_by is not null),
      'joined', (select count(*) from public.profiles where invited_by is not null),
      'installed', (select count(*) from public.profiles where invited_by is not null and app_opened_at is not null and coalesce(banned, false) = false),
      'to_validate', (select count(*) from public.invite_rewards where status = 'a_valider'),
      'validated', (select count(*) from public.invite_rewards where status = 'valide'),
      'delivered', (select count(*) from public.invite_rewards where status = 'remis'),
      'refused', (select count(*) from public.invite_rewards where status = 'refuse')
    ),
    'rewards', coalesce((
      select jsonb_agg(q.x order by q.created_at desc) from (
        select jsonb_build_object(
          'id', r.id, 'number', r.number, 'status', r.status, 'note', r.note, 'created_at', r.created_at, 'handled_at', r.handled_at,
          'user', jsonb_build_object('id', p.id, 'name', coalesce(p.full_name, 'Client'), 'phone', p.phone, 'whatsapp', p.whatsapp_number),
          'friends', coalesce((
            select jsonb_agg(jsonb_build_object('name', coalesce(f.full_name, 'Ami'), 'phone', f.phone, 'joined_at', f.invited_at, 'installed', f.app_opened_at is not null, 'banned', coalesce(f.banned, false)) order by f.invited_at)
            from public.profiles f where f.invited_by = p.id
          ), '[]'::jsonb)
        ) as x, r.created_at
        from public.invite_rewards r join public.profiles p on p.id = r.user_id
        order by r.created_at desc limit 200
      ) q
    ), '[]'::jsonb),
    'inviters', coalesce((
      select jsonb_agg(y order by (y->>'installed')::integer desc, (y->>'joined')::integer desc) from (
        select jsonb_build_object(
          'id', p.id, 'name', coalesce(p.full_name, 'Client'), 'phone', p.phone,
          'joined', count(f.id), 'installed', count(f.id) filter (where f.app_opened_at is not null and coalesce(f.banned, false) = false)
        ) as y
        from public.profiles p join public.profiles f on f.invited_by = p.id
        group by p.id, p.full_name, p.phone
        order by count(f.id) filter (where f.app_opened_at is not null) desc, count(f.id) desc limit 100
      ) q2
    ), '[]'::jsonb)
  );
end;
$$;

-- Le patron change l'état d'un gain : a_valider, valide (parfum accepté, l'équipe écrit au client), remis, refuse
create or replace function public.admin_invite_reward_set(p_reward uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_status not in ('a_valider', 'valide', 'remis', 'refuse') then
    raise exception 'État inconnu';
  end if;
  update public.invite_rewards
    set status = p_status, note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note), handled_at = case when p_status = 'a_valider' then null else now() end
    where id = p_reward;
  if not found then
    raise exception 'Gain introuvable';
  end if;
end;
$$;

revoke all on function public.invite_my_code() from public, anon;
revoke all on function public.invite_claim(text) from public, anon;
revoke all on function public.invite_mark_app_opened() from public, anon;
revoke all on function public.invite_my_progress() from public, anon;
revoke all on function public.admin_invite_overview() from public, anon;
revoke all on function public.admin_invite_reward_set(uuid, text, text) from public, anon;
revoke all on function public.invite_lookup(text) from public;

grant execute on function public.invite_my_code() to authenticated;
grant execute on function public.invite_claim(text) to authenticated;
grant execute on function public.invite_mark_app_opened() to authenticated;
grant execute on function public.invite_my_progress() to authenticated;
grant execute on function public.admin_invite_overview() to authenticated;
grant execute on function public.admin_invite_reward_set(uuid, text, text) to authenticated;
grant execute on function public.invite_lookup(text) to anon, authenticated;
