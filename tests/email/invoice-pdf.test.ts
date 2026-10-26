// La facture PDF (supabase/functions/order-invoice/invoice.ts) : mêmes chiffres que l'écran Facture (src/lib/invoice.ts), texte sans danger pour le PDF,
// et dessin complet (une page, plusieurs pages, commande annulée, nom arabe, sans logo). Aucun réseau, aucune base.
// Lancer : node --import ./tests/zara/register.mjs tests/email/invoice-pdf.test.ts
// Le dessin demande « pdf-lib » (pas ajouté au projet : la fonction serveur le charge elle-même) : PDF_LIB=/chemin/vers/pdf-lib/cjs/index.js ou npm i --no-save pdf-lib.
// Si pdftotext est installé, le texte du PDF est relu pour vérifier les chiffres écrits.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { invoiceBreakdown, invoiceNumber, orderNumberLabel, PAYMENT_LABELS, STATUS_LABELS, formatXAF as screenXAF } from '../../src/lib/invoice.ts';
import { GIFT_WRAP_FEE } from '../../src/constants/shopRules.ts';
import * as pdf from '../../supabase/functions/order-invoice/invoice.ts';
import { LOGO_JPEG_BASE64 } from '../../supabase/functions/order-invoice/logo.ts';
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

const mk = (extra: Record<string, unknown> = {}) =>
  ({
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
    created_at: '2026-10-25T10:00:00Z',
    ...extra,
  }) as Order;

// --- les mêmes chiffres que l'écran Facture ---
check('emballage cadeau : même prix que la boutique', pdf.GIFT_WRAP_FEE === GIFT_WRAP_FEE);
check('libellés de paiement identiques', JSON.stringify(pdf.PAYMENT_LABELS) === JSON.stringify(PAYMENT_LABELS));
check('libellés de statut identiques', JSON.stringify(pdf.STATUS_LABELS) === JSON.stringify(STATUS_LABELS));
const variants = [
  mk(),
  mk({ total: 85500, gift_wrap: true, loyalty_discount: 9000 }),
  mk({ total: 50000 }),
  mk({ order_number: undefined }),
  mk({ created_at: '2026-12-31T23:30:00Z' }),
  mk({ items: [], total: 0 }),
  mk({ items: [{ product_id: 'x', product_name: null, unit_price: '15000', quantity: 0, color: 'Rouge', size: null }], total: 17000 }),
];
for (const [i, o] of variants.entries()) {
  check(`#${i} numéro de facture et de commande identiques`, pdf.invoiceNumber(o) === invoiceNumber(o) && pdf.orderNumberLabel(o) === orderNumberLabel(o), [pdf.invoiceNumber(o), invoiceNumber(o)]);
  check(`#${i} lignes et totaux identiques`, JSON.stringify(pdf.invoiceBreakdown(o)) === JSON.stringify(invoiceBreakdown(o)), [pdf.invoiceBreakdown(o), invoiceBreakdown(o)]);
}
check('montant : espace normale (jamais l’espace fine insécable des téléphones)', pdf.formatXAF(1234567) === '1 234 567 FCFA' && screenXAF(1234567).replace(/\s/g, ' ') === '1 234 567 FCFA');
check('nom du fichier : Facture-FA-2026-000012.pdf', pdf.invoiceFileName(mk()) === 'Facture-FA-2026-000012.pdf');

// --- texte sûr pour un PDF ---
check('accents du français gardés', pdf.pdfText('Fatimé Ali – Hôtel d’Été « ok »') === 'Fatimé Ali – Hôtel d’Été « ok »', pdf.pdfText('Fatimé Ali – Hôtel d’Été « ok »'));
check('espaces spéciales et « − » remplacés', pdf.pdfText('1 234 FCFA −9 000') === '1 234 FCFA -9 000');
check('arabe et emoji retirés sans erreur', pdf.pdfText('محمد 🎁 Ali') === 'Ali', pdf.pdfText('محمد 🎁 Ali'));
check('nom entièrement arabe : texte vide', pdf.pdfText('محمد') === '');
check('retours à la ligne et tabulations aplatis', pdf.pdfText('a\n\tb\r\nc') === 'a b c');
check('null / undefined : texte vide', pdf.pdfText(null) === '' && pdf.pdfText(undefined) === '');

// --- dessin ---
let lib: any = null;
try {
  lib = await import(process.env.PDF_LIB ?? 'pdf-lib');
  lib = lib.PDFDocument ? lib : lib.default;
} catch {
  lib = null;
}
if (!lib) {
  console.log('SAUTÉ le dessin : pdf-lib introuvable (PDF_LIB=… ou npm i --no-save pdf-lib)');
} else {
  const logo = Uint8Array.from(Buffer.from(LOGO_JPEG_BASE64, 'base64'));
  check('logo : fichier JPEG valide', logo[0] === 0xff && logo[1] === 0xd8 && logo.byteLength < 20000, logo.byteLength);
  const shop = { shop_name: 'Albasse Shopping', address: 'Avenue Mobutu', postal_code: '', city: "N'Djamena", country: 'Tchad', phone: '+235 66 00 00 00', email: 'contact@albasseshopping.com', invoice_legal_line: 'Albasse Shopping · RCCM TD-NDJ-00-0000' };
  const dir = mkdtempSync(path.join(tmpdir(), 'facture-'));
  const text = (bytes: Uint8Array, name: string): string | null => {
    const file = path.join(dir, name);
    writeFileSync(file, bytes);
    try {
      return execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
    } catch {
      return null;
    }
  };
  const pageCount = async (bytes: Uint8Array): Promise<number> => (await lib.PDFDocument.load(bytes)).getPageCount();

  const o1 = mk({ total: 85500, gift_wrap: true, loyalty_discount: 9000, payment_reference: 'AM123' });
  const bytes1 = await pdf.buildInvoicePdf(lib, { order: o1, shop, cityFeeUndefined: false }, logo);
  check('PDF valide (%PDF- … %%EOF)', Buffer.from(bytes1.subarray(0, 5)).toString() === '%PDF-' && Buffer.from(bytes1.subarray(-8)).toString().includes('%%EOF'));
  check('une seule page pour 2 articles', (await pageCount(bytes1)) === 1);
  const t1 = text(bytes1, 'f1.pdf');
  if (t1 === null) console.log('SAUTÉ la relecture du texte : pdftotext absent');
  else {
    const flat = t1.replace(/\s+/g, ' ');
    check('numéro de facture, commande et date écrits', flat.includes('FA-2026-000012') && flat.includes('N° 12') && flat.includes('25 octobre 2026'), flat.slice(0, 200));
    check('client et livraison écrits', flat.includes('Fatimé Ali') && flat.includes('66 12 34 56') && flat.includes('Quartier Farcha, Moundou'));
    check('articles : désignation, variante, quantité, prix', flat.includes('Soulier noir') && flat.includes('Taille 42 · Noir') && flat.includes('Montre') && flat.includes('35 000 FCFA') && flat.includes('70 000 FCFA'));
    check('totaux : articles 90 000, remise -9 000, cadeau 2 000, livraison 2 500, total 85 500', ['90 000 FCFA', '-9 000 FCFA', '2 000 FCFA', '2 500 FCFA', '85 500 FCFA'].every((s) => flat.includes(s)), flat);
    check('paiement avec référence, statut et mention légale écrits', flat.includes('Airtel Money (réf. AM123)') && flat.includes('En attente') && flat.includes('RCCM TD-NDJ-00-0000') && flat.includes('albasseshopping.com'));
    check('pas de mot « COMMANDE ANNULÉE » sur une commande normale', !flat.includes('ANNULÉE'));
  }

  // livraison : gratuite ou à définir (aucun reste)
  const free = text(await pdf.buildInvoicePdf(lib, { order: mk({ total: 90000 }), shop, cityFeeUndefined: false }, logo), 'f2.pdf');
  const undef = text(await pdf.buildInvoicePdf(lib, { order: mk({ total: 90000 }), shop, cityFeeUndefined: true }, logo), 'f3.pdf');
  if (free !== null && undef !== null) {
    check('livraison sans reste : « Gratuite », ou « À définir » si la ville n’a pas de tarif', /Livraison\s+Gratuite/.test(free) && /Livraison\s+À définir/.test(undef), [free.slice(-300)]);
  }

  // commande annulée, nom arabe et emoji, boutique sans réglages, sans logo
  const odd = await pdf.buildInvoicePdf(
    lib,
    { order: mk({ status: 'cancelled', shipping_name: 'محمد', shipping_address: 'حي الفرشة 🏠', items: [{ product_name: 'Parfum 🌹 عود', unit_price: 5000, quantity: 3, color: null, size: null }], total: 15000 }), shop: {}, cityFeeUndefined: false },
    null
  );
  const tOdd = text(odd, 'f4.pdf');
  check('annulée + arabe + emoji + sans réglages + sans logo : le PDF est quand même dessiné', Buffer.from(odd.subarray(0, 5)).toString() === '%PDF-' && (await pageCount(odd)) === 1);
  if (tOdd !== null) check('« COMMANDE ANNULÉE » écrit, client remplacé par « Client », boutique par défaut', tOdd.includes('COMMANDE ANNULÉE') && tOdd.includes('Client') && tOdd.includes('Albasse Shopping') && tOdd.includes('Parfum'), tOdd.slice(0, 300));

  // beaucoup d'articles : plusieurs pages, rien de coupé (les 70 lignes et le total sont là)
  const many = Array.from({ length: 70 }, (_, i) => ({ product_name: `Article numéro ${i + 1} avec un nom assez long pour passer à la ligne dans la colonne de désignation`, unit_price: 1000, quantity: 1, color: 'Bleu', size: 'M' }));
  const big = await pdf.buildInvoicePdf(lib, { order: mk({ items: many, total: 70000 }), shop, cityFeeUndefined: false }, logo);
  const bigPages = await pageCount(big);
  check('70 articles : plusieurs pages', bigPages > 1, bigPages);
  const tBig = text(big, 'f5.pdf');
  if (tBig !== null) check('70 articles : première et dernière ligne et total présents', tBig.includes('Article numéro 1 ') && tBig.includes('Article numéro 70 ') && tBig.includes('70 000 FCFA'));

  // très long mot sans espace (ne dépasse pas, ne plante pas)
  const longWord = await pdf.buildInvoicePdf(lib, { order: mk({ items: [{ product_name: 'X'.repeat(300), unit_price: 100, quantity: 1, color: null, size: null }], total: 100 }), shop, cityFeeUndefined: false }, logo);
  check('un mot de 300 lettres est coupé sans erreur', Buffer.from(longWord.subarray(0, 5)).toString() === '%PDF-');
}

console.log(`\n${ok} vérifications réussies${process.exitCode ? ', ÉCHECS ci-dessus' : ''}`);
