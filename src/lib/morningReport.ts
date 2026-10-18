// « Rapport du matin » de Zara : ce qui s'est passé pendant la nuit, avec les VRAIS chiffres de la boutique.
// Aucun réseau, aucun écran ici : tout est testable. Chaque morceau peut manquer (null) : le rapport le dit au lieu d'inventer.

import type { ZaraStats } from './assistantStats';
import type { BrowsingOverview } from './browsingOverview';
import { LOW_STOCK_MAX, chadDayIso } from './assistantSales';

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CHAD_OFFSET_MS = HOUR_MS;

export type MorningWindow = 'night' | 'day';
export const MORNING_WINDOWS: MorningWindow[] = ['night', 'day'];
export const MORNING_WINDOW_LABELS: Record<MorningWindow, string> = {
  night: 'Cette nuit (depuis hier 18 h)',
  day: 'Dernières 24 h',
};

// Début de la période (date ISO pour la base). « Cette nuit » = depuis hier 18 h, heure du Tchad.
export function morningSince(window: MorningWindow, now: number = Date.now()): string {
  if (window === 'day') return new Date(now - DAY_MS).toISOString();
  const local = new Date(now + CHAD_OFFSET_MS);
  const chadMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - CHAD_OFFSET_MS;
  return new Date(chadMidnight - 6 * HOUR_MS).toISOString();
}

// Commandes qui attendent d'être traitées par l'équipe.
export const ORDERS_TO_PROCESS = ['pending', 'paid', 'processing'] as const;

export interface MorningOrder {
  id: string;
  status: string;
  total: number;
  created_at: string;
  is_flagged_fake?: boolean | null;
}

export interface MorningCallback {
  status: string;
  wanted_day: string | null;
  created_at: string;
}

export interface MorningInput {
  now: number;
  since: string;
  stats: ZaraStats | null;
  browsing: BrowsingOverview | null;
  orders: MorningOrder[] | null;
  callbacks: MorningCallback[] | null;
  catalog: { id: string; name: string; stock: number }[] | null;
  abandonedCarts: number | null;
}

export type MorningRoute = 'AdminCallbacks' | 'AdminOrders' | 'AdminAbandonedCarts' | 'AdminBrowsing';

export interface TodoItem {
  key: 'callbacks' | 'orders' | 'carts' | 'stock';
  icon: string;
  text: string;
  route: MorningRoute;
}

export interface MorningReport {
  todo: TodoItem[];
  visitors: number | null;
  sales: { orders: number; amount: number; zaraOrders: number; zaraAmount: number; zaraShare: number | null } | null;
  toProcess: { count: number; amount: number; oldestHours: number | null } | null;
  callbacks: { pending: number; due: number; today: number; late: number; newSince: number } | null;
  carts: { visitors: number; products: { name: string; visitors: number }[]; abandoned: number | null } | null;
  watched: {
    products: { name: string; views: number; visitors: number; stock: number | null; lowStock: boolean; soldOut: boolean }[];
    lowStockCount: number;
    searches: { query: string; count: number }[];
  } | null;
  zara: { conversations: number; accounts: number; installs: number } | null;
}

export const plural = (n: number, one: string, many: string = `${one}s`) => `${n} ${n > 1 ? many : one}`;

const TOP = 5;

export function buildMorningReport(input: MorningInput): MorningReport {
  const { now, since, stats, browsing, orders, callbacks, catalog, abandonedCarts } = input;

  // ventes de la période (toute la boutique) et part de Zara
  const sales = stats
    ? {
        orders: stats.shop.orders,
        amount: stats.shop.ordersAmount,
        zaraOrders: stats.sales.count,
        zaraAmount: stats.sales.amount,
        zaraShare: stats.shares.orders,
      }
    : null;

  // commandes à traiter (peu importe quand elles sont arrivées), sauf les fausses
  let toProcess: MorningReport['toProcess'] = null;
  if (orders) {
    const waiting = orders.filter((o) => (ORDERS_TO_PROCESS as readonly string[]).includes(o.status) && !o.is_flagged_fake);
    const oldest = waiting.reduce<number | null>((min, o) => {
      const t = new Date(o.created_at).getTime();
      return Number.isFinite(t) && (min === null || t < min) ? t : min;
    }, null);
    toProcess = {
      count: waiting.length,
      amount: waiting.reduce((sum, o) => sum + (Number.isFinite(Number(o.total)) ? Number(o.total) : 0), 0),
      oldestHours: oldest === null ? null : Math.max(0, Math.floor((now - oldest) / HOUR_MS)),
    };
  }

  // rappels WhatsApp : « à faire maintenant » = le jour demandé est aujourd'hui ou déjà passé
  let cb: MorningReport['callbacks'] = null;
  if (callbacks) {
    const today = chadDayIso(new Date(now));
    const pending = callbacks.filter((r) => r.status === 'new');
    const late = pending.filter((r) => r.wanted_day && r.wanted_day < today).length;
    const todayN = pending.filter((r) => r.wanted_day === today).length;
    const sinceMs = new Date(since).getTime();
    cb = {
      pending: pending.length,
      due: late + todayN,
      today: todayN,
      late,
      newSince: callbacks.filter((r) => new Date(r.created_at).getTime() >= sinceMs).length,
    };
  }

  // paniers non commandés vus par le suivi de navigation + paniers abandonnés de clients connectés
  let carts: MorningReport['carts'] = null;
  if (browsing || abandonedCarts !== null) {
    const open = (browsing?.rows ?? []).filter((r) => r.cartStatus === 'in_cart');
    const byProduct = new Map<string, { name: string; refs: Set<string> }>();
    for (const r of open) {
      const entry = byProduct.get(r.productId) ?? { name: r.productName, refs: new Set<string>() };
      entry.refs.add(r.visitorRef);
      byProduct.set(r.productId, entry);
    }
    carts = {
      visitors: new Set(open.map((r) => r.visitorRef)).size,
      products: [...byProduct.values()]
        .map((e) => ({ name: e.name, visitors: e.refs.size }))
        .sort((a, b) => b.visitors - a.visitors || a.name.localeCompare(b.name))
        .slice(0, 3),
      abandoned: abandonedCarts,
    };
  }

  // les articles les plus regardés, avec leur vrai stock
  let watched: MorningReport['watched'] = null;
  if (browsing) {
    const stockOf = new Map((catalog ?? []).map((p) => [p.id, p.stock]));
    const products = browsing.topProducts.slice(0, TOP).map((p) => {
      const stock = stockOf.has(p.productId) ? (stockOf.get(p.productId) as number) : null;
      return {
        name: p.name,
        views: p.views,
        visitors: p.visitors,
        stock,
        lowStock: stock !== null && stock >= 1 && stock <= LOW_STOCK_MAX,
        soldOut: stock !== null && stock <= 0,
      };
    });
    watched = {
      products,
      lowStockCount: products.filter((p) => p.lowStock || p.soldOut).length,
      searches: browsing.topSearches.slice(0, TOP),
    };
  }

  const zara = stats ? { conversations: stats.conversations.total, accounts: stats.accounts.count, installs: stats.installs.count } : null;

  // ce qu'il faut faire en premier (seulement ce qui existe vraiment)
  const todo: TodoItem[] = [];
  if (cb && cb.due > 0) {
    todo.push({
      key: 'callbacks',
      icon: '📲',
      text: `${plural(cb.due, 'rappel WhatsApp', 'rappels WhatsApp')} à faire aujourd’hui${cb.late > 0 ? ` (dont ${cb.late} en retard)` : ''}`,
      route: 'AdminCallbacks',
    });
  } else if (cb && cb.pending > 0) {
    todo.push({ key: 'callbacks', icon: '📲', text: `${plural(cb.pending, 'rappel WhatsApp', 'rappels WhatsApp')} en attente (jour à venir ou sans jour)`, route: 'AdminCallbacks' });
  }
  if (toProcess && toProcess.count > 0) {
    todo.push({
      key: 'orders',
      icon: '📦',
      text: `${plural(toProcess.count, 'commande')} à traiter${toProcess.oldestHours !== null && toProcess.oldestHours >= 1 ? ` (la plus ancienne attend ${toProcess.oldestHours} h)` : ''}`,
      route: 'AdminOrders',
    });
  }
  if (carts && (carts.abandoned ?? 0) > 0) {
    todo.push({ key: 'carts', icon: '🛒', text: `${plural(carts.abandoned as number, 'panier abandonné', 'paniers abandonnés')} de clients connectés à relancer`, route: 'AdminAbandonedCarts' });
  }
  if (watched && watched.lowStockCount > 0) {
    todo.push({
      key: 'stock',
      icon: '⚠️',
      text: `${plural(watched.lowStockCount, 'article très regardé presque épuisé', 'articles très regardés presque épuisés ou épuisés')}`,
      route: 'AdminBrowsing',
    });
  }

  return { todo, visitors: browsing ? browsing.totals.visitors : null, sales, toProcess, callbacks: cb, carts, watched, zara };
}
