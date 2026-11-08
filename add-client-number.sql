-- Numéro client : chaque compte reçoit un numéro unique (AS-000123), lié à son téléphone et à son e-mail, pour retrouver un compte plus vite.
-- (docs/numero-client.md)
--
--   • Les comptes qui existent déjà reçoivent un numéro, dans l'ordre de création (le plus ancien : AS-000001).
--   • Chaque nouveau compte reçoit son numéro tout seul, à sa création (par défaut de la colonne : rien d'autre à changer dans le site ni dans la base).
--   • Le numéro ne change jamais et ne peut être modifié par personne depuis le site (déclencheur de protection).
--   • Ce n'est PAS un mot de passe : il ne permet pas d'entrer dans un compte, il aide seulement l'équipe à retrouver le bon compte.
--   • Aucune nouvelle table : pas de règle d'accès à ajouter. Le client lit son numéro avec son propre profil, l'équipe lit tous les profils (règles déjà en place).
--
-- Sans danger à relancer : rien n'est renuméroté, un compte qui a déjà son numéro le garde.

create sequence if not exists public.client_number_seq as integer minvalue 1 start 1;

alter table public.profiles add column if not exists client_number integer;

-- les nouveaux comptes (créés par le déclencheur de la base, ou par le serveur) reçoivent leur numéro tout seuls
alter table public.profiles alter column client_number set default nextval('public.client_number_seq');
-- le serveur (fonctions Supabase) peut créer un compte ; le site (anon / authenticated) n'a pas besoin de la séquence
grant usage, select on sequence public.client_number_seq to service_role;

-- les comptes déjà là : un numéro chacun, du plus ancien au plus récent
do $$
declare
  r record;
begin
  for r in select id from public.profiles where client_number is null order by created_at, id loop
    update public.profiles set client_number = nextval('public.client_number_seq') where id = r.id;
  end loop;
end $$;

create unique index if not exists profiles_client_number_key on public.profiles (client_number);
alter table public.profiles alter column client_number set not null;
alter sequence public.client_number_seq owned by public.profiles.client_number;

-- Personne ne change un numéro depuis le site (ni un client, ni un compte administrateur) : seul l'éditeur SQL de Supabase le peut.
create or replace function public.protect_client_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and new.client_number is distinct from old.client_number then
    raise exception 'Modification non autorisée de ce profil' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_client_number on public.profiles;
create trigger protect_client_number
  before update on public.profiles
  for each row execute function public.protect_client_number();
