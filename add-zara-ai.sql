-- Zara IA : compteur des messages envoyés à l'IA, par visiteur et par adresse IP, pour chaque jour (heure de N'Djamena).
-- La fonction serveur « zara-ai » refuse au-delà de 20 messages par visiteur (200 par adresse IP) et par jour.
-- Seule la fonction serveur (clé « service_role ») s'en sert : le site n'y a pas accès (aucun droit pour anon / authenticated).
-- À lancer une fois dans Supabase › SQL Editor.

create table if not exists public.zara_ai_usage (
  key text not null,
  day date not null,
  count integer not null default 0,
  primary key (key, day)
);
alter table public.zara_ai_usage enable row level security;
revoke all on public.zara_ai_usage from anon, authenticated;
grant select, insert, update, delete on public.zara_ai_usage to service_role;

-- Compte un message et dit s'il est encore permis aujourd'hui (true) ou si la limite est dépassée (false).
create or replace function public.zara_ai_take(p_key text, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  n integer;
  d date := (now() at time zone 'Africa/Ndjamena')::date;
begin
  insert into zara_ai_usage (key, day, count) values (p_key, d, 1)
  on conflict (key, day) do update set count = zara_ai_usage.count + 1
  returning count into n;
  -- de temps en temps, on efface les jours de plus d'une semaine
  if random() < 0.02 then
    delete from zara_ai_usage where day < d - 7;
  end if;
  return n <= p_limit;
end $$;
revoke all on function public.zara_ai_take(text, integer) from public, anon, authenticated;
grant execute on function public.zara_ai_take(text, integer) to service_role;
