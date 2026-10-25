// Numéro de commande, facture, tri des commandes et export CSV (src/lib/invoice.ts) : fonctions pures, aucun réseau, aucune base.
// Lancer : node --import ./tests/zara/register.mjs tests/email/invoice.test.ts
import { filterOrders, invoiceBreakdown, invoiceNumber, matchesQuery, ordersToCsv, orderNumberLabel } from '../../src/lib/invoice.ts';
import type { Order } from '../../src/types';

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

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();
const mk = (extra: Partial<Order> = {}): Order => ({
  id: '0c7e6708-fb70-413c-9862-6e041adc963f',
  order_number: 12,
  user_id: 'u1',
  items: [
    { product_id: 'a', product_name: ' Soulier  noir ', product_image: null, unit_price: 20000, quantity: 1, color: 'Noir', size: '42' },
    { product_id: 'b', product_name: 'Montre', product_image: null, unit_price: 35000, quantity: 2, color: null, size: null },
  ],
  total: 92500,
  status: 'pending',
  payment_method: 'airtel_money',
  payment_reference: null,
  shipping_name: 'Fatimé Ali',
  shipping_phone: '66 12 34 56',
  shipping_address: 'Quartier Farcha',
  shipping_city: 'Moundou',
  session_id: null,
  referrer_source: null,
  is_flagged_fake: false,
  created_at: iso(NOW - 3600_000),
  ...extra,
});

// numéros
check('numéro de commande : « N° 12 »', orderNumberLabel(mk()) === 'N° 12');
check('sans numéro (script pas lancé) : l’ancien repère #0c7e6708', orderNumberLabel(mk({ order_number: undefined })) === '#0c7e6708');
check('numéro de facture : FA-2026-000012', invoiceNumber(mk()) === 'FA-2026-000012', invoiceNumber(mk()));
check('année de la facture = année du jour à N’Djamena (31 décembre 23 h 30 UTC = 1er janvier là-bas)', invoiceNumber(mk({ created_at: '2026-12-31T23:30:00Z' })) === 'FA-2027-000012');
check('numéro de facture sans numéro de commande : repère de 8 caractères', invoiceNumber(mk({ order_number: undefined })) === 'FA-2026-0C7E6708');

// facture : lignes et totaux (articles 90 000 − remise 9 000 + cadeau 2 000 + livraison 2 500 = 85 500)
{
  const b = invoiceBreakdown(mk({ total: 85500, gift_wrap: true, loyalty_discount: 9000 }));
  check('lignes : nom nettoyé, variante, quantité, prix unitaire, total de ligne', b.rows.length === 2 && b.rows[0].name === 'Soulier noir' && b.rows[0].variant === 'Taille 42 · Noir' && b.rows[1].quantity === 2 && b.rows[1].total === 70000, b.rows);
  check('articles 90 000, remise 9 000, cadeau 2 000', b.itemsTotal === 90000 && b.loyaltyDiscount === 9000 && b.giftWrap === 2000, b);
  check('livraison = le reste du total (85 500 − 83 000 = 2 500)', b.delivery === 2500 && b.total === 85500, b);
  const free = invoiceBreakdown(mk({ total: 90000 }));
  check('sans cadeau ni remise : livraison 0 (gratuite ou à définir)', free.delivery === 0 && free.giftWrap === 0 && free.loyaltyDiscount === 0);
  const odd = invoiceBreakdown(mk({ total: 50000 }));
  check('total plus petit que les articles : livraison jamais négative', odd.delivery === 0);
}

// recherche
{
  const o = mk();
  check('recherche « 12 » : le numéro de commande', matchesQuery(o, '12'));
  check('recherche « N° 12 », « #12 », « n°012 », « FA-2026-000012 »', ['N° 12', '#12', 'n°012', 'FA-2026-000012', 'fa-2026-000012'].every((q) => matchesQuery(o, q)));
  check('recherche « 13 » : pas cette commande', !matchesQuery(o, '13') && !matchesQuery(o, 'FA-2026-000013'));
  check('recherche par nom sans accent ni majuscule : « fatime »', matchesQuery(o, 'fatime') && matchesQuery(o, 'ALI'));
  check('recherche par téléphone : « 1234 » et « 66 12 34 56 »', matchesQuery(o, '1234') && matchesQuery(o, '66 12 34 56'));
  check('chiffres courts : « 12 » ne cherche pas dans le téléphone (4 chiffres au moins)', !matchesQuery(mk({ order_number: 5 }), '12'));
  check('recherche par ville et par ancien repère #0c7e6708', matchesQuery(o, 'moundou') && matchesQuery(o, '#0c7e6708') && !matchesQuery(o, 'sarh'));
  check('recherche vide : tout', matchesQuery(o, '   '));
}

// filtres
{
  const list = [
    mk({ id: 'a', order_number: 1, status: 'pending', created_at: iso(NOW - 3600_000) }),
    mk({ id: 'b', order_number: 2, status: 'delivered', created_at: iso(NOW - 3 * 86_400_000) }),
    mk({ id: 'c', order_number: 3, status: 'cancelled', created_at: iso(NOW - 20 * 86_400_000) }),
    mk({ id: 'd', order_number: 4, status: 'delivered', created_at: iso(NOW - 60 * 86_400_000) }),
  ];
  const ids = (f: Parameters<typeof filterOrders>[1]) => filterOrders(list, f, NOW).map((o) => o.id).join();
  check('statut : livrées', ids({ query: '', status: 'delivered', period: 'all' }) === 'b,d');
  check('période : aujourd’hui, 7 jours, 30 jours', ids({ query: '', status: 'all', period: 'today' }) === 'a' && ids({ query: '', status: 'all', period: '7d' }) === 'a,b' && ids({ query: '', status: 'all', period: '30d' }) === 'a,b,c');
  check('statut + période + numéro ensemble', ids({ query: '2', status: 'delivered', period: '7d' }) === 'b' && ids({ query: '4', status: 'delivered', period: '7d' }) === '');
}

// export CSV
{
  const csv = ordersToCsv([mk({ total: 85500, gift_wrap: true, loyalty_discount: 9000, shipping_name: 'Ali; "le grand"', status: 'delivered' })]);
  const lines = csv.trim().split('\r\n');
  check('CSV : commence par la marque UTF-8 (accents corrects dans Excel) et a un titre + une ligne', csv.charCodeAt(0) === 0xfeff && lines.length === 2, lines.length);
  check('CSV : numéro de commande, numéro de facture, statut, total', /^12;FA-2026-000012;/.test(lines[1]) && /;Livrée;/.test(lines[1]) && /;85500$/.test(lines[1]), lines[1]);
  check('CSV : un « ; » ou un guillemet dans un nom ne casse pas les colonnes', lines[1].includes('"Ali; ""le grand"""') && lines[1].split(';').length > 14, lines[1]);
  check('CSV : articles lisibles et paiement en français', /1 x Soulier noir \(Taille 42 · Noir\) \+ 2 x Montre/.test(lines[1]) && /;Airtel Money;/.test(lines[1]), lines[1]);
}

console.log(process.exitCode ? '\nDES ECHECS' : `\nTOUT EST BON (${ok} contrôles)`);
