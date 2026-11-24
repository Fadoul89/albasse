-- Les clics sur les notifications push n'etaient comptes que pour celles programmees
-- manuellement par l'admin (scheduled_pushes, add-push-clicks.sql). Les notifications
-- AUTOMATIQUES de Zara (nouvel article / promotion, via le gardien push_outbox ->
-- product_notifications, add-push-gate.sql) n'avaient pas de colonne clicks : le service
-- worker (public/sw.js) envoyait bien la marque de clic pour ces notifications aussi, mais
-- record_push_click ne cherchait que dans scheduled_pushes, donc le clic etait silencieusement
-- ignore.
--
-- Desormais record_push_click cherche d'abord dans scheduled_pushes (inchange), puis, sans
-- correspondance, dans product_notifications (meme methode : 16 premiers caracteres du
-- SHA-256 de "titre + retour a la ligne + message", 30 derniers jours).
alter table public.product_notifications add column if not exists clicks integer not null default 0;

create or replace function public.record_push_click(p_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{16}$' then
    return false;
  end if;

  -- 1) notification programmee par l'administrateur (scheduled_pushes)
  select id into v_id
    from scheduled_pushes
    where status = 'sent'
      and sent_at > now() - interval '30 days'
      and left(encode(sha256(convert_to(title || E'\n' || message, 'UTF8')), 'hex'), 16) = p_hash
    order by sent_at desc
    limit 1;
  if v_id is not null then
    update scheduled_pushes set clicks = clicks + 1 where id = v_id;
    return true;
  end if;

  -- 2) notification automatique de Zara (product_notifications, via le gardien push_outbox)
  select id into v_id
    from product_notifications
    where created_at > now() - interval '30 days'
      and left(encode(sha256(convert_to(title || E'\n' || message, 'UTF8')), 'hex'), 16) = p_hash
    order by created_at desc
    limit 1;
  if v_id is not null then
    update product_notifications set clicks = clicks + 1 where id = v_id;
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.record_push_click(text) from public;
grant execute on function public.record_push_click(text) to anon, authenticated;
