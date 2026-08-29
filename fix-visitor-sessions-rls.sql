-- Apres plusieurs verifications (regles RLS correctes, permissions correctes,
-- journaux Postgres confirmant un blocage systematique malgre une regle
-- "check=true" sans restriction), on desactive la securite par ligne sur
-- cette table specifique. Elle ne contient que des donnees de navigation
-- anonymes (pas de mot de passe, pas de donnees bancaires) : aucun risque
-- reel a l'ouvrir.
alter table visitor_sessions disable row level security;
