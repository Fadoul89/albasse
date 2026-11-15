// Catégories renommées par le patron : Zara garde ses clés (montre, bebe-et-maternite) et retrouve les articles ; la page « Page » ouvre la vraie adresse.
import { KEY_TO_SHOP_SLUG, SHOP_SLUG_TO_KEY, shopSlugOf, zaraKey, CATEGORY_WORDS, CATEGORY_AR, CATEGORY_EMOJI, GENDERED_SLUGS } from '../../src/lib/assistantLang.ts';
import { parseNeed } from '../../src/lib/assistantMarketing.ts';

let ok = 0;
let ko = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) ok++;
  else {
    ko++;
    console.log('ÉCHEC :', name, detail === undefined ? '' : JSON.stringify(detail));
  }
}

check('« montre-accessoires » (MONTRE & ACCESSOIRES) = la clé « montre » de Zara', zaraKey('montre-accessoires') === 'montre');
check('« produits-pour-bebes » = la clé « bebe-et-maternite » de Zara', zaraKey('produits-pour-bebes') === 'bebe-et-maternite');
check('les autres catégories ne changent pas', ['parfum', 'chaussures', 'maison-bureau', 'vetements-pour-femmes', 'sacs-et-bagages', ''].every((s) => zaraKey(s) === s));
check('retour : la clé « montre » ouvre la page « montre-accessoires », « bebe-et-maternite » la page « produits-pour-bebes »', shopSlugOf('montre') === 'montre-accessoires' && shopSlugOf('bebe-et-maternite') === 'produits-pour-bebes');
check('retour : une catégorie sans changement garde son adresse', shopSlugOf('parfum') === 'parfum' && shopSlugOf('maison-bureau') === 'maison-bureau');
check('aller-retour : slug → clé → slug', Object.keys(SHOP_SLUG_TO_KEY).every((s) => shopSlugOf(zaraKey(s)) === s) && Object.keys(KEY_TO_SHOP_SLUG).length === Object.keys(SHOP_SLUG_TO_KEY).length);
check('Zara a encore ses textes pour « montre » et « bebe-et-maternite » (arabe, émoji, mots)', !!CATEGORY_AR['montre'] && !!CATEGORY_EMOJI['montre'] && !!CATEGORY_AR['bebe-et-maternite'] && !!CATEGORY_EMOJI['bebe-et-maternite'] && CATEGORY_WORDS.some((c) => c.slug === 'montre') && CATEGORY_WORDS.some((c) => c.slug === 'bebe-et-maternite') && GENDERED_SLUGS.includes('montre'));
check('« je cherche une montre » reconnaît la clé « montre » ; « article pour bébé » la clé « bebe-et-maternite »', parseNeed('je cherche une montre pour homme').slug === 'montre' && parseNeed('des articles pour bébé').slug === 'bebe-et-maternite', [parseNeed('je cherche une montre pour homme').slug, parseNeed('des articles pour bébé').slug]);
console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
