-- Option GPS : position réelle des visiteurs (demandée dès l'arrivée sur le site, à tous), adresse détectée
-- sur le profil du client (admin) et analyse des visiteurs par région (admin).
-- Sans danger à relancer. Rien n'est demandé si la base n'a pas ce script (voir src/lib/visitorLocation.ts :
-- l'insertion échoue silencieusement, sans redemander, sans jamais bloquer la navigation).

create table if not exists public.visitor_locations (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision,
  address text,
  city text,
  region text,
  country text,
  created_at timestamptz not null default now()
);

create index if not exists visitor_locations_visitor_id_created_at_idx on public.visitor_locations (visitor_id, created_at desc);
create index if not exists visitor_locations_user_id_created_at_idx on public.visitor_locations (user_id, created_at desc);

alter table public.visitor_locations enable row level security;

drop policy if exists "visitor_locations_insert_anyone" on public.visitor_locations;
create policy "visitor_locations_insert_anyone" on public.visitor_locations for insert to anon, authenticated with check (true);

drop policy if exists "visitor_locations_select_admin" on public.visitor_locations;
create policy "visitor_locations_select_admin" on public.visitor_locations for select to authenticated using (public.is_admin());

-- Depuis le 30 octobre 2026, Supabase ne donne plus l'accès par défaut aux nouvelles tables (voir AGENTS.md) :
grant insert on public.visitor_locations to anon, authenticated;
grant select on public.visitor_locations to authenticated;

-- Pour l'administrateur : la dernière position connue de chaque visiteur (anonyme ou client), regroupée par
-- région et par ville. "Inconnu" quand l'adresse n'a pas pu être retrouvée (coordonnées gardées quand même).
create or replace function public.admin_visitor_regions_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  with latest as (
    select distinct on (visitor_id) visitor_id, user_id, city, region, country, created_at
    from public.visitor_locations
    order by visitor_id, created_at desc
  ),
  by_region as (
    select coalesce(region, 'Inconnu') as region, coalesce(country, 'Inconnu') as country, count(*) as visitors
    from latest
    group by 1, 2
    order by visitors desc
  ),
  by_city as (
    select coalesce(city, 'Inconnu') as city, coalesce(region, 'Inconnu') as region, count(*) as visitors
    from latest
    group by 1, 2
    order by visitors desc
    limit 20
  )
  select jsonb_build_object(
    'total_visitors_located', (select count(*) from latest),
    'regions', coalesce((select jsonb_agg(jsonb_build_object('region', region, 'country', country, 'visitors', visitors)) from by_region), '[]'::jsonb),
    'cities', coalesce((select jsonb_agg(jsonb_build_object('city', city, 'region', region, 'visitors', visitors)) from by_city), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_visitor_regions_overview() to authenticated;
revoke execute on function public.admin_visitor_regions_overview() from anon;
