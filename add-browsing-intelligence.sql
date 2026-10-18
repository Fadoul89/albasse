-- BROUILLON : intelligence commerciale de Zara (suivi de navigation). PAS ENCORE APPLIQUÉ à la vraie base.
--
-- But : garder, pour chaque visiteur (identifiant anonyme) ou compte client, les articles regardés, le nombre de consultations,
-- le temps ACTIF passé sur chaque fiche, les clics sur variantes, le panier, les recherches et le niveau d'intérêt estimé, pour
-- le tableau de suivi de l'administrateur. Zara, elle, lit d'abord le profil gardé sur le téléphone du visiteur.
--
-- Vie privée :
--   * seulement un identifiant anonyme (le même que les statistiques de visites) et, si le client est connecté, son compte ;
--   * jamais de nom, de téléphone, de message ; les recherches qui ressemblent à un numéro ou une adresse e-mail ne partent pas ;
--   * le visiteur peut refuser le suivi : le site n'envoie plus rien et appelle forget_browsing pour effacer ce qui existe ;
--   * conservation 90 jours : effacement automatique à chaque envoi (1 fois sur 50), ou à la main : select public.purge_browsing_data();
--   * seul l'administrateur peut lire (fonction browsing_overview) ; l'administrateur voit des références anonymes, pas l'identifiant brut.
--
-- Chaque envoi du site porte un numéro unique (p_batch_id) : si la connexion coupe et que le site renvoie le même courrier,
-- la base le reconnaît et ne le compte qu'une fois.
--
-- Tant que ce script n'est pas appliqué : le site marche comme avant, Zara utilise le profil du téléphone, rien ne part vers la base
-- (le site réessaie doucement) et le tableau de suivi dit « pas encore activé ».
--
-- Pour annuler (tout supprimer) :
--   drop function if exists public.browsing_overview(timestamptz, integer);
--   drop function if exists public.forget_browsing(text);
--   drop function if exists public.track_browsing(text, text, uuid, jsonb, jsonb);
--   drop function if exists public.purge_browsing_data(integer);
--   drop function if exists public.browsing_int(text, integer);
--   drop table if exists public.browsing_searches;
--   drop table if exists public.browsing_batches;
--   drop table if exists public.visitor_product_interest;

-- 1. Un article regardé par un visiteur : une ligne, mise à jour à chaque envoi
create table if not exists public.visitor_product_interest (
  visitor_id text not null,
  product_id text not null,
  user_id uuid,
  session_id text,
  product_name text,
  category_slug text,
  category_name text,
  views integer not null default 0,
  sessions integer not null default 0,
  active_seconds integer not null default 0,
  last_duration_seconds integer not null default 0,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  image_clicks integer not null default 0,
  size_clicks integer not null default 0,
  color_clicks integer not null default 0,
  returns_after_others integer not null default 0,
  cart_status text not null default 'none' check (cart_status in ('none', 'in_cart', 'removed', 'purchased')),
  interest text not null default 'leger' check (interest in ('leger', 'moyen', 'eleve')),
  last_suggestion_kind text,
  last_suggestion_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (visitor_id, product_id)
);

create index if not exists visitor_product_interest_last_viewed_idx on public.visitor_product_interest (last_viewed_at);
create index if not exists visitor_product_interest_user_idx on public.visitor_product_interest (user_id);

alter table public.visitor_product_interest enable row level security;
drop policy if exists visitor_product_interest_admin_read on public.visitor_product_interest;
create policy visitor_product_interest_admin_read on public.visitor_product_interest
  for select
  using (public.is_admin());

-- 2. Les recherches faites sur le site
create table if not exists public.browsing_searches (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  query text not null,
  searched_at timestamptz not null default now()
);

create index if not exists browsing_searches_searched_at_idx on public.browsing_searches (searched_at);
create index if not exists browsing_searches_visitor_idx on public.browsing_searches (visitor_id);

alter table public.browsing_searches enable row level security;
drop policy if exists browsing_searches_admin_read on public.browsing_searches;
create policy browsing_searches_admin_read on public.browsing_searches
  for select
  using (public.is_admin());

-- 3. Les numéros d'envoi déjà reçus (pour ne jamais compter deux fois le même courrier) ; personne ne peut les lire
create table if not exists public.browsing_batches (
  batch_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.browsing_batches enable row level security;

-- 4. Un nombre entier sûr : valeur illisible ou négative = 0, plafonnée
create or replace function public.browsing_int(p text, p_max integer default 1000000) returns integer
language plpgsql
immutable
as $$
begin
  if p is null or p !~ '^-?[0-9]+(\.[0-9]+)?$' then
    return 0;
  end if;
  return greatest(0, least(round(p::numeric), p_max::numeric))::integer;
exception when others then
  return 0;
end;
$$;

-- 5. Effacement après 90 jours (appelé de temps en temps par les envois ; réservé au système et à l'administrateur de la base)
create or replace function public.purge_browsing_data(p_days integer default 90) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.visitor_product_interest where coalesce(last_viewed_at, updated_at) < now() - make_interval(days => greatest(p_days, 1));
  delete from public.browsing_searches where searched_at < now() - make_interval(days => greatest(p_days, 1));
  delete from public.browsing_batches where created_at < now() - interval '7 days';
end;
$$;

revoke all on function public.purge_browsing_data(integer) from public;
revoke all on function public.purge_browsing_data(integer) from anon;
revoke all on function public.purge_browsing_data(integer) from authenticated;

-- 6. Réception d'un envoi du site : seulement des DIFFÉRENCES (jamais des totaux), avec un numéro d'envoi unique
create or replace function public.track_browsing(
  p_visitor_id text,
  p_session_id text,
  p_batch_id uuid,
  p_items jsonb,
  p_searches jsonb default '[]'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  s jsonb;
  n integer;
  pid text;
  cart text;
  level text;
  viewed timestamptz;
  sugg_at timestamptz;
  q text;
  searched timestamptz;
begin
  if p_visitor_id is null or length(p_visitor_id) < 8 or length(p_visitor_id) > 64 or p_batch_id is null then
    return;
  end if;

  -- déjà reçu (le site a renvoyé le même courrier après une coupure) : rien n'est recompté
  insert into public.browsing_batches (batch_id) values (p_batch_id) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    return;
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) = 'array' then
    for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) limit 60 loop
      pid := left(coalesce(item->>'product_id', ''), 64);
      continue when pid = '';
      cart := case when item->>'cart_status' in ('none', 'in_cart', 'removed', 'purchased') then item->>'cart_status' else 'none' end;
      level := case when item->>'interest' in ('leger', 'moyen', 'eleve') then item->>'interest' else 'leger' end;
      begin viewed := (item->>'last_viewed_at')::timestamptz; exception when others then viewed := null; end;
      begin sugg_at := (item->>'last_suggestion_at')::timestamptz; exception when others then sugg_at := null; end;

      insert into public.visitor_product_interest as t (
        visitor_id, product_id, user_id, session_id, product_name, category_slug, category_name,
        views, sessions, active_seconds, last_duration_seconds, first_viewed_at, last_viewed_at,
        image_clicks, size_clicks, color_clicks, returns_after_others, cart_status, interest,
        last_suggestion_kind, last_suggestion_at, updated_at
      ) values (
        p_visitor_id, pid, uid, left(p_session_id, 64), left(item->>'name', 200), left(item->>'category_slug', 100), left(item->>'category_name', 100),
        public.browsing_int(item->>'views', 100000), public.browsing_int(item->>'sessions', 100000),
        public.browsing_int(item->>'active_seconds', 86400), public.browsing_int(item->>'last_duration_seconds', 86400),
        coalesce(viewed, now()), viewed,
        public.browsing_int(item->>'image_clicks', 100000), public.browsing_int(item->>'size_clicks', 100000), public.browsing_int(item->>'color_clicks', 100000),
        public.browsing_int(item->>'returns_after_others', 100000), cart, level,
        left(item->>'last_suggestion_kind', 40), sugg_at, now()
      )
      on conflict (visitor_id, product_id) do update set
        user_id = coalesce(excluded.user_id, t.user_id),
        session_id = coalesce(excluded.session_id, t.session_id),
        product_name = coalesce(excluded.product_name, t.product_name),
        category_slug = coalesce(excluded.category_slug, t.category_slug),
        category_name = coalesce(excluded.category_name, t.category_name),
        views = t.views + excluded.views,
        sessions = t.sessions + excluded.sessions,
        active_seconds = t.active_seconds + excluded.active_seconds,
        last_duration_seconds = case when excluded.last_viewed_at is not null and excluded.last_viewed_at >= coalesce(t.last_viewed_at, '-infinity'::timestamptz) then excluded.last_duration_seconds else t.last_duration_seconds end,
        last_viewed_at = greatest(coalesce(t.last_viewed_at, '-infinity'::timestamptz), coalesce(excluded.last_viewed_at, '-infinity'::timestamptz)),
        image_clicks = t.image_clicks + excluded.image_clicks,
        size_clicks = t.size_clicks + excluded.size_clicks,
        color_clicks = t.color_clicks + excluded.color_clicks,
        returns_after_others = t.returns_after_others + excluded.returns_after_others,
        -- un achat reste un achat : un envoi en retard qui dit « retiré » ne le défait pas
        cart_status = case when t.cart_status = 'purchased' and excluded.cart_status <> 'purchased' then t.cart_status else excluded.cart_status end,
        interest = excluded.interest,
        last_suggestion_kind = coalesce(excluded.last_suggestion_kind, t.last_suggestion_kind),
        last_suggestion_at = greatest(coalesce(t.last_suggestion_at, '-infinity'::timestamptz), coalesce(excluded.last_suggestion_at, '-infinity'::timestamptz)),
        updated_at = now();
    end loop;
  end if;

  if jsonb_typeof(coalesce(p_searches, '[]'::jsonb)) = 'array' then
    for s in select value from jsonb_array_elements(coalesce(p_searches, '[]'::jsonb)) limit 20 loop
      q := lower(btrim(coalesce(s->>'q', '')));
      -- jamais un numéro, une adresse e-mail, un lien ou un texte trop long (on ne cherche pas à identifier quelqu'un)
      continue when length(q) < 2 or length(q) > 60 or q ~ '@' or q ~ 'https?:|www\.' or length(regexp_replace(q, '[^0-9]', '', 'g')) >= 6;
      begin searched := (s->>'at')::timestamptz; exception when others then searched := now(); end;
      insert into public.browsing_searches (visitor_id, query, searched_at) values (p_visitor_id, q, least(coalesce(searched, now()), now()));
    end loop;
  end if;

  -- effacement des données de plus de 90 jours : 1 envoi sur 50, sans rien demander à personne
  if random() < 0.02 then
    perform public.purge_browsing_data(90);
  end if;
end;
$$;

revoke all on function public.track_browsing(text, text, uuid, jsonb, jsonb) from public;
grant execute on function public.track_browsing(text, text, uuid, jsonb, jsonb) to anon, authenticated;

-- 7. Le visiteur refuse le suivi : tout ce qui le concerne est effacé (il connaît son identifiant anonyme, personne d'autre)
create or replace function public.forget_browsing(p_visitor_id text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor_id is null or length(p_visitor_id) < 8 or length(p_visitor_id) > 64 then
    return;
  end if;
  delete from public.visitor_product_interest where visitor_id = p_visitor_id;
  delete from public.browsing_searches where visitor_id = p_visitor_id;
end;
$$;

revoke all on function public.forget_browsing(text) from public;
grant execute on function public.forget_browsing(text) to anon, authenticated;

-- 8. Le tableau de suivi (administrateur seulement) : lignes + résumé. Références anonymes (V-xxxxxx), compte client (C-xxxxxxxx) si connecté.
create or replace function public.browsing_overview(p_since timestamptz default null, p_limit integer default 300) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since timestamptz := coalesce(p_since, '-infinity'::timestamptz);
  lim integer := greatest(1, least(coalesce(p_limit, 300), 1000));
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(r order by r.last_viewed_at desc nulls last)
      from (
        select
          'V-' || left(md5(t.visitor_id), 6) as visitor_ref,
          case when t.user_id is not null then 'C-' || left(t.user_id::text, 8) end as account_ref,
          t.session_id,
          t.product_id,
          t.product_name,
          t.category_name,
          t.views,
          t.sessions,
          t.active_seconds,
          t.last_duration_seconds,
          t.last_viewed_at,
          t.image_clicks + t.size_clicks + t.color_clicks as variant_clicks,
          t.cart_status,
          -- statut de la commande du client connecté pour cet article, s'il en a passé une
          case when t.user_id is not null then (
            select o.status from public.orders o
            where o.user_id = t.user_id and o.items @> jsonb_build_array(jsonb_build_object('product_id', t.product_id))
            order by o.created_at desc limit 1
          ) end as order_status,
          t.interest,
          t.last_suggestion_kind,
          t.last_suggestion_at
        from public.visitor_product_interest t
        where coalesce(t.last_viewed_at, t.updated_at) >= since
        order by t.last_viewed_at desc nulls last
        limit lim
      ) r
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(x order by x.views desc, x.active_seconds desc)
      from (
        select product_id, max(product_name) as product_name, max(category_name) as category_name,
               sum(views)::integer as views, sum(active_seconds)::integer as active_seconds, count(*)::integer as visitors,
               count(*) filter (where interest = 'eleve')::integer as high_interest
        from public.visitor_product_interest
        where coalesce(last_viewed_at, updated_at) >= since
        group by product_id
        order by sum(views) desc, sum(active_seconds) desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'top_categories', coalesce((
      select jsonb_agg(x order by x.views desc)
      from (
        select coalesce(max(category_name), category_slug) as category, sum(views)::integer as views, count(distinct visitor_id)::integer as visitors
        from public.visitor_product_interest
        where category_slug is not null and coalesce(last_viewed_at, updated_at) >= since
        group by category_slug
        order by sum(views) desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'top_searches', coalesce((
      select jsonb_agg(x order by x.n desc)
      from (
        select query, count(*)::integer as n
        from public.browsing_searches
        where searched_at >= since
        group by query
        order by count(*) desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'levels', coalesce((
      select jsonb_object_agg(interest, n)
      from (
        select interest, count(*)::integer as n
        from public.visitor_product_interest
        where coalesce(last_viewed_at, updated_at) >= since
        group by interest
      ) x
    ), '{}'::jsonb),
    'totals', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from public.visitor_product_interest where coalesce(last_viewed_at, updated_at) >= since),
      'rows', (select count(*) from public.visitor_product_interest where coalesce(last_viewed_at, updated_at) >= since)
    )
  );
end;
$$;

revoke all on function public.browsing_overview(timestamptz, integer) from public;
revoke all on function public.browsing_overview(timestamptz, integer) from anon;
grant execute on function public.browsing_overview(timestamptz, integer) to authenticated;

-- Demande à l'API du site de relire la liste des tables et fonctions tout de suite
notify pgrst, 'reload schema';
