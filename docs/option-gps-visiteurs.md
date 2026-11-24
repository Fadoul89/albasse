# Option GPS : position des visiteurs

Demande du patron (24 novembre 2026) : détecter la position GPS réelle des visiteurs, afficher l'adresse
détectée sur la fiche du client (admin), et analyser les visiteurs par région. Réponses du patron : la
**position GPS réelle du téléphone** (pas la ville déclarée à la main dans le profil), demandée **à tous les
visiteurs, dès l'arrivée sur le site** (pas seulement les clients connectés, pas derrière un bouton).

## Le service de géocodage

Aucune préférence donnée par le patron : par défaut, le site utilise **OpenStreetMap Nominatim**, gratuit et
sans clé à créer. Si le volume de visiteurs ou la précision le justifient un jour, on pourra passer à une clé
Google Maps payante (changement limité à `reverseGeocode()` dans `src/lib/visitorLocationTracker.ts`).

## Comment ça marche

- À l'arrivée sur le site (web), le navigateur demande la permission de localisation — **une seule fois par
  appareil, pour toujours** (jamais redemandé à chaque visite). C'est une fenêtre du navigateur lui-même :
  elle ne peut pas être silencieuse ni personnalisée, contrairement au suivi de navigation habituel du site.
- Comme pour le suivi de navigation (`src/lib/trackingConsent.ts`) : si le visiteur a déjà refusé le suivi
  (page de confidentialité, ou en l'écrivant à Zara), ou si son navigateur envoie « Ne pas me suivre »
  (Do Not Track / Global Privacy Control), la demande ne part pas. Sans refus, elle part pour tout le monde,
  comme demandé.
- Si le visiteur accepte, les coordonnées sont converties en adresse lisible (ville, région, pays) via
  Nominatim, puis gardées en base (`visitor_locations`) avec l'identifiant anonyme du visiteur et, s'il est
  connecté, son `user_id`.
- Si le visiteur refuse, ou si son téléphone ne sait pas répondre : rien n'est enregistré, et il n'est jamais
  redemandé sur cet appareil.

## Pour l'administrateur

- **Fiche du client** (Admin › Clients › un client) : une ligne « 📍 Position détectée (GPS) » avec l'adresse
  trouvée (ou « Jamais partagée » si le client n'a jamais accepté), et la date de détection.
- **Admin › Visiteurs par région (GPS)** : les visiteurs (anonymes et clients connectés) regroupés par région
  et par ville, d'après leur position GPS la plus récente — pas la ville déclarée à la main. « Inconnu »
  quand l'adresse n'a pas pu être retrouvée (les coordonnées restent gardées quand même).

## Ce que fait la base (`add-visitor-gps.sql`)

Sans danger à relancer. Rien de personnel n'est demandé : seulement des coordonnées GPS et l'adresse qui en
découle.

- Une table `visitor_locations` : `visitor_id`, `user_id` (si connu), `latitude`/`longitude`, `address`,
  `city`, `region`, `country`, `created_at`. Droits donnés explicitement (règle du 30 octobre 2026) :
  n'importe quel visiteur peut enregistrer sa position (`insert`) ; seul l'administrateur peut la lire
  (RLS + `select` réservé à `authenticated`, filtré par `is_admin()`).
- La fonction `admin_visitor_regions_overview()` (réservée à l'administrateur) : la position la plus récente
  de chaque visiteur, regroupée par région et par ville.

**Avant le script SQL** : l'écran « Visiteurs par région » dit « Lancez d'abord le script
add-visitor-gps.sql », la fiche client ne montre jamais d'erreur, et l'enregistrement de la position échoue
en silence (sans bloquer la navigation, sans redemander).

Test sur un Postgres local jetable (jamais la vraie base) : `sh tests/sql/run-visitor-gps.sh` (12 contrôles).

## Où est le code

- Règles pures (demande une seule fois, lecture de l'adresse Nominatim) : `src/lib/visitorLocation.ts`
  (test : `node --import ./tests/zara/register.mjs tests/intel/visitor-location.test.ts`).
- Demande au navigateur, appel à Nominatim, enregistrement en base : `src/lib/visitorLocationTracker.ts`,
  démarré une fois dans `src/navigation/RootNavigator.tsx` (comme `initBrowsingTracker`).
- Écrans : ligne « 📍 Position détectée (GPS) » dans `src/screens/admin/AdminCustomerDetailScreen.tsx`
  (`src/hooks/useLastVisitorLocation.ts`) ; `src/screens/admin/AdminVisitorRegionsScreen.tsx`
  (`src/hooks/useVisitorRegions.ts`), accessible depuis le tableau de bord admin.
