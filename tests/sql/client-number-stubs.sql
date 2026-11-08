-- Décor de test pour add-client-number.sql sur un Postgres local JETABLE (jamais la vraie base).
-- Il se pose APRÈS tests/sql/password-alert-stubs.sql (profiles, is_admin(), vault, net simulés) et ajoute le rôle « service_role »
-- et des comptes qui existent DÉJÀ avant le script (créés dans le désordre : le plus ancien n'est pas le premier de la table).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to service_role;
grant select, insert, update on public.profiles to service_role, authenticated;
grant select on public.profiles to anon;

insert into public.profiles (id, email, full_name, phone, whatsapp_number, region, is_admin, telegram_chat_id, created_at) values
  ('00000000-0000-4000-8000-000000000001', 'admin@exemple.com', 'Patron', '66000000', null, 'N''Djamena', true, 424242, '2026-03-01'),
  ('00000000-0000-4000-8000-000000000002', '23566123456@tel.albasseshopping.com', 'Éric Moussa', '66 12 34 56', null, 'N''Djamena', false, null, '2026-01-10'),
  ('00000000-0000-4000-8000-000000000003', 'amina@gmail.com', 'Amina', '99 88 77 66', '+235 99 88 77 66', 'Doba', false, null, '2026-01-05');
insert into vault.decrypted_secrets values ('telegram_bot_token', '123456:FAKE-TOKEN-FOR-TESTS-ONLY-xxxxxxxxxxxxxxx');
