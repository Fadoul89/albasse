-- Sous-catégories (demande du patron, 5 novembre 2026) : une catégorie peut avoir un « parent » (ex. « Vêtements » › « Chemises »).
-- UN SEUL niveau : une sous-catégorie n'a pas de sous-catégorie. Les articles gardent leur catégorie (category_id), qui peut être une sous-catégorie.
-- Sans danger à relancer : rien n'est supprimé, aucune catégorie ni aucun article n'est modifié (toutes les catégories restent « principales » tant que
-- l'administrateur n'a pas créé de sous-catégorie dans Admin › Catégories).
-- Pas de nouvelle table : les droits et la sécurité de la table « categories » (lecture pour tous, écriture pour l'administrateur) restent ceux d'aujourd'hui.

alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete set null;
-- supprimer une catégorie principale : ses sous-catégories deviennent des catégories principales (leurs articles restent classés)

create index if not exists categories_parent_idx on public.categories(parent_id);

-- Garde-fou (même si l'écran de l'administrateur le refuse déjà) : un seul niveau, jamais sa propre sous-catégorie
create or replace function public.categories_one_level()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'Une catégorie ne peut pas être sa propre catégorie principale.';
  end if;
  if exists (select 1 from public.categories c where c.id = new.parent_id and c.parent_id is not null) then
    raise exception 'Une sous-catégorie ne peut pas avoir de sous-catégorie : un seul niveau.';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.categories c where c.parent_id = new.id) then
    raise exception 'Cette catégorie a déjà des sous-catégories : elle reste une catégorie principale.';
  end if;
  return new;
end;
$$;

drop trigger if exists categories_one_level on public.categories;
create trigger categories_one_level
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_one_level();
