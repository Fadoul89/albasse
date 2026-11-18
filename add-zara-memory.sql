-- Zara IA, « mémoire du client » : quelques notes courtes sur un client CONNECTÉ (goûts, taille, pointure, budget, occasions…),
-- écrites par la fonction serveur « zara-ai » pour mieux le conseiller la fois suivante. Jamais d'adresse, de téléphone ni d'e-mail
-- (la fonction les refuse). Sans ce script, Zara marche comme avant, sans mémoire.
-- Droits : le client peut seulement LIRE et EFFACER ses propres notes (« Tout oublier » dans le chat) ; seule la fonction serveur
-- (clé « service_role ») les écrit. Les visiteurs sans compte n'ont aucun accès.
-- Nouvelle table : depuis le 30 octobre 2026, Supabase ne donne plus l'accès automatique aux nouvelles tables, d'où les « grant » ci-dessous.
-- À lancer une fois dans Supabase › SQL Editor (on peut le relancer sans risque).

create table if not exists public.zara_memory (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint zara_memory_notes_list check (jsonb_typeof(notes) = 'array' and jsonb_array_length(notes) <= 8)
);

alter table public.zara_memory enable row level security;

drop policy if exists "zara_memory_read_own" on public.zara_memory;
create policy "zara_memory_read_own" on public.zara_memory
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "zara_memory_forget_own" on public.zara_memory;
create policy "zara_memory_forget_own" on public.zara_memory
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.zara_memory from public, anon, authenticated;
grant select, delete on public.zara_memory to authenticated;
grant select, insert, update, delete on public.zara_memory to service_role;
