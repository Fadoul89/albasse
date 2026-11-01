// Mode « page unique » : seul « cafe » active le mode ; sans la variable, le vrai site ne change pas. Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/single-page.test.ts
import { parseSinglePage, SINGLE_PAGE, isSinglePage } from '../../src/lib/singlePage.ts';

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

check('« cafe » active le mode page unique', parseSinglePage('cafe') === 'cafe');
check('majuscules et espaces ne gênent pas : « Cafe », « CAFE », « cafe »', parseSinglePage('Cafe') === 'cafe' && parseSinglePage(' CAFE ') === 'cafe');
check('variable absente, vide ou inconnue : site normal (null)', parseSinglePage(undefined) === null && parseSinglePage(null) === null && parseSinglePage('') === null && parseSinglePage('boutique') === null && parseSinglePage('0') === null && parseSinglePage('true') === null);
check('dans les tests (aucune variable) : le site reste le site normal', SINGLE_PAGE === null && isSinglePage() === false);

console.log(`\n${ok} contrôles réussis`);
