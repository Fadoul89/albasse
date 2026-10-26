// Zara choisit les articles de la Vente flash et des Promotions d'après les statistiques réelles du site (fonction pure, testée dans tests/email/zara-promotions.test.ts).
// Elle ne change AUCUN prix : elle choisit parmi les articles qui ont déjà un ancien prix donnant une VRAIE remise (5 à 60 %), en stock, et elle dit pourquoi
// avec les vrais chiffres (vues, ajouts au panier, j'aime, ventes, stock). Pas assez de visites = moins d'articles proposés, jamais un choix au hasard.
import { realDiscountPct } from './promotions';

export const FLASH_COUNT = 4; // articles en Vente flash (24 h)
export const PROMO_COUNT = 12; // articles en Promotion (7 jours)
export const FLASH_HOURS = 24;
export const PROMO_DAYS = 7;
export const MIN_STOCK_FLASH = 5; // une vente flash doit pouvoir se vendre
export const MIN_STOCK_PROMO = 3;
export const MIN_INTEREST_FLASH = 5; // vues + 5 × paniers + j'aime (20 au plus) sur la semaine
export const MIN_INTEREST_PROMO = 3;
export const MAX_PER_CATEGORY_FLASH = 2; // pas toute la Vente flash dans la même rubrique
export const MAX_PER_CATEGORY_PROMO = 3;

// une ligne de zara_promotion_stats (base)
export interface PromoStatRow {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  old_price: number | null;
  stock: number;
  category_id: string | null;
  likes: number;
  views: number;
  carts: number;
  sold: number; // unités vendues sur 30 jours
  flash_active: boolean;
  promo_active: boolean;
}

export interface PromoPick {
  kind: 'flash' | 'promo';
  id: string;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  oldPrice: number;
  discountPct: number;
  stock: number;
  views: number;
  carts: number;
  likes: number;
  sold: number;
  reasons: string[]; // des faits vrais, en français
}

export interface PromoPlan {
  flash: PromoPick[];
  promo: PromoPick[];
  notes: string[];
  considered: number; // articles examinés
  eligible: number; // articles avec une vraie remise, en stock, pas déjà en promotion
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const interestOf = (r: Pick<PromoStatRow, 'views' | 'carts' | 'likes'>): number => n(r.views) + 5 * n(r.carts) + Math.min(n(r.likes), 20);

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

export function reasonsFor(r: Pick<PromoStatRow, 'views' | 'carts' | 'likes' | 'sold' | 'stock'>, discountPct: number): string[] {
  const out: string[] = [];
  if (n(r.views) > 0) out.push(`👁 ${plural(n(r.views), 'vue', 'vues')} cette semaine`);
  if (n(r.carts) > 0) out.push(`🛒 ${plural(n(r.carts), 'ajout au panier', 'ajouts au panier')}`);
  if (n(r.likes) > 0) out.push(`♥ ${plural(n(r.likes), 'j’aime', 'j’aime')}`);
  out.push(n(r.sold) > 0 ? `📦 ${plural(n(r.sold), 'vendu', 'vendus')} ce mois` : '📦 pas encore acheté ce mois');
  out.push(`${n(r.stock)} en stock`);
  out.push(`vraie remise −${discountPct} %`);
  return out;
}

const discountFactor = (pct: number) => 1 + Math.min(pct, 40) / 40; // ×1 à ×2 : une remise plus forte aide, sans écraser l'intérêt réel

export function pickPromotions(rows: PromoStatRow[]): PromoPlan {
  const notes: string[] = [];
  const pool = rows
    .map((r) => {
      const oldPrice = r.old_price == null ? null : n(r.old_price);
      const pct = oldPrice ? realDiscountPct(n(r.price), oldPrice) : null;
      return { r, oldPrice, pct, interest: interestOf(r) };
    })
    .filter((x) => x.pct !== null && x.oldPrice !== null && !x.r.flash_active && !x.r.promo_active && n(x.r.stock) >= MIN_STOCK_PROMO);

  const build = (kind: 'flash' | 'promo', x: (typeof pool)[number]): PromoPick => ({
    kind,
    id: x.r.id,
    name: x.r.name,
    slug: x.r.slug,
    image: x.r.image,
    price: n(x.r.price),
    oldPrice: x.oldPrice as number,
    discountPct: x.pct as number,
    stock: n(x.r.stock),
    views: n(x.r.views),
    carts: n(x.r.carts),
    likes: n(x.r.likes),
    sold: n(x.r.sold),
    reasons: reasonsFor(x.r, x.pct as number),
  });

  const byName = (a: (typeof pool)[number], b: (typeof pool)[number]) => a.r.name.localeCompare(b.r.name, 'fr');
  const take = (list: typeof pool, count: number, perCategory: number) => {
    const used = new Map<string, number>();
    const chosen: typeof pool = [];
    for (const x of list) {
      if (chosen.length >= count) break;
      const cat = x.r.category_id ?? '';
      if ((used.get(cat) ?? 0) >= perCategory) continue;
      used.set(cat, (used.get(cat) ?? 0) + 1);
      chosen.push(x);
    }
    return chosen;
  };

  // Vente flash : les articles les plus demandés (vues, paniers, j'aime), avec du stock pour vendre et une remise vraie
  const flashPool = pool
    .filter((x) => x.interest >= MIN_INTEREST_FLASH && n(x.r.stock) >= MIN_STOCK_FLASH)
    .sort((a, b) => b.interest * discountFactor(b.pct as number) - a.interest * discountFactor(a.pct as number) || n(b.r.stock) - n(a.r.stock) || byName(a, b));
  const flashChosen = take(flashPool, FLASH_COUNT, MAX_PER_CATEGORY_FLASH);
  const flashIds = new Set(flashChosen.map((x) => x.r.id));

  // Promotions : les articles regardés mais peu achetés (une remise peut les décider), un peu de chaque rubrique
  const promoPool = pool
    .filter((x) => !flashIds.has(x.r.id) && x.interest >= MIN_INTEREST_PROMO)
    .sort((a, b) => {
      const sa = (a.interest / (1 + 3 * n(a.r.sold))) * discountFactor(a.pct as number);
      const sb = (b.interest / (1 + 3 * n(b.r.sold))) * discountFactor(b.pct as number);
      return sb - sa || n(b.r.stock) - n(a.r.stock) || byName(a, b);
    });
  const promoChosen = take(promoPool, PROMO_COUNT, MAX_PER_CATEGORY_PROMO);

  if (flashChosen.length < FLASH_COUNT) {
    notes.push(
      flashChosen.length === 0
        ? 'Aucun article n’a assez de visites ET une vraie remise pour la Vente flash : Zara n’en propose pas (jamais au hasard).'
        : `Seulement ${plural(flashChosen.length, 'article a', 'articles ont')} assez de visites, de stock et une vraie remise pour la Vente flash.`
    );
  }
  if (promoChosen.length < PROMO_COUNT) {
    notes.push(
      promoChosen.length === 0
        ? 'Aucun article n’a assez de visites ET une vraie remise pour les Promotions.'
        : `Seulement ${plural(promoChosen.length, 'article a', 'articles ont')} assez de visites et une vraie remise pour les Promotions.`
    );
  }
  return { flash: flashChosen.map((x) => build('flash', x)), promo: promoChosen.map((x) => build('promo', x)), notes, considered: rows.length, eligible: pool.length };
}
