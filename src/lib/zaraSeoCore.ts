// Zara SEO (admin) : calculs purs, sans réseau ni base (testés : tests/seo/zara-seo.test.ts).
// Santé des fiches produit (descriptions) et choix des fiches à améliorer. Les appels à la fonction « zara-seo » et à la base sont dans zaraSeo.ts.

// en dessous de ce nombre de caractères, la description est « trop courte » (même valeur que supabase/functions/zara-seo/rules.ts : un test le vérifie)
export const WEAK_MIN_LEN = 60;
export const BATCH_SIZE = 8;

export interface SeoRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  stock: number;
  is_active: boolean;
  images: string[] | null;
  created_at?: string;
  description_zara_at?: string | null;
  description_before_zara?: string | null;
}

export type DescriptionLevel = 'none' | 'short' | 'ok';

export function descriptionLevel(description: string | null | undefined): DescriptionLevel {
  const len = String(description ?? '').replace(/\s+/g, ' ').trim().length;
  if (len === 0) return 'none';
  return len < WEAK_MIN_LEN ? 'short' : 'ok';
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface SeoOverview {
  active: number;
  none: number;
  short: number;
  ok: number;
  doneByZara: number;
  duplicates: { name: string; count: number }[];
}

// Les articles désactivés ne sont pas comptés (Google ne les voit pas). « doneByZara » : descriptions déjà écrites par Zara.
export function seoOverview(rows: SeoRow[]): SeoOverview {
  const active = rows.filter((r) => r.is_active);
  const level = (r: SeoRow) => descriptionLevel(r.description);
  const byName = new Map<string, { name: string; count: number }>();
  for (const r of active) {
    const key = fold(r.name);
    if (!key) continue;
    const cur = byName.get(key);
    if (cur) cur.count++;
    else byName.set(key, { name: r.name.replace(/\s+/g, ' ').trim(), count: 1 });
  }
  return {
    active: active.length,
    none: active.filter((r) => level(r) === 'none').length,
    short: active.filter((r) => level(r) === 'short').length,
    ok: active.filter((r) => level(r) === 'ok').length,
    doneByZara: rows.filter((r) => !!r.description_zara_at).length,
    duplicates: [...byName.values()].filter((d) => d.count > 1).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

// Les fiches à améliorer d'abord : sans description avant « trop courte », en stock avant épuisé, les plus récentes d'abord.
// Les fiches déjà écrites par Zara (ou déjà proposées dans cette séance) ne reviennent pas.
export function pickWeak(rows: SeoRow[], count = BATCH_SIZE, skip: Set<string> = new Set()): SeoRow[] {
  const rank = (r: SeoRow) => (descriptionLevel(r.description) === 'none' ? 0 : 1) * 2 + (r.stock > 0 ? 0 : 1);
  return rows
    .filter((r) => r.is_active && !r.description_zara_at && !skip.has(r.id) && descriptionLevel(r.description) !== 'ok')
    .sort((a, b) => rank(a) - rank(b) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')) || a.name.localeCompare(b.name))
    .slice(0, count);
}

export interface SeoSuggestion {
  id: string;
  name: string;
  current: string;
  proposal: string;
  source: 'ia' | 'modele';
  problems: string[];
}
