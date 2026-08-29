-- Diagnostic programme d'affiliation : a coller dans Supabase SQL Editor

-- 1. Le compte affilie est-il bien configure ?
select id, email, full_name, is_affiliate, affiliate_status, referral_code
from profiles
where is_affiliate = true;

-- 2. Des visites ont-elles ete enregistrees avec un code de parrainage ?
select id, referral_code, user_id, started_at
from visitor_sessions
where referral_code is not null
order by started_at desc
limit 10;

-- 3. Les dernieres commandes, et si elles sont liees a une session avec code
select o.id, o.total, o.status, o.session_id, o.user_id, o.created_at,
       vs.referral_code
from orders o
left join visitor_sessions vs on vs.id = o.session_id
order by o.created_at desc
limit 10;

-- 4. Des commissions ont-elles ete creees ?
select * from affiliate_commissions order by created_at desc limit 10;

-- 5. Le taux de commission par defaut est-il bien configure (pas 0) ?
select * from affiliate_settings;
