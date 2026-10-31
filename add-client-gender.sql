-- Homme / Femme : le site garde maintenant le genre de chaque client, pour suivre l'analyse des clients (Admin › Clients : hommes, femmes,
-- commandes et montants de chacun).
--  • À l'inscription, le client choisit « Homme » ou « Femme » (obligatoire).
--  • Les clients déjà inscrits : Zara leur pose la question une fois (carte sur l'accueil) ; l'administrateur peut aussi le corriger sur la fiche du client.
--  • Rien n'est deviné d'après le prénom : seul le choix du client (ou le vôtre) est gardé. « Non précisé » tant que personne n'a choisi.
-- À lancer UNE FOIS dans Supabase › SQL Editor. Sans danger si on le relance.
-- Aucune nouvelle table : la colonne s'ajoute à « profiles » (même accès que les autres colonnes), donc aucun « grant » de plus.

alter table public.profiles add column if not exists gender text;

alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check check (gender is null or gender in ('homme', 'femme'));

-- Le client change son propre genre avec les règles habituelles de « profiles » (sa propre ligne seulement, voir fix-profile-security.sql).
-- L'administrateur ne peut pas modifier la ligne d'un autre client directement : il passe par cette fonction, réservée aux administrateurs.
create or replace function public.admin_set_client_gender(target_user_id uuid, new_gender text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Non autorise';
  end if;
  if new_gender is not null and new_gender not in ('homme', 'femme') then
    raise exception 'Genre invalide (homme ou femme)';
  end if;
  update public.profiles set gender = new_gender where id = target_user_id;
  if not found then
    raise exception 'Client introuvable';
  end if;
end;
$$;

revoke all on function public.admin_set_client_gender(uuid, text) from public, anon;
grant execute on function public.admin_set_client_gender(uuid, text) to authenticated;
