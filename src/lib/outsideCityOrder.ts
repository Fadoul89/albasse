// Villes hors N'Djamena quand Airtel Money et Moov Money sont retirés (shopRules.MOBILE_MONEY_ENABLED = false) : le client ne paie pas sur le site,
// il envoie sa commande sur WhatsApp (même numéro et même présentation que « Commander sur WhatsApp » de la fiche article). Des fonctions pures.
import { HOME_CITY, ORDER_WHATSAPP } from '../constants/shopRules';

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export interface OutsideOrderInput {
  productName: string;
  price: number; // prix d'une unité
  quantity?: number;
  variant?: string | null; // « Taille 42 · Noir »
  city?: string | null;
  siteUrl?: string | null; // lien de la fiche article
}

// Le message WhatsApp prêt à envoyer (le client n'a plus qu'à appuyer sur « Envoyer »)
export function outsideOrderMessage(input: OutsideOrderInput): string {
  const qty = Math.max(1, Math.floor(input.quantity ?? 1));
  const lines = ['Bonjour Albasse Shopping, je veux commander :', `🛍️ ${input.productName.trim()}`];
  if (input.variant && input.variant.trim()) lines.push(`🎨 ${input.variant.trim()}`);
  lines.push(`💰 Prix : ${fcfa(input.price)}`, `🔢 Quantité : ${qty}`);
  if (input.city && input.city.trim()) lines.push(`📍 Ville : ${input.city.trim()}`);
  if (input.siteUrl) lines.push(`🔗 ${input.siteUrl}`);
  return lines.join('\n');
}

export const outsideOrderUrl = (input: OutsideOrderInput): string => `https://wa.me/${ORDER_WHATSAPP}?text=${encodeURIComponent(outsideOrderMessage(input))}`;

// Les phrases de la page de commande et de Zara (français / arabe)
export const OUTSIDE_TEXT = {
  fr: {
    title: 'Commande sur WhatsApp',
    body: (city: string) =>
      `Pour le moment, les commandes pour ${city} se prennent sur WhatsApp : nous notons votre commande avec vous et vous disent comment payer. À ${HOME_CITY}, vous commandez ici et vous payez à la livraison.`,
    button: '💬 Commander sur WhatsApp',
  },
  ar: {
    title: 'الطلب عبر واتساب',
    body: (city: string) => `حالياً، تُؤخذ الطلبات إلى ${city} عبر واتساب: نسجّل طلبك معك ونشرح لك طريقة الدفع. في إنجامينا، تطلب هنا وتدفع عند الاستلام.`,
    button: '💬 اطلب عبر واتساب',
  },
} as const;
