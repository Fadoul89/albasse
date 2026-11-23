// Où mène « PROFITER DE L'OFFRE » (src/lib/promoTarget.ts). Fonctions pures, aucun réseau.
// Lancer : node --import ./tests/zara/register.mjs tests/shop/promo-target.test.ts
import { promoAction, promoWhatsappText, promoWhatsappUrl, promoTargetLabel, NO_TARGET_WARNING } from '../../src/lib/promoTarget.ts';

let ok = 0;
const check = (label: string, cond: unknown, detail?: unknown) => {
  if (cond) { ok++; console.log('OK   ', label); } else { console.log('ECHEC', label, detail === undefined ? '' : JSON.stringify(detail)); process.exitCode = 1; }
};

const products = [{ id: 'p1', slug: 'ensemble-safari', name: 'Ensemble safari ', is_active: true }, { id: 'p2', slug: 'vieux', name: 'Vieux', is_active: false }];
const categories = [{ id: 'c1', slug: 'chaussures', name: 'Chaussures' }];
const cadeau = { name: 'Cadeau', message: "Offre unique jusqu'à fin de mois \n4XL 3XL 2XL XL", product_id: null, category_id: null, image_url: 'https://x.supabase.co/storage/v1/object/public/product-images/a.jpeg' };

check('ciblage « Produit précis » : la fiche de l\'article', JSON.stringify(promoAction({ ...cadeau, product_id: 'p1' }, products, categories)) === JSON.stringify({ kind: 'product', slug: 'ensemble-safari' }));
check('ciblage « Catégorie » : la page de la catégorie', JSON.stringify(promoAction({ ...cadeau, category_id: 'c1' }, products, categories)) === JSON.stringify({ kind: 'category', slug: 'chaussures' }));
const a = promoAction(cadeau, products, categories);
check('sans ciblage : WhatsApp (avant : la fenêtre se fermait, le client restait où il était)', a.kind === 'whatsapp' && a.url.startsWith('https://wa.me/23599221017?text='), a);
check('article ciblé plus en vente ou supprimé : WhatsApp', promoAction({ ...cadeau, product_id: 'p2' }, products, categories).kind === 'whatsapp' && promoAction({ ...cadeau, product_id: 'zz' }, products, categories).kind === 'whatsapp');
check('catégorie ciblée supprimée : WhatsApp', promoAction({ ...cadeau, category_id: 'zz' }, products, categories).kind === 'whatsapp');

const t = promoWhatsappText(cadeau, 'Aminata');
check('message : bonjour, le prénom, le nom de l\'offre', t.startsWith("Bonjour Albasse Shopping 👋 C'est Aminata.\nJe veux profiter de l'offre « Cadeau » :"), t);
check('message : le texte de l\'offre et la photo (la boutique sait de quel article il s\'agit)', t.includes('4XL 3XL 2XL XL') && t.includes("Photo de l'offre : https://x.supabase.co/storage/v1/object/public/product-images/a.jpeg"), t);
check('visiteur sans compte : pas de prénom', promoWhatsappText(cadeau, null).startsWith('Bonjour Albasse Shopping 👋\nJe veux'));
check('{prenom} dans le texte de l\'offre : remplacé', promoWhatsappText({ ...cadeau, message: 'Pour toi {prenom} !' }, 'Ali').includes('Pour toi Ali !') && promoWhatsappText({ ...cadeau, message: 'Pour toi {prenom} !' }, null).includes('Pour toi cher client !'));
check('offre sans texte ni photo : message court et propre', promoWhatsappText({ ...cadeau, message: '  ', image_url: null }, null) === "Bonjour Albasse Shopping 👋\nJe veux profiter de l'offre « Cadeau ».");
check('le lien WhatsApp contient tout le message (encodé)', decodeURIComponent(promoWhatsappUrl(cadeau, 'Aminata').split('?text=')[1]) === t);

check('admin : « Ouvre l\'article : Ensemble safari »', promoTargetLabel({ product_id: 'p1', category_id: null }, products, categories).text === "🎯 Ouvre l'article : Ensemble safari" && !promoTargetLabel({ product_id: 'p1', category_id: null }, products, categories).warn);
check('admin : « Ouvre la catégorie : Chaussures »', promoTargetLabel({ product_id: null, category_id: 'c1' }, products, categories).text === '🎯 Ouvre la catégorie : Chaussures');
check('admin : sans ciblage → avertissement WhatsApp', promoTargetLabel({ product_id: null, category_id: null }, products, categories).warn && /Sans ciblage/.test(promoTargetLabel({ product_id: null, category_id: null }, products, categories).text));
check('admin : article plus en vente → avertissement', promoTargetLabel({ product_id: 'p2', category_id: null }, products, categories).warn);
check('avertissement du formulaire : dit quoi faire', /Produit précis/.test(NO_TARGET_WARNING) && /WhatsApp/.test(NO_TARGET_WARNING));

console.log(process.exitCode ? '\nIL Y A DES ECHECS' : `\nTOUS LES CONTROLES REUSSIS (${ok})`);
