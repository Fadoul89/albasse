// Tableau de bord « couleur hacker » (demande du patron, 16 novembre 2026) : règles d'affichage, sans réseau.
// Les chiffres viennent de la fonction de la base admin_dashboard_overview (add-admin-dashboard.sql) : des totaux, jamais un client.
// Testé dans tests/email/hacker-dashboard.test.ts. Rien n'est inventé : un chiffre illisible vaut 0, une comparaison absente n'est pas affichée.

export type PeriodKey = 'today' | '7d' | '30d' | 'all';
export const PERIODS: { key: PeriodKey; label: string; flag: string }[] = [
  { key: 'today', label: "Aujourd'hui", flag: '--aujourdhui' },
  { key: '7d', label: '7 jours', flag: '--7j' },
  { key: '30d', label: '30 jours', flag: '--30j' },
  { key: 'all', label: 'Tout', flag: '--tout' },
];
const BEFORE: Record<PeriodKey, string | null> = { today: "vs hier à la même heure", '7d': "vs 7 j d'avant", '30d': "vs 30 j d'avant", all: null };
export const periodTitle = (k: PeriodKey): string => (k === 'today' ? "aujourd'hui" : k === 'all' ? 'depuis le début' : k === '7d' ? 'ces 7 derniers jours' : 'ces 30 derniers jours');
export const terminalLine = (k: PeriodKey): string => `root@albasse:~$ ./tableau_de_bord ${(PERIODS.find((p) => p.key === k) ?? PERIODS[2]).flag}`;

export interface WeekPoint {
  week: string; // lundi de la semaine, AAAA-MM-JJ
  visitors: number;
}
export interface Overview {
  period: PeriodKey;
  visitors: number;
  visitorsPrev: number | null;
  newCustomers: number;
  newCustomersPrev: number | null;
  orders: number;
  ordersPrev: number | null;
  revenue: number;
  products: number;
  categories: number;
  weeks: WeekPoint[];
  sources: { source: string; visitors: number }[];
  top: { productId: string; name: string; visitors: number }[];
}

const int = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};
const intOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);

// La réponse de la base (jsonb) ; null si elle est illisible
export function parseOverview(raw: unknown): Overview | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const period = (['today', '7d', '30d', 'all'] as const).find((k) => k === r.period) ?? '30d';
  return {
    period,
    visitors: int(r.visitors),
    visitorsPrev: intOrNull(r.visitors_prev),
    newCustomers: int(r.new_customers),
    newCustomersPrev: intOrNull(r.new_customers_prev),
    orders: int(r.orders),
    ordersPrev: intOrNull(r.orders_prev),
    revenue: int(r.revenue),
    products: int(r.products),
    categories: int(r.categories),
    weeks: arr(r.weeks)
      .filter((w) => typeof w.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.week as string))
      .map((w) => ({ week: w.week as string, visitors: int(w.visitors) })),
    sources: arr(r.sources)
      .filter((s) => typeof s.source === 'string' && (s.source as string).trim() !== '')
      .map((s) => ({ source: (s.source as string).trim(), visitors: int(s.visitors) })),
    top: arr(r.top)
      .filter((t) => typeof t.name === 'string' && typeof t.product_id === 'string')
      .map((t) => ({ productId: t.product_id as string, name: (t.name as string).replace(/\s+/g, ' ').trim(), visitors: int(t.visitors) })),
  };
}

// 24 180 (espaces fines comme sur le reste du site)
export const nb = (n: number): string => Math.round(n).toLocaleString('fr-FR');
// 10 738 -> « 10,7k » ; 485 -> « 485 » (au-dessus des barres)
export const compact = (n: number): string => (n >= 1000 ? `${(Math.round(n / 100) / 10).toLocaleString('fr-FR')}k` : String(Math.round(n)));
export const fcfa = (n: number): string => `${nb(n)} FCFA`;

export type Trend = 'up' | 'down' | 'flat';
// L'évolution par rapport à la période d'avant : en % quand la période d'avant a au moins 20 (sinon un % ne veut rien dire), sinon en nombre.
// null : pas de comparaison (période « Tout », ou chiffre d'avant inconnu).
export function change(cur: number, prev: number | null, k: PeriodKey): { text: string; trend: Trend } | null {
  const before = BEFORE[k];
  if (prev === null || before === null) return null;
  const diff = cur - prev;
  if (diff === 0) return { text: `= comme avant (${before.replace(/^vs /, '')})`, trend: 'flat' };
  const trend: Trend = diff > 0 ? 'up' : 'down';
  const arrow = diff > 0 ? '▲' : '▼';
  const sign = diff > 0 ? '+' : '-';
  if (prev >= 20) return { text: `${arrow} ${sign}${Math.abs(Math.round((diff / prev) * 100))} % ${before}`, trend };
  return { text: `${arrow} ${sign}${nb(Math.abs(diff))} ${before}`, trend };
}

// Les barres des 12 semaines : hauteur en % de la plus haute (au moins 2 % pour une semaine non vide), la dernière = semaine en cours
export function weekBars(weeks: WeekPoint[]): { label: string; visitors: number; height: number; current: boolean }[] {
  const max = Math.max(0, ...weeks.map((w) => w.visitors));
  return weeks.map((w, i) => {
    const [, m, d] = w.week.split('-');
    const h = max > 0 ? (w.visitors / max) * 100 : 0;
    return { label: `${d}/${m}`, visitors: w.visitors, height: w.visitors > 0 ? Math.max(2, Math.round(h)) : 0, current: i === weeks.length - 1 };
  });
}

// La jauge : part des visiteurs qui ont créé un compte. null quand il n'y a aucun visiteur (rien à dire).
export function signupRate(newCustomers: number, visitors: number): { pct: number; text: string } | null {
  if (!(visitors > 0)) return null;
  const pct = Math.min(100, (newCustomers / visitors) * 100);
  return { pct, text: `${(Math.round(pct * 10) / 10).toLocaleString('fr-FR')} %` };
}
// Les traits allumés de la jauge (sur `total`) : au moins 1 dès qu'il y a un compte créé, pour que la jauge ne paraisse pas vide à tort
export const litTicks = (pct: number, total: number): number => (pct > 0 ? Math.max(1, Math.min(total, Math.round((pct / 100) * total))) : 0);

// La part d'une commande sur les visiteurs : « moins de 0,1 % » plutôt qu'un 0 trompeur
export function orderRateText(orders: number, visitors: number): string {
  if (!(visitors > 0)) return `${nb(orders)} commande${orders > 1 ? 's' : ''}`;
  const pct = (orders / visitors) * 100;
  const p = orders === 0 ? '0 %' : pct < 0.1 ? 'moins de 0,1 %' : `${(Math.round(pct * 10) / 10).toLocaleString('fr-FR')} %`;
  return `Commandes : ${nb(orders)} sur ${nb(visitors)} (${p})`;
}

const SOURCE_ICONS: [RegExp, string][] = [
  [/tiktok/i, '🎵'],
  [/publicit|campagne/i, '📣'],
  [/direct/i, '🔗'],
  [/facebook/i, '📘'],
  [/instagram/i, '📸'],
  [/google/i, '🔎'],
  [/whatsapp/i, '💬'],
  [/telegram/i, '✈️'],
];
export const sourceIcon = (s: string): string => SOURCE_ICONS.find(([re]) => re.test(s))?.[1] ?? '·';
export const sourceLabel = (s: string): string => (/^publicit/i.test(s) ? 'Publicité' : s);

// Largeur d'une barre de classement en % du premier (au moins 1 % pour une ligne non vide)
export const shareOf = (n: number, max: number): number => (max > 0 && n > 0 ? Math.max(1, Math.round((n / max) * 100)) : 0);
