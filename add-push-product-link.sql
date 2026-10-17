-- Notifications push du site : ouvrir la fiche du produit au toucher.
--
-- Avant : la notification ne contenait que le titre et le texte, donc le toucher
-- ramenait toujours a l'accueil. Le declencheur envoie maintenant aussi l'identifiant
-- du produit a la fonction « send-web-push », qui en fait l'adresse /produit/<slug>
-- placee dans la notification (public/sw.js l'ouvre au toucher).
--
-- La fonction existante est modifiee sur place : le secret du webhook n'est pas
-- recopie ici. Sans danger a relancer, ne fait rien si c'est deja fait.
do $$
declare
  def text := pg_get_functiondef('public.push_notify_product_notification()'::regprocedure);
  nouveau text;
begin
  nouveau := regexp_replace(
    def,
    '(functions/v1/send-web-push''\s*,\s*body := jsonb_build_object\(''title'', new\.title, ''message'', new\.message)\)',
    E'\\1, ''product_id'', new.product_id)'
  );
  if nouveau <> def then
    execute nouveau;
  end if;
end;
$$;
