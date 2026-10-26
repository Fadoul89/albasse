-- Zara SEO : Zara propose la description des fiches faibles (fonction « zara-seo »), l'administrateur valide, ce script publie et peut annuler.
-- À lancer dans Supabase › SQL Editor (sans danger à relancer). Aucune description n'est modifiée par ce script lui-même.
--
--   • products.description_before_zara : la description d'AVANT la première modification par Zara (texte vide si l'article n'en avait pas) :
--     rien n'est jamais perdu, « Remettre l'ancienne » la restaure.
--   • products.description_zara_at : quand Zara a écrit la description actuelle (vide = description saisie par la boutique).
--   • zara_apply_seo(items) : réservée aux administrateurs (contrôle is_admin() dans la fonction ; les visiteurs n'ont même pas le droit de l'appeler).
--     Remplace la description des articles donnés, après contrôle (40 à 600 caractères, sans balises).
--   • zara_undo_seo(ids) : remet l'ancienne description.
-- Aucune nouvelle table : pas de « grant » de table à ajouter.

alter table public.products add column if not exists description_before_zara text;
alter table public.products add column if not exists description_zara_at timestamptz;

create or replace function public.zara_apply_seo(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it jsonb;
  v_id uuid;
  v_text text;
  cur record;
  n integer := 0;
  skipped jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'liste d''articles attendue';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    begin
      v_id := (it ->> 'id')::uuid;
    exception when others then
      skipped := skipped || jsonb_build_object('id', it ->> 'id', 'reason', 'identifiant invalide');
      continue;
    end;

    v_text := regexp_replace(btrim(coalesce(it ->> 'description', '')), '\s+', ' ', 'g');
    if length(v_text) < 40 or length(v_text) > 600 then
      skipped := skipped || jsonb_build_object('id', v_id, 'reason', 'longueur (40 à 600 caractères)');
      continue;
    end if;
    if v_text ~ '[<>]' then
      skipped := skipped || jsonb_build_object('id', v_id, 'reason', 'balises interdites');
      continue;
    end if;

    select id, description, description_zara_at into cur from public.products where id = v_id for update;
    if not found then
      skipped := skipped || jsonb_build_object('id', v_id, 'reason', 'article introuvable');
      continue;
    end if;

    update public.products
       set description_before_zara = case when cur.description_zara_at is null then coalesce(cur.description, '') else description_before_zara end,
           description = v_text,
           description_zara_at = now()
     where id = v_id;
    n := n + 1;
  end loop;

  return jsonb_build_object('applied', n, 'skipped', skipped);
end;
$$;
revoke all on function public.zara_apply_seo(jsonb) from public, anon;
grant execute on function public.zara_apply_seo(jsonb) to authenticated;

create or replace function public.zara_undo_seo(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;
  update public.products
     set description = coalesce(description_before_zara, ''),
         description_before_zara = null,
         description_zara_at = null
   where id = any(coalesce(p_ids, '{}')) and description_zara_at is not null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.zara_undo_seo(uuid[]) from public, anon;
grant execute on function public.zara_undo_seo(uuid[]) to authenticated;

-- Pour tout remettre comme avant (toutes les descriptions écrites par Zara) :
--   update public.products set description = coalesce(description_before_zara, ''), description_before_zara = null, description_zara_at = null
--   where description_zara_at is not null;
