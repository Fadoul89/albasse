// Conditions générales (src/lib/termsText.ts) : chaque règle écrite doit être une règle réelle de la boutique, et la version vue par Google doit dire la même chose.
import { TERMS_SECTIONS, TERMS_UPDATED, TERMS_EMAIL } from '../../src/lib/termsText.ts';
import { infoPageDef, infoPage } from '../../netlify/edge-functions/lib/seo.ts';

let ok = 0;
let ko = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) ok++;
  else {
    ko++;
    console.log('ÉCHEC :', name, detail === undefined ? '' : JSON.stringify(detail));
  }
}

const all = TERMS_SECTIONS.flatMap((s) => [s.title, ...s.paragraphs]).join('\n');

check('9 parties numérotées de 1 à 9', TERMS_SECTIONS.length === 9 && TERMS_SECTIONS.every((s, i) => s.title.startsWith(`${i + 1}. `)), TERMS_SECTIONS.map((s) => s.title));
check('chaque partie a au moins une phrase', TERMS_SECTIONS.every((s) => s.paragraphs.length > 0 && s.paragraphs.every((p) => p.trim().length > 10)));
check('aucune phrase en double', new Set(TERMS_SECTIONS.flatMap((s) => s.paragraphs)).size === TERMS_SECTIONS.flatMap((s) => s.paragraphs).length);

// les règles réelles
check('commande non confirmée : 48 heures', /48 heures/.test(all));
check('livraison : services ouverts de 8h30 à 16h', /8h30 à 16h/.test(all));
check('paiement : à la livraison à N\'Djamena, à l\'avance (Moov / Airtel) ailleurs', /payez à la livraison/.test(all) && /Moov Money ou Airtel Money/.test(all));
check('emballage cadeau : 2 000 FCFA', /2 000 FCFA/.test(all));
check('retours : 72 heures, frais à notre charge si article incorrect ou défectueux, à la charge du client pour une taille', /72 heures/.test(all) && /frais de retour sont à notre charge/.test(all) && /à la charge du client/.test(all));
check('compte : 3 commandes non honorées', /3 commandes non honorées/.test(all));
check('fidélité : 1 point par tranche de 5 000 FCFA, -10 % à la 7e commande, une seule fois', /1 point de fidélité par tranche de 5 000 FCFA/.test(all) && /10 %/.test(all) && /7e commande, une seule fois/.test(all));
check('données : jamais vendues', /jamais vendues/.test(all));

// ce qu'on ne doit jamais écrire sans que le patron l'ait décidé
check('pas de promesse inventée : ni « remboursement garanti », ni « satisfait ou remboursé », ni délai de livraison chiffré', !/satisfait ou rembours|rembours[ée]s? sous|livraison en \d+|sous \d+ ?(h|jours)/i.test(all), all.match(/satisfait ou rembours|livraison en \d+/i));
check('pas de tribunal ni de loi inventés', !/tribunal|juridiction|code de la consommation|RGPD/i.test(all));

check('date de mise à jour et e-mail', /2026/.test(TERMS_UPDATED) && TERMS_EMAIL === 'contact@albasseshopping.com');

// la version vue par Google dit la même chose
const def = infoPageDef('/conditions-generales');
check('Google : la page /conditions-generales existe (avec ou sans barre finale)', !!def && infoPageDef('/conditions-generales/')?.path === '/conditions-generales');
const html = def ? infoPage(def) : '';
check('Google : mêmes chiffres que la vraie page (48 heures, 8h30 à 16h, 72 heures, Moov, Airtel)', /48 heures/.test(html) && /8h30 à 16h/.test(html) && /72 heures/.test(html) && /Moov Money/.test(html) && /Airtel Money/.test(html));
check('Google : les 9 parties sont annoncées', [1, 2, 3, 4, 5, 6, 7, 8, 9].every((n) => html.includes(`${n}. `)));
check('Google : titre, adresse canonique, pas de « noindex »', /<title>Conditions générales \| Albasse Shopping<\/title>/.test(html) && html.includes('rel="canonical" href="https://www.albasseshopping.com/conditions-generales"') && !/noindex/.test(html));

console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
