select 'trigger' as type, tgname as name, tgenabled::text as detail
from pg_trigger
where tgrelid = 'visitor_sessions'::regclass and not tgisinternal
union all
select 'policy' as type, policyname as name,
  'cmd=' || cmd || ' permissive=' || permissive || ' roles=' || roles::text || ' check=' || coalesce(with_check,'NULL') as detail
from pg_policies
where tablename = 'visitor_sessions'
union all
select 'rls_enabled', relname, relrowsecurity::text
from pg_class
where relname = 'visitor_sessions'
union all
select 'column', column_name, data_type || ' nullable=' || is_nullable || ' default=' || coalesce(column_default,'NULL')
from information_schema.columns
where table_name = 'visitor_sessions'
order by 1;
