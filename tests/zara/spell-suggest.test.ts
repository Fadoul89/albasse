// « Vouliez-vous dire… ? » (src/lib/spellSuggest.ts) : un mot mal écrit est remplacé par le mot le plus proche des articles de la boutique.
// Lancer : node --import ./tests/zara/register.mjs tests/zara/spell-suggest.test.ts
import { buildVocabulary, closestWord, editDistance, suggestWords } from '../../src/lib/spellSuggest.ts';
import { tokenize } from '../../src/lib/assistantBrain.ts';

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

// quelques articles de la boutique (comme la recherche : nom + catégorie + couleurs, passés par tokenize)
const SHOP = [
  'Montre Naviforce pour homme NF8022 Montres Noir Vert',
  'Parfum Oud Royal Parfums Marron',
  'Chaussures Clarks homme Chaussures Noir',
  'Sandales femme Chaussures Marron',
  'Robe longue Vêtements Vert',
  'T-shirt noir Vêtements Noir',
];
const vocab = buildVocabulary(SHOP.flatMap(tokenize));
const fix = (q: string) => suggestWords(tokenize(q), vocab)?.join(' ') ?? null;

// la distance entre deux mots
check('distance : mots identiques = 0', editDistance('parfum', 'parfum', 2) === 0);
check('distance : une lettre changée = 1', editDistance('parfun', 'parfum', 2) === 1);
check('distance : une lettre oubliée = 1', editDistance('chausure', 'chaussure', 2) === 1);
check('distance : une lettre en trop = 1', editDistance('parfumm', 'parfum', 2) === 1);
check('distance : deux lettres inversées = 1', editDistance('parfmu', 'parfum', 2) === 1);
check('distance : trop différents = plus que le maximum', editDistance('montre', 'sandale', 2) > 2);

// les corrections
check('« parfun » -> « parfum »', fix('parfun') === 'parfum', fix('parfun'));
check('« parfmu » (lettres inversées) -> « parfum »', fix('parfmu') === 'parfum', fix('parfmu'));
check('« chausure » -> « chaussure »', fix('chausure') === 'chaussure', fix('chausure'));
check('« nawiforce » -> « naviforce »', fix('nawiforce') === 'naviforce', fix('nawiforce'));
check('« sandalles » -> « sandale »', fix('sandalles') === 'sandale', fix('sandalles'));
check('plusieurs mots : seul le mot faux est corrigé (« parfun oud » -> « parfum oud »)', fix('parfun oud') === 'parfum oud', fix('parfun oud'));
check('mots vides ignorés (« un parfun pour homme » -> « parfum homme »)', fix('un parfun pour homme') === 'parfum homme', fix('un parfun pour homme'));
check('accents et majuscules (« PARFUN ») -> « parfum »', fix('PARFUN') === 'parfum', fix('PARFUN'));

// ce qu'on ne corrige pas
check('un mot de la boutique n\'est pas touché (« montre »)', fix('montre') === null);
check('le pluriel d\'un mot connu n\'est pas touché (« montres », « robes »)', fix('montres') === null && fix('robes') === null);
check('le début d\'un mot connu (le client écrit encore) n\'est pas touché (« parf », « chaus »)', fix('parf') === null && fix('chaus') === null);
check('mot trop court (3 lettres) : rien', closestWord('rob', vocab) === null && fix('rob') === null);
check('une première lettre fausse sur un mot court : rien (« tobe » ne devient pas « robe »)', fix('tobe') === null, fix('tobe'));
check('mot qui ne ressemble à rien (« asdfgh ») : rien', fix('asdfgh') === null);
check('un mot avec un chiffre (« nf8o22 ») : rien', fix('nf8o22') === null);
check('mot arabe : rien', fix('عطر') === null && fix('ساعة رجالية') === null);
check('recherche vide : rien', fix('') === null && fix('   ') === null);
check('une première lettre fausse sur un long mot est permise (« barfum » -> « parfum »)', fix('barfum') === 'parfum', fix('barfum'));

// le mot le plus courant gagne à égalité
const tie = buildVocabulary(['sacs', 'sacs', 'sacs', 'sacx']);
check('à égalité, le mot le plus courant de la boutique gagne', closestWord('sacz', tie) === 'sacs', closestWord('sacz', tie));

console.log(`\n${ok} vérifications réussies`);
if (process.exitCode) console.log('IL Y A DES ECHECS');
else console.log('TOUT EST BON');
