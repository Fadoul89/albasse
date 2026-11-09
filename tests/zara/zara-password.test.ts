// Zara et le mot de passe (docs/zara-mot-de-passe.md) : Zara GUIDE (elle ne donne jamais de code, elle ne demande jamais de mot de passe).
//   • le chat reconnaît « mot de passe oublié / à changer » en français et en arabe (et ne confond pas avec « code promo ») ;
//   • les textes du chat (client connecté, visiteur) et ceux de l'écran « Mot de passe oublié » ne promettent rien de faux. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/zara/zara-password.test.ts
import { detectIntent, wantsPassword } from '../../src/lib/assistantBrain.ts';
import { texts } from '../../src/lib/assistantText.ts';
import { zaraForgotLine } from '../../src/lib/clientNumber.ts';

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

// --- le chat reconnaît le sujet
const yesFr = [
  "j'ai oublié mon mot de passe",
  'Mot de passe oublié',
  'comment changer mon mot de passe ?',
  'mdp oublié',
  "j'ai perdu mon mot de passe",
  "j'ai oublié mon code",
  'je veux récupérer mon compte',
  'je veux retrouver mon compte',
  "je n'arrive pas à me connecter",
  'impossible de me connecter',
  'password',
];
const yesAr = ['نسيت كلمة السر', 'نسيت كلمة المرور', 'كيف اغير كلمة السر', 'نسيت الباسورد', 'نسيت الرمز السري', 'ابغى استرجاع حسابي'];
for (const t of [...yesFr, ...yesAr]) check(`« ${t} » → mot de passe`, detectIntent(t) === 'password' && wantsPassword(t), detectIntent(t));

// --- ce qui n'est PAS un mot de passe
const noFr = [
  "j'ai un code promo",
  "j'ai perdu mon code promo",
  'mon code de parrainage',
  'comment créer un compte',
  'je veux mon compte fidélité',
  'je cherche un parfum pour homme',
  'bonjour',
  'où est ma commande',
  'je veux me connecter',
  'quel est votre numéro',
  'merci beaucoup',
];
for (const t of noFr) check(`« ${t} » → pas un mot de passe`, detectIntent(t) !== 'password' && !wantsPassword(t), detectIntent(t));
check('« compte » seul mène toujours à l’explication du compte', detectIntent('compte') === 'account');
check('« Telegram » passe toujours avant (lier Telegram)', detectIntent('lier telegram') === 'telegram');

// --- les textes du chat
for (const lang of ['fr', 'ar'] as const) {
  const t = texts(lang);
  const member = t.passwordMember('AS-000123');
  const memberNo = t.passwordMember(null);
  const guest = t.passwordGuest;
  check(`[${lang}] connecté : le numéro client est donné`, member.includes('AS-000123'), member);
  check(`[${lang}] connecté sans numéro (colonne absente) : aucun « null » ni « undefined »`, !/null|undefined|AS-/.test(memberNo), memberNo);
  // le numéro client (AS-000123) n'est pas un code d'accès : on le retire avant de chercher un « code » de 6 chiffres donné par Zara
  check(`[${lang}] jamais de mot de passe ni de code d’accès donné par Zara`, !/\d{4,}/.test(memberNo) && !/\d{4,}/.test(guest.replace('AS-000123', '')), [memberNo, guest]);
  check(`[${lang}] visiteur : indique l’écran « mot de passe oublié » et le numéro client en exemple`, guest.includes('AS-000123'), guest);
  check(`[${lang}] boutons : « mot de passe oublié » et « changer mon mot de passe » écrits`, t.chip.forgotPassword.length > 4 && t.chip.changePassword.length > 4);
  check(`[${lang}] Zara dit qu’elle ne demande jamais le mot de passe`, lang === 'fr' ? /ne le demande jamais|ne m’écrivez jamais/.test(member + guest) : /ولا أطلبها|لا تكتب لي/.test(member + guest));
}
check('[fr] le chemin pour changer est le vrai : « Compte » puis « Changer mon mot de passe »', texts('fr').passwordMember(null).includes('« Compte »') && texts('fr').passwordMember(null).includes('« Changer mon mot de passe »'));

// --- l'écran « Mot de passe oublié »
const start = zaraForgotLine('start');
const wa = zaraForgotLine('whatsapp');
const sent = zaraForgotLine('emailSent');
check('écran : trois phrases différentes selon l’étape', new Set([start, wa, sent]).size === 3);
check('écran : Zara se présente et ne demande jamais le mot de passe', /Zara/.test(start) && /jamais/.test(start) && /mot de passe/.test(start));
check('écran : après le téléphone ou le numéro client, elle renvoie vers WhatsApp', /WhatsApp/.test(wa));
check('écran : après l’e-mail, elle parle de la boîte e-mail et des spams', /e-mail/.test(sent) && /spam/.test(sent));
const none = zaraForgotLine('noAccount');
check('écran : aucun compte trouvé → Zara le dit gentiment et propose de créer un compte (jamais WhatsApp)', /aucun compte/.test(none) && /créez votre compte/.test(none) && !/WhatsApp/.test(none) && new Set([start, wa, sent, none]).size === 4, none);
check('écran : jamais « j’ai prévenu l’équipe » ni un délai promis (l’alerte est un plus et peut ne pas partir)', ![start, wa, sent, none].some((s) => /prévenu|en quelques minutes|tout de suite|immédiatement|sous \d/.test(s)), [start, wa, sent, none]);

// --- « Mot de passe oublié » : on confirme d'abord que la personne a un compte ICI (demande du patron, 9 novembre 2026)
import { noAccountText, readAccountAnswer } from '../../src/lib/accountCheckRules.ts';
check('la base répond vrai : compte trouvé', readAccountAnswer(true, null) === true);
check('la base répond faux : aucun compte', readAccountAnswer(false, null) === false);
check('erreur, fonction absente (script pas lancé) ou réponse bizarre : on ne sait pas (null), l’écran fait comme avant', readAccountAnswer(null, { message: 'Could not find the function' }) === null && readAccountAnswer(undefined, null) === null && readAccountAnswer('oui', null) === null && readAccountAnswer({ id: 1 }, null) === null);
const t1 = noAccountText('phone', '66 50 36 76');
check('aucun compte (téléphone) : le texte nomme le numéro, propose e-mail ou numéro client, et la création d’un compte gratuit', /aucun compte avec le numéro 66 50 36 76/.test(t1) && /e-mail ou votre numéro client/.test(t1) && /Créez-le gratuitement/.test(t1), t1);
check('aucun compte (e-mail et numéro client) : le texte nomme ce que le client a écrit', /aucun compte avec l’e-mail a@b\.com/.test(noAccountText('email', 'a@b.com')) && /aucun compte avec le numéro client AS-000999/.test(noAccountText('clientNumber', 'AS-000999')));
check('aucun compte : jamais un nom ni une fiche, jamais « WhatsApp »', ![t1, noAccountText('email', 'a@b.com'), noAccountText('clientNumber', 'AS-1')].some((x) => /WhatsApp|nom|fiche/.test(x)));

console.log(`\n${ok} contrôles réussis`);
