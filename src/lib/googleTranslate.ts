import { Platform } from 'react-native';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

let initialized = false;

function setGoogTransCookie(value: string | null) {
  const domain = window.location.hostname;
  const expr = value
    ? `googtrans=${value}; path=/`
    : 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = expr;
  document.cookie = `${expr}; domain=${domain}`;
  document.cookie = `${expr}; domain=.${domain}`;
}

// Charge le widget Google Translate en arriere-plan (invisible) : la
// traduction est pilotee par nos propres boutons (voir LanguageSwitcher),
// pas par le menu deroulant de Google.
export function initGoogleTranslate() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined' || initialized) return;
  initialized = true;

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
}

export function translateToArabic() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  setGoogTransCookie('/fr/ar');
  window.location.reload();
}

export function translateToFrench() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  setGoogTransCookie(null);
  window.location.reload();
}
