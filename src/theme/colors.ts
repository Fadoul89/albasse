export const colors = {
  background: '#072469',
  panel: '#0e3181',
  panelAlt: '#163c95',

  gold: '#c79a3e',
  goldLight: '#e7c87a',
  goldGradient: ['#c79a3e', '#e7c87a'] as const,

  red: '#d8232a',

  cream: '#f4efe4',
  // Contraste (WCAG AA, 4.5:1 minimum pour un texte) mesuré sur les 3 fonds : background, panel, panelAlt.
  creamMuted: 'rgba(244, 239, 228, 0.75)',
  creamFaint: 'rgba(244, 239, 228, 0.66)',
  // seulement pour un décor sans texte (étoile vide) : jamais pour du texte
  decorFaint: 'rgba(244, 239, 228, 0.35)',

  border: 'rgba(199, 154, 62, 0.25)',
  overlay: 'rgba(7, 36, 105, 0.7)',

  success: '#2e8b57',
  error: '#d8232a',

  // Rouge et vert pour du TEXTE sur fond bleu (le rouge #d8232a ne fait que 2.0 à 2.9 sur ces fonds, le vert #2e8b57 de 2.3 à 3.4)
  errorText: '#ff9b9b',
  successText: '#5fd38d',
};
