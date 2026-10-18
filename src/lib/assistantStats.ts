// Statistiques spéciales de Zara : transforme la réponse de la base (fonction assistant_stats) en chiffres prêts à afficher.
// Aucun réseau ici : tout est testable.

export const DEVICES = ['iPhone', 'Android', 'Tablette', 'PC', 'Autre'] as const;
export type Device = (typeof DEVICES)[number];

export const DEVICE_LABELS: Record<Device, string> = {
  iPhone: 'iPhone',
  Android: 'Android',
  Tablette: 'Tablette',
  PC: 'Ordinateur',
  Autre: 'Autre / inconnu',
};

export type DeviceCounts = Record<Device, number>;
export type DeviceMoney = Record<Device, { count: number; amount: number }>;

export type StatsPeriod = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'all';

export const PERIOD_ORDER: StatsPeriod[] = ['today', 'yesterday', '7d', '30d', 'month', 'all'];

export const PERIOD_LABELS: Record<StatsPeriod, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  '7d': '7 jours',
  '30d': '30 jours',
  month: 'Ce mois',
  all: 'Depuis le début',
};

// Ce que renvoie la fonction de la base (assistant_stats).
export interface RawStats {
  conversations?: { device: string; n: number | string }[];
  events?: { event: string; device: string; n: number | string }[];
  orders?: { device: string; status: string; n: number | string; amount: number | string }[];
  accounts?: { device: string; n: number | string }[];
  installs?: { device: string; n: number | string }[];
  totals?: { orders?: number | string; orders_amount?: number | string; accounts?: number | string; installs?: number | string };
}

export interface ZaraStats {
  conversations: { total: number; byDevice: DeviceCounts };
  sales: {
    count: number;
    amount: number;
    delivered: { count: number; amount: number };
    cancelled: number;
    byDevice: DeviceMoney;
  };
  accounts: { count: number; byDevice: DeviceCounts };
  installs: {
    count: number;
    byDevice: DeviceCounts;
    questions: number;
    alreadyInstalled: number;
    later: number;
    iosGuides: number;
  };
  shop: { orders: number; ordersAmount: number; accounts: number; installs: number };
  // part de Zara dans ce qui s'est passé sur toute la boutique (en %, null si rien à comparer)
  shares: { orders: number | null; accounts: number | null; installs: number | null };
  // commandes passées par Zara pour 100 conversations (null s'il n'y a eu aucune conversation)
  ordersPer100Chats: number | null;
}

const emptyCounts = (): DeviceCounts => ({ iPhone: 0, Android: 0, Tablette: 0, PC: 0, Autre: 0 });
const emptyMoney = (): DeviceMoney => ({
  iPhone: { count: 0, amount: 0 },
  Android: { count: 0, amount: 0 },
  Tablette: { count: 0, amount: 0 },
  PC: { count: 0, amount: 0 },
  Autre: { count: 0, amount: 0 },
});

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const deviceOf = (value: unknown): Device => ((DEVICES as readonly string[]).includes(String(value)) ? (String(value) as Device) : 'Autre');

const percent = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

export function buildZaraStats(raw: RawStats | null | undefined): ZaraStats {
  const r = raw ?? {};

  const conversations = emptyCounts();
  for (const row of r.conversations ?? []) conversations[deviceOf(row.device)] += num(row.n);

  const accounts = emptyCounts();
  for (const row of r.accounts ?? []) accounts[deviceOf(row.device)] += num(row.n);

  const installs = emptyCounts();
  for (const row of r.installs ?? []) installs[deviceOf(row.device)] += num(row.n);

  // Une vente = une commande passée par Zara et non annulée (les commandes marquées fausses sont déjà écartées par la base).
  const byDevice = emptyMoney();
  let count = 0;
  let amount = 0;
  let deliveredCount = 0;
  let deliveredAmount = 0;
  let cancelled = 0;
  for (const row of r.orders ?? []) {
    const n = num(row.n);
    const sum = num(row.amount);
    if (row.status === 'cancelled') {
      cancelled += n;
      continue;
    }
    count += n;
    amount += sum;
    byDevice[deviceOf(row.device)].count += n;
    byDevice[deviceOf(row.device)].amount += sum;
    if (row.status === 'delivered') {
      deliveredCount += n;
      deliveredAmount += sum;
    }
  }

  const eventTotal = (name: string) => (r.events ?? []).filter((e) => e.event === name).reduce((sum, e) => sum + num(e.n), 0);

  const conversationsTotal = DEVICES.reduce((sum, d) => sum + conversations[d], 0);
  const accountsTotal = DEVICES.reduce((sum, d) => sum + accounts[d], 0);
  const installsTotal = DEVICES.reduce((sum, d) => sum + installs[d], 0);

  const shop = {
    orders: num(r.totals?.orders),
    ordersAmount: num(r.totals?.orders_amount),
    accounts: num(r.totals?.accounts),
    installs: num(r.totals?.installs),
  };

  return {
    conversations: { total: conversationsTotal, byDevice: conversations },
    sales: { count, amount, delivered: { count: deliveredCount, amount: deliveredAmount }, cancelled, byDevice },
    accounts: { count: accountsTotal, byDevice: accounts },
    installs: {
      count: installsTotal,
      byDevice: installs,
      questions: eventTotal('install_question'),
      alreadyInstalled: eventTotal('install_already'),
      later: eventTotal('install_later'),
      iosGuides: eventTotal('install_ios_guide'),
    },
    shop,
    shares: {
      orders: percent(count, shop.orders),
      accounts: percent(accountsTotal, shop.accounts),
      installs: percent(installsTotal, shop.installs),
    },
    ordersPer100Chats: conversationsTotal > 0 ? Math.round((count / conversationsTotal) * 1000) / 10 : null,
  };
}

// Les jours se comptent à l'heure du Tchad (UTC+1, pas d'heure d'été) : « aujourd'hui » commence à minuit à N'Djamena.
const CHAD_OFFSET_MS = 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

function chadMidnight(now: number): number {
  const local = new Date(now + CHAD_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - CHAD_OFFSET_MS;
}

// Début (inclus) et fin (exclue) de la période, en dates ISO pour la base ; null = pas de limite.
export function periodBounds(period: StatsPeriod, now: number = Date.now()): { since: string | null; until: string | null } {
  const today = chadMidnight(now);
  const iso = (ms: number) => new Date(ms).toISOString();
  switch (period) {
    case 'today':
      return { since: iso(today), until: null };
    case 'yesterday':
      return { since: iso(today - DAY_MS), until: iso(today) };
    case '7d':
      return { since: iso(today - 6 * DAY_MS), until: null };
    case '30d':
      return { since: iso(today - 29 * DAY_MS), until: null };
    case 'month': {
      const local = new Date(now + CHAD_OFFSET_MS);
      return { since: iso(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - CHAD_OFFSET_MS), until: null };
    }
    default:
      return { since: null, until: null };
  }
}

export type StatsFailure = 'not_installed' | 'forbidden' | 'error';

// Classe l'erreur de la base : fonction pas encore installée (script pas appliqué), accès refusé, ou autre panne.
export function classifyStatsError(error: { code?: string | null; message?: string | null; status?: number } | null | undefined): StatsFailure {
  const code = error?.code ?? '';
  if (code === 'PGRST202' || code === '42883' || error?.status === 404) return 'not_installed';
  if (code === '42501') return 'forbidden';
  return 'error';
}
