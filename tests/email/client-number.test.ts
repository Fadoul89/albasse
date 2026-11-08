// Le numéro client (lib/clientNumber, docs/numero-client.md) : écriture AS-000123, lecture de ce que l'on tape, recherche de l'équipe, messages. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/client-number.test.ts
import { clientNumberLine, clientNumberMatches, forgotEmailMessage, forgotMessage, forgotNumberMessage, formatClientNumber, keepMessage, looksLikeClientNumber, parseClientNumber } from '../../src/lib/clientNumber.ts';
import { recoveryMessage } from '../../src/lib/passwordRecovery.ts';

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

// --- écrire le numéro
check('1 → AS-000001', formatClientNumber(1) === 'AS-000001');
check('123 → AS-000123', formatClientNumber(123) === 'AS-000123');
check('987654 → AS-987654 ; 1234567 → AS-1234567 (jamais coupé)', formatClientNumber(987654) === 'AS-987654' && formatClientNumber(1234567) === 'AS-1234567');
check('le numéro lu dans la base sous forme de texte (« 42 ») marche aussi', formatClientNumber('42') === 'AS-000042');
check('absent, vide ou invalide → null (colonne pas encore dans la base : rien ne s\'affiche)', [undefined, null, '', 'abc', 0, -3, 2.5, NaN, 1e12, {}, [] , '4 2'].every((v) => formatClientNumber(v) === null));

// --- lire ce que le client ou l'équipe écrit
check('« AS-000123 » → 123', parseClientNumber('AS-000123') === 123);
check('minuscules, espaces, sans tiret : « as 123 », « AS123 », « as-123 », « AS : 123 »', ['as 123', 'AS123', 'as-123', 'AS : 123', '  AS-0123  '].every((t) => parseClientNumber(t) === 123));
check('le numéro seul : « 000123 » et « 123 » → 123', parseClientNumber('000123') === 123 && parseClientNumber('123') === 123);
check('zéro, vide, lettres, deux numéros ou trop long → null', ['', '0', '000000', 'AS-', 'AS-12a', '12 34', 'AS-1234567890', 'abc', 'BS-000123', '123456789012'].every((t) => parseClientNumber(t) === null));
check('absent (null / undefined) → null', parseClientNumber(null) === null && parseClientNumber(undefined) === null);
check('écrire puis relire donne le même numéro (1 à 5000)', Array.from({ length: 5000 }, (_, i) => i + 1).every((n) => parseClientNumber(formatClientNumber(n)!) === n));

// --- la recherche de l'équipe (Admin › Clients)
check('« AS-000123 » trouve le client 123', clientNumberMatches(123, 'AS-000123'));
check('« as-000123 », « as 123 », « AS123 », « 123 » et « 000123 » trouvent aussi le client 123', ['as-000123', 'as 123', 'AS123', '123', '000123', ' 123 '].every((q) => clientNumberMatches(123, q)));
check('un début de numéro (« as-00 ») ne trouve personne : c\'est le numéro entier que l\'on cherche', !clientNumberMatches(123, 'as-') && !clientNumberMatches(123, 'as-00') && !clientNumberMatches(123, 'as'));
check('« 12 » ne trouve PAS le client 123 (un nombre seul doit être exactement le numéro)', !clientNumberMatches(123, '12') && clientNumberMatches(12, '12'));
check('un téléphone tapé (« 66123456 ») ne trouve pas un client par erreur', !clientNumberMatches(123, '66123456'));
check('un autre numéro ne correspond pas : « AS-000124 » ne trouve pas 123', !clientNumberMatches(123, 'AS-000124') && !clientNumberMatches(123, '124'));
check('recherche vide, ou client sans numéro → jamais « trouvé »', !clientNumberMatches(123, '') && !clientNumberMatches(123, '   ') && !clientNumberMatches(undefined, 'AS-000123') && !clientNumberMatches(null, '123'));

// --- les messages
check('la ligne du message : « Votre numéro client : AS-000123 (gardez-le …) »', clientNumberLine(123) === 'Votre numéro client : AS-000123 (gardez-le : il aide à retrouver votre compte)');
check('sans numéro : aucune ligne (vide)', clientNumberLine(undefined) === '' && clientNumberLine(null) === '');
const withNo = recoveryMessage({ firstName: 'Amina', loginEmail: '23566123456@tel.albasseshopping.com', code: '482913', clientNumber: 123 });
const without = recoveryMessage({ firstName: 'Amina', loginEmail: '23566123456@tel.albasseshopping.com', code: '482913' });
check('message du nouveau code : le numéro client est dit (une seule fois)', withNo.includes('Votre numéro client : AS-000123') && withNo.split('AS-000123').length === 2, withNo);
check('message du nouveau code sans numéro : exactement comme avant (aucune ligne vide ajoutée)', !without.includes('numéro client') && !/\n\n/.test(without) && without.split('\n').length === 4, without);
check('le message avec numéro = le message d\'avant + une ligne', withNo.split('\n').slice(0, 4).join('\n') === without && withNo.split('\n').length === 5);
check('le message n\'écrit jamais le numéro à la place du code', withNo.includes('Voici votre nouveau code : 482913') && !withNo.includes('code : AS-'));

const f1 = forgotMessage('66 12 34 56', 'as 123');
const f2 = forgotMessage('66 12 34 56', '');
const f3 = forgotMessage('66 12 34 56', 'n\'importe quoi');
check('« mot de passe oublié » avec numéro client : il est dans le message vers l\'équipe', f1.includes('Mon numéro client : AS-000123') && f1.includes('numéro 66 12 34 56'), f1);
check('« mot de passe oublié » sans numéro client, ou numéro mal écrit : le message est celui d\'avant', f2 === 'Bonjour Albasse Shopping, j\'ai oublié le mot de passe de mon compte (numéro 66 12 34 56). Pouvez-vous m\'aider ?' && f3 === f2, [f2, f3]);

const k = keepMessage({ number: 123, phone: '66 12 34 56', email: 'amina@gmail.com' });
check('message « garder mon numéro » : numéro, téléphone, e-mail', !!k && k.includes('AS-000123') && k.includes('66 12 34 56') && k.includes('amina@gmail.com'), k);
check('compte sans e-mail visible : pas de ligne e-mail ; sans numéro : rien à envoyer', !keepMessage({ number: 123, phone: '66 12 34 56', email: null })!.includes('E-mail') && keepMessage({ number: undefined }) === null);

// --- la case unique de « Mot de passe oublié » : téléphone, e-mail ou numéro client
check('« AS-000123 », « as 123 », « 123 », « 000123 » sont des numéros client', ['AS-000123', 'as 123', 'AS123', '123', '000123', ' 42 '].every((t) => looksLikeClientNumber(t)));
check('un téléphone (8 chiffres ou plus, avec ou sans espaces, +235) n\'est JAMAIS pris pour un numéro client', ['66123456', '66 12 34 56', '+235 66 12 34 56', '23566123456', '0023566123456'].every((t) => !looksLikeClientNumber(t)));
check('un e-mail, un mot, du vide ne sont pas des numéros client', ['amina@gmail.com', 'as@gmail.com', 'AS-12@x.com', 'bonjour', '', '   ', '0', 'AS-', 'AS-abc'].every((t) => !looksLikeClientNumber(t)));
check('7 chiffres au plus = numéro client, 8 = téléphone (frontière)', looksLikeClientNumber('1234567') && !looksLikeClientNumber('12345678'));
check('absent → faux', !looksLikeClientNumber(null) && !looksLikeClientNumber(undefined));
const n1 = forgotNumberMessage('as 123');
check('message « mot de passe oublié » avec le numéro client seul : écrit proprement AS-000123', n1 === 'Bonjour Albasse Shopping, j\'ai oublié le mot de passe de mon compte. Mon numéro client : AS-000123. Pouvez-vous m\'aider ?', n1);
const e1 = forgotEmailMessage('  fatime@gmail.com ');
check('message « rien reçu » avec l\'e-mail : l\'e-mail, « je n\'ai pas reçu d\'e-mail »', e1 === 'Bonjour Albasse Shopping, j\'ai oublié le mot de passe de mon compte (e-mail fatime@gmail.com). Je n\'ai pas reçu d\'e-mail. Pouvez-vous m\'aider ?', e1);

console.log(`\n${ok} contrôles réussis`);
