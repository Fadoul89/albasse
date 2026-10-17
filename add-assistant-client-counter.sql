-- BROUILLON : compteur « Vous êtes mon Nᵉ client aujourd'hui » de Zara Kings. PAS ENCORE APPLIQUÉ à la vraie base.
--
-- But : que Zara dise le VRAI nombre. Chaque fois qu'une personne ouvre une conversation avec Zara (une fois par appareil et
-- par jour), le site appelle cette fonction ; elle note la conversation et renvoie son rang du jour (1, 2, 3...).
-- Le jour commence à minuit, heure du Tchad (Africa/Ndjamena).
--
-- Rien de personnel n'est gardé : la table ne contient que l'heure de début de la conversation (aucun nom, téléphone, message
-- ni identifiant). Personne ne peut lire ou modifier la table depuis le site : seule la fonction ci-dessous écrit, et seul
-- l'administrateur peut lire la table (pour ses statistiques).
--
-- Tant que ce script n'est pas appliqué, Zara accueille les clients SANS dire de nombre (elle n'invente jamais un chiffre).
--
-- Pour annuler :
--   drop function if exists public.assistant_chat_start();
--   drop table if exists public.assistant_chats;

create table if not exists public.assistant_chats (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now()
);

create index if not exists assistant_chats_started_at_idx on public.assistant_chats (started_at);

alter table public.assistant_chats enable row level security;

drop policy if exists assistant_chats_admin_read on public.assistant_chats;
create policy assistant_chats_admin_read on public.assistant_chats
  for select
  using (public.is_admin());

create or replace function public.assistant_chat_start() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'Africa/Ndjamena') at time zone 'Africa/Ndjamena';
  n integer;
begin
  insert into public.assistant_chats default values;
  select count(*) into n from public.assistant_chats where started_at >= today_start;
  return n;
end;
$$;

revoke all on function public.assistant_chat_start() from public;
grant execute on function public.assistant_chat_start() to anon, authenticated;
