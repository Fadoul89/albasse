// Vrai quand le site est affiche a l'interieur de l'app Android (coquille
// WebView) plutot que dans un navigateur normal. Deux signaux independants
// (le user-agent personnalise ET un parametre d'URL mis par l'app) : si l'un
// des deux marche, c'est memorise dans localStorage pour le reste de la
// navigation, meme quand le routeur cote client fait disparaitre le
// parametre d'URL en changeant de page.
const FLAG_KEY = 'albasse_app_shell';

function detectFromUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /AlbasseShoppingApp/i.test(navigator.userAgent);
}

function detectFromQueryParam(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('albasse_app') === '1';
  } catch {
    return false;
  }
}

export function isRunningInsideApp(): boolean {
  if (detectFromUserAgent() || detectFromQueryParam()) {
    try {
      window.localStorage?.setItem(FLAG_KEY, '1');
    } catch {
      // silencieux
    }
    return true;
  }
  try {
    return window.localStorage?.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}
