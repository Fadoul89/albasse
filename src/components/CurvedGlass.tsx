import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';

// Le fond du menu ☰ « verre courbé » (demande du patron, 16 novembre 2026, comme la vidéo « Curved Sidebar ») :
// une VITRE CLAIRE légèrement bleutée (21 novembre 2026 : « l'écrit et la vitre claire ne collent pas » → choix 1 : lettres blanches) :
// le site se voit au travers, flou, avec un reflet de lumière en biais et des bords lumineux ; les bords gauche et droit sont creusés au milieu.
// Les lettres du menu sont blanches, avec une ombre bleu nuit douce (lisibles même devant les zones claires du site).
// Web : un <div> découpé par un chemin SVG (clip-path) + flou du fond (backdrop-filter) ; le liseré est le même chemin, dessiné par-dessus.
// Sans flou possible (vieux navigateur) : le verre devient bleu nuit presque plein, les lettres blanches restent lisibles. Hors web : un panneau bleu nuit aux coins arrondis.
// Rien ne bloque les touchers : ce fond est sous le contenu, et pointer-events est coupé.

// Le contour, en fractions de la taille du panneau (0 à 1) : coins arrondis, côtés creusés de 4,5 % au milieu.
export const CURVE_PATH =
  'M0.08,0 H0.92 Q1,0 1,0.012 C0.955,0.3 0.955,0.7 1,0.988 Q1,1 0.92,1 H0.08 Q0,1 0,0.988 C0.045,0.7 0.045,0.3 0,0.012 Q0,0 0.08,0 Z';
const CLIP_ID = 'albasse-menu-curve';
// Le creux au milieu de chaque côté, en part de la largeur : le contenu garde au moins cette marge pour ne jamais être coupé
export const CURVE_INSET = 0.045;

// une vitre à peine teintée de bleu (plus claire en haut) : le site se voit au travers, et les lettres blanches ressortent partout
export const GLASS_BG = 'linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(20,45,120,0.16) 45%, rgba(15,35,95,0.24) 100%)';
export const GLASS_FILTER = 'blur(9px) saturate(150%) brightness(1.2)';
// le reflet de vitre : deux bandes claires en biais
const GLASS_SHINE =
  'linear-gradient(118deg, rgba(255,255,255,0) 22%, rgba(255,255,255,0.28) 30%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.14) 68%, rgba(255,255,255,0) 74%)';
// l'ombre bleu nuit des lettres blanches (tous les textes du panneau : les textes de React Native Web ne l'héritent pas),
// sauf sur les boutons et cartes à fond plein (palier, Se connecter, Créer un compte, « À la une », publicité du menu) ;
// et sans flou possible : un verre bleu nuit presque plein
const P = '[data-testid="menu-panel"]';
const SOLID = ['menu-profile-tier', 'menu-login', 'menu-register', 'menu-highlight', 'menu-ad'];
// une seule ombre, courte : légère à dessiner (la publicité animée du menu se redessine à chaque image)
export const TEXT_SHADOW = '0 1px 3px rgba(0,18,60,0.65)';
const GLASS_CSS =
  `${P},${P} div{text-shadow:${TEXT_SHADOW}}` +
  `${SOLID.map((id) => `${P} div[data-testid="${id}"],${P} [data-testid="${id}"] div`).join(',')}{text-shadow:none}` +
  `@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){[data-glass="verre"]{background:rgba(16,34,88,0.95) !important}}`;

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
    React.createElement('style', null, GLASS_CSS),
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
  native: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,34,88,0.97)', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
});
