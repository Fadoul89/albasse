select id, referral_code, user_id, started_at
from visitor_sessions
order by started_at desc
limit 5;
