-- Interrupteur « Notification automatique des nouveaux articles » (ÉTEINT par défaut).
--
-- Avant : chaque article publié (notify_on_publish est vrai par défaut) envoyait tout de suite une notification à tous les téléphones abonnés.
-- Maintenant : tant que l'interrupteur est éteint, publier un article n'envoie AUCUNE notification (ni sur les téléphones, ni dans la cloche
-- des clients). Pour les rallumer plus tard : page « Promotions intelligentes » › interrupteur « Notification automatique des nouveaux
-- articles », ou   update store_settings set push_new_products_enabled = true where id = 1;
--
-- Ce script marche seul, et aussi avec le gardien des notifications (add-push-gate.sql, qui contient la même fonction) : quand le gardien
-- est installé, une notification de nouvel article attend dans sa file (une seule à la fois, aux bonnes heures) au lieu de partir tout de suite.
-- Les ventes flash et les notifications programmées ne changent pas. Sans danger à relancer, dans n'importe quel ordre.

alter table public.store_settings add column if not exists push_new_products_enabled boolean not null default false;

create or replace function public.notify_new_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_on boolean;
begin
  if new.notify_on_publish then
    select push_new_products_enabled into new_on from store_settings where id = 1;
    if coalesce(new_on, false) then
      if to_regprocedure('public.push_enqueue(uuid,text,text,text)') is not null then
        perform public.push_enqueue(new.id, 'new', '🛍️ Nouveau produit disponible', new.name || ' — ' || new.price || ' FCFA');
      else
        insert into product_notifications (product_id, title, message)
        values (new.id, '🛍️ Nouveau produit disponible', new.name || ' — ' || new.price || ' FCFA');
      end if;
    end if;
  end if;
  return new;
end;
$$;
