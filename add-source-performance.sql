-- Migration : Performance par source (visiteurs separes)
-- A executer dans Supabase SQL Editor.

alter table visitor_sessions add column if not exists visitor_id text;
alter table visitor_sessions add column if not exists page_views integer not null default 1;
alter table visitor_sessions add column if not exists utm_medium text;
alter table visitor_sessions add column if not exists utm_campaign text;

create index if not exists visitor_sessions_visitor_idx on visitor_sessions(visitor_id);
create index if not exists visitor_sessions_started_idx on visitor_sessions(started_at);
