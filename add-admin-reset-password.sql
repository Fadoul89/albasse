-- Retrouver son compte : l'équipe donne un NOUVEAU CODE à un client qui a perdu son mot de passe
-- (par exemple : il n'a pas fait la capture d'écran à la commande).
-- Admin › Clients › le client › « Donner un nouveau code » : le site tire un code de 6 chiffres, la base le met sur le compte,
-- et l'administrateur l'envoie sur WhatsApp. L'ancien code ne marche plus.
-- À lancer UNE FOIS dans Supabase › SQL Editor. Sans danger si on le relance.

-- Petit journal : qui a donné un nouveau code, à quel client, quand (le code lui-même n'est JAMAIS gardé).
create table if not exists public.admin_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_id uuid,
  created_at timestamptz not null default now()
);

alter table public.admin_password_resets enable row level security;

drop policy if exists "Les administrateurs lisent le journal des nouveaux codes" on public.admin_password_resets;
create policy "Les administrateurs lisent le journal des nouveaux codes"
  on public.admin_password_resets for select
  using (public.is_admin());

-- Supabase ne donne plus l'accès automatiquement aux nouvelles tables : lecture seulement, pour les administrateurs (règle ci-dessus).
-- Personne n'écrit directement dans ce journal : seule la fonction ci-dessous le fait.
revoke all on public.admin_password_resets from anon, authenticated;
grant select on public.admin_password_resets to authenticated;

-- La fonction : réservée aux administrateurs, jamais pour le compte d'un administrateur, code de 6 à 72 caractères.
-- Elle renvoie l'identifiant de connexion du compte (le site dit alors « votre numéro … » ou « votre e-mail … »).
create or replace function public.admin_set_client_password(target_user_id uuid, new_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  login_email text;
begin
  if not public.is_admin() then
    raise exception 'Non autorise';
  end if;
  if new_password is null or char_length(new_password) < 6 or char_length(new_password) > 72 then
    raise exception 'Mot de passe invalide (6 a 72 caracteres)';
  end if;
  if exists (select 1 from public.profiles where id = target_user_id and is_admin) then
    raise exception 'Compte administrateur : non autorise ici';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf', 10)),
         updated_at = now()
   where id = target_user_id
  returning email into login_email;
  if not found then
    raise exception 'Client introuvable';
  end if;

  insert into public.admin_password_resets (user_id, admin_id) values (target_user_id, auth.uid());
  return login_email;
end;
$$;

revoke all on function public.admin_set_client_password(uuid, text) from public, anon;
grant execute on function public.admin_set_client_password(uuid, text) to authenticated;
