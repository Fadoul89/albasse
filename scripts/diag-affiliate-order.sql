-- Verifie si la commande de Walid est bien liee a une session avec code de parrainage
select o.id, o.shipping_name, o.session_id, o.created_at,
       vs.id as session_found, vs.referral_code, vs.started_at as session_started
from orders o
left join visitor_sessions vs on vs.id = o.session_id
where o.shipping_name ilike '%Walid%'
order by o.created_at desc;

-- Verifie si le trigger existe bien sur la table orders
select tgname, tgenabled
from pg_trigger
where tgrelid = 'orders'::regclass and not tgisinternal;
