// Vrai quand le site est affiche a l'interieur de l'app Android (coquille
// WebView) plutot que dans un navigateur normal. L'app ajoute cette marque
// au user-agent (voir applicationNameForUserAgent dans albasse-app).
export function isRunningInsideApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /AlbasseShoppingApp/i.test(navigator.userAgent);
}
