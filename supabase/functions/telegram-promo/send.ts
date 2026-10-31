// Le déroulement des envois (clients absents, rapport) avec des dépendances injectées : sans réseau ni base ici, donc testable
// avec un faux Telegram et une fausse base (tests/email/telegram-promo.test.ts). Le branchement réel est dans index.ts.
import { absentMessage, classifyTelegramError, pickProducts, reportText, SITE, type PromoProduct, type PromoReport } from "./message.ts";

export interface TgResult {
  ok: boolean;
  status: number;
  description: string;
}
export interface ClaimRow {
  o_user_id: string;
  o_name: string | null;
  o_chat_id: number;
}
export interface AbsentDeps {
  claim: () => Promise<{ rows: ClaimRow[] } | { error: string }>;
  record: (userId: string, status: "sent" | "failed" | "blocked", error: string | null) => Promise<void>;
  loadProducts: () => Promise<PromoProduct[]>;
  telegram: (method: string, body: Record<string, unknown>) => Promise<TgResult>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

export const siteButton = { inline_keyboard: [[{ text: "🛍️ Voir les articles", url: SITE }]] };

export async function runAbsent(deps: AbsentDeps): Promise<{ error?: string; claimed: number; sent: number; failed: number; blocked: number }> {
  const claim = await deps.claim();
  if ("error" in claim) return { error: claim.error, claimed: 0, sent: 0, failed: 0, blocked: 0 };
  const rows = claim.rows;
  const out = { claimed: rows.length, sent: 0, failed: 0, blocked: 0 };
  if (rows.length === 0) return out;

  const pick = pickProducts(await deps.loadProducts(), deps.now());
  let rateLimited = false;
  for (const r of rows) {
    if (pick.products.length === 0 || rateLimited) {
      // rien à montrer (ou Telegram demande de ralentir) : le client sera repris un autre jour
      await deps.record(r.o_user_id, "failed", pick.products.length === 0 ? "aucun article à montrer" : "limite de vitesse Telegram");
      out.failed++;
      continue;
    }
    const ad = absentMessage({ fullName: r.o_name, products: pick.products, flashEndsAt: pick.flashEndsAt });
    let res: TgResult = ad.photo
      ? await deps.telegram("sendPhoto", { chat_id: r.o_chat_id, photo: ad.photo, caption: ad.text, reply_markup: siteButton })
      : { ok: false, status: 0, description: "" };
    // la photo n'a pas pu être envoyée (adresse illisible…) : le même texte part sans photo, sauf si le client est injoignable ou si Telegram demande d'attendre
    if (!res.ok && res.status !== 429 && classifyTelegramError(res.status, res.description) !== "blocked") {
      res = await deps.telegram("sendMessage", { chat_id: r.o_chat_id, text: ad.text, reply_markup: siteButton });
    }
    if (res.status === 429) rateLimited = true;
    const status = res.ok ? "sent" : classifyTelegramError(res.status, res.description);
    await deps.record(r.o_user_id, status, res.ok ? null : `${res.status} ${res.description}`);
    out[status === "sent" ? "sent" : status === "blocked" ? "blocked" : "failed"]++;
    await deps.sleep(80);
  }
  return out;
}

export interface ReportDeps {
  loadReport: () => Promise<{ data: PromoReport } | { error: string }>;
  telegram: (chatId: number, text: string) => Promise<TgResult>;
}

export async function runReport(deps: ReportDeps, chats: number[], dry: boolean): Promise<{ error?: string; ok?: boolean; dry?: boolean; skipped?: boolean; text?: string | null; sent?: number; admins?: number }> {
  const loaded = await deps.loadReport();
  if ("error" in loaded) return { error: loaded.error };
  const text = reportText(loaded.data);
  if (dry) return { ok: true, dry: true, text };
  if (!text) return { ok: true, skipped: true };
  let sent = 0;
  for (const chat of chats) if ((await deps.telegram(chat, text)).ok) sent++;
  return { ok: sent > 0, sent, admins: chats.length };
}
