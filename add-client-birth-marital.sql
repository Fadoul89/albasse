-- Date de naissance et Célibataire / Marié(e) : le site garde maintenant ces deux réponses de chaque client (Admin › Clients : sur la ligne et sur la fiche).
--  • À l'inscription, le client doit écrire sa date de naissance et choisir « Célibataire » ou « Marié(e) » (obligatoires).
--  • Les clients déjà inscrits ne sont pas bloqués : ils peuvent les remplir dans Compte › Modifier mon profil. « Non précisé » tant que personne n'a répondu.
--  • Rien n'est deviné : seul ce que le client écrit lui-même est gardé.
-- À lancer UNE FOIS dans Supabase › SQL Editor, AVANT de publier le site. Sans danger si on le relance.
-- Aucune nouvelle table : les colonnes s'ajoutent à « profiles » (même accès et mêmes règles que les autres colonnes : le client lit et modifie sa propre
-- ligne, l'administrateur lit tout, voir fix-profile-security.sql), donc aucun « grant » de plus.

alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists marital_status text;

alter table public.profiles drop constraint if exists profiles_marital_status_check;
alter table public.profiles add constraint profiles_marital_status_check check (marital_status is null or marital_status in ('celibataire', 'marie'));

-- une vraie date de naissance : pas avant 1900…
alter table public.profiles drop constraint if exists profiles_birth_date_check;
alter table public.profiles add constraint profiles_birth_date_check check (birth_date is null or birth_date >= date '1900-01-01');

-- … et pas dans le futur (« aujourd'hui » = le jour de N'Djamena). Un contrôle « check » ne peut pas lire l'heure : c'est le rôle de ce petit déclencheur.
create or replace function public.check_profile_birth_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.birth_date is not null and new.birth_date > (now() at time zone 'Africa/Ndjamena')::date then
    raise exception 'Date de naissance dans le futur' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.check_profile_birth_date() from public, anon, authenticated;

drop trigger if exists check_profile_birth_date on public.profiles;
create trigger check_profile_birth_date
  before insert or update of birth_date on public.profiles
  for each row execute function public.check_profile_birth_date();
