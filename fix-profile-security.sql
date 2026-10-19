-- Sécurité des comptes : un client connecté ne peut plus se donner les droits d'administrateur, se débannir, s'ajouter des points de
-- fidélité, effacer ses commandes signalées, s'approuver lui-même comme affilié ou prendre le code de parrainage d'un autre.
-- Il garde le droit de changer ses informations (nom, téléphone, WhatsApp, profession, ville, adresse, photo, notifications…) et de
-- demander à devenir affilié (statut « pending »).
-- Rien ne change pour les administrateurs ni pour les fonctions du site (bannir, points à la livraison, affiliés, fausses commandes) :
-- elles tournent avec le propriétaire de la base, pas avec le rôle du client. Sans danger à relancer.

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.id is distinct from old.id
    or new.is_admin is distinct from old.is_admin
    or new.banned is distinct from old.banned
    or new.loyalty_points is distinct from old.loyalty_points
    or new.fake_order_count is distinct from old.fake_order_count
    or new.telegram_chat_id is distinct from old.telegram_chat_id
    or new.created_at is distinct from old.created_at
    or (new.referral_code is distinct from old.referral_code and old.referral_code is not null)
    or (new.affiliate_status is distinct from old.affiliate_status and new.affiliate_status is distinct from 'pending')
  then
    raise exception 'Modification non autorisée de ce profil' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
