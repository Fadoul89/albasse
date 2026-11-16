-- Double vérification des administrateurs (code de Google Authenticator) : la protection est DANS la base.
-- is_admin() est utilisée par toutes les règles d'accès admin (56 règles RLS, les fonctions admin_*, et les fonctions serveur
-- qui l'appellent avec le jeton de l'admin). Nouvelle règle :
--   - un admin qui n'a PAS activé la double vérification : rien ne change ;
--   - un admin qui l'a activée : il n'est admin que si sa session a passé le code (jeton « aal2 »).
-- Un mot de passe volé ne suffit donc plus pour voir les commandes ou les clients. Les clients ne sont jamais concernés.
-- Relançable. Retour en arrière : relancer l'ancienne version (select coalesce((select is_admin from profiles where id = auth.uid()), false)).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
    and (
      coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      )
    );
$$;
