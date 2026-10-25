// Envoi automatique des e-mails de commande : lit la file (table email_outbox) et envoie par Brevo.
// Écrit sans dépendance à Deno (service, variables, fetch et horloge sont passés en paramètres) : testé dans tests/email/drain.test.ts.
import { orderDeliveredEmail, orderReceivedEmail, realEmail, type OrderRow } from "./orderEmails.ts";

export interface Deps {
  // deno-lint-ignore no-explicit-any
  service: any; // client Supabase avec la clé de service
  env: (name: string) => string | undefined;
  fetchFn: typeof fetch;
  now: () => number;
}

export const BATCH = 20; // e-mails par passage (un passage par minute)
export const MAX_ATTEMPTS = 3;
const NDJAMENA_MS = 3600_000; // UTC+1, sans heure d'été
const STUCK_MS = 600_000; // un message « en cours » depuis plus de 10 minutes est repris

export async function sendBrevo(deps: Deps, key: string, mail: { to: string; name?: string; subject: string; html: string }) {
  const sender = { email: deps.env("EMAIL_SENDER") || "contact@albasseshopping.com", name: deps.env("EMAIL_SENDER_NAME") || "Albasse Shopping" };
  try {
    const res = await deps.fetchFn("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender, replyTo: sender, to: [{ email: mail.to, ...(mail.name ? { name: mail.name } : {}) }], subject: mail.subject, htmlContent: mail.html }),
    });
    if (res.ok) return { ok: true as const };
    const raw = await res.text();
    let detail = raw.slice(0, 200);
    try {
      detail = String(JSON.parse(raw).message ?? detail);
    } catch {
      // texte brut
    }
    console.error("brevo-email: Brevo a refusé l'envoi", res.status, detail);
    return { ok: false as const, status: res.status, detail };
  } catch (e) {
    console.error("brevo-email: erreur réseau", e instanceof Error ? e.message : e);
    return { ok: false as const, status: 0, detail: "erreur réseau" };
  }
}

export async function drain(deps: Deps) {
  const { service } = deps;
  const key = deps.env("BREVO_API_KEY");
  if (!key) return { ok: false, reason: "no_key" };
  const iso = (ms: number) => new Date(ms).toISOString();

  // les messages « en cours » restés bloqués (panne) repartent dans la file
  await service.from("email_outbox").update({ status: "pending" }).eq("status", "sending").lt("updated_at", iso(deps.now() - STUCK_MS));

  const { data: settings } = await service.from("store_settings").select("order_emails_enabled").eq("id", 1).maybeSingle();
  if (settings?.order_emails_enabled !== true) {
    // interrupteur éteint : rien ne part, et ce qui attendait est annulé (pas de paquet surprise quand on le rallume)
    await service.from("email_outbox").update({ status: "skipped", error: "interrupteur éteint" }).eq("status", "pending");
    return { ok: true, sent: 0, off: true };
  }

  // plafond du jour (jour de N'Djamena)
  const dayStart = iso(Math.floor((deps.now() + NDJAMENA_MS) / 86_400_000) * 86_400_000 - NDJAMENA_MS);
  const { count: sentToday } = await service.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", dayStart);
  const cap = Math.max(1, Number(deps.env("EMAIL_DAILY_CAP") ?? 150) || 150);
  const room = cap - (sentToday ?? 0);
  if (room <= 0) return { ok: true, sent: 0, capped: true };

  const { data: rows } = await service.from("email_outbox").select("id,kind,order_id,user_id,attempts").eq("status", "pending").order("created_at").limit(Math.min(BATCH, room));
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows ?? []) {
    // on « prend » la ligne : un autre passage ne l'enverra pas en double
    const { data: claimed } = await service
      .from("email_outbox")
      .update({ status: "sending", attempts: (row.attempts ?? 0) + 1, updated_at: iso(deps.now()) })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    const skip = async (why: string) => {
      skipped++;
      await service.from("email_outbox").update({ status: "skipped", error: why, updated_at: iso(deps.now()) }).eq("id", row.id);
    };

    const { data: order } = await service
      .from("orders")
      .select("id,user_id,items,total,status,payment_method,shipping_city,gift_wrap,loyalty_discount,is_flagged_fake")
      .eq("id", row.order_id)
      .maybeSingle();
    if (!order || order.is_flagged_fake || order.status === "cancelled") {
      await skip("commande absente, annulée ou signalée");
      continue;
    }
    const { data: profile } = await service.from("profiles").select("full_name,email").eq("id", order.user_id).maybeSingle();
    const to = realEmail(profile?.email);
    if (!to) {
      await skip("pas d'adresse e-mail réelle");
      continue;
    }

    let mail: { subject: string; html: string };
    if (row.kind === "order_delivered") {
      const [deliv, used] = await Promise.all([
        service.from("orders").select("id", { count: "exact", head: true }).eq("user_id", order.user_id).eq("status", "delivered").eq("is_flagged_fake", false),
        service.from("orders").select("id", { count: "exact", head: true }).eq("user_id", order.user_id).gt("loyalty_discount", 0).neq("status", "cancelled"),
      ]);
      mail = orderDeliveredEmail(order as OrderRow, profile?.full_name, { delivered: deliv.error ? 0 : deliv.count ?? 0, used: used.error ? true : (used.count ?? 0) > 0 });
    } else {
      mail = orderReceivedEmail(order as OrderRow, profile?.full_name);
    }

    const res = await sendBrevo(deps, key, { to, name: String(profile?.full_name ?? "").trim() || undefined, subject: mail.subject, html: mail.html });
    if (res.ok) {
      sent++;
      await service.from("email_outbox").update({ status: "sent", sent_at: iso(deps.now()), error: null, updated_at: iso(deps.now()) }).eq("id", row.id);
    } else {
      failed++;
      // refus définitif de Brevo (clé, expéditeur…) ou 3 essais : on arrête ; sinon on réessaie à la minute suivante
      const final = (row.attempts ?? 0) + 1 >= MAX_ATTEMPTS || (res.status >= 400 && res.status < 500 && res.status !== 429);
      await service.from("email_outbox").update({ status: final ? "failed" : "pending", error: `${res.status} ${res.detail}`.slice(0, 300), updated_at: iso(deps.now()) }).eq("id", row.id);
    }
  }
  return { ok: true, sent, failed, skipped };
}
