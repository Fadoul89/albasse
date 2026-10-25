// Zara Marketing Intelligence : le déroulement d'un passage (simulation, mise en file, approbation, suivi des résultats) et le VERROU qui
// interdit tout envoi réel tant que les contrôles ne sont pas faits. Écrit sans dépendance à Deno (service, variables, fetch et horloge sont passés en
// paramètres) : testé dans tests/email/marketing-run.test.ts avec une fausse base et un faux Brevo.
// Règles de sécurité de ce fichier :
//  - la simulation n'écrit JAMAIS dans la file d'envoi ni dans les préférences des clients ;
//  - rien n'est mis en file hors du mode « live » validé, et par défaut chaque campagne attend l'approbation de l'administrateur ;
//  - si un contrôle n'est plus bon pendant que le mode est « live », le mode retombe tout seul en « simulation » ;
//  - une réponse n'affirme « envoyé » que si Brevo a donné l'identifiant du message.
import { brevoCheck } from "./brevoCheck.ts";
import { sendBrevo, unsubscribeLinks, type Deps } from "./drain.ts";
import {
  DAY_MS,
  SEGMENT_PRIORITY,
  clampSettings,
  langOf,
  liveGate,
  ndjamenaDate,
  ndjamenaDayStart,
  ndjamenaHour,
  planDay,
  renderEmail,
  verifyCatalog,
  type CatalogProduct,
  type Client,
  type ClientOrder,
  type GateState,
  type MarketingSettings,
  type Plan,
  type PlanRecipient,
  type SegmentKey,
  type SentRecord,
  type Snapshot,
} from "./marketing.ts";
import { mask, realEmail } from "./orderEmails.ts";

export type Mode = "off" | "simulation" | "live";
export interface StoredSettings {
  mode: Mode;
  settings: MarketingSettings;
  requireApproval: boolean;
  gate: GateState;
  validatedAt: number | null;
  lastRunDate: string | null;
}

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (v: unknown): number | null => {
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? t : null;
};

// ---------------------------------------------------------------------------------------------
// Réglages et verrou
// ---------------------------------------------------------------------------------------------

// null si le script SQL n'est pas encore lancé (la table n'existe pas)
export async function getSettings(service: Deps["service"]): Promise<StoredSettings | null> {
  const { data, error } = await service.from("marketing_ai_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return null;
  return {
    mode: data.mode === "live" || data.mode === "simulation" ? data.mode : "off",
    settings: clampSettings({ runHour: data.run_hour, dailyLimit: data.daily_limit, minDaysBetween: data.min_days_between, maxPer30Days: data.max_per_30_days }),
    requireApproval: data.require_approval !== false,
    gate: {
      brevoOk: typeof data.brevo_ok === "boolean" ? data.brevo_ok : null,
      brevoCheckedAt: ms(data.brevo_checked_at),
      simulationAt: ms(data.last_simulation_at),
      simulationBlocking: typeof data.last_simulation_blocking === "number" ? data.last_simulation_blocking : null,
      testEmailAt: ms(data.test_email_at),
      testEmailMessageId: typeof data.test_email_message_id === "string" && data.test_email_message_id ? data.test_email_message_id : null,
    },
    validatedAt: ms(data.validated_at),
    lastRunDate: typeof data.last_run_date === "string" ? data.last_run_date : null,
  };
}

// Écrit des réglages. Si le mode est « live » et que, avec cette écriture, un contrôle n'est plus bon, le mode retombe en « simulation »
// dans la même écriture (sinon le verrou de la base refuserait la mise à jour).
async function patchSettings(service: Deps["service"], st: StoredSettings, patch: Record<string, unknown>, now: number): Promise<{ demoted: boolean }> {
  const merged: GateState = {
    brevoOk: "brevo_ok" in patch ? (patch.brevo_ok as boolean | null) : st.gate.brevoOk,
    brevoCheckedAt: "brevo_checked_at" in patch ? ms(patch.brevo_checked_at) : st.gate.brevoCheckedAt,
    simulationAt: "last_simulation_at" in patch ? ms(patch.last_simulation_at) : st.gate.simulationAt,
    simulationBlocking: "last_simulation_blocking" in patch ? (patch.last_simulation_blocking as number | null) : st.gate.simulationBlocking,
    testEmailAt: "test_email_at" in patch ? ms(patch.test_email_at) : st.gate.testEmailAt,
    testEmailMessageId: "test_email_message_id" in patch ? (patch.test_email_message_id as string | null) : st.gate.testEmailMessageId,
  };
  const demote = st.mode === "live" && !("mode" in patch) && !liveGate(merged, now).ok;
  const { error } = await service.from("marketing_ai_settings").update({ ...patch, ...(demote ? { mode: "simulation" } : {}) }).eq("id", 1);
  if (error) throw new Error(`réglages : ${String(error.message ?? error.code ?? "erreur").slice(0, 120)}`);
  return { demoted: demote };
}

export async function setMode(deps: Deps, mode: unknown, confirm: unknown, adminId: string) {
  const st = await getSettings(deps.service);
  if (!st) return { ok: false as const, reason: "sql_missing" };
  if (mode !== "off" && mode !== "simulation" && mode !== "live") return { ok: false as const, reason: "bad_request" };
  const now = deps.now();
  if (mode === "live") {
    // le verrou : confirmation tapée par l'administrateur ET contrôles récents
    if (confirm !== "ACTIVER") return { ok: false as const, reason: "confirmation", missing: [] as string[] };
    const gate = liveGate(st.gate, now);
    if (!gate.ok) return { ok: false as const, reason: "gate", missing: gate.missing };
    const { error } = await deps.service.from("marketing_ai_settings").update({ mode: "live", validated_at: iso(now), validated_by: adminId }).eq("id", 1);
    if (error) return { ok: false as const, reason: "refused" };
    return { ok: true as const, mode: "live" as Mode };
  }
  const { error } = await deps.service.from("marketing_ai_settings").update({ mode }).eq("id", 1);
  if (error) return { ok: false as const, reason: "refused" };
  return { ok: true as const, mode: mode as Mode };
}

// ---------------------------------------------------------------------------------------------
// Lecture des données (lecture seule)
// ---------------------------------------------------------------------------------------------

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>, size = 1000, max = 20000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(`lecture : ${String(error.message ?? "erreur").slice(0, 120)}`);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

export async function loadSnapshot(service: Deps["service"], now: number): Promise<Snapshot> {
  const [products, profiles, prefs, sessions, orders, favs, outbox] = await Promise.all([
    fetchAll<any>((a, b) => service.from("products").select("id,name,slug,price,compare_at_price,images,is_flash_sale,flash_sale_ends_at,created_at,category_id,stock,is_active").eq("is_active", true).order("id").range(a, b)),
    fetchAll<any>((a, b) => service.from("profiles").select("id,email,full_name,created_at,last_login_at,banned,is_admin,notify_promotions,notify_new_products,notify_flash_sale").order("id").range(a, b)),
    fetchAll<any>((a, b) => service.from("email_prefs").select("user_id,token,unsubscribed_at,suppressed_at,lang").order("user_id").range(a, b)),
    fetchAll<any>((a, b) => service.from("visitor_sessions").select("id,user_id,last_seen_at").not("user_id", "is", null).gte("last_seen_at", iso(now - 90 * DAY_MS)).order("id").range(a, b)),
    fetchAll<any>((a, b) => service.from("orders").select("id,user_id,status,created_at,is_flagged_fake,loyalty_discount,items").not("user_id", "is", null).order("id").range(a, b)),
    fetchAll<any>((a, b) => service.from("favorites").select("id,user_id,product_id").order("id").range(a, b)),
    fetchAll<any>((a, b) => service.from("email_outbox").select("id,user_id,kind,status,created_at,segment,variant,product_ids").in("kind", ["marketing", "promo_inactive"]).gte("created_at", iso(now - 60 * DAY_MS)).order("id").range(a, b)),
  ]);
  const prefBy = new Map<string, any>(prefs.map((p) => [p.user_id, p]));
  const lastSeen = new Map<string, number>();
  for (const s of sessions) {
    const t = ms(s.last_seen_at);
    if (t !== null) lastSeen.set(s.user_id, Math.max(lastSeen.get(s.user_id) ?? 0, t));
  }
  const clients: Client[] = profiles.map((p) => {
    const pref = prefBy.get(p.id);
    const createdAt = ms(p.created_at) ?? 0;
    return {
      id: p.id,
      email: p.email ?? null,
      fullName: p.full_name ?? null,
      createdAt,
      lastActiveAt: Math.max(createdAt, ms(p.last_login_at) ?? 0, lastSeen.get(p.id) ?? 0),
      notifyPromotions: p.notify_promotions === true,
      notifyNewProducts: p.notify_new_products === true,
      notifyFlash: p.notify_flash_sale === true,
      banned: p.banned === true,
      isAdmin: p.is_admin === true,
      unsubscribedAt: ms(pref?.unsubscribed_at),
      suppressedAt: ms(pref?.suppressed_at),
      token: pref?.token ?? null,
      lang: pref?.lang === "ar" || pref?.lang === "fr" ? pref.lang : null,
    };
  });
  const clientOrders: ClientOrder[] = orders.map((o) => ({
    userId: o.user_id,
    status: String(o.status ?? ""),
    createdAt: ms(o.created_at) ?? 0,
    isFake: o.is_flagged_fake === true,
    loyaltyDiscount: Number(o.loyalty_discount) || 0,
    productIds: (Array.isArray(o.items) ? o.items : []).map((i: any) => i?.product_id).filter((id: unknown): id is string => typeof id === "string"),
  }));
  const sent: SentRecord[] = outbox.map((r) => ({ userId: r.user_id, kind: r.kind, status: r.status, createdAt: ms(r.created_at) ?? 0, segment: r.segment ?? null, variant: r.variant ?? null, productIds: Array.isArray(r.product_ids) ? r.product_ids : null }));
  return { now, products: products as CatalogProduct[], clients, orders: clientOrders, favorites: favs.map((f) => ({ userId: f.user_id, productId: f.product_id })), sent };
}

async function queuedToday(service: Deps["service"], now: number): Promise<number> {
  const { count } = await service.from("email_outbox").select("id", { count: "exact", head: true }).eq("kind", "marketing").in("status", ["pending", "sending", "sent"]).gte("created_at", iso(ndjamenaDayStart(now)));
  return count ?? 0;
}

// ---------------------------------------------------------------------------------------------
// Le plan, la simulation, le journal
// ---------------------------------------------------------------------------------------------

export const blockingCount = (plan: Plan) => plan.issues.filter((i) => i.level === "blocking").length;

// ce que l'administrateur voit : le plan sans les identifiants des clients (adresses masquées seulement)
export function publicPlan(plan: Plan) {
  const { recipients, ...rest } = plan;
  return { ...rest, recipientCount: recipients.length, sample: recipients.slice(0, 50).map(({ userId: _u, ...r }) => r) };
}

async function saveRun(service: Deps["service"], row: { run_date: string; mode: "simulation" | "live"; status: string; plan: Plan; error?: string }): Promise<string | null> {
  const { data, error } = await service
    .from("marketing_runs")
    .insert({ run_date: row.run_date, mode: row.mode, status: row.status, summary: { ...publicPlan(row.plan), blocking: blockingCount(row.plan) }, recipients: row.plan.recipients, error: row.error ?? null })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`journal : ${String(error.message ?? "erreur").slice(0, 120)}`);
  return data?.id ?? null;
}

async function buildPlan(deps: Deps, st: StoredSettings): Promise<Plan> {
  const now = deps.now();
  const snap = await loadSnapshot(deps.service, now);
  return planDay(snap, st.settings, { alreadyQueuedToday: await queuedToday(deps.service, now) });
}

// SIMULATION : le plan, les aperçus et le rapport ; AUCUNE ligne dans la file d'envoi, AUCUN e-mail, aucun code de désinscription créé
export async function simulate(deps: Deps) {
  const st = await getSettings(deps.service);
  if (!st) return { ok: false as const, reason: "sql_missing" };
  const now = deps.now();
  const plan = await buildPlan(deps, st);
  const runId = await saveRun(deps.service, { run_date: plan.runDate, mode: "simulation", status: "simulated", plan });
  const { demoted } = await patchSettings(deps.service, st, { last_simulation_at: iso(now), last_simulation_blocking: blockingCount(plan) }, now);
  return { ok: true as const, run_id: runId, demoted, plan: publicPlan(plan), blocking: blockingCount(plan) };
}

// ---------------------------------------------------------------------------------------------
// Mise en file (seulement « live » validé) et approbation
// ---------------------------------------------------------------------------------------------

async function queueRecipients(deps: Deps, runId: string, runDate: string, recipients: PlanRecipient[]): Promise<number> {
  const { service } = deps;
  if (recipients.length === 0) return 0;
  // le code de désinscription de chaque client (créé ici seulement, jamais pendant une simulation)
  const ids = recipients.map((r) => r.userId);
  const known = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await service.from("email_prefs").select("user_id").in("user_id", ids.slice(i, i + 200));
    for (const r of data ?? []) known.add(r.user_id);
  }
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length) {
    const { error } = await service.from("email_prefs").insert(missing.map((user_id) => ({ user_id })));
    if (error) throw new Error(`préférences : ${String(error.message ?? "erreur").slice(0, 120)}`);
  }
  let queued = 0;
  for (const segment of SEGMENT_PRIORITY) {
    const group = recipients.filter((r) => r.segment === segment);
    if (group.length === 0) continue;
    const { data: campaign, error } = await service.from("marketing_campaigns").insert({ run_id: runId, segment, planned: group.length, tag: `zmi-${runDate.replace(/-/g, "")}-${segment}` }).select("id").maybeSingle();
    if (error || !campaign) throw new Error("campagne : création refusée");
    const rows = group.map((r) => ({ kind: "marketing", user_id: r.userId, campaign_id: campaign.id, segment: r.segment, variant: r.variant, lang: r.lang, product_ids: r.productIds }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error: e } = await service.from("email_outbox").insert(rows.slice(i, i + 100));
      if (e) throw new Error(`file d'envoi : ${String(e.message ?? "erreur").slice(0, 120)}`);
      queued += Math.min(100, rows.length - i);
    }
  }
  return queued;
}

export async function approveRun(deps: Deps, runId: unknown, adminId: string) {
  const { service } = deps;
  const st = await getSettings(service);
  if (!st) return { ok: false as const, reason: "sql_missing" };
  if (typeof runId !== "string" || !/^[0-9a-f-]{36}$/i.test(runId)) return { ok: false as const, reason: "bad_request" };
  const now = deps.now();
  const { data: run } = await service.from("marketing_runs").select("id,run_date,mode,status,recipients").eq("id", runId).maybeSingle();
  if (!run || run.mode !== "live" || run.status !== "pending_approval") return { ok: false as const, reason: "not_pending" };
  // une campagne se valide le jour même : le lendemain, les données ont changé
  if (run.run_date !== ndjamenaDate(now)) {
    await service.from("marketing_runs").update({ status: "expired" }).eq("id", runId);
    return { ok: false as const, reason: "expired" };
  }
  if (st.mode !== "live" || !st.validatedAt || !liveGate(st.gate, now).ok) return { ok: false as const, reason: "locked" };
  const recipients = (Array.isArray(run.recipients) ? run.recipients : []) as PlanRecipient[];
  try {
    const queued = await queueRecipients(deps, runId, run.run_date, recipients);
    await service.from("marketing_runs").update({ status: "queued", approved_at: iso(now), approved_by: adminId }).eq("id", runId);
    return { ok: true as const, queued };
  } catch (e) {
    await service.from("marketing_runs").update({ status: "error", error: String(e instanceof Error ? e.message : e).slice(0, 200) }).eq("id", runId);
    return { ok: false as const, reason: "queue_failed" };
  }
}

// ---------------------------------------------------------------------------------------------
// Contrôle Brevo et e-mail de test
// ---------------------------------------------------------------------------------------------

export async function runCheck(deps: Deps) {
  const result = await brevoCheck(deps);
  const st = await getSettings(deps.service);
  if (st) await patchSettings(deps.service, st, { brevo_ok: result.ok, brevo_checked_at: result.checked_at, brevo_detail: result }, deps.now());
  return { ...result, stored: !!st };
}

// e-mail de test : seulement vers l'adresse de l'administrateur ; le verrou ne compte que si Brevo donne l'identifiant du message
export async function sendTestEmail(deps: Deps, admin: { email: unknown; fullName: unknown }) {
  const key = deps.env("BREVO_API_KEY");
  if (!key) return { ok: false as const, reason: "no_key" };
  const to = realEmail(admin.email);
  if (!to) return { ok: false as const, reason: "no_email" };
  const { data } = await deps.service
    .from("products")
    .select("id,name,slug,price,compare_at_price,images,is_flash_sale,flash_sale_ends_at,created_at,category_id,stock,is_active")
    .eq("is_active", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false })
    .limit(60);
  const now = deps.now();
  const { verified } = verifyCatalog((data ?? []) as CatalogProduct[], now);
  if (verified.length < 2) return { ok: false as const, reason: "no_products" };
  const links = unsubscribeLinks(deps.env("SUPABASE_URL"), "00000000-0000-4000-8000-000000000000");
  const mail = renderEmail({ segment: "inactive", variant: "A", lang: langOf({ fullName: String(admin.fullName ?? "") } as Client), fullName: String(admin.fullName ?? "") || "Administrateur", products: verified.slice(0, 4), runDate: ndjamenaDate(now), unsubscribeUrl: links.page });
  const sent = await sendBrevo(deps, key, { to, name: String(admin.fullName ?? "").trim() || undefined, subject: `[Test Zara Marketing] ${mail.subject}`, html: mail.html, headers: links.headers });
  if (!sent.ok) return { ok: false as const, reason: sent.status ? "brevo" : "error", status: sent.status, detail: sent.detail };
  if (!sent.messageId) return { ok: true as const, to: mask(to), confirmed: false }; // Brevo n'a pas donné d'identifiant : pas de confirmation, le verrou ne compte pas
  const st = await getSettings(deps.service);
  if (st) await patchSettings(deps.service, st, { test_email_at: iso(now), test_email_message_id: sent.messageId }, now);
  return { ok: true as const, to: mask(to), confirmed: true };
}

// ---------------------------------------------------------------------------------------------
// Résultats : ce que Brevo confirme (livraison, clics, rebonds, plaintes), et les adresses à mettre en suppression
// ---------------------------------------------------------------------------------------------

export interface EventSummary {
  delivered_at: string | null;
  click_count: number;
  bounce_type: "hard" | "soft" | "blocked" | "invalid" | null;
  complaint: boolean;
}
export function summarizeEvents(events: unknown): EventSummary {
  const out: EventSummary = { delivered_at: null, click_count: 0, bounce_type: null, complaint: false };
  for (const e of Array.isArray(events) ? (events as any[]) : []) {
    const kind = String(e?.event ?? "").toLowerCase().replace(/s$/, "");
    if (kind === "delivered") out.delivered_at = out.delivered_at ?? (typeof e.date === "string" ? e.date : null);
    else if (kind === "click") out.click_count++;
    else if (kind === "hardbounce" || kind === "bounce") out.bounce_type = "hard";
    else if (kind === "softbounce") out.bounce_type = out.bounce_type ?? "soft";
    else if (kind === "blocked") out.bounce_type = out.bounce_type === "hard" ? "hard" : "blocked";
    else if (kind === "invalid") out.bounce_type = "invalid";
    else if (kind === "spam" || kind === "complaint") out.complaint = true;
  }
  return out;
}
const SUPPRESS: Record<string, string> = { hard: "rebond_dur", blocked: "bloque", invalid: "adresse_invalide" };

export async function syncEvents(deps: Deps, limit = 30) {
  const key = deps.env("BREVO_API_KEY");
  if (!key) return { ok: false as const, reason: "no_key" };
  const now = deps.now();
  const { data: rows } = await deps.service
    .from("email_outbox")
    .select("id,user_id,provider_message_id,events_synced_at")
    .eq("kind", "marketing")
    .eq("status", "sent")
    .gte("sent_at", iso(now - 14 * DAY_MS))
    .order("sent_at")
    .limit(200);
  const due = (rows ?? []).filter((r: any) => r.provider_message_id && (!r.events_synced_at || now - Date.parse(r.events_synced_at) > 3600_000)).slice(0, limit);
  let synced = 0;
  let suppressed = 0;
  let stopped: string | null = null;
  for (const r of due) {
    let res: Response;
    try {
      res = await deps.fetchFn(`https://api.brevo.com/v3/smtp/statistics/events?messageId=${encodeURIComponent(r.provider_message_id)}&limit=100&sort=desc&days=14`, { method: "GET", headers: { "api-key": key, accept: "application/json" } });
    } catch {
      stopped = "reseau";
      break;
    }
    if (!res.ok) {
      stopped = `brevo_${res.status}`;
      break;
    }
    const body = await res.json().catch(() => null);
    const sum = summarizeEvents(body?.events);
    await deps.service
      .from("email_outbox")
      .update({ delivered_at: sum.delivered_at, click_count: sum.click_count, bounce_type: sum.bounce_type, complaint_at: sum.complaint ? iso(now) : null, events_synced_at: iso(now) })
      .eq("id", r.id);
    synced++;
    // rebond dur, adresse bloquée ou invalide, plainte : l'adresse est mise en suppression tout de suite (plus aucun e-mail publicitaire)
    const reason = sum.complaint ? "plainte" : sum.bounce_type ? SUPPRESS[sum.bounce_type] : null;
    if (reason && r.user_id) {
      await deps.service.from("email_prefs").update({ suppressed_at: iso(now), suppressed_reason: reason }).eq("user_id", r.user_id);
      suppressed++;
    }
  }
  return { ok: true as const, synced, suppressed, stopped };
}

// ---------------------------------------------------------------------------------------------
// Le passage horaire (appelé par la base à :05 chaque heure)
// ---------------------------------------------------------------------------------------------

export async function tick(deps: Deps) {
  const st = await getSettings(deps.service);
  if (!st || st.mode === "off") return { ok: true, skipped: "off" };
  const now = deps.now();
  let sync: unknown = null;
  try {
    sync = await syncEvents(deps);
  } catch (e) {
    sync = { ok: false, reason: String(e instanceof Error ? e.message : e).slice(0, 80) };
  }
  if (ndjamenaHour(now) !== st.settings.runHour) return { ok: true, skipped: "hour", sync };
  const today = ndjamenaDate(now);
  if (st.lastRunDate === today) return { ok: true, skipped: "already_ran", sync };

  const plan = await buildPlan(deps, st);
  const blocking = blockingCount(plan);
  if (st.mode === "simulation") {
    const runId = await saveRun(deps.service, { run_date: today, mode: "simulation", status: "simulated", plan });
    await patchSettings(deps.service, st, { last_simulation_at: iso(now), last_simulation_blocking: blocking, last_run_date: today }, now);
    return { ok: true, mode: "simulation", run_id: runId, planned: plan.recipients.length, blocking, sync };
  }

  // live : le contrôle Brevo et la simulation du jour sont refaits, puis le verrou est relu AVANT toute mise en file
  const check = await brevoCheck(deps);
  const merged: GateState = { ...st.gate, brevoOk: check.ok, brevoCheckedAt: ms(check.checked_at), simulationAt: now, simulationBlocking: blocking };
  const gate = liveGate(merged, now);
  const locked = !gate.ok || !st.validatedAt;
  const base = { brevo_ok: check.ok, brevo_checked_at: check.checked_at, brevo_detail: check, last_simulation_at: iso(now), last_simulation_blocking: blocking, last_run_date: today };
  if (locked) {
    // un contrôle n'est plus bon : rien n'est mis en file, et le mode retombe en simulation (il faudra le revalider)
    const runId = await saveRun(deps.service, { run_date: today, mode: "live", status: "blocked", plan, error: `verrou : ${[...gate.missing, ...(st.validatedAt ? [] : ["validation"])].join(", ")}` });
    await deps.service.from("marketing_ai_settings").update({ ...base, mode: "simulation" }).eq("id", 1);
    return { ok: true, mode: "live", blocked: true, missing: gate.missing, run_id: runId, sync };
  }
  await patchSettings(deps.service, st, base, now);
  if (st.requireApproval) {
    const runId = await saveRun(deps.service, { run_date: today, mode: "live", status: "pending_approval", plan });
    return { ok: true, mode: "live", pending_approval: true, run_id: runId, planned: plan.recipients.length, sync };
  }
  const runId = await saveRun(deps.service, { run_date: today, mode: "live", status: "queued", plan });
  try {
    const queued = runId ? await queueRecipients(deps, runId, today, plan.recipients) : 0;
    return { ok: true, mode: "live", queued, run_id: runId, sync };
  } catch (e) {
    if (runId) await deps.service.from("marketing_runs").update({ status: "error", error: String(e instanceof Error ? e.message : e).slice(0, 200) }).eq("id", runId);
    return { ok: false, mode: "live", reason: "queue_failed", run_id: runId, sync };
  }
}

