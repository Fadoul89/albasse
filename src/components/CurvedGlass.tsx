import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';

// Le fond du menu ☰ « verre courbé » (demande du patron, 16 novembre 2026, comme la vidéo « Curved Sidebar ») :
// une VITRE CLAIRE (21 novembre 2026 : « vitre claire encore ») : le site se voit au travers, à peine flou et éclairci,
// avec un reflet de lumière en biais et des bords lumineux ; les bords gauche et droit sont légèrement creusés au milieu.
// Le texte du menu garde un léger halo blanc (lisible même devant les zones colorées du site).
// Web : un <div> découpé par un chemin SVG (clip-path) + flou du fond (backdrop-filter) ; le liseré est le même chemin, dessiné par-dessus.
// Sans flou possible (vieux navigateur) : le verre est assez blanc pour rester lisible. Hors web : un panneau clair aux coins arrondis.
// Rien ne bloque les touchers : ce fond est sous le contenu, et pointer-events est coupé.

// Le contour, en fractions de la taille du panneau (0 à 1) : coins arrondis, côtés creusés de 4,5 % au milieu.
export const CURVE_PATH =
  'M0.08,0 H0.92 Q1,0 1,0.012 C0.955,0.3 0.955,0.7 1,0.988 Q1,1 0.92,1 H0.08 Q0,1 0,0.988 C0.045,0.7 0.045,0.3 0,0.012 Q0,0 0.08,0 Z';
const CLIP_ID = 'albasse-menu-curve';
// Le creux au milieu de chaque côté, en part de la largeur : le contenu garde au moins cette marge pour ne jamais être coupé
export const CURVE_INSET = 0.045;

// peu de blanc : le site se voit au travers ; le flou léger et l'éclaircissement (brightness) gardent le texte sombre lisible
export const GLASS_BG = 'linear-gradient(160deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.20) 42%, rgba(255,255,255,0.30) 100%)';
export const GLASS_FILTER = 'blur(8px) saturate(150%) brightness(1.8)';
// le reflet de vitre : deux bandes claires en biais
const GLASS_SHINE =
  'linear-gradient(118deg, rgba(255,255,255,0) 22%, rgba(255,255,255,0.28) 30%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.14) 68%, rgba(255,255,255,0) 74%)';
// le halo blanc des lettres du menu (tous les textes du panneau : les textes de React Native Web ne l'héritent pas)
const TEXT_HALO =
  '[data-testid="menu-panel"],[data-testid="menu-panel"] div{text-shadow:0 0 6px rgba(255,255,255,0.95),0 0 2px rgba(255,255,255,0.9)}';

export function CurvedGlass() {
  if (Platform.OS !== 'web') return <View pointerEvents="none" style={styles.native} />;
  return React.createElement(
    'div',
    { 'aria-hidden': 'true', 'data-testid': 'menu-glass', style: { position: 'absolute', inset: 0, pointerEvents: 'none' } },
    React.createElement(
      'svg',
      { width: 0, height: 0, style: { position: 'absolute' }, focusable: 'false' },
      React.createElement(
        'defs',
        null,
        React.createElement('clipPath', { id: CLIP_ID, clipPathUnits: 'objectBoundingBox' }, React.createElement('path', { d: CURVE_PATH }))
      )
    ),
    React.createElement('style', null, TEXT_HALO),
    React.createElement(
      'div',
      {
        'data-glass': 'verre',
        style: {
          position: 'absolute',
          inset: 0,
          borderRadius: 26, // si le découpage n'est pas possible : au moins des coins arrondis
          clipPath: `url(#${CLIP_ID})`,
          WebkitClipPath: `url(#${CLIP_ID})`,
          background: GLASS_BG,
          backdropFilter: GLASS_FILTER,
          WebkitBackdropFilter: GLASS_FILTER,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.55), inset 0 2px 24px rgba(255,255,255,0.45), inset 0 -10px 30px rgba(255,255,255,0.18)',
        },
      },
      React.createElement('div', { 'data-glass': 'reflet', style: { position: 'absolute', inset: 0, background: GLASS_SHINE } })
    ),
    React.createElement(
      'svg',
      { viewBox: '0 0 1 1', preserveAspectRatio: 'none', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }, focusable: 'false' },
      React.createElement('path', { d: CURVE_PATH, fill: 'none', stroke: 'rgba(255,255,255,0.95)', strokeWidth: 1.6, vectorEffect: 'non-scaling-stroke' })
    )
  );
}

const styles = StyleSheet.create({
  native: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(240,243,249,0.97)', borderRadius: 26, borderWidth: 1, borderColor: '#ffffff' },
});
