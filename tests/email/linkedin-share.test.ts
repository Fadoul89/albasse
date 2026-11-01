// Bouton « LinkedIn » d'une fiche produit : le lien de partage. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/linkedin-share.test.ts
import { LINKEDIN_SHARE_BASE, linkedinShareTarget, linkedinShareUrl } from '../../src/lib/linkedinShare.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) {
    ok++;
    console.log('OK   ', label);
  } else {
    console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail));
    process.exitCode = 1;
  }
};

const page = 'https://www.albasseshopping.com/produit/montre-homme-luxe';
const url = linkedinShareUrl(page);
check('la page de partage de LinkedIn, avec le lien de l\'article', url === 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(page), url);
check('l\'adresse de base est celle de LinkedIn (sécurisée)', LINKEDIN_SHARE_BASE === 'https://www.linkedin.com/sharing/share-offsite/' && url.startsWith('https://www.linkedin.com/'));
check('le lien de l\'article est bien « encodé » (rien de collé tel quel)', !url.slice(LINKEDIN_SHARE_BASE.length).includes('://') && url.endsWith('https%3A%2F%2Fwww.albasseshopping.com%2Fproduit%2Fmontre-homme-luxe'));
const odd = 'https://www.albasseshopping.com/produit/a&b?x=1 2#t';
check('un lien avec & ? espace # reste entier dans « url= » (un seul paramètre)', new URL(linkedinShareUrl(odd)).searchParams.get('url') === odd && [...new URL(linkedinShareUrl(odd)).searchParams.keys()].join() === 'url', linkedinShareUrl(odd));
check('un lien avec des lettres arabes ou accentuées reste intact', new URL(linkedinShareUrl('https://www.albasseshopping.com/produit/montre-élégante-ساعة')).searchParams.get('url') === 'https://www.albasseshopping.com/produit/montre-élégante-ساعة');

// ---- ouvrir directement l'APPLICATION LinkedIn, selon l'appareil
const enc = encodeURIComponent;
const android = linkedinShareTarget(page, 'android');
const m = /^intent:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=([^#]+)#Intent;scheme=https;package=com\.linkedin\.android;S\.browser_fallback_url=([^;]+);end$/.exec(android.url);
check('Android (Chrome) : le lien est donné DIRECTEMENT à l\'application LinkedIn (com.linkedin.android)', android.kind === 'intent' && !!m, android);
check('Android : le lien de l\'article est dans la demande, et la page de partage du site est le secours si l\'application manque', !!m && decodeURIComponent(m[1]) === page && decodeURIComponent(m[2]) === url, m);
const app = linkedinShareTarget(page, 'android-app');
check('application Albasse (Android) : on demande l\'application LinkedIn, avec la page de partage du site en secours (1,5 s plus tard)', app.kind === 'app' && app.url === android.url && (app as { fallback: string }).fallback === url, app);
const ios = linkedinShareTarget(page, 'ios');
check('iPhone : le lien linkedin.com (l\'iPhone l\'ouvre dans l\'application LinkedIn quand elle est installée)', ios.kind === 'link' && ios.url === url, ios);
const desk = linkedinShareTarget(page, 'desktop');
check('ordinateur : la page de partage dans un nouvel onglet', desk.kind === 'tab' && desk.url === url, desk);
check('aucun lien ne laisse le lien de l\'article « tel quel » : tout est encodé (Android, secours compris)', !android.url.replace('intent://www.linkedin.com/sharing/share-offsite/', '').includes('https://www.albasseshopping') && android.url.includes(enc(page)));

console.log(`\n${ok} contrôles réussis`);
