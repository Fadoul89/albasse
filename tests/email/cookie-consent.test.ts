// Bandeau cookies : le pixel TikTok ne démarre qu'avec l'accord du visiteur (src/lib/cookieChoice.ts).
import { COOKIE_KEY, COOKIE_TEXT, parseChoice, shouldShowBanner } from '../../src/lib/cookieChoice.ts';

let ok = 0;
let ko = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) ok++;
  else {
    ko++;
    console.log('ÉCHEC :', name, detail === undefined ? '' : JSON.stringify(detail));
  }
}

check('« accepted » et « refused » sont reconnus', parseChoice('accepted') === 'accepted' && parseChoice('refused') === 'refused');
check('rien, vide ou valeur inconnue = pas encore choisi (donc pas de pixel)', parseChoice(null) === null && parseChoice(undefined) === null && parseChoice('') === null && parseChoice('yes') === null && parseChoice('ACCEPTED') === null && parseChoice('true') === null);

check('bandeau : visible sur le site tant que rien n\'est choisi', shouldShowBanner(null, true) === true);
check('bandeau : caché après « Accepter » ou « Refuser »', shouldShowBanner('accepted', true) === false && shouldShowBanner('refused', true) === false);
check('bandeau : jamais dans l\'application mobile native', shouldShowBanner(null, false) === false);

check('clé de stockage stable (ne pas la changer : les visiteurs perdraient leur choix)', COOKIE_KEY === 'albasse_cookie_consent');

check('textes : Accepter / Refuser / En savoir plus', COOKIE_TEXT.accept === 'Accepter' && COOKIE_TEXT.refuse === 'Refuser' && COOKIE_TEXT.more === 'En savoir plus');
check('le texte dit la vérité : TikTok seulement avec accord, rien n\'est envoyé si refus', /pixel TikTok/.test(COOKIE_TEXT.body) && /Si vous refusez, rien n’est envoyé à TikTok/.test(COOKIE_TEXT.body));
check('le texte ne promet rien de faux (pas « aucun cookie »)', !/aucun cookie|sans cookie/i.test(COOKIE_TEXT.body));
check('le texte de la politique : 3 états (accepté, refusé, pas encore choisi)', COOKIE_TEXT.settingsAccepted !== COOKIE_TEXT.settingsRefused && COOKIE_TEXT.settingsNone.length > 5);

console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
