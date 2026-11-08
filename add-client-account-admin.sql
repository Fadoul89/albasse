-- Gestion de compte côté équipe (Admin › Clients › fiche du client › « Gérer le compte ») : docs/gestion-de-compte.md
--
--   • admin_client_account_info(client)   : comment le client se connecte (numéro ou e-mail), combien de commandes il a, si son compte est fermé ;
--   • admin_update_client_profile(client, changes) : modifier la fiche (nom, WhatsApp, e-mail de contact, ville, pays, adresse, profession,
--                                           et le téléphone pour un ancien compte connecté par e-mail) ;
--   • client_account_log                  : le JOURNAL (qui a fait quoi, sur quel compte, quand). Il ne garde jamais de nom, téléphone ni e-mail :
--                                           seulement le numéro client, l'action et les NOMS des champs changés.
-- Changer le numéro de connexion, fermer et supprimer un compte passent par la fonction serveur « admin-client-account » (elle seule peut
-- toucher à la connexion Supabase) ; elle écrit aussi dans ce journal.
-- Réservé aux administrateurs (is_admin()). Un compte administrateur n'est jamais modifié ici. Sans danger à relancer.
-- À lancer APRÈS add-client-number.sql si possible (sinon le numéro client reste vide dans le journal, rien ne casse).

-- ---------- le journal
create table if not exists public.client_account_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid references public.profiles(id) on delete set null,
  target_id uuid not null,            -- pas de lien : le journal garde la trace même si le compte est supprimé pour de bon
  client_number integer,
  action text not null check (action in ('edit', 'change_login', 'close', 'delete')),
  detail text not null default ''
);
create index if not exists client_account_log_target_idx on public.client_account_log (target_id, created_at desc);
create index if not exists client_account_log_created_idx on public.client_account_log (created_at desc);

-- Supabase ne donne plus d'accès automatique aux nouvelles tables : les administrateurs LISENT le journal ; personne n'écrit depuis le site
-- (seules les fonctions de la base et la fonction serveur écrivent, avec leurs propres droits).
alter table public.client_account_log enable row level security;
revoke all on public.client_account_log from public, anon, authenticated;
grant select on public.client_account_log to authenticated;
grant select, insert on public.client_account_log to service_role;
drop policy if exists client_account_log_admin_read on public.client_account_log;
create policy client_account_log_admin_read on public.client_account_log for select to authenticated using (public.is_admin());

-- ---------- comment le client se connecte, et ce qu'il a fait
create or replace function public.admin_client_account_info(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login text;
  v_admin boolean;
begin
  if not public.is_admin() then
    raise exception 'Non autorise';
  end if;
  select u.email, coalesce(p.is_admin, false) into v_login, v_admin
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = p_target;
  if not found then
    raise exception 'Client introuvable';
  end if;
  return jsonb_build_object(
    'login_email', v_login,
    'login_kind', case
      when lower(v_login) like 'closed-%@closed.albasseshopping.com' then 'closed'
      when lower(v_login) like '%@tel.albasseshopping.com' then 'phone'
      else 'email' end,
    'orders', (select count(*) from public.orders o where o.user_id = p_target),
    'is_admin', v_admin
  );
end;
$$;
revoke all on function public.admin_client_account_info(uuid) from public, anon;
grant execute on function public.admin_client_account_info(uuid) to authenticated;

-- ---------- modifier la fiche
create or replace function public.admin_update_client_profile(p_target uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.profiles%rowtype;
  v_login text;
  v_kind text;
  k text;
  v text;
  d text;
  allowed text[] := array['full_name', 'phone', 'whatsapp_number', 'email', 'region', 'country', 'address', 'profession'];
  n_name text; n_phone text; n_wa text; n_email text; n_region text; n_country text; n_address text; n_prof text;
  changed text[] := '{}';
begin
  if not public.is_admin() then
    raise exception 'Non autorise';
  end if;
  select * into o from public.profiles where id = p_target;
  if not found then
    raise exception 'Client introuvable';
  end if;
  if coalesce(o.is_admin, false) then
    raise exception 'Compte administrateur : non modifiable ici';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'Demande invalide';
  end if;
  for k in select jsonb_object_keys(p_changes) loop
    if not (k = any(allowed)) then
      raise exception 'Champ non modifiable : %', k;
    end if;
    if jsonb_typeof(p_changes -> k) not in ('string', 'null') then
      raise exception 'Valeur invalide pour %', k;
    end if;
  end loop;

  select u.email into v_login from auth.users u where u.id = p_target;
  v_kind := case
    when lower(coalesce(v_login, '')) like 'closed-%@closed.albasseshopping.com' then 'closed'
    when lower(coalesce(v_login, '')) like '%@tel.albasseshopping.com' then 'phone'
    else 'email' end;
  if v_kind = 'closed' then
    raise exception 'Compte fermé : non modifiable';
  end if;

  n_name := o.full_name; n_phone := o.phone; n_wa := o.whatsapp_number; n_email := o.email;
  n_region := o.region; n_country := o.country; n_address := o.address; n_prof := o.profession;

  if p_changes ? 'full_name' then
    v := btrim(coalesce(p_changes ->> 'full_name', ''));
    if char_length(v) < 2 or char_length(v) > 80 then
      raise exception 'Le nom doit avoir entre 2 et 80 caractères';
    end if;
    n_name := v; changed := changed || array['nom'];
  end if;

  if p_changes ? 'phone' then
    -- un compte connecté par son numéro : le téléphone de connexion se change avec « Changer le numéro de connexion » (sinon la connexion et la fiche se contrediraient)
    if v_kind = 'phone' then
      raise exception 'Le téléphone de connexion se change avec « Changer le numéro de connexion »';
    end if;
    v := btrim(coalesce(p_changes ->> 'phone', ''));
    if v = '' then
      n_phone := null;
    else
      if v !~ '^[+0-9 ().-]{6,25}$' or length(regexp_replace(v, '\D', '', 'g')) not between 8 and 15 then
        raise exception 'Numéro de téléphone invalide';
      end if;
      n_phone := v;
    end if;
    changed := changed || array['téléphone'];
  end if;

  if p_changes ? 'whatsapp_number' then
    v := btrim(coalesce(p_changes ->> 'whatsapp_number', ''));
    if v = '' then
      n_wa := null;
    else
      if v !~ '^[+0-9 ().-]{6,25}$' or length(regexp_replace(v, '\D', '', 'g')) not between 8 and 15 then
        raise exception 'Numéro WhatsApp invalide';
      end if;
      n_wa := v;
    end if;
    changed := changed || array['WhatsApp'];
  end if;

  if p_changes ? 'email' then
    -- un ancien compte (connexion par e-mail) : l'e-mail EST la connexion, il ne se change pas ici (Changer la connexion)
    if v_kind = 'email' then
      raise exception 'L''e-mail de connexion d''un ancien compte se change avec « Changer la connexion »';
    end if;
    v := lower(btrim(coalesce(p_changes ->> 'email', '')));
    if v = '' then
      n_email := v_login;   -- plus d'e-mail de contact : la fiche garde l'adresse tirée du numéro, comme à l'inscription sans e-mail
    else
      if v !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v) > 120 or v like '%@tel.albasseshopping.com' or v like '%@closed.albasseshopping.com' then
        raise exception 'Adresse e-mail invalide';
      end if;
      n_email := v;
    end if;
    changed := changed || array['e-mail'];
  end if;

  if p_changes ? 'region' then
    v := btrim(coalesce(p_changes ->> 'region', ''));
    if char_length(v) > 80 then raise exception 'Ville trop longue (80 caractères au plus)'; end if;
    n_region := nullif(v, ''); changed := changed || array['ville'];
  end if;
  if p_changes ? 'country' then
    v := btrim(coalesce(p_changes ->> 'country', ''));
    if char_length(v) > 80 then raise exception 'Pays trop long (80 caractères au plus)'; end if;
    n_country := nullif(v, ''); changed := changed || array['pays'];
  end if;
  if p_changes ? 'address' then
    v := btrim(coalesce(p_changes ->> 'address', ''));
    if char_length(v) > 200 then raise exception 'Adresse trop longue (200 caractères au plus)'; end if;
    n_address := nullif(v, ''); changed := changed || array['adresse'];
  end if;
  if p_changes ? 'profession' then
    v := btrim(coalesce(p_changes ->> 'profession', ''));
    if char_length(v) > 80 then raise exception 'Profession trop longue (80 caractères au plus)'; end if;
    n_prof := nullif(v, ''); changed := changed || array['profession'];
  end if;

  update public.profiles
     set full_name = n_name, phone = n_phone, whatsapp_number = n_wa, email = n_email,
         region = n_region, country = n_country, address = n_address, profession = n_prof
   where id = p_target;

  d := 'fiche modifiée : ' || array_to_string(changed, ', ');
  insert into public.client_account_log (admin_id, target_id, client_number, action, detail)
  values (auth.uid(), p_target, nullif(to_jsonb(o) ->> 'client_number', '')::integer, 'edit', d);
end;
$$;
revoke all on function public.admin_update_client_profile(uuid, jsonb) from public, anon;
grant execute on function public.admin_update_client_profile(uuid, jsonb) to authenticated;
