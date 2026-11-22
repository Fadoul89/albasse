// Espace affilié : lecture des chiffres rendus par la base (fonction sûre affiliate_my_stats, add-affiliate-fixes.sql), totaux,
// libellé d'une commande, et le code de parrainage (nettoyé, généré). Fonctions pures, sans réseau (tests/shop/affiliate-stats.test.ts).
import { isObject, num, text } from './visitStats';

export type CommissionStatus = 'pending' | 'validated' | 'cancelled';

export interface AffiliateCommissionRow {
  id: string;
  affiliate_id: string;
  order_id: string;
  order_number: number | null;
  order_total: number | null;
  amount: number;
  status: CommissionStatus;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface ProductStat {
  views: number;
  orders: number;
  commission: number;
}

export interface AffiliateRpcStats {
  visitors: number;
  commissions: AffiliateCommissionRow[];
  products: Record<string, ProductStat>;
}

const STATUSES: CommissionStatus[] = ['pending', 'validated', 'cancelled'];

// null : la fonction n'existe pas encore (script pas lancé), refus, ou réponse illisible : la page garde son ancienne lecture
export function parseAffiliateStats(raw: unknown, affiliateId: string): AffiliateRpcStats | null {
  if (!isObject(raw) || !Array.isArray(raw.commissions) || !Array.isArray(raw.products)) return null;
  const visitors = num(raw.visitors);
  if (visitors === null) return null;
  const commissions: AffiliateCommissionRow[] = [];
  for (const c of raw.commissions) {
    if (!isObject(c)) continue;
    const id = text(c.id);
    const orderId = text(c.order_id);
    const status = text(c.status) as CommissionStatus | null;
    const amount = num(c.amount);
    if (!id || !orderId || !status || !STATUSES.includes(status) || amount === null) continue;
    commissions.push({
      id,
      affiliate_id: affiliateId,
      order_id: orderId,
      order_number: num(c.order_number),
      order_total: num(c.order_total),
      amount,
      status,
      paid: c.paid === true,
      paid_at: text(c.paid_at),
      created_at: text(c.created_at) ?? '',
    });
  }
  const products: Record<string, ProductStat> = {};
  for (const p of raw.products) {
    if (!isObject(p)) continue;
    const id = text(p.product_id);
    if (!id) continue;
    products[id] = { views: num(p.views) ?? 0, orders: num(p.orders) ?? 0, commission: num(p.commission) ?? 0 };
  }
  return { visitors, commissions, products };
}

// les totaux de l'espace affilié (les commissions annulées ne comptent ni dans les ventes ni dans le chiffre d'affaires)
export function affiliateTotals(commissions: Pick<AffiliateCommissionRow, 'status' | 'paid' | 'amount' | 'order_total'>[]) {
  const live = commissions.filter((c) => c.status !== 'cancelled');
  return {
    ordersCount: live.length,
    revenue: live.reduce((s, c) => s + (c.order_total ?? 0), 0),
    pendingCommission: commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + c.amount, 0),
    validatedCommission: commissions.filter((c) => c.status === 'validated' && !c.paid).reduce((s, c) => s + c.amount, 0),
    paidCommission: commissions.filter((c) => c.paid).reduce((s, c) => s + c.amount, 0),
  };
}

// « Commande N° 101 » (le numéro que le patron voit aussi dans l'admin) ; sinon les 8 premiers caractères de la commande
export function commissionLabel(c: { order_number?: number | null; order_id: string }): string {
  return c.order_number != null ? `Commande N° ${c.order_number}` : `Commande #${c.order_id.slice(0, 8)}`;
}

// le code de parrainage lu dans un lien (?ref=…) : majuscules, sans espaces, lettres / chiffres / tiret, 32 caractères au plus ; sinon null
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{2,32}$/.test(code) ? code : null;
}

// un nouveau code : 4 lettres du nom (sans accents) + 4 chiffres (9 000 codes par nom, au lieu de 900 : moins de doublons)
export function generateReferralCode(name: string | null | undefined, random: () => number = Math.random): string {
  const base =
    (name ?? 'AFF')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, 4) || 'AFF';
  const suffix = Math.floor(1000 + random() * 9000);
  return `${base}${suffix}`;
}

// la base refuse un code déjà pris (index unique) : on réessaie avec un autre
export const isDuplicateCodeError = (error: { code?: string; message?: string } | null): boolean =>
  !!error && (error.code === '23505' || /duplicate key|profiles_referral_code/i.test(error.message ?? ''));
