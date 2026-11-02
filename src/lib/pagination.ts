// Découpe d'une longue liste en pages numérotées (1 2 3 4 …) : Admin › Clients (demande du patron : « voir toute la liste divisée en pages »).
// Des fonctions pures, sans réseau : testées dans tests/email/pagination.test.ts.

// Le nombre de pages (toujours au moins 1, même pour une liste vide)
export const pageCount = (total: number, size: number): number => {
  const t = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const s = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  return Math.max(1, Math.ceil(t / s));
};

// Une page valide : entre 1 et le nombre de pages (une valeur absurde ou illisible = la page 1)
export const clampPage = (page: number, total: number, size: number): number => {
  const p = Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.min(Math.max(1, p), pageCount(total, size));
};

// Les éléments de la page demandée (la liste reçue n'est pas modifiée)
export function pageSlice<T>(list: readonly T[], page: number, size: number): T[] {
  const s = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  const p = clampPage(page, list.length, s);
  return list.slice((p - 1) * s, p * s);
}

// « 21–40 sur 75 » : les numéros (à partir de 1) du premier et du dernier élément de la page, et le total ; null quand la liste est vide
export function pageRange(page: number, total: number, size: number): { from: number; to: number; total: number } | null {
  const t = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  if (t === 0) return null;
  const s = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  const p = clampPage(page, t, s);
  return { from: (p - 1) * s + 1, to: Math.min(p * s, t), total: t };
}

// Les boutons à montrer : tous les numéros quand il y en a peu (1 2 3 4), sinon la première et la dernière page, la page courante et ses voisines,
// avec des « … » à la place des pages cachées. Au plus `maxButtons` éléments (7 par défaut : tient sur un téléphone de 360 px).
export type PageItem = number | 'gap-left' | 'gap-right';
export function pageItems(current: number, count: number, maxButtons = 7): PageItem[] {
  const n = Number.isFinite(count) && count >= 1 ? Math.floor(count) : 1;
  const max = Math.max(5, Math.floor(maxButtons));
  const c = Math.min(Math.max(1, Number.isFinite(current) ? Math.floor(current) : 1), n);
  if (n <= max) return Array.from({ length: n }, (_, i) => i + 1);
  const edge = max - 2; // numéros montrés d'un côté quand la page courante est près d'un bord (1 2 3 4 5 … 12)
  if (c <= edge - 1) return [...Array.from({ length: edge }, (_, i) => i + 1), 'gap-right', n];
  if (c >= n - (edge - 2)) return [1, 'gap-left', ...Array.from({ length: edge }, (_, i) => n - edge + 1 + i)];
  const middle = max - 4; // au milieu : 1 … 5 6 7 … 12
  const start = c - Math.floor((middle - 1) / 2);
  return [1, 'gap-left', ...Array.from({ length: middle }, (_, i) => start + i), 'gap-right', n];
}
