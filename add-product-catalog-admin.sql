-- Migration : Gestion catalogue admin (statut actif/inactif)
-- A executer dans Supabase SQL Editor.

alter table products add column if not exists is_active boolean not null default true;
