// Texte de la barre « achats récents » : seulement la ville et l'article, jamais le nom du client. Fonctions pures (testées dans
// tests/email/recent-purchases.test.ts).
export interface RecentPurchase {
  city: string | null;
  product: string;
  created_at: string;
}

export function agoLabel(createdAt: string, now: number = Date.now()): string {
  const min = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 60_000));
  if (!Number.isFinite(min)) return '';
  if (min < 2) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} jour${d > 1 ? 's' : ''}`;
}

export function purchaseText(p: RecentPurchase, now: number = Date.now()): string {
  const product = p.product.length > 40 ? `${p.product.slice(0, 39).trimEnd()}…` : p.product;
  const who = p.city ? `Un client de ${p.city}` : 'Un client';
  const ago = agoLabel(p.created_at, now);
  return `🛍️ ${who} a commandé : ${product}${ago ? ` · ${ago}` : ''}`;
}
