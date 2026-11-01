// Page unique « Café Homme » : albasseshopping.com/cafe (docs/page-cafe.md).
// Une seule page, sans menu ni catégories du site, pour vendre le café aux hommes (catégorie « Vitalité & Énergie Homme »).
// Le prix, la photo et le stock viennent de la vraie fiche « cafe-homme » (rien n'est écrit en dur) ; la commande passe par la page de
// commande du site (admin, facture, alerte Telegram comme les autres commandes).
// Les phrases viennent de la fiche de l'article (préparation rapide, 5 sachets, format à emporter, destiné aux hommes) et des vraies règles
// de la boutique (constants/shopRules). Aucune promesse de santé ni d'effet : seulement ce qui est vrai et écrit sur la fiche.
// Des fonctions pures, sans réseau : tests/email/landing-cafe.test.ts.
import { DEFAULT_AGENCIES, DELIVERY_HOURS, HOME_CITY } from '../constants/shopRules';

export const CAFE_PAGE = {
  // le nom de la page (celui de la catégorie), affiché en haut et dans l'onglet du navigateur
  name: 'Vitalité & Énergie Homme',
  // l'adresse de la page (albasseshopping.com/cafe, et aussi /vitalite-energie-homme) : voir RootNavigator
  path: 'cafe',
  // la fiche de l'article vendu sur cette page
  slug: 'cafe-homme',
  badge: 'POUR HOMME',
  subtitle: 'Lot de 5 sachets individuels',
} as const;

// La livraison se fait dans une enveloppe kaki (demande du patron) : le colis est préparé ainsi par l'équipe
export const CAFE_ENVELOPE = 'Livraison dans une enveloppe kaki';

export const CAFE_POINTS: { icon: string; text: string }[] = [
  { icon: '☕', text: 'Préparation rapide' },
  { icon: '📦', text: '5 sachets individuels dans le lot' },
  { icon: '🎒', text: 'Format pratique à emporter' },
  { icon: '👨', text: 'Produit destiné aux hommes' },
  { icon: '✉️', text: CAFE_ENVELOPE },
];

export const CAFE_FACTS: { icon: string; title: string; text: string }[] = [
  { icon: '🚚', title: 'Livraison', text: `Votre commande est livrée dans une enveloppe kaki, à ${HOME_CITY} et dans les villes de province (${DEFAULT_AGENCIES}). Les services de livraison travaillent de ${DELIVERY_HOURS}.` },
  { icon: '💵', title: 'Paiement', text: `À la livraison à ${HOME_CITY}. Dans les autres villes : Airtel Money ou Moov Money, à l’avance.` },
  { icon: '↩️', title: 'Retour', text: 'Article incorrect ou défectueux : écrivez-nous dans les 72 heures après la réception, avec une photo ou une vidéo.' },
];

interface CafeProductLike {
  is_active?: boolean;
  stock?: number | null;
  sizes?: string[] | null;
  colors?: string[] | null;
}

export type CafeStatus = 'loading' | 'missing' | 'soldout' | 'ready';

// loading : la fiche n'est pas encore arrivée ; missing : introuvable ou retirée de la vente ; soldout : stock à 0 ; ready : on peut commander
export function cafeStatus(product: CafeProductLike | null | undefined, isLoading: boolean): CafeStatus {
  if (!product) return isLoading ? 'loading' : 'missing';
  if (product.is_active === false) return 'missing';
  if (!(Number(product.stock ?? 0) > 0)) return 'soldout';
  return 'ready';
}

// Le stock bas n'est dit que s'il est vrai : de 1 à 10 exemplaires. Au-dessus (ou épuisé) : rien.
export const LOW_STOCK_MAX = 10;
export const cafeLowStock = (stock: number | null | undefined): number | null => {
  const n = Number(stock ?? 0);
  return n >= 1 && n <= LOW_STOCK_MAX ? n : null;
};

// La page n'a ni tailles ni couleurs à choisir : si un jour la fiche en reçoit plusieurs, « Commander » ouvre la fiche de l'article (le client choisit là)
export const cafeNeedsChoice = (product: CafeProductLike): boolean => (product.sizes?.length ?? 0) > 1 || (product.colors?.length ?? 0) > 1;

// Lien WhatsApp d'une question sur le café (numéro : chiffres seulement ; indicatif du Tchad ajouté pour un numéro local à 8 chiffres)
export function cafeWhatsAppUrl(rawNumber: string | null | undefined, fallbackDigits = '23560605151'): string {
  const digits = String(rawNumber ?? '').replace(/[^0-9]/g, '');
  const full = digits.length === 8 ? `235${digits}` : digits.length >= 10 ? digits : fallbackDigits;
  return `https://wa.me/${full}?text=${encodeURIComponent('Bonjour, j’ai une question sur le Café Homme.')}`;
}
