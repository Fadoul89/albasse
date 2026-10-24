// Photos de la boutique (Supabase Storage) à la taille affichée : Supabase les redimensionne et les envoie en WebP.
// Une carte d'article n'a pas besoin de la photo d'origine (jusqu'à 3 Mo) : beaucoup moins de données pour les clients
// (réseau mobile) et pour le quota « Cached Egress » de Supabase. Les autres adresses (hors Supabase) restent telles quelles.
const OBJECT_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

export function sizedImage(url: string, width: number): string;
export function sizedImage(url: string | null | undefined, width: number): string | null | undefined;
export function sizedImage(url: string | null | undefined, width: number) {
  if (!url) return url;
  const i = url.indexOf(OBJECT_PATH);
  if (i < 0) return url;
  const base = url.slice(0, i) + RENDER_PATH + url.slice(i + OBJECT_PATH.length);
  return `${base}${base.includes('?') ? '&' : '?'}width=${width}&quality=70`;
}
