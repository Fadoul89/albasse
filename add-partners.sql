-- Partenaires locaux : certains articles du site appartiennent à des partenaires. Pour ne plus oublier à qui est l'article quand une commande arrive,
-- le patron (et lui seul) garde la liste de ses partenaires et associe chaque article à un partenaire, avec un petit message privé facultatif.
--
--   • partners          : la liste des partenaires (nom, téléphone, petit mot) ;
--   • product_partners  : « cet article appartient à ce partenaire » + un petit message privé sur l'article.
--
-- CONFIDENTIEL : ces deux tables ne sont lisibles et modifiables que par les administrateurs (sécurité par ligne). Le lien article → partenaire n'est PAS une colonne
-- de la table « products » (qui est publique) : il ne voyage jamais avec les articles montrés aux clients. Ni la facture, ni le site client ne le montrent.
-- Supprimer un partenaire retire seulement le lien de ses articles (les articles ne sont jamais touchés). Supprimer un article retire son lien.
--
-- Ce script change aussi l'alerte Telegram de nouvelle commande : sous chaque article qui a un partenaire, une ligne « 🤝 Partenaire : nom · téléphone — petit message ».
-- Une commande sans article de partenaire donne exactement le même message qu'avant. Une commande n'échoue jamais à cause de l'alerte.
-- Sans danger à relancer.

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  phone text check (phone is null or char_length(phone) <= 40),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create table if not exists public.product_partners (
  product_id uuid primary key references public.products(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists product_partners_partner_idx on public.product_partners (partner_id);

-- Supabase ne donne plus d'accès automatique aux nouvelles tables : seuls les comptes connectés ont des droits, et la sécurité par ligne ne laisse passer que les administrateurs.
alter table public.partners enable row level security;
alter table public.product_partners enable row level security;
revoke all on public.partners from public, anon, authenticated;
revoke all on public.product_partners from public, anon, authenticated;
grant select, insert, update, delete on public.partners to authenticated;
grant select, insert, update, delete on public.product_partners to authenticated;

drop policy if exists partners_admin_all on public.partners;
create policy partners_admin_all on public.partners for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists product_partners_admin_all on public.product_partners;
create policy product_partners_admin_all on public.product_partners for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- L'alerte Telegram de nouvelle commande, avec le partenaire de chaque article (si l'article en a un).
create or replace function public.telegram_notify_admin_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tok text;
  r record;
  articles text;
  txt text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  if tok is null then
    return new;
  end if;
  select string_agg(
           '• ' || coalesce(i.item->>'product_name', 'Article') || ' × ' || coalesce(i.item->>'quantity', '1')
           || coalesce(
                E'\n' || '   🤝 Partenaire : ' || pt.name
                || coalesce(' · ' || nullif(btrim(pt.phone), ''), '')
                || coalesce(' — ' || nullif(btrim(pp.note), ''), ''),
                ''),
           E'\n' order by i.ord)
    into articles
    from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) with ordinality as i(item, ord)
    left join public.product_partners pp
      on pp.product_id = case when (i.item->>'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (i.item->>'product_id')::uuid end
    left join public.partners pt on pt.id = pp.partner_id;
  txt := '🛒 Nouvelle commande' || E'\n'
      || coalesce(new.shipping_name, '') || ' · ' || coalesce(new.shipping_phone, '') || E'\n'
      || coalesce(new.shipping_city, '') || E'\n'
      || coalesce(articles || E'\n', '')
      || '💰 ' || replace(to_char(new.total, 'FM999,999,999'), ',', ' ') || ' FCFA';
  for r in select telegram_chat_id from public.profiles where is_admin and telegram_chat_id is not null loop
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
      body := jsonb_build_object('chat_id', r.telegram_chat_id, 'text', txt)
    );
  end loop;
  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.telegram_notify_admin_new_order() from public, anon, authenticated;
