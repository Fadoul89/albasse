-- Vrai nombre de personnes en ligne (petit compteur « ● 3 en ligne » en haut de l'accueil, à la place du nombre inventé).
-- Compte les appareils différents dont le site a donné signe de vie depuis 70 secondes (le site envoie un signal toutes les 20 s).
-- Ne renvoie qu'un nombre : aucune donnée des visiteurs n'est lisible. Sans danger à relancer.
create or replace function public.online_visitors_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct coalesce(visitor_id, id::text))::integer
  from public.visitor_sessions
  where started_at > now() - interval '12 hours'
    and last_seen_at > now() - interval '70 seconds';
$$;

revoke all on function public.online_visitors_count() from public;
grant execute on function public.online_visitors_count() to anon, authenticated;
