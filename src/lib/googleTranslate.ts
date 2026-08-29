import { Platform } from 'react-native';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

let initialized = false;

// Bouton flottant "traduire en arabe" pour les clients arabophones (web
// uniquement). Traduction automatique via le widget Google Translate,
// limitee a l'arabe pour rester simple.
export function initGoogleTranslate() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined' || initialized) return;
  initialized = true;

  const container = document.createElement('div');
  container.id = 'google_translate_element';
  container.style.position = 'fixed';
  container.style.bottom = '16px';
  container.style.right = '16px';
  container.style.zIndex = '9999';
  container.style.backgroundColor = '#15151b';
  container.style.border = '1px solid rgba(199,154,62,0.5)';
  container.style.borderRadius = '999px';
  container.style.padding = '4px 10px';
  container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.45)';
  document.body.appendChild(container);

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
