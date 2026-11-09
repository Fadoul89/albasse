-- « Mot de passe oublié » : confirmer que la personne a un compte ICI avant de lui laisser écrire à l'équipe (demande du patron, 9 novembre 2026).
-- Avant : quelqu'un SANS compte pouvait taper son numéro, voir « Écrivez-nous sur WhatsApp » et envoyer « j'ai oublié le mot de passe de mon compte ».
-- Maintenant : l'écran demande d'abord à la base « ce compte existe-t-il ? ». Aucun compte : on ne prévient pas l'équipe, pas de WhatsApp, on propose de créer un compte.
--
-- La fonction répond SEULEMENT vrai, faux ou rien (null) : jamais un nom, un numéro, une adresse ni une fiche.
-- Elle retrouve le compte comme add-password-request-alert.sql : e-mail, numéro client « AS-000123 » (ou 123), ou téléphone (8 derniers chiffres,
-- avec ou sans +235 / 00235).
-- En cas de doute (erreur, script pas lancé), le site fait comme avant : un vrai client n'est jamais bloqué.
-- Ce n'est pas plus ouvert que l'inscription, qui dit déjà « Un compte existe déjà avec ce numéro ».
-- Aucune table nouvelle : pas de « grant » de table à ajouter. Sans danger à relancer.

create or replace function public.account_exists_for_login(p_login text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_login text := left(btrim(coalesce(p_login, '')), 120);
  v_digits text;
  v_cn integer;
begin
  if v_login = '' then
    return false;
  end if;

  if position('@' in v_login) > 0 then
    -- un e-mail (ancien compte, ou vrai e-mail donné par un compte créé avec le numéro)
    return exists (select 1 from public.profiles p where lower(p.email) = lower(v_login));
  elsif v_login ~* '^\s*as\s*[-–—:.]?\s*\d{1,9}\s*$' or v_login ~ '^\s*\d{1,7}\s*$' then
    -- le numéro client (AS-000123, ou 123 : un numéro de téléphone a au moins 8 chiffres, jamais 7 ou moins)
    v_cn := nullif(regexp_replace(v_login, '\D', '', 'g'), '')::integer;
    if v_cn is null or v_cn < 1 then
      return false;
    end if;
    return exists (select 1 from public.profiles p where (to_jsonb(p) ->> 'client_number') = v_cn::text);
  else
    -- un numéro de téléphone : comparé sur ses 8 derniers chiffres (+235, 00235 ou rien devant)
    v_digits := regexp_replace(v_login, '\D', '', 'g');
    if left(v_digits, 2) = '00' then
      v_digits := substr(v_digits, 3);
    end if;
    if length(v_digits) < 8 then
      return false;
    end if;
    return exists (
      select 1 from public.profiles p
      where right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 8) = right(v_digits, 8)
         or right(regexp_replace(coalesce(p.whatsapp_number, ''), '\D', '', 'g'), 8) = right(v_digits, 8)
         or (lower(coalesce(p.email, '')) like '%@tel.albasseshopping.com' and right(regexp_replace(split_part(p.email, '@', 1), '\D', '', 'g'), 8) = right(v_digits, 8))
    );
  end if;
exception when others then
  -- une erreur ne doit JAMAIS bloquer l'écran : « on ne sait pas » (null), le site fait comme avant
  return null;
end;
$$;

revoke all on function public.account_exists_for_login(text) from public;
-- l'écran « Mot de passe oublié » est ouvert aux visiteurs sans compte
grant execute on function public.account_exists_for_login(text) to anon, authenticated;
