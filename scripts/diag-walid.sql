select o.id, o.shipping_name, o.session_id, vs.referral_code
from orders o
left join visitor_sessions vs on vs.id = o.session_id
where o.shipping_name ilike '%Walid%'
order by o.created_at desc;
