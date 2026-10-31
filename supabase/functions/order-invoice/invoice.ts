// La facture PDF d'une commande : mêmes chiffres, mêmes lignes et même mise en page que l'écran « Facture » du site (src/screens/InvoiceScreen.tsx).
// Sans réseau ni base : la bibliothèque PDF (pdf-lib) est reçue en paramètre, donc ce fichier se teste tel quel (tests/email/invoice-pdf.test.ts).
// Les calculs (numéro de facture, remise, emballage, livraison = le reste du total) répètent src/lib/invoice.ts : le test compare les deux.

export const GIFT_WRAP_FEE = 2000; // = src/constants/shopRules.ts

export const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export const PAYMENT_LABELS: Record<string, string> = {
  airtel_money: "Airtel Money",
  moov_money: "Moov Money",
  cash_on_delivery: "Paiement à la livraison",
  stripe: "Carte bancaire",
};

export interface InvoiceOrder {
  id: string;
  order_number?: number | null;
  items: { product_name?: string | null; unit_price?: number | null; quantity?: number | null; color?: string | null; size?: string | null }[] | null;
  total: number;
  status: string;
  payment_method: string;
  payment_reference?: string | null;
  shipping_name?: string | null;
  shipping_phone?: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  gift_wrap?: boolean | null;
  loyalty_discount?: number | null;
  created_at: string;
}

export interface InvoiceShop {
  shop_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  invoice_legal_line?: string | null;
}

export interface InvoiceData {
  order: InvoiceOrder;
  shop: InvoiceShop;
  /** la ville de livraison existe et ses frais sont « à définir » (delivery_fee vide) */
  cityFeeUndefined: boolean;
}

// --- textes ------------------------------------------------------------------------------------------------------------------------------

// Les polices standard d'un PDF ne connaissent que l'alphabet latin (WinAnsi) : on garde les lettres accentuées du français et on retire le reste
// (arabe, emoji…) au lieu de faire échouer toute la facture. Les espaces spéciales et le « − » deviennent des signes simples.
export function pdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u00A0\u202F\u2007\u2009\u200A]/g, " ")
    .replace(/\u2212/g, "-")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF\u2018\u2019\u201C\u201D\u2013\u2014\u2022\u20AC\u2026]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const frNumber = (n: number) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
export const formatXAF = (n: number) => `${frNumber(n)} FCFA`;

// « N° 12 » (ou l'ancien repère #0C7E6708 tant que le script add-order-numbers-invoices.sql n'est pas lancé)
export const orderNumberLabel = (o: Pick<InvoiceOrder, "id" | "order_number">) => (o.order_number ? `N° ${o.order_number}` : `#${o.id.slice(0, 8)}`);

// Facture n° FA-2026-000012 : l'année du jour de la commande à N'Djamena (UTC+1), puis le numéro de commande sur 6 chiffres
export function invoiceNumber(o: Pick<InvoiceOrder, "id" | "order_number" | "created_at">): string {
  const year = new Date(Date.parse(o.created_at) + 3600_000).getUTCFullYear();
  return o.order_number ? `FA-${year}-${String(o.order_number).padStart(6, "0")}` : `FA-${year}-${o.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export const dateLabel = (iso: string) =>
  new Date(Date.parse(iso) + 3600_000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export interface InvoiceRow {
  name: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
export interface InvoiceBreakdown {
  rows: InvoiceRow[];
  itemsTotal: number;
  loyaltyDiscount: number;
  giftWrap: number;
  delivery: number;
  total: number;
}

// La commande ne garde pas les frais de livraison à part : total = articles − remise fidélité + emballage + livraison, donc livraison = le reste.
export function invoiceBreakdown(order: Pick<InvoiceOrder, "items" | "total" | "gift_wrap" | "loyalty_discount">): InvoiceBreakdown {
  const rows = (order.items ?? []).map((i) => {
    const quantity = Number(i.quantity) || 1;
    const unitPrice = Number(i.unit_price) || 0;
    const variant = [i.size ? `Taille ${i.size}` : "", i.color ?? ""].filter(Boolean).join(" · ");
    return { name: String(i.product_name ?? "").replace(/\s+/g, " ").trim(), variant, quantity, unitPrice, total: unitPrice * quantity };
  });
  const itemsTotal = rows.reduce((s, r) => s + r.total, 0);
  const loyaltyDiscount = Number(order.loyalty_discount) || 0;
  const giftWrap = order.gift_wrap ? GIFT_WRAP_FEE : 0;
  const total = Number(order.total) || 0;
  const delivery = Math.max(0, total - (itemsTotal - loyaltyDiscount + giftWrap));
  return { rows, itemsTotal, loyaltyDiscount, giftWrap, delivery, total };
}

export const invoiceFileName = (o: Pick<InvoiceOrder, "id" | "order_number" | "created_at">) => `Facture-${invoiceNumber(o)}.pdf`;

// --- dessin --------------------------------------------------------------------------------------------------------------------------------

// Ce que le dessin attend de pdf-lib (reçu en paramètre : « npm:pdf-lib » côté serveur, « pdf-lib » dans les tests)
export interface PdfLib {
  PDFDocument: { create(): Promise<any> };
  StandardFonts: { Helvetica: string; HelveticaBold: string };
  rgb(r: number, g: number, b: number): unknown;
}

const hex = (rgb: PdfLib["rgb"], h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 42;

// logoImage : le fichier du logo (PNG ou JPEG, reconnu à ses premiers octets) ou null : sans logo, la facture reste complète
export async function buildInvoicePdf(lib: PdfLib, data: InvoiceData, logoImage: Uint8Array | null): Promise<Uint8Array> {
  const { order, shop } = data;
  const b = invoiceBreakdown(order);
  const doc = await lib.PDFDocument.create();
  const regular = await doc.embedFont(lib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold);
  let logo: any = null;
  if (logoImage) {
    try {
      const isPng = logoImage[0] === 0x89 && logoImage[1] === 0x50;
      logo = isPng ? await doc.embedPng(logoImage) : await doc.embedJpg(logoImage);
    } catch {
      logo = null; // logo illisible : pas de logo
    }
  }

  // Les 3 couleurs du patron (comme les e-mails) : violet aubergine (bande, titres, en-tête du tableau, total), doré (filet, chiffres sur violet),
  // argenté (traits). Le doré n'est jamais un texte sur fond blanc (trop pâle) : il sert de filet ou de texte sur le violet.
  const INK = hex(lib.rgb, "#1d2433");
  const MUTED = hex(lib.rgb, "#5b6475");
  const LINE = hex(lib.rgb, "#C0C0C0");
  const VIOLET = hex(lib.rgb, "#4B0082");
  const GOLD = hex(lib.rgb, "#D4AF37");
  const SILVER_LIGHT = hex(lib.rgb, "#EDEDF2");
  const RED = hex(lib.rgb, "#c0262d"); // « commande annulée » : un statut, il reste rouge

  const number = invoiceNumber(order);
  doc.setTitle(`Facture ${number}`);
  doc.setAuthor(pdfText(shop.shop_name) || "Albasse Shopping");
  doc.setSubject(`Commande ${orderNumberLabel(order)}`);

  // la bande violette et son filet doré, en haut de chaque page (dans la marge : rien ne se décale)
  const band = (pg: any) => {
    pg.drawRectangle({ x: 0, y: A4.h - 14, width: A4.w, height: 14, color: VIOLET });
    pg.drawRectangle({ x: 0, y: A4.h - 17.5, width: A4.w, height: 3.5, color: GOLD });
  };
  let page = doc.addPage([A4.w, A4.h]);
  band(page);
  let y = A4.h - MARGIN;
  const right = A4.w - MARGIN;
  const width = (font: any, size: number, text: string) => font.widthOfTextAtSize(text, size);

  const text = (t: string, x: number, yy: number, size: number, opts: { font?: any; color?: unknown; alignRight?: boolean } = {}) => {
    const font = opts.font ?? regular;
    const s = pdfText(t);
    if (!s) return;
    const dx = opts.alignRight ? -width(font, size, s) : 0;
    page.drawText(s, { x: x + dx, y: yy, size, font, color: opts.color ?? INK });
  };

  // coupe un texte en lignes qui tiennent dans maxWidth
  const wrap = (t: string, font: any, size: number, maxWidth: number): string[] => {
    const words = pdfText(t).split(" ").filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (width(font, size, next) <= maxWidth) {
        cur = next;
      } else {
        if (cur) lines.push(cur);
        // un mot plus long que la ligne : on le coupe
        let rest = w;
        while (width(font, size, rest) > maxWidth && rest.length > 1) {
          let n = rest.length - 1;
          while (n > 1 && width(font, size, rest.slice(0, n)) > maxWidth) n--;
          lines.push(rest.slice(0, n));
          rest = rest.slice(n);
        }
        cur = rest;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  // --- en-tête : boutique à gauche, FACTURE à droite
  const logoSize = 54;
  const topY = y;
  let leftX = MARGIN;
  if (logo) {
    page.drawImage(logo, { x: MARGIN, y: topY - logoSize, width: logoSize, height: logoSize });
    leftX = MARGIN + logoSize + 12;
  }
  text(shop.shop_name || "Albasse Shopping", leftX, topY - 22, 17, { font: bold, color: VIOLET });
  const shopLines = [shop.address, [shop.postal_code, shop.city].filter(Boolean).join(" "), shop.country, shop.phone ? `Tél. ${shop.phone}` : "", shop.email]
    .map((l) => pdfText(l))
    .filter(Boolean);
  let sy = topY - 38;
  for (const l of shopLines.slice(0, 5)) {
    text(l, leftX, sy, 9.5, { color: MUTED });
    sy -= 12.5;
  }
  text("FACTURE", right, topY - 18, 22, { font: bold, alignRight: true });
  text(number, right, topY - 36, 12, { font: bold, color: VIOLET, alignRight: true });
  text(`Date : ${dateLabel(order.created_at)}`, right, topY - 51, 9.5, { color: MUTED, alignRight: true });
  text(`Commande ${orderNumberLabel(order)}`, right, topY - 64, 9.5, { color: MUTED, alignRight: true });
  y = Math.min(topY - logoSize, sy) - 22;

  if (order.status === "cancelled") {
    const label = "COMMANDE ANNULÉE";
    page.drawRectangle({ x: MARGIN, y: y - 24, width: right - MARGIN, height: 24, borderColor: RED, borderWidth: 1.5 });
    text(label, A4.w / 2 - width(bold, 12, label) / 2, y - 16.5, 12, { font: bold, color: RED });
    y -= 40;
  }

  // --- client et livraison
  text("CLIENT ET LIVRAISON", MARGIN, y, 8.5, { font: bold, color: MUTED });
  y -= 15;
  text(pdfText(order.shipping_name) || "Client", MARGIN, y, 11, { font: bold });
  y -= 14;
  for (const l of [order.shipping_phone, [order.shipping_address, order.shipping_city].filter(Boolean).join(", ")]) {
    for (const part of wrap(String(l ?? ""), regular, 10, right - MARGIN)) {
      text(part, MARGIN, y, 10, { color: MUTED });
      y -= 13;
    }
  }
  y -= 14;

  // --- tableau des articles
  const colQty = right - 190;
  const colPrice = right - 105;
  const colTotal = right;
  const nameW = colQty - 40 - MARGIN - 10;

  const drawHead = () => {
    page.drawRectangle({ x: MARGIN, y: y - 20, width: right - MARGIN, height: 20, color: VIOLET });
    text("Désignation", MARGIN + 6, y - 14, 9.5, { font: bold, color: GOLD });
    text("Qté", colQty, y - 14, 9.5, { font: bold, color: GOLD, alignRight: true });
    text("Prix unit.", colPrice, y - 14, 9.5, { font: bold, color: GOLD, alignRight: true });
    text("Total", colTotal - 6, y - 14, 9.5, { font: bold, color: GOLD, alignRight: true });
    y -= 20;
  };
  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    band(page);
    y = A4.h - MARGIN;
  };
  drawHead();
  for (const r of b.rows) {
    const nameLines = wrap(r.name || "Article", regular, 10.5, nameW);
    const variantLines = r.variant ? wrap(r.variant, regular, 9, nameW) : [];
    const rowH = 10 + nameLines.length * 13 + variantLines.length * 11.5 + 4;
    if (y - rowH < MARGIN + 20) {
      newPage();
      drawHead();
    }
    let ly = y - 15;
    for (const l of nameLines) {
      text(l, MARGIN + 6, ly, 10.5);
      ly -= 13;
    }
    for (const l of variantLines) {
      text(l, MARGIN + 6, ly, 9, { color: MUTED });
      ly -= 11.5;
    }
    text(String(r.quantity), colQty, y - 15, 10.5, { alignRight: true });
    text(formatXAF(r.unitPrice), colPrice, y - 15, 10.5, { alignRight: true });
    text(formatXAF(r.total), colTotal - 6, y - 15, 10.5, { alignRight: true });
    y -= rowH;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.7, color: LINE });
  }
  y -= 18;

  // --- totaux (à droite)
  // les totaux, le paiement et le pied de page (≈ 200 pt) doivent tenir sous la dernière ligne ; sinon ils passent sur une page à eux
  if (y < MARGIN + 200) newPage();
  const deliveryText = b.delivery > 0 ? formatXAF(b.delivery) : data.cityFeeUndefined ? "À définir" : "Gratuite";
  const lines: { label: string; value: string }[] = [{ label: "Articles", value: formatXAF(b.itemsTotal) }];
  if (b.loyaltyDiscount > 0) lines.push({ label: "Remise fidélité -10 %", value: `-${formatXAF(b.loyaltyDiscount)}` });
  if (b.giftWrap > 0) lines.push({ label: "Emballage cadeau", value: formatXAF(b.giftWrap) });
  lines.push({ label: "Livraison", value: deliveryText });
  const boxLeft = right - 250;
  for (const l of lines) {
    text(l.label, boxLeft, y, 10.5, { color: MUTED });
    text(l.value, right - 6, y, 10.5, { alignRight: true });
    y -= 17;
  }
  y -= 6;
  page.drawRectangle({ x: boxLeft - 10, y: y - 8, width: right - boxLeft + 10, height: 25, color: VIOLET });
  text("TOTAL À PAYER", boxLeft, y, 12, { font: bold, color: SILVER_LIGHT });
  text(formatXAF(b.total), right - 6, y, 12, { font: bold, color: GOLD, alignRight: true });
  y -= 34;

  // --- paiement et statut
  const payment = `Paiement : ${PAYMENT_LABELS[order.payment_method] ?? order.payment_method}${order.payment_reference ? ` (réf. ${order.payment_reference})` : ""}`;
  text(payment, MARGIN, y, 10, { color: MUTED });
  y -= 14;
  text(`Statut de la commande : ${STATUS_LABELS[order.status] ?? order.status}`, MARGIN, y, 10, { color: MUTED });

  // --- pied de page (sur la dernière page)
  let fy = MARGIN + 28;
  page.drawLine({ start: { x: MARGIN, y: fy + 18 }, end: { x: right, y: fy + 18 }, thickness: 0.7, color: LINE });
  if (shop.invoice_legal_line) {
    for (const l of wrap(shop.invoice_legal_line, regular, 9, right - MARGIN)) {
      text(l, A4.w / 2 - width(regular, 9, l) / 2, fy + 4, 9, { color: MUTED });
      fy -= 11;
    }
  }
  const thanks = "Merci pour votre confiance · albasseshopping.com";
  text(thanks, A4.w / 2 - width(regular, 9.5, pdfText(thanks)) / 2, fy + 4, 9.5, { color: MUTED });

  return await doc.save();
}
