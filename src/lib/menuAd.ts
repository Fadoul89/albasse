// Publicité mouvementée du menu ☰ (demande du patron, 16 novembre 2026). Règles sans réseau, testées dans tests/email/menu-ad.test.ts.
// Les images et leurs liens sont choisis par le patron dans Admin › Promotions intelligentes (colonne store_settings.menu_ad_items,
// script add-menu-ad.sql). Rien n'est inventé : sans image choisie, le menu garde sa carte « À la une » automatique (ou rien).
import type { AdItem } from '../types';

export const MENU_AD_MAX = 12; // comme la règle de la base
export const MENU_AD_SHOW_MS = 5000; // une nouvelle image toutes les 5 secondes, glissement compris
export const MENU_AD_SLIDE_MS = 700; // le glissement vers la suivante (dans les 5 secondes)
export const MENU_AD_HEIGHT = 168;

export const MENU_AD_TEXT = {
  section: '📣 Publicité du menu ☰',
  help:
    'Vos images, dans le menu ☰ du site, à la place de la carte « À la une ». Plusieurs images : elles glissent l\'une après l\'autre toutes les 5 secondes, avec un zoom lent et un reflet de lumière. Format conseillé : paysage, environ 1 200 × 700. Ajoutez un lien par image (un article, une catégorie, WhatsApp…).',
  editorTitle: 'Images de la publicité du menu',
  missing: 'Pour activer cette publicité, lancez d\'abord le script add-menu-ad.sql dans Supabase (une colonne ajoutée, aucune nouvelle table).',
  tag: 'PUB',
  go: 'Voir ›',
  label: (n: number, i: number) => (n > 1 ? `Publicité ${i + 1} sur ${n}` : 'Publicité'),
};

const httpsUrl = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^https:\/\/\S+$/i.test(s) ? s : null;
};

/** Les images de la publicité du menu, lisibles et dans l'ordre choisi (12 au plus). Une liste absente ou abîmée : aucune image. */
export function menuAdItems(raw: unknown): AdItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AdItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const image = httpsUrl((it as { image_url?: unknown }).image_url);
    if (!image) continue;
    const linkRaw = (it as { link?: unknown }).link;
    const link = typeof linkRaw === 'string' && linkRaw.trim() !== '' ? linkRaw.trim() : null;
    out.push({ image_url: image, link });
    if (out.length >= MENU_AD_MAX) break;
  }
  return out;
}

export type MenuAdTarget =
  | { kind: 'product'; slug: string }
  | { kind: 'category'; slug: string }
  | { kind: 'page'; path: string } // une autre page du site (ex. /mes-commandes)
  | { kind: 'external'; url: string }; // WhatsApp, un autre site…

const SITE_HOSTS = new Set(['albasseshopping.com', 'www.albasseshopping.com']);

/**
 * Où mène une image : un article ou une catégorie du site s'ouvre DANS le site (sans recharger) ; une autre page du site, à sa place ;
 * WhatsApp ou un autre site, à part. Lien vide ou incompréhensible : null (l'image n'est pas cliquable).
 */
export function menuAdTarget(link: string | null | undefined): MenuAdTarget | null {
  const s = (link ?? '').trim();
  if (!s) return null;
  let path: string | null = null;
  if (s.startsWith('/')) path = s;
  else {
    let u: URL;
    try {
      u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    } catch {
      return null;
    }
    if (SITE_HOSTS.has(u.hostname.toLowerCase())) path = `${u.pathname}${u.search}`;
    else if (u.protocol === 'https:' || u.protocol === 'http:') return { kind: 'external', url: u.toString() };
    else if (/^(whatsapp|tel|mailto):$/i.test(u.protocol)) return { kind: 'external', url: s };
    else return null;
  }
  const m = path.match(/^\/(produit|categorie)\/([^/?#]+)/);
  if (m) {
    const slug = decodeURIComponent(m[2]);
    return m[1] === 'produit' ? { kind: 'product', slug } : { kind: 'category', slug };
  }
  return { kind: 'page', path: path || '/' };
}
