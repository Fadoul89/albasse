// Contenu des e-mails de commande (reçue, livrée) : des fonctions pures, sans réseau ni base, testées dans tests/email/order-emails.test.ts.
// Les faits (articles, prix, total, ville, paiement) viennent de la commande dans la base, jamais d'un texte envoyé par l'application.

export const FAKE_DOMAIN = "@tel.albasseshopping.com";
export const SITE = "https://www.albasseshopping.com";

// mêmes règles que la boutique (src/constants/shopRules.ts et src/lib/loyaltyDiscount.ts)
const PAYMENT = { airtel: "60 60 51 51", moov: "99 22 10 17" };
const DELIVERY_HOURS = "8h30 à 16h";
const GIFT_WRAP_FEE = 2000;
export const LOYALTY_MIN_DELIVERED = 6;

export interface OrderItemRow {
  product_name: string;
  unit_price: number;
  quantity: number;
  color?: string | null;
  size?: string | null;
}
export interface OrderRow {
  id: string;
  order_number?: number | null; // numéro de commande donné par la base (1, 2, 3…)
  items: OrderItemRow[];
  total: number;
  payment_method: string;
  shipping_city?: string | null;
  gift_wrap?: boolean | null;
  loyalty_discount?: number | null;
}
export interface Loyalty {
  delivered: number; // commandes livrées, celle-ci comprise
  used: boolean; // remise déjà utilisée
}

// les comptes créés avec un numéro de téléphone ont une fausse adresse (numéro@tel.albasseshopping.com) : on n'y écrit jamais
export const realEmail = (v: unknown): string | null => {
  const e = typeof v === "string" ? v.trim() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.toLowerCase().endsWith(FAKE_DOMAIN) ? e : null;
};
export const mask = (e: string) => e.replace(/^(.{2}).*(@.*)$/, "$1***$2");
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// 22 500 FCFA (espaces insécables : le montant ne se coupe pas en fin de ligne)
export const fmt = (n: number) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
export const orderRef = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();
// « 12 » (numéro de commande) ; l'ancien repère de 8 caractères tant que la commande n'a pas de numéro
export const orderLabel = (o: { id: string; order_number?: number | null }) => (o.order_number ? String(o.order_number) : orderRef(o.id));
export const invoiceLink = (id: string) => `${SITE}/facture/${id}`;
export const firstName = (full: unknown) => String(full ?? "").trim().split(/\s+/)[0] || "";

// Mise en page commune des e-mails de la boutique
export function layout(title: string, bodyHtml: string, footerNote = "Cet e-mail concerne votre commande.", footerHtml = ""): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1d2433">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#062266;padding:14px 24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:12px"><img src="${SITE}/icon-192.png" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:22px"></td><td style="color:#e8c46c;font-size:20px;font-weight:bold;font-family:Arial,Helvetica,sans-serif">Albasse Shopping</td></tr></table></td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 12px;font-size:20px;color:#062266">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;background:#f4f4f7;font-size:12px;color:#6b7280">Albasse Shopping, N'Djamena, Tchad · albasseshopping.com<br>${escapeHtml(footerNote)}${footerHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

export const para = (html: string) => `<p style="font-size:15px;line-height:22px;margin:0 0 12px">${html}</p>`;
export const button = (href: string, label: string) =>
  `<p style="margin:18px 0 6px"><a href="${href}" style="background:#062266;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:24px;font-size:14px;font-weight:bold;display:inline-block">${escapeHtml(label)}</a></p>`;

function itemsTable(order: OrderRow): string {
  const rows = (order.items ?? [])
    .map((i) => {
      const variant = [i.size ? `Taille ${i.size}` : "", i.color ?? ""].filter(Boolean).join(" · ");
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #eceef3;font-size:14px">${escapeHtml(String(i.product_name ?? "").replace(/\s+/g, " ").trim())}${
        variant ? `<br><span style="color:#6b7280;font-size:12px">${escapeHtml(variant)}</span>` : ""
      }</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid #eceef3;font-size:14px;text-align:right;white-space:nowrap">${Number(i.quantity) || 1} × ${fmt(i.unit_price)}</td></tr>`;
    })
    .join("");
  const extra: string[] = [];
  if (order.gift_wrap) extra.push(`<tr><td style="padding:8px 0;font-size:14px">🎁 Emballage cadeau</td><td style="padding:8px 0;font-size:14px;text-align:right;white-space:nowrap">${fmt(GIFT_WRAP_FEE)}</td></tr>`);
  const disc = Number(order.loyalty_discount) || 0;
  if (disc > 0) extra.push(`<tr><td style="padding:8px 0;font-size:14px">Remise fidélité −10 %</td><td style="padding:8px 0;font-size:14px;text-align:right;white-space:nowrap">−${fmt(disc)}</td></tr>`);
  extra.push(`<tr><td style="padding:10px 0;font-size:15px;font-weight:bold">Total</td><td style="padding:10px 0;font-size:15px;font-weight:bold;text-align:right;white-space:nowrap">${fmt(order.total)}</td></tr>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 14px">${rows}${extra.join("")}</table>`;
}

export function paymentLine(method: string): string {
  if (method === "cash_on_delivery") return "Paiement à la livraison.";
  if (method === "airtel_money") return `Paiement Airtel Money : envoyez le montant au ${PAYMENT.airtel}. Votre commande est valable 48 heures.`;
  if (method === "moov_money") return `Paiement Moov Money : envoyez le montant au ${PAYMENT.moov}. Votre commande est valable 48 heures.`;
  if (method === "stripe") return "Paiement par carte.";
  return "";
}

export function orderReceivedEmail(order: OrderRow, fullName: unknown): { subject: string; html: string } {
  const ref = orderLabel(order);
  const name = firstName(fullName);
  const city = String(order.shipping_city ?? "").trim();
  const pay = paymentLine(order.payment_method);
  const html = layout(
    "Commande reçue ✅",
    para(`Bonjour${name ? ` ${escapeHtml(name)}` : ""},`) +
      para(`Merci ! Nous avons bien reçu votre commande <b>n° ${ref}</b>.`) +
      itemsTable(order) +
      (city ? para(`🚚 Livraison à <b>${escapeHtml(city)}</b>. Nos services de livraison sont ouverts de ${DELIVERY_HOURS}.`) : "") +
      (pay ? para(escapeHtml(pay)) : "") +
      button(`${SITE}/mes-commandes`, "Suivre mes commandes") +
      para(`🧾 <a href="${invoiceLink(order.id)}" style="color:#062266;font-weight:bold">Voir ma facture</a> (connectez-vous avec votre compte pour l'ouvrir).`)
  );
  return { subject: `Commande reçue n° ${ref} — Albasse Shopping`, html };
}

// Remise fidélité : −10 % à la 7ᵉ commande, c'est-à-dire après 6 commandes livrées ; une seule fois par client.
export function loyaltyLine(l: Loyalty): string {
  if (l.used) return "";
  if (l.delivered >= LOYALTY_MIN_DELIVERED) return "🎁 Bonne nouvelle : votre prochaine commande bénéficie de −10 % sur les articles.";
  const n = LOYALTY_MIN_DELIVERED - l.delivered;
  return `Encore ${n} commande${n > 1 ? "s" : ""} livrée${n > 1 ? "s" : ""}, et votre commande suivante aura −10 % sur les articles.`;
}

export function orderDeliveredEmail(order: OrderRow, fullName: unknown, loyalty: Loyalty): { subject: string; html: string } {
  const ref = orderLabel(order);
  const name = firstName(fullName);
  const fidelity = loyaltyLine(loyalty);
  const html = layout(
    "Commande livrée 🎉",
    para(`Bonjour${name ? ` ${escapeHtml(name)}` : ""},`) +
      para(`Votre commande <b>n° ${ref}</b> a été livrée. Merci de votre confiance !`) +
      (fidelity ? para(escapeHtml(fidelity)) : "") +
      para("Un souci avec votre commande ? Répondez simplement à cet e-mail, nous vous aidons.") +
      button(`${SITE}/mes-commandes`, "Voir mes commandes") +
      para(`🧾 <a href="${invoiceLink(order.id)}" style="color:#062266;font-weight:bold">Voir ma facture</a>`)
  );
  return { subject: `Votre commande n° ${ref} est livrée 🎉`, html };
}

// E-mail de bienvenue, envoyé une seule fois après la création du compte (texte du patron ; la dernière phrase tient compte du compte déjà créé).
export function welcomeEmail(fullName: unknown): { subject: string; html: string } {
  const name = firstName(fullName);
  const why = [
    "Des articles pour tous les goûts et tous les budgets",
    "Une expérience d’achat simple et pratique",
    "Livraison partout au Tchad 🇹🇩",
    "Un service client à votre écoute",
  ]
    .map((l) => `<tr><td style="padding:3px 0;font-size:15px;line-height:22px">✅ ${escapeHtml(l)}</td></tr>`)
    .join("");
  const html = layout(
    "Bienvenue sur Albasse Shopping ! 🎉",
    para(`Bonjour${name ? ` ${escapeHtml(name)}` : ""} et bienvenue ! ❤️`) +
      para(`Nous sommes ravis de vous accueillir sur 🌐 <b>www.albasseshopping.com</b>, votre plateforme de vente en ligne 100 % tchadienne 🇹🇩.`) +
      para("Découvrez une large sélection de vêtements, chaussures, parfums, montres et accessoires pour tous les styles et tous les budgets.") +
      para("<b>✨ Pourquoi choisir Albasse Shopping ?</b>") +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px">${why}</table>` +
      para("🤝 Merci de nous faire confiance et de rejoindre notre grande famille !") +
      para("🛒 Votre compte est créé : profitez pleinement de votre expérience shopping.") +
      button(SITE, "Découvrir nos articles"),
    "Vous recevez cet e-mail parce que vous venez de créer un compte sur albasseshopping.com."
  );
  return { subject: "Bienvenue chez Albasse Shopping ! 🎉", html };
}
