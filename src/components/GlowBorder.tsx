import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Ligne lumineuse qui fait le tour de l'ecran (web seulement), d'UNE SEULE couleur a la fois :
// turquoise, puis la couleur suivante, et ainsi de suite, sans melange. Entre deux changements
// rien ne bouge, donc le telephone ne redessine rien (peu de batterie). Elle ne bloque aucun
// toucher et reste turquoise pour les personnes qui ont demande moins d'animations.
const COLORS: Array<[number, number, number]> = [
  [45, 226, 200], // turquoise
  [90, 169, 255], // bleu ciel
  [167, 139, 250], // violet
  [255, 90, 138], // rose
  [255, 82, 82], // rouge
  [255, 210, 74], // or
  [74, 222, 128], // vert
];
const HOLD_MS = 1600;

const CSS = `
.albasse-glow{position:fixed;top:env(safe-area-inset-top,0px);right:env(safe-area-inset-right,0px);bottom:env(safe-area-inset-bottom,0px);left:env(safe-area-inset-left,0px);
  box-sizing:border-box;pointer-events:none;z-index:2147483646;--glow-rgb:${COLORS[0].join(',')};
  border:2px solid rgb(var(--glow-rgb));
  box-shadow:inset 0 0 3px 0 rgba(var(--glow-rgb),.95),inset 0 0 9px 1px rgba(var(--glow-rgb),.5);
  transition:border-color .45s ease,box-shadow .45s ease}
`;

export function GlowBorder() {
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let index = 0;
    const timer = setInterval(() => {
      if (document.hidden || !frame.current) return;
      index = (index + 1) % COLORS.length;
      frame.current.style.setProperty('--glow-rgb', COLORS[index].join(','));
    }, HOLD_MS);
    return () => clearInterval(timer);
  }, []);

  if (Platform.OS !== 'web') return null;
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('style', null, CSS),
    React.createElement('div', { ref: frame, className: 'albasse-glow', 'aria-hidden': 'true' })
  );
}
