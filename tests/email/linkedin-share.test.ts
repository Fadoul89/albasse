// Bouton « LinkedIn » d'une fiche produit : le lien de partage. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/linkedin-share.test.ts
import { LINKEDIN_SHARE_BASE, linkedinShareUrl } from '../../src/lib/linkedinShare.ts';

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

console.log(`\n${ok} contrôles réussis`);
