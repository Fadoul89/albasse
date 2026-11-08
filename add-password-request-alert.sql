-- Alerte Telegram à l'administrateur quand un client demande un nouveau mot de passe (écran « Mot de passe oublié »).
-- Avant : l'équipe ne l'apprenait que si le client pensait à écrire sur WhatsApp. Maintenant : un message Telegram arrive tout de suite
-- (comme l'alerte de nouvelle commande), avec le nom, le numéro, la ville et le lien direct vers la fiche du client dans Admin › Clients
-- (puis « Donner un nouveau code », comme avant : docs/recuperer-compte.md).
--
-- Prérequis (déjà en place pour l'alerte de commande) : le token du bot dans le coffre-fort (nom « telegram_bot_token ») et un compte administrateur
-- qui a lié Telegram (Compte › Lier Telegram). Sans cela, rien n'est envoyé et rien n'échoue.
--
-- Comment le client est retrouvé (une seule case sur l'écran « Mot de passe oublié ») :
--   • son numéro de téléphone (8 derniers chiffres) ;
--   • son numéro client « AS-000123 » (ou 123 : un numéro de téléphone a toujours au moins 8 chiffres) : add-client-number.sql, docs/numero-client.md ;
--   • son e-mail : un ancien compte (connexion par e-mail) reçoit le lien par e-mail, l'équipe est seulement prévenue ; un compte créé avec le NUMÉRO
--     qui a donné un vrai e-mail (facultatif) ne reçoit aucun lien (sa connexion est son numéro) : l'équipe est prévenue comme pour un numéro, « il attend un nouveau code ».
--
-- Garde-fous :
--   • la fonction répond toujours pareil (rien), que le compte existe ou non : on ne peut pas deviner quels numéros ont un compte ;
--   • un numéro ou e-mail inconnu n'envoie rien ; un compte administrateur non plus ;
--   • au plus 1 alerte par client toutes les 30 minutes, et 20 alertes par heure en tout (personne ne peut inonder le Telegram du patron) ;
--   • le message ne contient jamais de mot de passe ni de code : seulement qui a demandé ;
--   • le petit journal (qui, par quel moyen, quand) est effacé après 30 jours.
-- Sans danger à relancer.

create table if not exists public.password_request_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('phone', 'email')),
  created_at timestamptz not null default now()
);
create index if not exists password_request_alerts_user_idx on public.password_request_alerts (user_id, created_at desc);
create index if not exists password_request_alerts_created_idx on public.password_request_alerts (created_at desc);

-- Supabase ne donne plus d'accès automatique aux nouvelles tables : le site n'écrit jamais ici (seule la fonction ci-dessous le fait) ;
-- les administrateurs peuvent seulement LIRE le journal.
alter table public.password_request_alerts enable row level security;
revoke all on public.password_request_alerts from public, anon, authenticated;
grant select on public.password_request_alerts to authenticated;
drop policy if exists password_request_alerts_admin_read on public.password_request_alerts;
create policy password_request_alerts_admin_read on public.password_request_alerts for select to authenticated using (public.is_admin());

create or replace function public.notify_admin_password_request(p_login text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login text := left(btrim(coalesce(p_login, '')), 120);
  v_digits text;
  v_channel text;
  v_p record;
  v_tok text;
  r record;
  txt text;
  v_num text;
  v_shown text;
  v_wa text;
  v_cn integer;
  v_phone_acct boolean := false;
  v_by_email boolean := false;
begin
  -- le petit journal ne garde que 30 jours
  delete from public.password_request_alerts where created_at < now() - interval '30 days';
  if v_login = '' then
    return;
  end if;

  if position('@' in v_login) > 0 then
    -- un e-mail. Deux cas : un ancien compte (connexion par e-mail) reçoit le lien de réinitialisation par e-mail et l'équipe est seulement prévenue ;
    -- un compte créé avec le NUMÉRO (qui a donné un vrai e-mail, facultatif) ne reçoit aucun lien : sa connexion est son numéro, l'équipe doit lui donner un nouveau code.
    v_by_email := true;
    select p.id, p.full_name, p.phone, p.whatsapp_number, p.region, p.email, to_jsonb(p) ->> 'client_number' as client_number,
           (lower(coalesce(p.email, '')) like '%@tel.albasseshopping.com'
            or exists (select 1 from auth.users u where u.id = p.id and lower(coalesce(u.email, '')) like '%@tel.albasseshopping.com')) as phone_acct into v_p
    from public.profiles p
    where lower(p.email) = lower(v_login) and not coalesce(p.is_admin, false)
    order by p.created_at
    limit 1;
    v_phone_acct := coalesce(v_p.phone_acct, false);
    v_channel := case when v_phone_acct then 'phone' else 'email' end;
  elsif v_login ~* '^\s*as\s*[-–—:.]?\s*\d{1,9}\s*$' or v_login ~ '^\s*\d{1,7}\s*$' then
    -- le numéro client (AS-000123, ou 123 : un numéro de téléphone a au moins 8 chiffres, jamais 7 ou moins)
    v_channel := 'phone';
    v_cn := nullif(regexp_replace(v_login, '\D', '', 'g'), '')::integer;
    if v_cn is null or v_cn < 1 then
      return;
    end if;
    select p.id, p.full_name, p.phone, p.whatsapp_number, p.region, p.email, to_jsonb(p) ->> 'client_number' as client_number into v_p
    from public.profiles p
    where (to_jsonb(p) ->> 'client_number') = v_cn::text and not coalesce(p.is_admin, false)
    limit 1;
  else
    -- compte créé avec le numéro : l'équipe doit donner un nouveau code. Le numéro est comparé sur ses 8 derniers chiffres (+235, 00235 ou rien devant).
    v_channel := 'phone';
    v_digits := regexp_replace(v_login, '\D', '', 'g');
    if left(v_digits, 2) = '00' then
      v_digits := substr(v_digits, 3);
    end if;
    if length(v_digits) < 8 then
      return;
    end if;
    select p.id, p.full_name, p.phone, p.whatsapp_number, p.region, p.email, to_jsonb(p) ->> 'client_number' as client_number into v_p
    from public.profiles p
    where not coalesce(p.is_admin, false)
      and (
        right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 8) = right(v_digits, 8)
        or right(regexp_replace(coalesce(p.whatsapp_number, ''), '\D', '', 'g'), 8) = right(v_digits, 8)
        or (lower(coalesce(p.email, '')) like '%@tel.albasseshopping.com' and right(regexp_replace(split_part(p.email, '@', 1), '\D', '', 'g'), 8) = right(v_digits, 8))
      )
    order by (lower(coalesce(p.email, '')) like '%@tel.albasseshopping.com') desc, p.created_at
    limit 1;
  end if;

  -- inconnu : rien (et la réponse est la même que pour un compte connu)
  if v_p.id is null then
    return;
  end if;

  -- pas plus d'1 alerte par client toutes les 30 minutes, ni plus de 20 alertes par heure en tout
  if exists (select 1 from public.password_request_alerts a where a.user_id = v_p.id and a.created_at > now() - interval '30 minutes') then
    return;
  end if;
  if (select count(*) from public.password_request_alerts a where a.created_at > now() - interval '1 hour') >= 20 then
    return;
  end if;

  select decrypted_secret into v_tok from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if v_tok is null then
    return;
  end if;
  if not exists (select 1 from public.profiles where is_admin and telegram_chat_id is not null) then
    return;
  end if;

  -- le numéro à joindre : WhatsApp du client, sinon son téléphone
  v_num := regexp_replace(coalesce(nullif(v_p.whatsapp_number, ''), v_p.phone, ''), '\D', '', 'g');
  if left(v_num, 2) = '00' then
    v_num := substr(v_num, 3);
  end if;
  v_shown := coalesce(nullif(btrim(coalesce(v_p.whatsapp_number, '')), ''), nullif(btrim(coalesce(v_p.phone, '')), ''), '—');
  v_wa := case when length(v_num) = 8 then '235' || v_num when length(v_num) >= 9 then v_num else null end;

  if v_channel = 'phone' then
    txt := '🔑 Mot de passe oublié' || E'\n'
        || coalesce(nullif(btrim(coalesce(v_p.full_name, '')), ''), 'Client') || E'\n'
        || '📞 ' || v_shown || E'\n'
        || case when v_p.client_number is not null then '🪪 N° client : AS-' || lpad(v_p.client_number, 6, '0') || E'\n' else '' end
        || case when nullif(btrim(coalesce(v_p.region, '')), '') is not null then '📍 ' || btrim(v_p.region) || E'\n' else '' end
        || case when v_by_email then '✉️ Demande faite avec son e-mail (compte créé avec le numéro : aucun lien ne part, il attend un code).' || E'\n' else '' end
        || 'Il attend un nouveau code.' || E'\n'
        || '👉 Sa fiche (puis « Donner un nouveau code ») : https://www.albasseshopping.com/admin/clients/' || v_p.id::text
        || case when v_wa is not null then E'\n' || '💬 WhatsApp : https://wa.me/' || v_wa else '' end;
  else
    txt := '🔑 Mot de passe oublié (par e-mail)' || E'\n'
        || coalesce(nullif(btrim(coalesce(v_p.full_name, '')), ''), 'Client') || ' · ' || v_p.email || E'\n'
        || case when v_p.client_number is not null then '🪪 N° client : AS-' || lpad(v_p.client_number, 6, '0') || E'\n' else '' end
        || 'A demandé un lien de réinitialisation par e-mail : rien à faire, sauf s''il vous écrit.' || E'\n'
        || '👉 Sa fiche : https://www.albasseshopping.com/admin/clients/' || v_p.id::text;
  end if;

  insert into public.password_request_alerts (user_id, channel) values (v_p.id, v_channel);
  for r in select telegram_chat_id from public.profiles where is_admin and telegram_chat_id is not null loop
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_tok || '/sendMessage',
      body := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', txt)
    );
  end loop;
exception when others then
  -- une alerte ne doit JAMAIS faire échouer l'écran « Mot de passe oublié » ni révéler quoi que ce soit
  return;
end;
$$;

revoke all on function public.notify_admin_password_request(text) from public;
-- l'écran « Mot de passe oublié » est ouvert aux visiteurs sans compte
grant execute on function public.notify_admin_password_request(text) to anon, authenticated;
