// Fonction « telegram-promo » : Telegram aux clients absents depuis 7 jours, et rapport quotidien sur le Telegram des administrateurs.
//
// Appelée par la base (add-telegram-absent.sql) avec le secret partagé dans l'en-tête « x-cron-secret » (le même que pour « brevo-email » et
// « zara-report-poster », gardé dans le coffre-fort Supabase). Personne d'autre ne peut la déclencher.
//   POST { "action": "absent" }  : chaque matin à 9 h 30 (N'Djamena) : écrit aux clients que la base choisit (voir telegram_absent_claim) :
//                                  clients qui ont lié leur Telegram en connaissance de cause, sans STOP, absents depuis 7 jours.
//   POST { "action": "report" }  : chaque jour à 17 h : envoie le rapport (e-mails + Telegram : envoyés, revenus, commandes).
//   POST { "action": "report", "dry": true } : renvoie le texte du rapport sans l'envoyer.
// Le code du bot Telegram est lu dans le coffre-fort par zara_report_credentials : rien n'est écrit en clair ici, et jamais journalisé.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { runAbsent, runReport, type ClaimRow, type TgResult } from "./send.ts";
import type { PromoProduct, PromoReport } from "./message.ts";

const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// appel à l'API Telegram ; on ne journalise jamais l'adresse (elle contient la clé du bot)
async function telegram(token: string, method: string, body: Record<string, unknown>): Promise<TgResult> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    return { ok: res.ok && data?.ok !== false, status: res.status, description: String(data?.description ?? "").slice(0, 200) };
  } catch (e) {
    return { ok: false, status: 0, description: `réseau : ${e instanceof Error ? e.name : "erreur"}` };
  }
}

async function loadPromoProducts(): Promise<PromoProduct[]> {
  const { data } = await service
    .from("products")
    .select("id,name,slug,price,compare_at_price,images,is_flash_sale,flash_sale_ends_at,created_at")
    .eq("is_active", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as PromoProduct[];
}

async function claim(): Promise<{ rows: ClaimRow[] } | { error: string }> {
  const { data, error } = await service.rpc("telegram_absent_claim");
  return error ? { error: `choix des clients : ${error.message}` } : { rows: (data ?? []) as ClaimRow[] };
}

async function loadReport(): Promise<{ data: PromoReport } | { error: string }> {
  const { data, error } = await service.rpc("telegram_promos_report");
  return error || !data ? { error: `données du rapport : ${error?.message ?? "vides"}` } : { data: data as PromoReport };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return json({ error: "méthode refusée" }, 405);

    // seule la base (planificateur) peut déclencher : secret partagé relu dans le coffre-fort
    const given = req.headers.get("x-cron-secret") ?? "";
    const { data: secret } = await service.rpc("email_cron_secret");
    if (!given || typeof secret !== "string" || !safeEqual(given, secret)) return json({ error: "non autorisé" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "absent" && action !== "report") return json({ error: "action inconnue" }, 400);

    const { data: creds, error: credsError } = await service.rpc("zara_report_credentials");
    const token = creds?.token as string | undefined;
    const chats = ((creds?.chat_ids ?? []) as number[]).filter((c) => Number.isFinite(c));
    if (credsError || !token) return json({ error: "Telegram : clé du bot introuvable dans le coffre-fort" }, 500);

    if (action === "absent") {
      const out = await runAbsent({
        claim,
        record: async (userId, status, error) => {
          await service.rpc("telegram_absent_record", { p_user: userId, p_status: status, p_error: error });
        },
        loadProducts: loadPromoProducts,
        telegram: (method, payload) => telegram(token, method, payload),
        now: () => Date.now(),
        sleep,
      });
      return out.error ? json(out, 500) : json({ ok: true, ...out });
    }
    if (!body?.dry && chats.length === 0) return json({ error: "aucun administrateur lié à Telegram" }, 500);
    const out = await runReport({ loadReport, telegram: (chat, text) => telegram(token, "sendMessage", { chat_id: chat, text }) }, chats, body?.dry === true);
    return out.error ? json(out, 500) : json(out);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
