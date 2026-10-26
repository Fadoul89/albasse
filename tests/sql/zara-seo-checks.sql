-- Contrôles de add-zara-seo.sql sur un Postgres local jetable (voir tests/sql/run-zara-seo.sh).
create schema t;
grant usage on schema t to public;

create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK    %', label; else raise exception 'ECHEC %', label; end if;
end $$;
create function t.fails(label text, stmt text, expect text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like '%' || expect || '%' then raise notice 'OK    % (refusé : %)', label, sqlerrm; return; end if;
    raise exception 'ECHEC % : refusé mais autre message : %', label, sqlerrm;
  end;
  raise exception 'ECHEC % : aurait dû être refusé', label;
end $$;

insert into public.profiles(id, is_admin) values ('aaaaaaaa-0000-4000-8000-000000000001', true), ('bbbbbbbb-0000-4000-8000-000000000002', false);
create function t.as_admin() returns void language sql as $$ select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', false) $$;
create function t.as_client() returns void language sql as $$ select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', false) $$;
create function t.as_visitor() returns void language sql as $$ select set_config('request.jwt.claim.sub', '', false) $$;
create function t.id(p_slug text) returns uuid language sql as $$ select id from public.products where slug = p_slug $$;

-- 0. le script a bien ajouté ses colonnes, et n'a modifié aucune description
select t.ok('colonnes ajoutées (description_before_zara, description_zara_at)',
  (select count(*) from information_schema.columns where table_name = 'products' and column_name in ('description_before_zara', 'description_zara_at')) = 2);
select t.ok('aucune description modifiée par le script lui-même',
  (select count(*) = 0 from public.products where description_zara_at is not null or description_before_zara is not null)
  and (select description = 'Ancienne description de la boutique' from public.products where slug = 'c'));

-- 1. les droits : seuls les administrateurs
select t.as_visitor();
set role anon;
select t.fails('un visiteur ne peut pas publier', 'select public.zara_apply_seo(''[]''::jsonb)', 'permission denied');
select t.fails('un visiteur ne peut pas annuler', 'select public.zara_undo_seo(array[]::uuid[])', 'permission denied');
reset role;
select t.as_client();
set role authenticated;
select t.fails('un client connecté (pas administrateur) ne peut pas publier', 'select public.zara_apply_seo(''[]''::jsonb)', 'réservé aux administrateurs');
select t.fails('un client connecté ne peut pas annuler', 'select public.zara_undo_seo(array[]::uuid[])', 'réservé aux administrateurs');
reset role;
select t.ok('rien n''a changé après ces refus', (select count(*) = 0 from public.products where description_zara_at is not null));

-- 2. l'administrateur publie : 1 bonne, 1 trop courte, 1 avec balise, 1 inconnue, 1 identifiant invalide, 1 trop longue
select t.as_admin();
set role authenticated;
create temp table res as select public.zara_apply_seo(jsonb_build_array(
  jsonb_build_object('id', t.id('a'), 'description', 'Montre homme au cadran blanc et bracelet noir. À commander sur Albasse Shopping, boutique en ligne au Tchad.'),
  jsonb_build_object('id', t.id('b'), 'description', 'Trop court'),
  jsonb_build_object('id', t.id('c'), 'description', 'Description avec <b>balise</b> interdite, assez longue pour passer la longueur.'),
  jsonb_build_object('id', '00000000-0000-4000-8000-00000000dead', 'description', 'Un article qui n''existe pas dans la boutique, assez long pour la règle.'),
  jsonb_build_object('id', 'pas-un-uuid', 'description', 'Identifiant invalide, assez long pour passer la règle de longueur minimale.'),
  jsonb_build_object('id', t.id('d'), 'description', repeat('x', 601))
)) as r;
grant select on res to public;
reset role;
select t.ok('1 publiée, 5 refusées', (select (r ->> 'applied')::int = 1 and jsonb_array_length(r -> 'skipped') = 5 from res));
select t.ok('la bonne description est publiée', (select description like 'Montre homme au cadran blanc%' and description_zara_at is not null from public.products where slug = 'a'));
select t.ok('article sans description (null) : l''original gardé est un texte vide', (select description_before_zara = '' from public.products where slug = 'a'));
select t.ok('les refusées n''ont rien changé',
  (select description = '' and description_zara_at is null from public.products where slug = 'b')
  and (select description = 'Ancienne description de la boutique' and description_zara_at is null from public.products where slug = 'c')
  and (select description = 'Courte' and description_zara_at is null from public.products where slug = 'd'));
select t.ok('le prix, le stock et le nom ne changent jamais', (select price = 10000 and stock = 10 and name = 'Article A' and slug = 'a' from public.products where slug = 'a'));

-- 3. publier sur un article qui avait une description : l'ancienne est gardée ; une 2e fois : la toute première est gardée
select t.as_admin();
set role authenticated;
select public.zara_apply_seo(jsonb_build_array(jsonb_build_object('id', t.id('c'), 'description', 'Nouvelle description de Zara, claire et utile pour l''acheteur comme pour Google.')));
reset role;
select t.ok('l''ancienne description est gardée', (select description_before_zara = 'Ancienne description de la boutique' and description like 'Nouvelle description de Zara%' from public.products where slug = 'c'));
select t.as_admin();
set role authenticated;
select public.zara_apply_seo(jsonb_build_array(jsonb_build_object('id', t.id('c'), 'description', 'Deuxième version de Zara pour le même article, toujours claire et utile pour Google.')));
reset role;
select t.ok('2e publication : la toute première description d''origine est toujours gardée', (select description_before_zara = 'Ancienne description de la boutique' and description like 'Deuxième version%' from public.products where slug = 'c'));

-- 4. espaces et retours à la ligne nettoyés
select t.as_admin();
set role authenticated;
select public.zara_apply_seo(jsonb_build_array(jsonb_build_object('id', t.id('e'), 'description', E'  Ligne un   avec espaces.\n\n  Ligne deux, toujours assez longue pour la règle.  ')));
reset role;
select t.ok('texte sur une seule ligne, espaces réduits', (select description = 'Ligne un avec espaces. Ligne deux, toujours assez longue pour la règle.' from public.products where slug = 'e'));

-- 5. annuler
select t.as_admin();
set role authenticated;
create temp table un as select public.zara_undo_seo(array[t.id('a'), t.id('c'), t.id('b')]) as n;
grant select on un to public;
reset role;
select t.ok('2 annulées (la 3e n''avait jamais été modifiée par Zara)', (select n = 2 from un));
select t.ok('descriptions d''origine remises, repères effacés',
  (select description = '' and description_before_zara is null and description_zara_at is null from public.products where slug = 'a')
  and (select description = 'Ancienne description de la boutique' and description_before_zara is null and description_zara_at is null from public.products where slug = 'c'));
select t.ok('la fiche non annulée garde le texte de Zara', (select description_zara_at is not null from public.products where slug = 'e'));

-- 6. rien d'autre n'a bougé
select t.ok('aucun prix ni stock modifié dans tout le catalogue',
  (select sum(price) = 10000 + 5000 + 7000 + 3000 + 9000 and sum(stock) = 10 + 10 + 10 + 0 + 10 from public.products));
