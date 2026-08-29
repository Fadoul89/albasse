select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where tablename = 'visitor_sessions';
