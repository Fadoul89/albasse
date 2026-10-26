// Commande sans compte : informations demandées au visiteur, code de 6 chiffres différent pour chaque client (jamais « 1234 » commun à tous). Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/guest-account.test.ts
import { CHAD_PHONE_REGEX, generateTempPassword, guestFullName, guestInfoProblem, isWeakCode, prettyChadPhone } from '../../src/lib/guestAccount.ts';
import { phoneLoginEmail } from '../../src/lib/phoneAuth.ts';

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

const good = { firstName: 'Amina', lastName: 'Hassan', phone: '66123456', email: 'amina@gmail.com' };

// ---- informations du visiteur
check('informations complètes : aucun problème', guestInfoProblem(good) === null, guestInfoProblem(good));
check('prénom vide : demandé', /prénom/.test(guestInfoProblem({ ...good, firstName: '  ' }) ?? ''));
check('prénom d\'une lettre : demandé', /prénom/.test(guestInfoProblem({ ...good, firstName: 'A' }) ?? ''));
check('nom vide : demandé', /nom/.test(guestInfoProblem({ ...good, lastName: '' }) ?? '') && !/prénom/.test(guestInfoProblem({ ...good, lastName: '' }) ?? ''));
check('téléphone : 8 chiffres qui commencent par 6 ou 9', guestInfoProblem({ ...good, phone: '12345678' }) !== null && guestInfoProblem({ ...good, phone: '6612345' }) !== null && guestInfoProblem({ ...good, phone: '99123456' }) === null);
check('même règle de numéro que la page de commande', CHAD_PHONE_REGEX.test('66123456') && CHAD_PHONE_REGEX.test('90123456') && !CHAD_PHONE_REGEX.test('56123456'));
check('e-mail obligatoire et valable', /e-mail/.test(guestInfoProblem({ ...good, email: '' }) ?? '') && /e-mail/.test(guestInfoProblem({ ...good, email: 'amina@' }) ?? '') && /e-mail/.test(guestInfoProblem({ ...good, email: 'amina gmail.com' }) ?? ''));
check('les champs sont contrôlés dans l\'ordre : prénom, nom, téléphone, e-mail', /prénom/.test(guestInfoProblem({ firstName: '', lastName: '', phone: '', email: '' }) ?? ''));
check('nom complet : prénom + nom, espaces nettoyés', guestFullName({ firstName: '  Amina ', lastName: ' Hassan  ' }) === 'Amina Hassan', guestFullName({ firstName: '  Amina ', lastName: ' Hassan  ' }));
check('numéro affiché par paires', prettyChadPhone('66123456') === '66 12 34 56', prettyChadPhone('66123456'));
check('le compte est créé avec le numéro (adresse tirée du numéro)', phoneLoginEmail('66123456') === '23566123456@tel.albasseshopping.com', phoneLoginEmail('66123456'));

// ---- codes trop faciles
for (const weak of ['000000', '111111', '999999', '123456', '234567', '654321', '987654', '012345', '121212', '123123', '456456', '1234', '12345678', 'abcdef', '']) {
  check(`code faible refusé : « ${weak} »`, isWeakCode(weak) === true);
}
for (const fine of ['482915', '730264', '905817', '316842', '271038']) {
  check(`code correct accepté : « ${fine} »`, isWeakCode(fine) === false);
}

// ---- tirage du mot de passe
const codes = Array.from({ length: 4000 }, () => generateTempPassword());
check('toujours 6 chiffres', codes.every((c) => /^\d{6}$/.test(c)));
check('jamais un code faible', codes.every((c) => !isWeakCode(c)));
check('jamais « 1234 » ni un code commun : plus de 3 900 codes différents sur 4 000 clients', new Set(codes).size > 3900, new Set(codes).size);
check('les chiffres sont bien répartis (chaque chiffre entre 8 et 12 % des chiffres tirés)', (() => {
  const count = Array(10).fill(0);
  for (const c of codes) for (const d of c) count[Number(d)]++;
  const total = codes.length * 6;
  return count.every((n) => n / total > 0.08 && n / total < 0.12);
})());
let calls = 0;
const stubborn = generateTempPassword(() => {
  calls++;
  return calls < 3 ? 123456 : 730264; // deux tirages faibles puis un bon
});
check('un tirage faible est refait', stubborn === '730264' && calls === 3, { stubborn, calls });
check('zéros de tête conservés (code 004829)', generateTempPassword(() => 4829) === '004829');
check('toujours au moins 6 caractères (minimum du système)', codes.every((c) => c.length >= 6));

console.log(`\n${ok} vérifications réussies${process.exitCode ? ' — AVEC DES ÉCHECS' : ''}`);
