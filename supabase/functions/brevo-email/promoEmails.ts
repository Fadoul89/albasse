// E-mail publicitaire aux clients absents depuis 7 jours : des fonctions pures, sans réseau ni base, testées dans tests/email/promo-emails.test.ts.
// Les articles, les prix et la vente flash viennent de la base (jamais d'un texte envoyé par l'application) ; rien n'est inventé.
import { BRAND, FOOTER_LINK_STYLE, SITE, button, escapeHtml, firstName, fmt, layout, para } from "./orderEmails.ts";

export interface PromoProduct {
  id: string;
  name: string;
  slug?: string | null;
  price: number;
  compare_at_price?: number | null;
  images?: string[] | null;
  is_flash_sale?: boolean | null;
  flash_sale_ends_at?: string | null;
  created_at?: string | null;
}

export const MAX_PROMO_PRODUCTS = 4;

const isFlashNow = (p: PromoProduct, now: number) => p.is_flash_sale === true && !!p.flash_sale_ends_at && Date.parse(p.flash_sale_ends_at) > now;
const isReduced = (p: PromoProduct) => Number(p.compare_at_price) > Number(p.price) && Number(p.price) > 0;

// Les ventes flash en cours d'abord (la fin la plus proche en premier), puis les articles les plus récents.
export function pickProducts(rows: PromoProduct[], now: number, max = MAX_PROMO_PRODUCTS): { products: PromoProduct[]; flashEndsAt: string | null } {
  const usable = rows.filter((p) => p && p.name && Number(p.price) > 0);
  const flash = usable.filter((p) => isFlashNow(p, now)).sort((a, b) => Date.parse(a.flash_sale_ends_at!) - Date.parse(b.flash_sale_ends_at!));
  const rest = usable.filter((p) => !isFlashNow(p, now)).sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "") || 0);
  const products = [...flash, ...rest].slice(0, max);
  return { products, flashEndsAt: flash.length ? flash[0].flash_sale_ends_at ?? null : null };
}

// « 28 octobre » (jour de N'Djamena)
const dayLabel = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Ndjamena" }).format(new Date(iso));

const productUrl = (p: PromoProduct) => (p.slug ? `${SITE}/produit/${encodeURIComponent(p.slug)}` : SITE);
const imageUrl = (p: PromoProduct) => {
  const u = (p.images ?? []).find((i) => typeof i === "string" && /^https:\/\//i.test(i));
  return u ? u.replace(/"/g, "%22") : null;
};

function productRow(p: PromoProduct): string {
  const img = imageUrl(p);
  const reduced = isReduced(p);
  const off = reduced ? Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100) : 0;
  const href = productUrl(p);
  return `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${BRAND.silver};width:84px;vertical-align:top">${
    img ? `<a href="${href}"><img src="${img}" width="72" height="72" alt="" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:8px"></a>` : ""
  }</td>
<td style="padding:10px 0 10px 8px;border-bottom:1px solid ${BRAND.silver};vertical-align:top;font-size:14px;line-height:20px"><a href="${href}" style="color:#1d2433;text-decoration:none;font-weight:bold">${escapeHtml(
    String(p.name).replace(/\s+/g, " ").trim()
  )}</a><br><span style="font-size:15px;color:${BRAND.violet};font-weight:bold">${fmt(Number(p.price))}</span>${
    reduced ? ` <span style="color:#6b7280;text-decoration:line-through;font-size:12px">${fmt(Number(p.compare_at_price))}</span> <span style="background:${BRAND.gold};color:${BRAND.violet};font-size:12px;font-weight:bold;padding:2px 7px;border-radius:10px">−${off} %</span>` : ""
  }</td></tr>`;
}

export function inactiveClientEmail(input: {
  fullName: unknown;
  products: PromoProduct[];
  flashEndsAt: string | null;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const name = firstName(input.fullName);
  const flash = !!input.flashEndsAt;
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 14px">${input.products.map(productRow).join("")}</table>`;
  const html = layout(
    flash ? "Vente flash en cours 🔥" : "Les articles du moment 🛍️",
    para(`Bonjour${name ? ` ${escapeHtml(name)}` : ""}, vous nous manquez !`) +
      para(flash ? `🔥 Une vente flash est en cours sur Albasse Shopping, jusqu'au <b>${escapeHtml(dayLabel(input.flashEndsAt!))}</b>. Voici une sélection :` : "Voici une sélection d'articles du moment sur Albasse Shopping :") +
      table +
      button(SITE, "Voir tous les articles") +
      para("🚚 Livraison partout au Tchad 🇹🇩"),
    "Vous recevez cet e-mail parce que vous avez accepté de recevoir nos promotions sur albasseshopping.com.",
    `<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="${FOOTER_LINK_STYLE}">Me désinscrire des e-mails publicitaires</a>`
  );
  const subject = flash ? "🔥 Vente flash en cours chez Albasse Shopping" : name ? `${name}, les articles du moment vous attendent 🛍️` : "Les articles du moment chez Albasse Shopping 🛍️";
  return { subject, html };
}
