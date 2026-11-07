// Écran d'entrée « Créez votre compte » : les 4 articles montrés, les avantages, et la création du compte (nom, téléphone, mot de passe, conditions ; le reste est demandé ensuite dans le sondage). Aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/email/entry-screen.test.ts
import {
  ENTRY_BENEFITS,
  ENTRY_PREVIEW_COUNT,
  ENTRY_PRICE_BANDS,
  ENTRY_PRICE_MAX,
  ENTRY_PRICE_MIN,
  ENTRY_ROTATE_MS,
  ENTRY_SET_COUNT,
  checkStepOne,
  entryBandOf,
  entryPrice,
  pickEntryProducts,
  pickEntrySets,
  type EntryCategory,
  type EntryProduct,
} from '../../src/lib/entryScreen.ts';
import { WHEEL_ENABLED } from '../../src/lib/featureFlags.ts';

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

const cats: EntryCategory[] = [
  { id: 'parf', name: 'Parfum', slug: 'parfum' },
  { id: 'parf-h', name: 'Parfum homme', slug: 'parfum-homme', parent_id: 'parf' },
  { id: 'mont', name: 'MONTRE & ACCESSOIRES', slug: 'montre' },
  { id: 'chau', name: 'Chaussures', slug: 'chaussures' },
  { id: 'vit', name: 'Vitalité & Énergie Homme', slug: 'vitalite-energie-homme' },
  { id: 'vit-s', name: 'Café', slug: 'cafe', parent_id: 'vit' },
  { id: 'luns', name: 'Lunettes', slug: 'lunettes' },
];
const P = (id: string, cat: string | null, likes: number, extra: Partial<EntryProduct> = {}): EntryProduct => ({
  id,
  name: `Article ${id}`,
  price: 10000,
  images: [`https://x/${id}.jpg`],
  stock: 5,
  is_active: true,
  category_id: cat,
  likes_count: likes,
  created_at: '2026-11-01T00:00:00Z',
  ...extra,
});

// ---- prix
check('prix : « 40 000 FCFA » (séparateur de milliers français, sans décimales)', entryPrice(40000).replace(/\s/g, ' ') === '40 000 FCFA' || /^40\D000 FCFA$/.test(entryPrice(40000)), entryPrice(40000));
check('prix : texte reçu de la base (« 22500.00 »)', /^22\D500 FCFA$/.test(entryPrice('22500.00')), entryPrice('22500.00'));
check('prix : valeur absente = 0 FCFA, jamais « NaN »', entryPrice('') === '0 FCFA' && !/NaN/.test(entryPrice(undefined as unknown as number)));

// ---- les articles montrés : de 10 000 à 15 000 FCFA, et de 20 000 à 40 000 FCFA (demandes du patron, 6 novembre)
check('on montre 4 articles', ENTRY_PREVIEW_COUNT === 4);
check('deux fourchettes de prix : de 10 000 à 15 000 FCFA et de 20 000 à 40 000 FCFA', ENTRY_PRICE_BANDS.length === 2 && ENTRY_PRICE_BANDS[0].min === 10000 && ENTRY_PRICE_BANDS[0].max === 15000 && ENTRY_PRICE_BANDS[1].min === 20000 && ENTRY_PRICE_BANDS[1].max === 40000);
check('bornes de la demande à la boutique : 10 000 et 40 000', ENTRY_PRICE_MIN === 10000 && ENTRY_PRICE_MAX === 40000);
check('la bande change toute seule : jusqu\'à 4 jeux, un nouveau toutes les 3 à 10 secondes', ENTRY_SET_COUNT === 4 && ENTRY_ROTATE_MS >= 3000 && ENTRY_ROTATE_MS <= 10000, [ENTRY_SET_COUNT, ENTRY_ROTATE_MS]);
check('fourchette d\'un prix : bornes comprises, rien entre 15 001 et 19 999, rien au-dessus de 40 000, texte de la base compris', entryBandOf(10000) === 0 && entryBandOf(15000) === 0 && entryBandOf(15001) === -1 && entryBandOf(17500) === -1 && entryBandOf(19999) === -1 && entryBandOf(20000) === 1 && entryBandOf(40000) === 1 && entryBandOf(40001) === -1 && entryBandOf(9999) === -1 && entryBandOf('22500.00') === 1 && entryBandOf('') === -1 && entryBandOf('abc') === -1);
const PR = (id: string, cat: string | null, price: number | string, likes = 0, extra: Partial<EntryProduct> = {}): EntryProduct => P(id, cat, likes, { price, ...extra });
{
  const products = [
    PR('trop-bas1', 'mont', 3500, 9), PR('trop-bas2', 'chau', 9999, 9), PR('trop-haut1', 'parf', 15001, 9), PR('trop-haut2', 'luns', 650000, 9),
    PR('borne-basse', 'mont', 10000, 1), PR('borne-haute', 'chau', 15000, 1), PR('milieu', 'parf', 12500, 1),
  ];
  const picked = pickEntryProducts(products, cats);
  check('seulement de 10 000 à 15 000 FCFA, bornes comprises (9 999, 15 001 et 650 000 refusés, même très aimés)', picked.map((p) => p.id).join(',') === 'borne-basse,milieu,borne-haute', picked.map((p) => `${p.id}:${p.price}`));
}
{
  const products = [PR('a', 'mont', 15000, 5), PR('b', 'chau', 10000, 4), PR('c', 'parf', 12500, 3), PR('d', 'luns', 11000, 2), PR('e', 'vit', 10500, 99)];
  const picked = pickEntryProducts(products, cats);
  check('4 articles de 4 catégories différentes, rangés du moins cher au plus cher pour l\'affichage', picked.map((p) => p.id).join(',') === 'b,d,c,a' && new Set(picked.map((p) => p.category_id)).size === 4, picked.map((p) => `${p.id}:${p.price}`));
  check('les prix montrés se suivent dans l\'ordre croissant', picked.every((p, i) => i === 0 || Number(picked[i - 1].price) <= Number(p.price)), picked.map((p) => p.price));
}
{
  const products = [PR('a', 'mont', 11000, 9), PR('b', 'mont', 11500, 8), PR('c', 'mont', 12000, 7), PR('d', 'mont', 12500, 6), PR('e', 'chau', 13000, 1), PR('f', 'parf', 13500, 0)];
  const picked = pickEntryProducts(products, cats);
  check('on choisit les plus aimés, un par catégorie d\'abord : chaussures et parfum passent avant les 2e et 3e montres', picked.map((p) => p.id).join(',') === 'a,b,e,f' || picked.map((p) => p.id).sort().join(',') === 'a,e,f,b', picked.map((p) => p.id));
  check('…donc 3 catégories différentes dans les 3 premiers choisis', new Set(picked.slice(0, 4).map((p) => p.category_id)).size === 3, picked.map((p) => p.category_id));
}
{
  const sub = [PR('a', 'parf-h', 12000, 5), PR('b', 'parf', 12500, 4), PR('c', 'mont', 13000, 3)];
  const picked = pickEntryProducts(sub, cats);
  check('une sous-catégorie compte comme sa catégorie principale (parfum homme et parfum : un seul d\'abord)', picked.map((p) => p.id).join(',') === 'a,b,c' && picked.slice(0, 3).filter((p) => p.category_id === 'parf' || p.category_id === 'parf-h').length === 2, picked.map((p) => p.id));
  const firstTwo = pickEntryProducts([...sub, PR('d', 'luns', 14000, 0)], cats).map((p) => p.id);
  check('…et le 2e parfum n\'est pris qu\'en dernier (4 articles : parfum homme, montre, lunettes, puis parfum)', firstTwo.join(',') === 'a,b,c,d', firstTwo);
}
{
  const products = [PR('vit1', 'vit', 12000, 99), PR('vit2', 'vit-s', 12500, 98), PR('ok1', 'mont', 13000, 1)];
  const picked = pickEntryProducts(products, cats);
  check('jamais d\'article « Vitalité & Énergie » (ni de sa sous-catégorie), même dans la fourchette et très aimé', picked.map((p) => p.id).join(',') === 'ok1', picked.map((p) => p.id));
}
{
  const products = [
    PR('inactif', 'mont', 12000, 9, { is_active: false }),
    PR('stock0', 'mont', 12000, 9, { stock: 0 }),
    PR('stocknull', 'mont', 12000, 9, { stock: null }),
    PR('sansphoto', 'mont', 12000, 9, { images: [] }),
    PR('photovide', 'mont', 12000, 9, { images: ['', '  '] }),
    PR('sansimages', 'mont', 12000, 9, { images: null }),
    PR('prixabsent', 'mont', '', 9),
    PR('sansnom', 'mont', 12000, 9, { name: '   ' }),
    PR('bon', 'chau', 12000),
  ];
  const picked = pickEntryProducts(products, cats);
  check('seulement des articles en vente : actif, en stock, avec photo, un prix dans la fourchette, un nom', picked.map((p) => p.id).join(',') === 'bon', picked.map((p) => p.id));
}
check('boutique vide : rien à montrer (la bande n\'apparaît pas)', pickEntryProducts([], cats).length === 0);
check('aucun article dans les fourchettes : rien (jamais un article hors de 10 000 à 15 000 et de 20 000 à 40 000, même pour compléter)', pickEntryProducts([PR('a', 'mont', 3500), PR('b', 'chau', 225000), PR('c', 'parf', 650000), PR('d', 'luns', 17500)], cats).length === 0);
check('moins de 4 articles dans les fourchettes : on montre ceux qui existent (17 500 : jamais)', pickEntryProducts([PR('a', 'mont', 11000), PR('b', 'chau', 12000), PR('c', 'parf', 17500), PR('d', 'luns', 40001)], cats).length === 2);
{
  const products = [PR('a', 'mont', 10000, 5), PR('b', 'mont', 11000, 4), PR('c', 'mont', 12000, 3), PR('d', 'mont', 13000, 2), PR('e', 'mont', 14000, 1)];
  const picked = pickEntryProducts(products, cats);
  check('une seule catégorie : on complète quand même jusqu\'à 4 (les plus aimés), du moins cher au plus cher', picked.map((p) => p.id).join(',') === 'a,b,c,d', picked.map((p) => p.id));
}
{
  const tie = [PR('peuaime', 'mont', 12000, 1), PR('beaucoup-cher', 'chau', 14000, 7), PR('beaucoup-moins-cher', 'parf', 11000, 7), PR('beaucoup-vieux', 'luns', 11000, 7, { created_at: '2026-10-01T00:00:00Z' })];
  const picked = pickEntryProducts(tie, cats, 3).map((p) => p.id);
  check('mêmes « j\'aime » et même prix : le plus récent est gardé, l\'autre laisse sa place à un prix différent (puis rangés par prix)', picked.join(',') === 'beaucoup-moins-cher,peuaime,beaucoup-cher', picked);
}
{
  // 3 articles à 12 500 et 1 à 15 000 : c'est ce que le patron a vu le 6 novembre → 4 prix différents demandés
  const products = [
    PR('survetement', 'vet', 12500, 2), PR('nivea', 'cosm', 12500, 1), PR('manette', 'jeux', 12500, 1), PR('sandale', 'chau', 15000, 3),
    PR('montre', 'mont', 11000, 0), PR('parfum', 'parf', 13500, 0), PR('lunettes', 'luns', 14000, 0),
  ];
  const picked = pickEntryProducts(products, [...cats, { id: 'vet', name: 'Vêtements', slug: 'vetements' }, { id: 'cosm', name: 'Cosmétique', slug: 'cosmetique' }, { id: 'jeux', name: 'Jeux', slug: 'jeux' }]);
  const prices = picked.map((p) => Number(p.price));
  check('4 articles à 4 prix différents (plus jamais trois à 12 500)', picked.length === 4 && new Set(prices).size === 4, prices);
  check('…les plus aimés d\'abord : sandale (3), survêtement (2), puis un article par prix et par catégorie parmi les suivants', picked.some((p) => p.id === 'sandale') && picked.some((p) => p.id === 'survetement'), picked.map((p) => p.id));
  check('…et rangés du moins cher au plus cher', prices.every((n, i) => i === 0 || prices[i - 1] <= n), prices);
}
{
  const same = [PR('a', 'mont', 12500, 5), PR('b', 'chau', 12500, 4), PR('c', 'parf', 12500, 3), PR('d', 'luns', 15000, 2), PR('e', 'vet', 12500, 1)];
  const picked = pickEntryProducts(same, [...cats, { id: 'vet', name: 'Vêtements', slug: 'vetements' }]);
  check('pas assez de prix différents (2 seulement) : on complète avec des articles différents au même prix, jamais moins que possible', picked.length === 4 && new Set(picked.map((p) => p.id)).size === 4 && new Set(picked.map((p) => Number(p.price))).size === 2, picked.map((p) => `${p.id}:${p.price}`));
}
{
  const dup = [
    PR('a1', 'chau', 15000, 3, { name: 'Al madjaz' }), PR('a2', 'chau', 15000, 2, { name: 'Al  madjaz ' }), PR('a3', 'mont', 14000, 2, { name: 'AL MADJAZ' }),
    PR('b', 'parf', 12000, 1), PR('c', 'luns', 11000, 0),
  ];
  const picked = pickEntryProducts(dup, cats);
  const names = picked.map((p) => p.name.replace(/\s+/g, ' ').trim().toLowerCase());
  check('jamais deux fois le même article (même nom, majuscules et espaces en plus ignorés) : « Al madjaz » une seule fois', names.filter((n) => n === 'al madjaz').length === 1 && picked.length === 3, picked.map((p) => p.name));
}
{
  const rich = Array.from({ length: 30 }, (_, i) => PR(`p${i}`, ['mont', 'chau', 'parf', 'luns', 'vet'][i % 5], 10000 + (i % 11) * 500, i % 4, { name: `Article ${i}` }));
  const picked = pickEntryProducts(rich, [...cats, { id: 'vet', name: 'Vêtements', slug: 'vetements' }]);
  check('beaucoup d\'articles : toujours 4 articles, 4 noms, 4 prix, 4 catégories différents', picked.length === 4 && new Set(picked.map((p) => p.name)).size === 4 && new Set(picked.map((p) => Number(p.price))).size === 4 && new Set(picked.map((p) => p.category_id)).size === 4, picked.map((p) => `${p.id}:${p.price}:${p.category_id}`));
}
{
  const strings = [PR('x', 'mont', '12000.00'), PR('y', 'chau', '15000.50'), PR('z', 'parf', '10000'), PR('w', 'luns', '9999.99')];
  check('prix reçus en texte par la base (« 12000.00 ») : comparés comme des nombres, 15 000,50 (entre les deux fourchettes) et 9 999,99 hors fourchette', pickEntryProducts(strings, cats).map((p) => p.id).sort().join(',') === 'x,z', pickEntryProducts(strings, cats).map((p) => p.id));
}
// ---- les deux fourchettes ensemble : un mélange, et des jeux qui se remplacent
{
  const mixed = [
    PR('a1', 'mont', 11000, 9), PR('a2', 'chau', 12500, 8), PR('a3', 'parf', 14000, 7),
    PR('b1', 'luns', 22000, 3), PR('b2', 'vet', 30000, 2), PR('b3', 'cosm', 38000, 1),
  ];
  const c2 = [...cats, { id: 'vet', name: 'Vêtements', slug: 'vetements' }, { id: 'cosm', name: 'Cosmétique', slug: 'cosmetique' }];
  const picked = pickEntryProducts(mixed, c2);
  const prices = picked.map((p) => Number(p.price));
  check('les deux fourchettes ensemble : 2 articles de 10 000 à 15 000 et 2 de 20 000 à 40 000 (les plus aimés de chacune)', picked.length === 4 && picked.filter((p) => entryBandOf(p.price) === 0).length === 2 && picked.filter((p) => entryBandOf(p.price) === 1).length === 2, picked.map((p) => `${p.id}:${p.price}`));
  check('…les plus aimés de chaque fourchette : a1, a2, b1, b2', picked.map((p) => p.id).sort().join(',') === 'a1,a2,b1,b2', picked.map((p) => p.id));
  check('…rangés du moins cher au plus cher, 4 prix différents', prices.every((n, i) => i === 0 || prices[i - 1] <= n) && new Set(prices).size === 4, prices);
}
{
  const high = [PR('b1', 'mont', 20000, 1), PR('b2', 'chau', 25000, 2), PR('b3', 'parf', 31000, 3), PR('b4', 'luns', 40000, 4), PR('b5', 'mont', 22000, 0)];
  check('seulement des articles de 20 000 à 40 000 : on complète avec eux, jusqu\'à 4', pickEntryProducts(high, cats).length === 4 && pickEntryProducts(high, cats).every((p) => entryBandOf(p.price) === 1));
  const low = [PR('a1', 'mont', 10000, 1), PR('a2', 'chau', 11000, 2), PR('a3', 'parf', 12000, 3), PR('a4', 'luns', 13000, 4)];
  check('seulement des articles de 10 000 à 15 000 : on complète avec eux, jusqu\'à 4', pickEntryProducts(low, cats).length === 4 && pickEntryProducts(low, cats).every((p) => entryBandOf(p.price) === 0));
  const gap = [PR('g1', 'mont', 15001, 99), PR('g2', 'chau', 17500, 99), PR('g3', 'parf', 19999, 99), PR('ok1', 'luns', 20000, 1), PR('ok2', 'mont', 15000, 1), PR('ko', 'chau', 40001, 99)];
  check('15 001 à 19 999 FCFA et au-dessus de 40 000 : jamais montrés, même les plus aimés ; 15 000 et 20 000 le sont', pickEntryProducts(gap, cats).map((p) => p.id).sort().join(',') === 'ok1,ok2', pickEntryProducts(gap, cats).map((p) => p.id));
}
{
  const catsMany = [...cats, { id: 'vet', name: 'Vêtements', slug: 'vetements' }, { id: 'cosm', name: 'Cosmétique', slug: 'cosmetique' }];
  const roots = ['mont', 'chau', 'parf', 'luns', 'vet', 'cosm'];
  const cheap = Array.from({ length: 12 }, (_, i) => PR(`c${i}`, roots[i % 6], 10000 + (i % 6) * 1000, 20 - i, { name: `Bas ${i}` }));
  const dear = Array.from({ length: 12 }, (_, i) => PR(`d${i}`, roots[(i + 2) % 6], 20000 + (i % 7) * 3000, 20 - i, { name: `Haut ${i}` }));
  const sets = pickEntrySets([...cheap, ...dear], catsMany);
  const flat = sets.flat();
  check('beaucoup d\'articles : 4 jeux de 4 articles (la bande change toute seule)', sets.length === 4 && sets.every((s) => s.length === 4), sets.map((s) => s.length));
  check('…aucun article ni aucun nom dans deux jeux', new Set(flat.map((p) => p.id)).size === 16 && new Set(flat.map((p) => p.name)).size === 16);
  check('…chaque jeu : 4 prix différents, du moins cher au plus cher, 2 + 2 des deux fourchettes', sets.every((s) => new Set(s.map((p) => Number(p.price))).size === 4 && s.every((p, i) => i === 0 || Number(s[i - 1].price) <= Number(p.price)) && s.filter((p) => entryBandOf(p.price) === 0).length === 2 && s.filter((p) => entryBandOf(p.price) === 1).length === 2), sets.map((s) => s.map((p) => p.price)));
  check('…le 1er jeu est le même que pickEntryProducts', sets[0].map((p) => p.id).join(',') === pickEntryProducts([...cheap, ...dear], catsMany).map((p) => p.id).join(','));
  check('…les plus aimés passent d\'abord (le 1er jeu a les plus « j\'aime » de chaque fourchette)', sets[0].some((p) => p.id === 'c0') && sets[0].some((p) => p.id === 'd0'), sets[0].map((p) => p.id));
  check('…un seul jeu demandé : un seul jeu', pickEntrySets([...cheap, ...dear], catsMany, 4, 1).length === 1);
}
{
  const six = Array.from({ length: 6 }, (_, i) => PR(`x${i}`, ['mont', 'chau', 'parf', 'luns', 'vet', 'cosm'][i], 11000 + i * 1000, 6 - i));
  const sets = pickEntrySets(six, [...cats, { id: 'vet', name: 'Vêtements', slug: 'vetements' }, { id: 'cosm', name: 'Cosmétique', slug: 'cosmetique' }]);
  check('6 articles seulement : un seul jeu de 4 (jamais un 2e jeu à moitié vide qui remplace le 1er)', sets.length === 1 && sets[0].length === 4, sets.map((s) => s.length));
  const eight = Array.from({ length: 8 }, (_, i) => PR(`y${i}`, ['mont', 'chau', 'parf', 'luns', 'vet', 'cosm', 'mont', 'chau'][i], 11000 + (i % 4) * 1000 + (i >= 4 ? 10000 : 0), 8 - i, { name: `Y ${i}` }));
  const sets8 = pickEntrySets(eight, [...cats, { id: 'vet', name: 'Vêtements', slug: 'vetements' }, { id: 'cosm', name: 'Cosmétique', slug: 'cosmetique' }]);
  check('8 articles : 2 jeux de 4', sets8.length === 2 && sets8.every((s) => s.length === 4), sets8.map((s) => s.length));
  check('1 seul article : un jeu de 1 (la bande reste fixe)', pickEntrySets([PR('z', 'mont', 12000)], cats).length === 1 && pickEntrySets([PR('z', 'mont', 12000)], cats)[0].length === 1);
  check('boutique vide ou rien dans les fourchettes : aucun jeu', pickEntrySets([], cats).length === 0 && pickEntrySets([PR('a', 'mont', 17500), PR('b', 'chau', 50000)], cats).length === 0);
  const vit = pickEntrySets([PR('v1', 'vit', 25000, 99), PR('v2', 'vit-s', 12000, 99), PR('v3', 'vit', 30000, 99), PR('v4', 'vit', 11000, 99)], cats);
  check('jamais d\'article « Vitalité & Énergie » dans aucun jeu, même de 20 000 à 40 000 et très aimé', vit.length === 0, vit.flat().map((p) => p.id));
}
check('les jeux ne modifient pas la liste reçue', (() => {
  const input = [PR('a', 'mont', 31000, 1), PR('b', 'chau', 10500, 9), PR('c', 'parf', 22000, 5)];
  const copy = input.map((p) => p.id).join(',');
  pickEntrySets(input, cats);
  return input.map((p) => p.id).join(',') === copy;
})());
check('article sans catégorie : montré quand même', pickEntryProducts([PR('x', null, 12000)], cats).length === 1);
check('le tri ne modifie pas la liste reçue', (() => {
  const input = [PR('a', 'mont', 14000, 1), PR('b', 'chau', 10500, 9)];
  const copy = input.map((p) => p.id).join(',');
  pickEntryProducts(input, cats);
  return input.map((p) => p.id).join(',') === copy;
})());

// ---- les avantages : seulement des choses vraies
check('2 avantages : paiement à la livraison à N\'Djamena et parrainage (la roue de la chance est cachée : lib/featureFlags)', ENTRY_BENEFITS.length === (WHEEL_ENABLED ? 3 : 2) && /N’Djamena/.test(ENTRY_BENEFITS[0]) && /Invite 5 amis, gagne un parfum/.test(ENTRY_BENEFITS[1]), ENTRY_BENEFITS);
check('roue cachée : aucun avantage ne parle de la roue de la chance', WHEEL_ENABLED || ENTRY_BENEFITS.every((b) => !/roue/i.test(b)), ENTRY_BENEFITS);
check('aucun avantage ne promet un pourcentage, un prix cassé ou une urgence', ENTRY_BENEFITS.every((b) => !/%|dernier|limité|stock|\bvite\b|promo|solde|-\d/i.test(b)), ENTRY_BENEFITS);

// ---- étape 1
const phoneOk = true;
check('étape 1 complète : accepté', checkStepOne({ name: 'Ali Mahamat', phone: '66 12 34 56', password: 'secret12', terms: true }, phoneOk).ok === true);
{
  const r = checkStepOne({ name: '', phone: '66 12 34 56', password: 'secret12', terms: true }, phoneOk);
  check('sans nom : « Champs manquants » (même message qu\'avant)', !r.ok && r.title === 'Champs manquants' && r.message === 'Nom, numéro de téléphone et mot de passe sont obligatoires.', r);
}
check('sans téléphone : champs manquants', (() => { const r = checkStepOne({ name: 'Ali', phone: '  ', password: 'secret12', terms: true }, phoneOk); return !r.ok && r.title === 'Champs manquants'; })());
check('sans mot de passe : champs manquants', (() => { const r = checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: '', terms: true }, phoneOk); return !r.ok && r.title === 'Champs manquants'; })());
{
  const r = checkStepOne({ name: 'Ali', phone: '12', password: 'secret12', terms: true }, false);
  check('numéro invalide : « Téléphone invalide »', !r.ok && r.title === 'Téléphone invalide' && /numéro de téléphone valide/.test(r.message), r);
}
{
  const r = checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: '12345', terms: true }, phoneOk);
  check('mot de passe de 5 caractères : « Mot de passe trop court »', !r.ok && r.title === 'Mot de passe trop court' && r.message === 'Minimum 6 caractères.', r);
}
check('mot de passe de 6 caractères : accepté', checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: '123456', terms: true }, phoneOk).ok === true);
{
  const r = checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: false }, phoneOk);
  check('conditions pas acceptées : refusé', !r.ok && r.title === 'Conditions non acceptées', r);
}
check('e-mail facultatif : vide = accepté', checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: true, email: '' }, phoneOk, true).ok === true && checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: true, email: '   ' }, phoneOk, false).ok === true && checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: true }, phoneOk, false).ok === true);
{
  const r = checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: true, email: 'pas-un-email' }, phoneOk, false);
  check('e-mail écrit mais mal écrit : « E-mail invalide » (même message qu\'avant)', !r.ok && r.title === 'E-mail invalide' && r.message === 'Merci de saisir une adresse e-mail valide, ou laissez la case vide.', r);
}
check('e-mail valide : accepté', checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: 'secret12', terms: true, email: 'ali@example.com' }, phoneOk, true).ok === true);
check('numéro invalide passe avant l\'e-mail invalide', (() => { const r = checkStepOne({ name: 'Ali', phone: '12', password: 'secret12', terms: true, email: 'x' }, false, false); return !r.ok && r.title === 'Téléphone invalide'; })());
check('e-mail invalide passe avant mot de passe trop court et conditions', (() => { const r = checkStepOne({ name: 'Ali', phone: '66 12 34 56', password: '123', terms: false, email: 'x' }, phoneOk, false); return !r.ok && r.title === 'E-mail invalide'; })());
check('l\'ordre des contrôles : champs manquants avant tout le reste', (() => { const r = checkStepOne({ name: '', phone: '', password: '', terms: false }, false); return !r.ok && r.title === 'Champs manquants'; })());

console.log(`\n${ok} controles OK`);
if (process.exitCode) console.log('DES ECHECS ci-dessus');
else console.log('TOUT EST BON');
