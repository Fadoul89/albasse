import { Platform } from 'react-native';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

let initialized = false;

const BTN_STYLE = [
  'font-family: sans-serif',
  'font-size: 12px',
  'font-weight: 600',
  'color: #f4efe4',
  'background: #15151b',
  'border: 1px solid rgba(199,154,62,0.5)',
  'border-radius: 999px',
  'padding: 6px 12px',
  'cursor: pointer',
].join(';');

function setGoogTransCookie(value: string | null) {
  const domain = window.location.hostname;
  const expr = value
    ? `googtrans=${value}; path=/`
    : 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = expr;
  document.cookie = `${expr}; domain=${domain}`;
  document.cookie = `${expr}; domain=.${domain}`;
}

// Boutons "Arabe" / "Français" fixes en haut de l'ecran (web uniquement),
// pilotant le widget Google Translate via son cookie plutot que d'afficher
// son propre menu deroulant.
export function initGoogleTranslate() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined' || initialized) return;
  initialized = true;

  // Conteneur requis par l'API Google Translate, invisible : nos propres
  // boutons pilotent la traduction a sa place.
  const hiddenContainer = document.createElement('div');
  hiddenContainer.id = 'google_translate_element';
  hiddenContainer.style.position = 'fixed';
  hiddenContainer.style.top = '-9999px';
  hiddenContainer.style.left = '-9999px';
  document.body.appendChild(hiddenContainer);

  window.googleTranslateElementInit = () => {
    new window.google.translate.TranslateElement(
      {
        pageLanguage: 'fr',
        includedLanguages: 'ar',
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false,
      },
      'google_translate_element'
    );
  };

  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.body.appendChild(script);

  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:8px;left:8px;z-index:9999;display:flex;gap:6px;';

  const arabicBtn = document.createElement('button');
  arabicBtn.textContent = 'العربية';
  arabicBtn.style.cssText = BTN_STYLE;
  arabicBtn.onclick = () => {
    setGoogTransCookie('/fr/ar');
    window.location.reload();
  };

  const frenchBtn = document.createElement('button');
  frenchBtn.textContent = '🇫🇷 Français';
  frenchBtn.style.cssText = BTN_STYLE;
  frenchBtn.onclick = () => {
    setGoogTransCookie(null);
    window.location.reload();
  };

  bar.appendChild(arabicBtn);
  bar.appendChild(frenchBtn);
  document.body.appendChild(bar);
}
