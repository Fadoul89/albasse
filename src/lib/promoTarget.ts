// Où mène le bouton « PROFITER DE L'OFFRE » d'une promotion intelligente (demande du patron, 23 novembre 2026 : « sans URL, comment le
// client peut bénéficier ? »). Avec un ciblage : la fiche de l'article ou la page de la catégorie. SANS ciblage (ou si l'article /
// la catégorie n'existe plus) : WhatsApp, avec l'offre déjà écrite ; avant, la fenêtre se fermait et le client restait où il était.
// Fonctions pures (tests/shop/promo-target.test.ts).
import { ORDER_WHATSAPP } from '../constants/shopRules';

export type PromoAction = { kind: 'product'; slug: string } | { kind: 'category'; slug: string } | { kind: 'whatsapp'; url: string };

interface PromoLike {
  name: string;
  message: string;
  product_id: string | null;
  category_id: string | null;
  image_url?: string | null;
}

// le message WhatsApp : l'offre, son texte et la photo (pour que la boutique sache tout de suite de quel article il s'agit)
export function promoWhatsappText(promo: PromoLike, firstName?: string | null): string {
  const name = promo.name.trim();
  const msg = promo.message.replace(/\{prenom\}/gi, firstName?.trim() || 'cher client').trim();
  const lines = [
    `Bonjour Albasse Shopping 👋${firstName?.trim() ? ` C'est ${firstName.trim()}.` : ''}`,
    `Je veux profiter de l'offre « ${name} »${msg ? ' :' : '.'}`,
    ...(msg ? [msg] : []),
    ...(promo.image_url ? [`Photo de l'offre : ${promo.image_url}`] : []),
  ];
  return lines.join('\n');
}

export const promoWhatsappUrl = (promo: PromoLike, firstName?: string | null): string =>
  `https://wa.me/${ORDER_WHATSAPP}?text=${encodeURIComponent(promoWhatsappText(promo, firstName))}`;

export function promoAction(
  promo: PromoLike,
  products: { id: string; slug: string; is_active?: boolean }[],
  categories: { id: string; slug: string }[],
  firstName?: string | null,
): PromoAction {
  const product = promo.product_id ? products.find((p) => p.id === promo.product_id && p.is_active !== false) : undefined;
  if (product) return { kind: 'product', slug: product.slug };
  const category = promo.category_id ? categories.find((c) => c.id === promo.category_id) : undefined;
  if (category) return { kind: 'category', slug: category.slug };
  return { kind: 'whatsapp', url: promoWhatsappUrl(promo, firstName) };
}

// dans l'admin : ce que fait le bouton de chaque promotion
export function promoTargetLabel(
  promo: { product_id: string | null; category_id: string | null },
  products: { id: string; name: string; is_active?: boolean }[],
  categories: { id: string; name: string }[],
): { text: string; warn: boolean } {
  if (promo.product_id) {
    const p = products.find((x) => x.id === promo.product_id);
    if (p && p.is_active !== false) return { text: `🎯 Ouvre l'article : ${p.name.trim()}`, warn: false };
    return { text: "⚠️ L'article ciblé n'est plus en vente : le bouton ouvre WhatsApp", warn: true };
  }
  if (promo.category_id) {
    const c = categories.find((x) => x.id === promo.category_id);
    if (c) return { text: `🎯 Ouvre la catégorie : ${c.name.trim()}`, warn: false };
    return { text: "⚠️ La catégorie ciblée n'existe plus : le bouton ouvre WhatsApp", warn: true };
  }
  return { text: '⚠️ Sans ciblage : le bouton ouvre WhatsApp (offre déjà écrite)', warn: true };
}

export const NO_TARGET_WARNING =
  "⚠️ Sans ciblage, le bouton « PROFITER DE L'OFFRE » n'ouvre aucun article : il ouvre WhatsApp avec l'offre déjà écrite. Pour emmener le client directement sur l'article, choisissez « Produit précis » (ou « Catégorie »).";
