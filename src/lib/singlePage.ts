// Mode « page unique » : le même site, mis en ligne une 2ᵉ fois sur une autre adresse (Netlify), qui s'ouvre directement sur la page
// « Vitalité & Énergie Homme » (le café), sans le nom, le bandeau, les fenêtres ni Zara d'Albasse Shopping (docs/site-cafe-separe.md).
// Le mode se choisit à la fabrication du site avec la variable EXPO_PUBLIC_SINGLE_PAGE=cafe (Netlify › Environment variables).
// Sans cette variable (le vrai site albasseshopping.com), RIEN ne change.
// Des fonctions pures, sans réseau : tests/email/single-page.test.ts.

export type SinglePageMode = 'cafe' | null;

export function parseSinglePage(raw: string | null | undefined): SinglePageMode {
  return String(raw ?? '').trim().toLowerCase() === 'cafe' ? 'cafe' : null;
}

// Expo écrit la valeur dans le site à la fabrication : il faut garder exactement cette écriture (process.env.EXPO_PUBLIC_…)
export const SINGLE_PAGE: SinglePageMode = parseSinglePage(process.env.EXPO_PUBLIC_SINGLE_PAGE);
export const isSinglePage = (): boolean => SINGLE_PAGE !== null;
