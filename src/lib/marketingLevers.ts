// Assistant marketing + psychologie de la vente : ce que l'écran admin affiche (Admin › Marketing).
// Les chiffres et les leviers VRAIS viennent de la fonction serveur « marketing-ai » (supabase/functions/marketing-ai/levers.ts) :
// ici, on ne fait que les montrer en français simple. Testé dans tests/email/marketing-levers.test.ts (mêmes clés que la fonction).

export const LEVER_KEYS = ['auto', 'social', 'loss', 'urgency', 'scarcity', 'trend', 'reciprocity'] as const;
export type LeverKey = (typeof LEVER_KEYS)[number];

export const LEVER_LABELS: Record<LeverKey, string> = {
  auto: '✨ Automatique',
  social: '👀 Preuve sociale',
  loss: '💰 Aversion à la perte',
  urgency: '⏰ Urgence',
  scarcity: '⏳ Rareté',
  trend: '🔥 Effet de mode',
  reciprocity: '🎁 Réciprocité',
};

// pourquoi un levier n'est pas proposé (il n'est pas vrai pour cet article)
export const LEVER_REASONS: Record<string, string> = {
  no_product: 'choisissez un article',
  few_views: 'moins de 50 personnes en 30 jours',
  no_discount: 'pas de vraie promotion en cours',
  no_deadline: 'pas de date de fin de promotion',
  stock_ok: 'stock normal',
  not_top: "pas parmi les 10 plus regardés",
};

export interface LeverFacts {
  hasProduct: boolean;
  price: number | null;
  oldPrice: number | null;
  saving: number;
  pct: number;
  stock: number | null;
  endsAt: string | null;
  views: number;
  rank: number | null;
  gift: boolean;
}
export interface LeverAvailability {
  key: Exclude<LeverKey, 'auto'>;
  available: boolean;
  reason?: string;
}

const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const fcfa = (n: number) => `${group(n)} FCFA`;
const when = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Ndjamena' }).format(new Date(iso));

// Les lignes « Les vrais chiffres de l'article » (seulement ce qui est vrai ; rien n'est deviné)
export function factLines(f: LeverFacts | null | undefined): string[] {
  if (!f || !f.hasProduct) return [];
  const out: string[] = [];
  out.push(f.views > 0 ? `👀 ${group(f.views)} personnes l'ont regardé en 30 jours${f.rank ? ` (n° ${f.rank} des plus regardés)` : ''}` : '👀 Moins de 50 personnes en 30 jours : pas de chiffre à citer');
  if (f.price && f.oldPrice && f.saving > 0) out.push(`💰 ${fcfa(f.price)} au lieu de ${fcfa(f.oldPrice)} : ${fcfa(f.saving)} économisés (-${f.pct} %)`);
  else if (f.price) out.push(`💰 ${fcfa(f.price)} (pas de promotion en cours)`);
  if (f.endsAt && Number.isFinite(Date.parse(f.endsAt))) out.push(`⏰ La promotion se termine ${when(f.endsAt)}`);
  if (f.stock !== null) out.push(f.stock >= 1 && f.stock <= 5 ? `⏳ Plus que ${f.stock} en stock` : `📦 Stock : ${f.stock} (pas de « stock limité »)`);
  return out;
}

// Le levier choisi n'est pas (ou plus) vrai pour l'article : on revient à « Automatique »
export function validLever(choice: LeverKey, levers: LeverAvailability[] | null | undefined): LeverKey {
  if (choice === 'auto') return 'auto';
  return (levers ?? []).some((l) => l.key === choice && l.available) ? choice : 'auto';
}

// Le contrôle du texte écrit par l'IA (supabase/functions/marketing-ai/levers.ts : falseClaims) en phrase pour l'administrateur
const WARN_TEXT: Record<string, string> = {
  rareté: 'il parle de stock limité alors que le stock est normal',
  urgence: "il parle d'urgence alors qu'il n'y a pas de date de fin",
  'nombre de personnes': 'un nombre de personnes ne correspond pas au vrai chiffre',
  achats: "il parle d'achats ou de clients satisfaits (non prouvé)",
  prix: 'un prix ne correspond pas aux vrais prix de l’article',
};
export function warningText(warnings: unknown): string | null {
  const list = Array.isArray(warnings) ? warnings.filter((w): w is string => typeof w === 'string') : [];
  if (list.length === 0) return null;
  return `⚠️ Vérifiez avant de publier : ${list.map((w) => WARN_TEXT[w] ?? w).join(' ; ')}.`;
}
