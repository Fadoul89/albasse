// Fonction « order-invoice » : la facture PDF d'une commande.
//
//   1. À chaque nouvelle commande, la base (add-order-invoice-telegram.sql) appelle cette fonction avec le secret partagé dans l'en-tête
//      « x-cron-secret » (le même que pour « brevo-email » et « zara-report-poster », gardé dans le coffre-fort Supabase) :
//        POST { "action": "telegram", "order_id": "…" }              : envoie le PDF sur le Telegram des administrateurs
//        POST { "action": "telegram", "order_id": "…", "dry": true }  : dessine seulement et répond avec la taille (rien n'est envoyé)
//        POST { "action": "selftest" }  : dessine une facture d'EXEMPLE (aucune commande) ; avec "send": true elle part sur Telegram
//   2. Le client (ou l'administrateur) télécharge la facture depuis le site avec son jeton de connexion :
//        POST { "action": "pdf", "order_id": "…" }  + en-tête « Authorization: Bearer <jeton> »  →  le fichier PDF
//      Un client ne reçoit que SES commandes ; l'administrateur reçoit toutes les commandes. Sans compte : refusé.
// Le code du bot Telegram est lu dans le coffre-fort par zara_report_credentials : rien n'est écrit en clair ici.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as pdfLib from "npm:pdf-lib@1.17.1";
import { buildInvoicePdf, formatXAF, invoiceFileName, invoiceNumber, orderNumberLabel, pdfText, type InvoiceOrder } from "./invoice.ts";

const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// le logo : le même fichier que sur le site (public/icon-192.png), lu une fois puis gardé ; s'il est introuvable, la facture est dessinée sans logo
const LOGO_URL = "https://www.albasseshopping.com/icon-192.png";
let logoCache: Uint8Array | null = null;
async function loadLogo(): Promise<Uint8Array | null> {
  if (logoCache) return logoCache;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(LOGO_URL, { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 500_000) return null;
    logoCache = bytes;
    return bytes;
  } catch {
    return null;
  }
}

// la commande, les réglages de la boutique et la ville (pour « Gratuite » ou « À définir ») : tout est relu dans la base
async function loadInvoice(orderId: string) {
  const { data: order, error } = await service.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error || !order) return null;
  const { data: shop } = await service.from("store_settings").select("*").eq("id", 1).maybeSingle();
  const { data: cities } = await service.from("cities").select("name,delivery_fee");
  const city = (cities ?? []).find((c: { name: string }) => c.name.toLowerCase() === String(order.shipping_city ?? "").toLowerCase());
  return { order: order as InvoiceOrder & { user_id: string | null }, shop: shop ?? {}, cityFeeUndefined: !!city && city.delivery_fee === null };
}

async function makePdf(orderId: string) {
  const loaded = await loadInvoice(orderId);
  if (!loaded) return null;
  const bytes = await buildInvoicePdf(pdfLib as never, { order: loaded.order, shop: loaded.shop, cityFeeUndefined: loaded.cityFeeUndefined }, await loadLogo());
  return { bytes, order: loaded.order };
}

async function telegramSend(token: string, chatId: number, pdf: Uint8Array, order: InvoiceOrder, caption: string): Promise<boolean> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("document", new Blob([pdf], { type: "application/pdf" }), invoiceFileName(order));
  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
  if (!res.ok) console.error("telegram sendDocument", res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    if (req.method !== "POST") return json({ error: "méthode refusée" }, 405);
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.order_id ?? "");

    // --- 1. appel de la base : secret partagé
    const given = req.headers.get("x-cron-secret") ?? "";
    if (given) {
      const { data: secret } = await service.rpc("email_cron_secret");
      if (typeof secret !== "string" || !safeEqual(given, secret)) return json({ error: "non autorisé" }, 401);

      // essai : une facture d'EXEMPLE (aucune commande lue ni créée) pour vérifier le dessin sur le vrai serveur ; envoyée seulement avec « send »
      if (body?.action === "selftest") {
        const { data: shop } = await service.from("store_settings").select("*").eq("id", 1).maybeSingle();
        const sample: InvoiceOrder = {
          id: "00000000-0000-4000-8000-000000000000",
          order_number: null,
          items: [{ product_name: "Article d'exemple", unit_price: 25000, quantity: 1, color: "Noir", size: "M" }],
          total: 27500,
          status: "pending",
          payment_method: "airtel_money",
          shipping_name: "Client exemple",
          shipping_phone: "66 00 00 00",
          shipping_address: "Quartier exemple",
          shipping_city: "N'Djamena",
          gift_wrap: false,
          loyalty_discount: 0,
          created_at: new Date().toISOString(),
        };
        const bytes = await buildInvoicePdf(pdfLib as never, { order: sample, shop: shop ?? {}, cityFeeUndefined: false }, await loadLogo());
        if (body?.send !== true) return json({ ok: true, selftest: true, bytes: bytes.byteLength });
        const { data: creds } = await service.rpc("zara_report_credentials");
        const token = creds?.token as string | undefined;
        const chats = ((creds?.chat_ids ?? []) as number[]).filter((c) => Number.isFinite(c));
        if (!token || chats.length === 0) return json({ error: "Telegram : bot ou administrateur non lié" }, 500);
        let sent = 0;
        for (const chat of chats) if (await telegramSend(token, chat, bytes, sample, "🧾 EXEMPLE de facture PDF (aucune vraie commande) : voici ce que vous recevrez à chaque commande.").catch(() => false)) sent++;
        return json({ ok: sent > 0, selftest: true, sent, bytes: bytes.byteLength });
      }

      if (!UUID.test(orderId)) return json({ error: "commande inconnue" }, 400);
      if (body?.action !== "telegram") return json({ error: "action inconnue" }, 400);

      const made = await makePdf(orderId);
      if (!made) return json({ error: "commande introuvable" }, 404);
      if (body?.dry === true) return json({ ok: true, dry: true, bytes: made.bytes.byteLength, file: invoiceFileName(made.order) });

      const { data: creds, error: credsError } = await service.rpc("zara_report_credentials");
      const token = creds?.token as string | undefined;
      const chats = ((creds?.chat_ids ?? []) as number[]).filter((c) => Number.isFinite(c));
      if (credsError || !token || chats.length === 0) return json({ error: `Telegram : ${credsError?.message ?? "bot ou administrateur non lié"}` }, 500);

      const o = made.order;
      const caption = `🧾 Facture ${invoiceNumber(o)} · commande ${orderNumberLabel(o)}\n${pdfText(o.shipping_name) || "Client"} · ${formatXAF(o.total)}`;
      let sent = 0;
      for (const chat of chats) if (await telegramSend(token, chat, made.bytes, o, caption).catch(() => false)) sent++;
      return json({ ok: sent > 0, sent, admins: chats.length, bytes: made.bytes.byteLength });
    }

    // --- 2. le client ou l'administrateur connecté : jeton de connexion
    if (!UUID.test(orderId)) return json({ error: "commande inconnue" }, 400);
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "connexion requise" }, 401);
    if (body?.action !== "pdf") return json({ error: "action inconnue" }, 400);
    const { data: auth, error: authError } = await service.auth.getUser(jwt);
    const user = auth?.user;
    if (authError || !user) return json({ error: "connexion requise" }, 401);

    const made = await makePdf(orderId);
    if (!made) return json({ error: "commande introuvable" }, 404);
    if (made.order.user_id !== user.id) {
      const { data: profile } = await service.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (!profile?.is_admin) return json({ error: "commande introuvable" }, 404); // même réponse : on ne dit pas qu'elle existe
    }
    return new Response(made.bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceFileName(made.order)}"`,
        "Cache-Control": "private, no-store",
        ...CORS,
      },
    });
  } catch (e) {
    console.error("order-invoice", e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
