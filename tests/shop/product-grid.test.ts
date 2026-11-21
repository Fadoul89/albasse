// La grille des articles selon la vraie largeur (src/lib/productGrid.ts) : fonction pure, aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/shop/product-grid.test.ts
import { gridLayout, GRID_GAP, MIN_CARD } from '../../src/lib/productGrid.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) { ok++; console.log('OK   ', label); } else { console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail)); process.exitCode = 1; }
};
const fits = (w: number, pad = GRID_GAP) => { const g = gridLayout(w, { pad }); return g.columns * g.cardWidth + (g.columns - 1) * GRID_GAP <= w - 2 * pad + 1e-9; };

check('petit téléphone (360) : 2 colonnes de 156 px (comme avant)', JSON.stringify(gridLayout(360)) === JSON.stringify({ columns: 2, cardWidth: 156 }), gridLayout(360));
check('téléphone (412) : 2 colonnes de 182 px (comme avant)', JSON.stringify(gridLayout(412)) === JSON.stringify({ columns: 2, cardWidth: 182 }), gridLayout(412));
check('téléphone en « version ordinateur » (980) : 4 colonnes de 225 px', JSON.stringify(gridLayout(980)) === JSON.stringify({ columns: 4, cardWidth: 225 }), gridLayout(980));
check('ordinateur (1280) : 6 colonnes (plus de grand vide)', gridLayout(1280).columns === 6 && gridLayout(1280).cardWidth >= MIN_CARD, gridLayout(1280));
check('très grand écran (2560) : 6 colonnes au plus', gridLayout(2560).columns === 6, gridLayout(2560));
check('tablette (768) : 3 colonnes', gridLayout(768).columns === 3, gridLayout(768));
check('une carte fait au moins 180 px dès qu\'il y a plus de 2 colonnes', [600, 700, 800, 900, 1000, 1100, 1200, 1300, 1500, 1900].every((w) => gridLayout(w).columns === 2 || gridLayout(w).cardWidth >= MIN_CARD));
check('la ligne tient toujours dans la largeur (jamais de carte qui passe à la ligne)', [320, 360, 375, 390, 412, 430, 600, 768, 980, 1024, 1280, 1366, 1440, 1920, 2560].every((w) => fits(w)) && [300, 777, 1001].every((w) => fits(w, 0)));
check('la ligne est remplie (moins d\'1 px de reste)', [412, 980, 1280, 1920].every((w) => { const g = gridLayout(w); return w - 2 * GRID_GAP - (g.columns * g.cardWidth + (g.columns - 1) * GRID_GAP) < 1; }));
check('largeur inconnue (0, NaN) : 2 colonnes, jamais de largeur négative', gridLayout(0).columns === 2 && gridLayout(0).cardWidth === 0 && gridLayout(NaN).columns === 2 && gridLayout(NaN).cardWidth === 0);
check('sans marge (pad 0, favoris dans un cadre) : 380 px → 2 colonnes de 182 px', JSON.stringify(gridLayout(380, { pad: 0 })) === JSON.stringify({ columns: 2, cardWidth: 182 }));
console.log(`\n${ok} contrôles réussis`);
