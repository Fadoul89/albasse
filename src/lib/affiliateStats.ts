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
  return `Commande ${orderRef(c)}`;
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

// ── Historique des paiements (bouton « Déjà payé ») ────────────────────────────────────────────────────────────────────
// Une commission est marquée payée à part (date et heure : paid_at). Les commissions payées le MÊME JOUR (heure de N'Djamena)
// forment un seul paiement : c'est ce que l'administrateur envoie en une fois sur Mobile Money.

export interface PaidCommissionInput {
  order_id: string;
  order_number?: number | null;
  order_total?: number | null;
  amount: number;
  paid: boolean;
  paid_at: string | null;
}

export interface PaymentOrder {
  order_id: string;
  order_number: number | null;
  order_total: number | null;
  amount: number;
}

export interface PaymentGroup {
  key: string; // « 2026-11-21 » (jour à N'Djamena) ; « inconnu » si la date manque
  dateLabel: string; // « 21 novembre 2026 »
  timeLabel: string | null; // « 14h05 » : l'heure du dernier règlement de ce jour
  total: number;
  orders: PaymentOrder[];
}

export interface PaymentHistory {
  total: number;
  count: number;
  payments: PaymentGroup[];
}

const NDJAMENA_OFFSET_MS = 60 * 60 * 1000; // N'Djamena : UTC+1 toute l'année (pas d'heure d'été)
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// la date et l'heure à N'Djamena, en français, quel que soit le fuseau du téléphone
export function ndjamenaDate(iso: string | null | undefined): { key: string; dateLabel: string; timeLabel: string } | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + NDJAMENA_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return {
    key: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    dateLabel: `${day} ${MONTHS[m]} ${y}`,
    timeLabel: `${d.getUTCHours()}h${String(d.getUTCMinutes()).padStart(2, '0')}`,
  };
}

export function paymentHistory(commissions: PaidCommissionInput[]): PaymentHistory {
  const groups = new Map<string, PaymentGroup & { lastMs: number }>();
  for (const c of commissions) {
    if (!c.paid) continue;
    const when = ndjamenaDate(c.paid_at);
    const key = when?.key ?? 'inconnu';
    const ms = when ? Date.parse(c.paid_at as string) : -Infinity;
    let g = groups.get(key);
    if (!g) {
      g = { key, dateLabel: when?.dateLabel ?? 'Date non enregistrée', timeLabel: when?.timeLabel ?? null, total: 0, orders: [], lastMs: ms };
      groups.set(key, g);
    }
    if (when && ms > g.lastMs) {
      g.lastMs = ms;
      g.timeLabel = when.timeLabel;
    }
    g.total += c.amount;
    g.orders.push({ order_id: c.order_id, order_number: c.order_number ?? null, order_total: c.order_total ?? null, amount: c.amount });
  }
  const payments = [...groups.values()]
    .sort((a, b) => b.lastMs - a.lastMs)
    .map(({ lastMs, ...g }) => ({ ...g, orders: g.orders.sort((a, b) => (b.order_number ?? -1) - (a.order_number ?? -1)) }));
  return { total: payments.reduce((s, p) => s + p.total, 0), count: payments.length, payments };
}

export const paymentCountLabel = (n: number): string => `${n} paiement${n > 1 ? 's' : ''}`;
export const orderCountLabel = (n: number): string => `${n} commande${n > 1 ? 's' : ''}`;
// « N° 101 » ; sans numéro : les 8 premiers caractères de la commande
export const orderRef = (o: { order_number?: number | null; order_id: string }): string =>
  o.order_number != null ? `N° ${o.order_number}` : `#${o.order_id.slice(0, 8)}`;
