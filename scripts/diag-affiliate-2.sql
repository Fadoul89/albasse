select id, shipping_name, session_id, created_at
from orders
order by created_at desc
limit 5;
