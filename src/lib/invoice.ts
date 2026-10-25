// Numéro de commande, facture électronique et tri des commandes (admin). Fonctions pures, testées dans tests/email/invoice.test.ts.
// Rien n'est stocké en plus : la facture se calcule à partir de la commande (articles, prix payés, remise, emballage, total).
import { GIFT_WRAP_FEE } from '../constants/shopRules';
import type { Order, OrderItem, OrderStatus } from '../types';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  paid: 'Payée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export const PAYMENT_LABELS: Record<string, string> = {
  airtel_money: 'Airtel Money',
  moov_money: 'Moov Money',
  cash_on_delivery: 'Paiement à la livraison',
  stripe: 'Carte bancaire',
};

type Numbered = Pick<Order, 'id'> & { order_number?: number | null };

// « N° 12 » (ou l'ancien repère #0C7E6708 tant que le script add-order-numbers-invoices.sql n'est pas lancé)
export const orderNumberLabel = (o: Numbered) => (o.order_number ? `N° ${o.order_number}` : `#${o.id.slice(0, 8)}`);

// Facture n° FA-2026-000012 : l'année du jour de la commande à N'Djamena (UTC+1), puis le numéro de commande sur 6 chiffres
export function invoiceNumber(o: Numbered & { created_at: string }): string {
  const year = new Date(Date.parse(o.created_at) + 3600_000).getUTCFullYear();
  return o.order_number ? `FA-${year}-${String(o.order_number).padStart(6, '0')}` : `FA-${year}-${o.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export interface InvoiceRow {
  name: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
export interface InvoiceBreakdown {
  rows: InvoiceRow[];
  itemsTotal: number;
  loyaltyDiscount: number;
  giftWrap: number;
  delivery: number;
  total: number;
}

const variantOf = (i: Pick<OrderItem, 'color' | 'size'>) => [i.size ? `Taille ${i.size}` : '', i.color ?? ''].filter(Boolean).join(' · ');

// La commande ne garde pas les frais de livraison à part : total = articles − remise fidélité + emballage + livraison, donc livraison = le reste.
export function invoiceBreakdown(order: Pick<Order, 'items' | 'total' | 'gift_wrap' | 'loyalty_discount'>): InvoiceBreakdown {
  const rows = (order.items ?? []).map((i) => {
    const quantity = Number(i.quantity) || 1;
    const unitPrice = Number(i.unit_price) || 0;
    return { name: String(i.product_name ?? '').replace(/\s+/g, ' ').trim(), variant: variantOf(i), quantity, unitPrice, total: unitPrice * quantity };
  });
  const itemsTotal = rows.reduce((s, r) => s + r.total, 0);
  const loyaltyDiscount = Number(order.loyalty_discount) || 0;
  const giftWrap = order.gift_wrap ? GIFT_WRAP_FEE : 0;
  const total = Number(order.total) || 0;
  const delivery = Math.max(0, total - (itemsTotal - loyaltyDiscount + giftWrap));
  return { rows, itemsTotal, loyaltyDiscount, giftWrap, delivery, total };
}

export const formatXAF = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;

// ---- Tri des commandes (page admin) ----
export type PeriodFilter = 'all' | 'today' | '7d' | '30d';
export interface OrderFilter {
  query: string;
  status: OrderStatus | 'all';
  period: PeriodFilter;
}
const digits = (s: string) => s.replace(/\D/g, '');
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Recherche par numéro de commande ou de facture (« 12 », « N° 12 », « #12 », « FA-2026-000012 »), nom, téléphone (4 chiffres au moins), ville, adresse
// ou ancien repère (« #0C7E6708 », 6 caractères au moins).
export function matchesQuery(o: Order, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const f = fold(q.replace(/^#/, ''));
  if (fold([o.shipping_name, o.shipping_city, o.shipping_address].join(' ')).includes(f)) return true;
  if (f.length >= 6 && o.id.toLowerCase().includes(f)) return true;
  const d = digits(q);
  if (!d) return false;
  if (d.length >= 4 && digits(o.shipping_phone ?? '').includes(d)) return true;
  const m = q.match(/^(?:n°|no|num|#|fa-\d{4}-)?\s*(\d+)$/i);
  return !!m && o.order_number != null && o.order_number === Number(m[1]);
}

export function inPeriod(createdAt: string, period: PeriodFilter, now = Date.now()): boolean {
  if (period === 'all') return true;
  const t = Date.parse(createdAt);
  if (period === 'today') {
    const day = (ms: number) => Math.floor((ms + 3600_000) / 86_400_000); // jour de N'Djamena
    return day(t) === day(now);
  }
  return now - t <= (period === '7d' ? 7 : 30) * 86_400_000;
}

export function filterOrders(orders: Order[], f: OrderFilter, now = Date.now()): Order[] {
  return orders.filter((o) => (f.status === 'all' || o.status === f.status) && inPeriod(o.created_at, f.period, now) && matchesQuery(o, f.query));
}

// ---- Export pour le comptable (CSV, séparateur « ; », ouvert directement par Excel en français) ----
const csvCell = (v: unknown) => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ');
  return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function ordersToCsv(orders: Order[]): string {
  const head = ['N° commande', 'N° facture', 'Date', 'Client', 'Téléphone', 'Ville', 'Adresse', 'Articles', 'Paiement', 'Statut', 'Remise fidélité', 'Emballage cadeau', 'Livraison', 'Total (FCFA)'];
  const lines = orders.map((o) => {
    const b = invoiceBreakdown(o);
    const date = new Date(Date.parse(o.created_at) + 3600_000).toISOString().replace('T', ' ').slice(0, 16);
    return [
      o.order_number ?? '',
      invoiceNumber(o),
      date,
      o.shipping_name,
      o.shipping_phone,
      o.shipping_city,
      o.shipping_address,
      b.rows.map((r) => `${r.quantity} x ${r.name}${r.variant ? ` (${r.variant})` : ''}`).join(' + '),
      PAYMENT_LABELS[o.payment_method] ?? o.payment_method,
      STATUS_LABELS[o.status] ?? o.status,
      b.loyaltyDiscount,
      b.giftWrap,
      b.delivery,
      b.total,
    ]
      .map(csvCell)
      .join(';');
  });
  return `﻿${[head.map(csvCell).join(';'), ...lines].join('\r\n')}\r\n`;
}
