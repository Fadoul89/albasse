// Transformation d'une image déjà sur Cloudinary (optimisation à l'affichage : format auto, qualité auto, largeur demandée).
// Sans effet sur une URL qui n'est pas Cloudinary (ex. une ancienne photo encore sur Supabase Storage pendant la migration,
// ou une image locale) : toujours sûr à appliquer, partout où une photo de l'app peut s'afficher.
const CLOUDINARY_HOST = 'res.cloudinary.com';
const UPLOAD_MARKER = '/upload/';

export function cloudinaryUrl(url: string | null | undefined, width: number): string {
  if (!url) return url ?? '';
  if (!url.includes(CLOUDINARY_HOST)) return url;
  const i = url.indexOf(UPLOAD_MARKER);
  if (i === -1) return url;
  const cut = i + UPLOAD_MARKER.length;
  // déjà une transformation en place (ex. relancé sur une URL déjà optimisée) : on ne double pas
  const rest = url.slice(cut);
  if (/^[a-z]_[^/]+\//i.test(rest)) return url;
  return `${url.slice(0, cut)}f_auto,q_auto,w_${width}/${rest}`;
}
