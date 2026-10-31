// Relance WhatsApp des clients « Intérêt élevé » : choix de l'article regardé et texte du message. Aucun écran, aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/relance/relance.test.ts
import {
  cityKey,
  deliveryLine,
  firstNameOf,
  isHomeCity,
  isUuid,
  orderedByUser,
  pickRelance,
  productLink,
  relanceCandidates,
  relanceMessage,
  whatsappLink,
  type InterestRow,
  type RelanceProduct,
} from '../../src/lib/relanceMessage.ts';

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

const ACCOUNT = 'abcd1234-0000-4000-8000-000000000001';
const OTHER = 'ffff9999-0000-4000-8000-000000000002';
const row = (over: Partial<InterestRow> & { productId: string }): InterestRow => ({
  userId: ACCOUNT,
  activeSeconds: 40,
  lastViewedAt: '2026-10-28T10:00:00Z',
  cartStatus: 'none',
  ...over,
});
const product = (over: Partial<RelanceProduct> & { id: string }): RelanceProduct => ({
  name: 'Survêtement ZEGNA',
  slug: 'survetement-zegna',
  price: 25000,
  compare_at_price: null,
  stock: 60,
  is_active: true,
  ...over,
});
const catalog = (...ps: RelanceProduct[]) => new Map(ps.map((p) => [p.id, p]));

// --- la ville (écrite à la main par les clients) ---
for (const v of ["N'Djamena", 'N’Djamena ', 'Ndjamena ', "N'Djaména", 'ndjamena', ' NDJAMENA ', 'N Djamena'])
  check(`ville de la boutique reconnue : « ${v} »`, isHomeCity(v), cityKey(v));
for (const v of ['Doba', 'Mongo', 'Abéché', '', '   ', null, undefined, '😀'])
  check(`pas la ville de la boutique : « ${String(v)} »`, !isHomeCity(v));

// --- quel article ---
{
  const rows = [
    row({ productId: 'p-old', lastViewedAt: '2026-10-20T10:00:00Z' }),
    row({ productId: 'p-new', lastViewedAt: '2026-10-29T10:00:00Z' }),
    row({ productId: 'p-cart', lastViewedAt: '2026-10-10T10:00:00Z', cartStatus: 'in_cart' }),
    row({ productId: 'p-removed', lastViewedAt: '2026-10-11T10:00:00Z', cartStatus: 'removed' }),
    row({ productId: 'p-longer', lastViewedAt: '2026-10-29T10:00:00Z', activeSeconds: 300 }),
    row({ productId: 'p-other-account', userId: OTHER, lastViewedAt: '2026-10-30T10:00:00Z' }),
    row({ productId: 'p-bought', cartStatus: 'purchased', lastViewedAt: '2026-10-30T10:00:00Z' }),
    row({ productId: 'p-ordered', lastViewedAt: '2026-10-30T10:00:00Z' }),
    row({ productId: 'p-delivered', lastViewedAt: '2026-10-30T10:00:00Z' }),
    row({ productId: 'p-cancelled', lastViewedAt: '2026-10-05T10:00:00Z' }),
    row({ productId: '', lastViewedAt: '2026-10-30T10:00:00Z' }),
  ];
  const ordered = orderedByUser([
    { user_id: ACCOUNT, status: 'pending', items: [{ product_id: 'p-ordered' }] },
    { user_id: ACCOUNT, status: 'delivered', items: [{ product_id: 'p-delivered', quantity: 2 }, { product_id: 'x' }] },
    { user_id: ACCOUNT, status: 'cancelled', items: [{ product_id: 'p-cancelled' }] },
    { user_id: OTHER, status: 'pending', items: [{ product_id: 'p-old' }] },
  ]);
  const ids = relanceCandidates(rows, ACCOUNT, ordered).map((r) => r.productId);
  check('ordre : geste d’achat d’abord (commande arrêtée plus récente, puis panier)', ids.slice(0, 2).join() === 'p-removed,p-cart', ids);
  check('ordre : ensuite le plus récent, puis le plus long à égalité', ids.slice(2, 5).join() === 'p-longer,p-new,p-old', ids);
  check('une commande annulée n’écarte pas l’article (le client peut le reprendre), il passe en dernier', ids[5] === 'p-cancelled' && ids.length === 6, ids);
  check('écartés : autre client, déjà acheté, déjà commandé ou livré, sans identifiant', !/other|bought|ordered|delivered/.test(ids.join()) && !ids.includes(''), ids);
  check('la commande d’un AUTRE client n’écarte rien pour celui-ci', ids.includes('p-old'));
  check('aucune donnée : aucune relance', relanceCandidates([], ACCOUNT).length === 0);
  check('sans liste de commandes : rien d’écarté sauf « acheté »', relanceCandidates(rows, ACCOUNT).length === 8);
  check('date illisible ou absente : pas de plantage', relanceCandidates([row({ productId: 'a', lastViewedAt: null }), row({ productId: 'b', lastViewedAt: 'pas une date' })], ACCOUNT).length === 2);
}

// --- les commandes lues dans la base ---
{
  const o = orderedByUser([
    { user_id: 'u1', status: 'paid', items: [{ product_id: 'a' }, { product_id: 'b' }] },
    { user_id: 'u1', status: 'pending', items: [{ product_id: 'c' }] },
    { user_id: 'u1', status: 'cancelled', items: [{ product_id: 'd' }] },
    { user_id: null, status: 'paid', items: [{ product_id: 'e' }] },
    { user_id: 'u2', status: 'paid', items: null },
    { user_id: 'u3', status: null, items: 'pas une liste' },
    { user_id: 'u4', status: 'paid', items: [null, 3, {}, { product_id: 7 }, { product_id: '' }, { product_id: 'ok' }] },
  ]);
  check('commandes : articles regroupés par client, annulées ignorées', [...(o.get('u1') ?? [])].sort().join() === 'a,b,c' && !o.get('u1')?.has('d'));
  check('commandes : sans client, sans articles ou données bizarres → pas de plantage, rien d’inventé', !o.has('u2') && !o.has('u3') && o.size === 2 && [...(o.get('u4') ?? [])].join() === 'ok', [...o.keys()]);
}

// --- article encore vendable ---
{
  const rows = [row({ productId: 'a', cartStatus: 'in_cart' }), row({ productId: 'b', lastViewedAt: '2026-10-27T10:00:00Z' }), row({ productId: 'c', lastViewedAt: '2026-10-26T10:00:00Z' })];
  const first = pickRelance(rows, ACCOUNT, catalog(product({ id: 'a' }), product({ id: 'b', name: 'B' }), product({ id: 'c', name: 'C' })));
  check('le meilleur article est choisi', first?.product.id === 'a' && first.row.productId === 'a', first?.product.id);
  const noStock = pickRelance(rows, ACCOUNT, catalog(product({ id: 'a', stock: 0 }), product({ id: 'b', name: 'B' })));
  check('article en rupture : on passe au suivant', noStock?.product.id === 'b', noStock?.product.id);
  const inactive = pickRelance(rows, ACCOUNT, catalog(product({ id: 'a', is_active: false }), product({ id: 'b', is_active: false }), product({ id: 'c', name: 'C' })));
  check('article retiré de la vente : on passe au suivant', inactive?.product.id === 'c', inactive?.product.id);
  const free = pickRelance(rows, ACCOUNT, catalog(product({ id: 'a', price: 0 }), product({ id: 'b', name: ' ' }), product({ id: 'c', name: 'C' })));
  check('prix à 0 ou nom vide : écarté', free?.product.id === 'c', free?.product.id);
  check('article introuvable dans la base : aucune relance', pickRelance(rows, ACCOUNT, catalog()) === null);
  check('aucun article vendable : null (message général)', pickRelance(rows, ACCOUNT, catalog(product({ id: 'a', stock: 0 }), product({ id: 'b', stock: -1 }), product({ id: 'c', is_active: false }))) === null);
}

// --- le message ---
const zegna = product({ id: 'z' });
const m = relanceMessage({ firstName: 'Fadoul', product: zegna, region: "N'Djamena" });
check('message : prénom, nom de l’article, vrai prix', /^Bonjour Fadoul, ici l'équipe Albasse Shopping 😊/.test(m) && m.includes('« Survêtement ZEGNA »') && m.includes('25 000 FCFA'), m);
check('message : lien direct vers la fiche de l’article', m.includes('https://www.albasseshopping.com/produit/survetement-zegna'), m);
check('message N’Djamena : livraison sans frais et paiement à la livraison', m.includes("Livraison à N'Djamena sans frais, et paiement à la livraison."), m);
check('message : stock élevé (60) → on ne parle pas du stock', !/Il n'en reste/.test(m), m);
check('message : pas de remise quand il n’y en a pas', !/au lieu de/.test(m), m);

const slip = relanceMessage({ firstName: 'Aïcha', product: product({ id: 's', name: 'Chaussures homme slip-on sport ', slug: 'chaussures-homme-slip-on-sport', price: 15000, stock: 6 }), region: 'Doba' });
check('stock bas (6) : « Il n’en reste que 6 » (vrai)', slip.includes("Il n'en reste que 6."), slip);
check('stock = 10 : mentionné ; stock = 11 : non', relanceMessage({ firstName: '', product: product({ id: 'x', stock: 10 }) }).includes("Il n'en reste que 10.") && !relanceMessage({ firstName: '', product: product({ id: 'x', stock: 11 }) }).includes("Il n'en reste"));
check('nom : espaces en trop retirés', slip.includes('« Chaussures homme slip-on sport »'), slip);
check('autre ville : paiement à l’avance, aucune promesse de livraison gratuite', slip.includes('paiement à l’avance par Airtel Money ou Moov Money') && !/sans frais|gratuit|à la livraison\./.test(slip), slip);

const bague = relanceMessage({ firstName: 'Moussa', product: product({ id: 'b', name: 'Bague Homme NR01', slug: 'bague-homme-nr01', price: 17500, compare_at_price: 22500, stock: 80 }), region: null });
check('vraie promotion : ancien prix indiqué', bague.includes('17 500 FCFA (au lieu de 22 500 FCFA)'), bague);
check('ville inconnue : on ne promet rien de faux (gratuit seulement à N’Djamena)', bague.includes("Livraison partout au Tchad. À N'Djamena : sans frais et paiement à la livraison."), bague);
check('ancien prix plus bas ou égal : pas de « au lieu de »', !relanceMessage({ firstName: '', product: product({ id: 'x', compare_at_price: 20000 }) }).includes('au lieu de') && !relanceMessage({ firstName: '', product: product({ id: 'x', compare_at_price: 25000 }) }).includes('au lieu de'));

check('sans prénom : « Bonjour, » propre', relanceMessage({ firstName: '', product: null }) === "Bonjour, ici l'équipe Albasse Shopping 😊");
check('sans article : salut simple, comme avant', relanceMessage({ firstName: 'Ali', product: null }) === "Bonjour Ali, ici l'équipe Albasse Shopping 😊");
check('article sans adresse (slug vide) : lien vers le site', productLink({ slug: null }) === 'https://www.albasseshopping.com' && productLink({ slug: 'a b/ç' }) === 'https://www.albasseshopping.com/produit/a%20b%2F%C3%A7');
check('aucune fausse urgence dans aucun message', ![m, slip, bague].some((t) => /dernière chance|vite|maintenant|urgent|\d+ personnes|regardent|promo exclusive/i.test(t)), [m, slip, bague]);
check('message court (tient dans le lien WhatsApp)', [m, slip, bague].every((t) => t.length < 600), [m.length, slip.length, bague.length]);
check('les 3 lignes de livraison sont distinctes', new Set([deliveryLine("N'Djamena"), deliveryLine('Doba'), deliveryLine('')]).size === 3);

// --- le prénom et le lien WhatsApp ---
check('prénom : premier mot du nom complet', firstNameOf('  Fadoul  Ali Mahamat ') === 'Fadoul' && firstNameOf(null) === '' && firstNameOf('') === '');
const link = whatsappLink('23566123456', m);
const url = new URL(link);
check('lien WhatsApp : numéro + texte encodé', url.origin === 'https://wa.me' && url.pathname === '/23566123456' && url.searchParams.get('text') === m, link.slice(0, 80));
check('lien WhatsApp : accents, guillemets, retours à la ligne et emojis survivent', decodeURIComponent(link.split('text=')[1]) === m);

// --- identifiants envoyés à la base ---
check('identifiant d’article valable (uuid) accepté', isUuid('e4677a88-d580-4524-ac06-a61055b58033'));
check('identifiant douteux refusé', !isUuid('p-1') && !isUuid('') && !isUuid("x'); drop table products;--") && !isUuid('e4677a88-d580-4524-ac06-a61055b5803'));

console.log(`\n${ok} vérifications réussies${process.exitCode ? ', AVEC ÉCHECS' : ''}`);
