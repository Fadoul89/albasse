// Photos plus légères pour les listes (cartes d'articles, catégories, miniatures).
// Supabase sait redimensionner une photo au moment où on la demande : on remplace
//   .../storage/v1/object/public/<dossier>/<fichier>
// par
//   .../storage/v1/render/image/public/<dossier>/<fichier>?width=480&quality=70
// Sur un échantillon de 12 vraies photos : 1 776 Ko -> 782 Ko (56 % plus léger).
//
// INTERRUPTEUR : EXPO_PUBLIC_IMAGE_THUMBS = "on" dans netlify.toml. Éteint (par défaut), toutes les adresses restent EXACTEMENT les mêmes qu'avant.
// Raison : la transformation d'images peut compter dans l'abonnement Supabase (nombre de photos d'origine transformées par mois) :
// c'est au patron de décider de l'allumer (docs/liste-avant-lancement.md).

export const THUMBS_ENABLED = process.env.EXPO_PUBLIC_IMAGE_THUMBS === 'on';

const PUBLIC_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

/** Adresse d'une version réduite de la photo (largeur en pixels réels de l'écran : pensez à doubler pour les écrans nets). */
export function thumbUrl<T extends string | null | undefined>(url: T, width: number, enabled: boolean = THUMBS_ENABLED, quality = 70): T | string {
  if (!enabled || !url) return url;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(url)) return url; // seulement les photos de notre base
  if (!url.includes(PUBLIC_PATH)) return url; // déjà réduite, ou pas une photo publique
  if (url.includes('?')) return url; // adresse déjà paramétrée : on n'y touche pas
  const w = Math.max(16, Math.min(2000, Math.round(width)));
  const q = Math.max(30, Math.min(95, Math.round(quality)));
  return `${url.replace(PUBLIC_PATH, RENDER_PATH)}?width=${w}&quality=${q}`;
}
