// Le NOM du site ou de l'appli d'où vient le visiteur (jamais l'adresse complète) : « www.tiktok.com », « org.telegram.messenger »
// (une appli Android : android-app://org.telegram.messenger/). Sert à la liste « D'où viennent les visiteurs Autre ? » de l'admin.
// Fonctions pures, sans réseau (tests/email/source-report.test.ts).
export function referrerHostOf(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/\.$/, '');
    return host ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
}

// un texte court pour la base (120 caractères au plus, comme la règle de add-source-report.sql) ; vide = null
export const shortText = (v: string | null | undefined): string | null => (v ? v.trim().slice(0, 120) || null : null);
