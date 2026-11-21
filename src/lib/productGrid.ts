// La grille des articles (catégories, « Tous les articles », recherche, favoris) : le nombre de colonnes et la largeur des cartes
// viennent de la VRAIE largeur de la liste, mesurée à l'écran (demande du patron, 21 novembre 2026 : « l'affichage des articles en
// version web est toujours comme ça » : 2 colonnes perdues au milieu d'un grand écran). Fonction pure, sans réseau (tests/shop/product-grid.test.ts).
//   • une carte fait au moins MIN_CARD px ; 2 colonnes au moins (téléphone), 6 au plus (grand écran) ;
//   • les cartes remplissent la ligne : même marge sur les côtés (pad) et même espace entre elles (gap).
export const GRID_GAP = 16;
export const MIN_CARD = 180;
export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 6;

export interface GridLayout {
  columns: number;
  cardWidth: number;
}

export function gridLayout(width: number, opts: { pad?: number; gap?: number; min?: number; minColumns?: number; maxColumns?: number } = {}): GridLayout {
  const pad = opts.pad ?? GRID_GAP;
  const gap = opts.gap ?? GRID_GAP;
  const min = opts.min ?? MIN_CARD;
  const lo = opts.minColumns ?? MIN_COLUMNS;
  const hi = Math.max(lo, opts.maxColumns ?? MAX_COLUMNS);
  const inner = Math.max(0, (Number.isFinite(width) ? width : 0) - 2 * pad);
  const columns = Math.min(hi, Math.max(lo, Math.floor((inner + gap) / (min + gap))));
  // arrondi vers le bas au centième : la dernière carte de la ligne ne passe jamais à la ligne suivante
  const cardWidth = Math.max(0, Math.floor(((inner - gap * (columns - 1)) / columns) * 100) / 100);
  return { columns, cardWidth };
}
