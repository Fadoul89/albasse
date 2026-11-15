// Les adresses qui existent vraiment sur le site (même liste que `linking` dans src/navigation/RootNavigator.tsx : un test les compare).
// Toute autre adresse reçoit le code 404 (avant : la page d'accueil avec le code 200, que Google prend pour un « faux 404 »).

export const KNOWN_PATHS: string[] = [
  '/',
  '/recherche',
  '/mes-commandes',
  '/panier',
  '/compte',
  '/commande',
  '/commande/confirmation',
  '/voyage',
  '/installer',
  '/app',
  '/desinscription',
  '/connexion',
  '/inscription',
  '/mot-de-passe-oublie',
  '/reinitialiser-mot-de-passe',
  '/contact',
  '/notifications',
  '/compte/notifications',
  '/mes-favoris',
  '/confidentialite',
  '/conditions-de-retour',
  '/conditions-generales',
  '/mes-messages',
  '/devenir-affilie',
  '/espace-affilie',
  '/espace-affilie/produits',
  '/roue-de-la-chance',
  '/inviter-mes-amis',
  // site « page unique » (docs/site-cafe-separe.md)
  '/cafe',
  '/vitalite-energie-homme',
];

// adresses avec un morceau variable : /produit/<slug>, /categorie/<slug>, /facture/<numéro>, /admin/…
export const KNOWN_PREFIXES: string[] = ['/produit/', '/categorie/', '/facture/', '/admin/'];

/** « /contact/ » et « /contact » sont la même adresse. */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/** Un fichier (image, script, google….html) : jamais une page de l'application. */
export function looksLikeFile(pathname: string): boolean {
  return /\/[^/]*\.[A-Za-z0-9]{2,6}$/.test(pathname);
}

export function isKnownPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (KNOWN_PATHS.includes(p)) return true;
  // le morceau variable doit exister : « /produit/ » seul n'est pas une page
  return KNOWN_PREFIXES.some((prefix) => p.startsWith(prefix) && p.length > prefix.length);
}
