-- Ordre des catégories choisi par l'admin (flèches ▲ ▼ sur la page « Catégories ») : 1 = la première sur l'accueil.
-- Les catégories sans numéro (nouvelles) passent après, par ordre alphabétique. Sans danger à relancer.
alter table public.categories add column if not exists sort_order integer;
