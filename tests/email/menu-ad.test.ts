// Publicité mouvementée du menu ☰ : images lisibles et liens (src/lib/menuAd.ts). Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/menu-ad.test.ts
import { MENU_AD_MAX, MENU_AD_SHOW_MS, MENU_AD_TEXT, menuAdItems, menuAdTarget } from '../../src/lib/menuAd.ts';

let ok = 0;
let ko = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) ok++;
  else {
    ko++;
    console.log('ÉCHEC :', name, detail === undefined ? '' : JSON.stringify(detail));
  }
};
const IMG = 'https://xtitsmmccpkelxfjyqyh.supabase.co/storage/v1/object/public/product-images/a.jpeg';

// --- les images
check('liste absente, vide ou abîmée : aucune image (la carte automatique reste)', menuAdItems(undefined).length === 0 && menuAdItems(null).length === 0 && menuAdItems('x').length === 0 && menuAdItems({}).length === 0 && menuAdItems([]).length === 0);
const items = menuAdItems([
  { image_url: IMG, link: ' https://www.albasseshopping.com/produit/ray-ban ' },
  { image_url: 'http://pas-securise.jpg', link: null },
  { image_url: '  ', link: 'x' },
  null,
  'texte',
  { image_url: IMG + '?2', link: '   ' },
  { image_url: IMG + '?3' },
]);
check('images en https gardées dans l\'ordre ; image vide, http ou abîmée écartée', items.length === 3 && items[0].image_url === IMG && items[1].image_url === IMG + '?2' && items[2].image_url === IMG + '?3', items);
check('lien nettoyé ; lien vide ou absent = pas de lien', items[0].link === 'https://www.albasseshopping.com/produit/ray-ban' && items[1].link === null && items[2].link === null, items);
check(`${MENU_AD_MAX} images au plus (comme la base)`, menuAdItems(Array.from({ length: 20 }, (_, i) => ({ image_url: `${IMG}?${i}`, link: null }))).length === MENU_AD_MAX);

// --- les liens
check('article du site : s\'ouvre dans le site', JSON.stringify(menuAdTarget('https://www.albasseshopping.com/produit/ray-ban')) === JSON.stringify({ kind: 'product', slug: 'ray-ban' }));
check('sans « www » et sans « https » : pareil', JSON.stringify(menuAdTarget('albasseshopping.com/produit/lacoste')) === JSON.stringify({ kind: 'product', slug: 'lacoste' }));
check('catégorie du site', JSON.stringify(menuAdTarget('https://www.albasseshopping.com/categorie/parfum?page=2')) === JSON.stringify({ kind: 'category', slug: 'parfum' }));
check('chemin court « /produit/x »', JSON.stringify(menuAdTarget('/produit/swistar-2')) === JSON.stringify({ kind: 'product', slug: 'swistar-2' }));
check('autre page du site', JSON.stringify(menuAdTarget('https://www.albasseshopping.com/mes-commandes')) === JSON.stringify({ kind: 'page', path: '/mes-commandes' }));
check('WhatsApp : à part', JSON.stringify(menuAdTarget('https://wa.me/23560605151')) === JSON.stringify({ kind: 'external', url: 'https://wa.me/23560605151' }) && menuAdTarget('whatsapp://send?phone=235')?.kind === 'external');
check('lien vide ou dangereux : pas cliquable', menuAdTarget(null) === null && menuAdTarget('') === null && menuAdTarget('   ') === null && menuAdTarget('javascript:alert(1)') === null);

// --- les textes et le rythme
check('5 secondes par image', MENU_AD_SHOW_MS === 5000);
check('textes : PUB, Voir ›, « Publicité 2 sur 3 »', MENU_AD_TEXT.tag === 'PUB' && MENU_AD_TEXT.go === 'Voir ›' && MENU_AD_TEXT.label(3, 1) === 'Publicité 2 sur 3' && MENU_AD_TEXT.label(1, 0) === 'Publicité');
check('l\'admin explique le script à lancer', /add-menu-ad\.sql/.test(MENU_AD_TEXT.missing));

console.log(`${ok} contrôles réussis, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
