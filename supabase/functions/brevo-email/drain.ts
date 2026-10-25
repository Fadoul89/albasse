// Envoi automatique des e-mails de commande : lit la file (table email_outbox) et envoie par Brevo.
// Écrit sans dépendance à Deno (service, variables, fetch et horloge sont passés en paramètres) : testé dans tests/email/drain.test.ts.
import { SITE, orderDeliveredEmail, orderReceivedEmail, realEmail, welcomeEmail, type OrderRow } from "./orderEmails.ts";
import { inactiveClientEmail, pickProducts, type PromoProduct } from "./promoEmails.ts";

export interface Deps {
  // deno-lint-ignore no-explicit-any
  service: any; // client Supabase avec la clé de service
  env: (name: string) => string | undefined;
  fetchFn: typeof fetch;
  now: () => number;
}

export const BATCH = 20; // e-mails par passage (un passage par minute)
export const PROMO_BATCH = 5; // e-mails publicitaires par passage : ils partent au goutte-à-goutte, après ceux des commandes
export const MAX_ATTEMPTS = 3;
const NDJAMENA_MS = 3600_000; // UTC+1, sans heure d'été
const STUCK_MS = 600_000; // un message « en cours » depuis plus de 10 minutes est repris
const WELCOME_DELAY_MS = 45_000; // l'e-mail de bienvenue attend que le nom saisi à l'inscription soit enregistré

export async function sendBrevo(deps: Deps, key: string, mail: { to: string; name?: string; subject: string; html: string; headers?: Record<string, string> }) {
  const sender = { email: deps.env("EMAIL_SENDER") || "contact@albasseshopping.com", name: deps.env("EMAIL_SENDER_NAME") || "Albasse Shopping" };
  try {
    const res = await deps.fetchFn("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender, replyTo: sender, to: [{ email: mail.to, ...(mail.name ? { name: mail.name } : {}) }], subject: mail.subject, htmlContent: mail.html, ...(mail.headers ? { headers: mail.headers } : {}) }),
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

// Articles à montrer dans les e-mails publicitaires : en vente et en stock (les ventes flash en cours passent en premier, voir promoEmails.ts)
export async function loadPromoProducts(service: Deps["service"]): Promise<PromoProduct[]> {
  const { data } = await service
    .from("products")
    .select("id,name,slug,price,compare_at_price,images,is_flash_sale,flash_sale_ends_at,created_at")
    .eq("is_active", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as PromoProduct[];
}

// Lien de désinscription : la page du site pour le client, et l'en-tête « List-Unsubscribe » pour le bouton « Se désabonner » de la messagerie
export const unsubscribeLinks = (supabaseUrl: string | undefined, token: string) => ({
  page: `${SITE}/desinscription?t=${token}`,
  headers: {
    "List-Unsubscribe": `<${(supabaseUrl || "https://xtitsmmccpkelxfjyqyh.supabase.co").replace(/\/$/, "")}/functions/v1/brevo-email?unsub=${token}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
});

export async function drain(deps: Deps) {
  const { service } = deps;
  const key = deps.env("BREVO_API_KEY");
  if (!key) return { ok: false, reason: "no_key" };
  const iso = (ms: number) => new Date(ms).toISOString();

  // les messages « en cours » restés bloqués (panne) repartent dans la file
  await service.from("email_outbox").update({ status: "pending" }).eq("status", "sending").lt("updated_at", iso(deps.now() - STUCK_MS));

  const { data: settings } = await service.from("store_settings").select("order_emails_enabled,inactive_emails_enabled").eq("id", 1).maybeSingle();
  if (settings?.order_emails_enabled !== true) {
    // interrupteur éteint : rien ne part, et ce qui attendait est annulé (pas de paquet surprise quand on le rallume)
    await service.from("email_outbox").update({ status: "skipped", error: "interrupteur éteint" }).eq("status", "pending");
    return { ok: true, sent: 0, off: true };
  }
  const promoOn = settings?.inactive_emails_enabled === true;
  if (!promoOn) await service.from("email_outbox").update({ status: "skipped", error: "interrupteur publicité éteint" }).eq("status", "pending").eq("kind", "promo_inactive");

  // plafond du jour (jour de N'Djamena)
  const dayStart = iso(Math.floor((deps.now() + NDJAMENA_MS) / 86_400_000) * 86_400_000 - NDJAMENA_MS);
  const { count: sentToday } = await service.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", dayStart);
  const cap = Math.max(1, Number(deps.env("EMAIL_DAILY_CAP") ?? 150) || 150);
  const room = cap - (sentToday ?? 0);
  if (room <= 0) return { ok: true, sent: 0, capped: true };

  const cols = "id,kind,order_id,user_id,attempts,created_at";
  const { data: main } = await service.from("email_outbox").select(cols).eq("status", "pending").neq("kind", "promo_inactive").order("created_at").limit(Math.min(BATCH, room));
  const rows = [...(main ?? [])];
  // la publicité passe après les e-mails de commande et de bienvenue, au goutte-à-goutte
  const promoRoom = Math.min(PROMO_BATCH, BATCH - rows.length, room - rows.length);
  if (promoOn && promoRoom > 0) {
    const { data: promo } = await service.from("email_outbox").select(cols).eq("status", "pending").eq("kind", "promo_inactive").order("created_at").limit(promoRoom);
    rows.push(...(promo ?? []));
  }
  let promoProducts: PromoProduct[] | null = null;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.kind === "welcome" && deps.now() - Date.parse(row.created_at) < WELCOME_DELAY_MS) continue;
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
    const send = async (to: string, fullName: unknown, mail: { subject: string; html: string; headers?: Record<string, string> }) => {
      const res = await sendBrevo(deps, key, { to, name: String(fullName ?? "").trim() || undefined, subject: mail.subject, html: mail.html, headers: mail.headers });
      if (res.ok) {
        sent++;
        await service.from("email_outbox").update({ status: "sent", sent_at: iso(deps.now()), error: null, updated_at: iso(deps.now()) }).eq("id", row.id);
      } else {
        failed++;
        // refus définitif de Brevo (clé, expéditeur…) ou 3 essais : on arrête ; sinon on réessaie à la minute suivante
        const final = (row.attempts ?? 0) + 1 >= MAX_ATTEMPTS || (res.status >= 400 && res.status < 500 && res.status !== 429);
        await service.from("email_outbox").update({ status: final ? "failed" : "pending", error: `${res.status} ${res.detail}`.slice(0, 300), updated_at: iso(deps.now()) }).eq("id", row.id);
      }
    };

    // publicité aux clients absents : tout est relu au moment de l'envoi (promotions acceptées, pas bloqué, pas désinscrit)
    if (row.kind === "promo_inactive") {
      const { data: client } = await service.from("profiles").select("full_name,email,banned,notify_promotions").eq("id", row.user_id).maybeSingle();
      const dest = realEmail(client?.email);
      if (!client || client.banned || !dest || client.notify_promotions !== true) {
        await skip("compte absent, bloqué, sans adresse réelle ou sans promotions acceptées");
        continue;
      }
      const { data: prefs } = await service.from("email_prefs").select("token,unsubscribed_at").eq("user_id", row.user_id).maybeSingle();
      if (!prefs?.token || prefs.unsubscribed_at) {
        await skip("désinscrit des e-mails publicitaires");
        continue;
      }
      promoProducts ??= await loadPromoProducts(service);
      const pick = pickProducts(promoProducts, deps.now());
      if (pick.products.length === 0) {
        await skip("aucun article à montrer");
        continue;
      }
      const links = unsubscribeLinks(deps.env("SUPABASE_URL"), prefs.token);
      const ad = inactiveClientEmail({ fullName: client.full_name, products: pick.products, flashEndsAt: pick.flashEndsAt, unsubscribeUrl: links.page });
      await send(dest, client.full_name, { ...ad, headers: links.headers });
      continue;
    }

    // bienvenue : pas de commande, on lit le profil du client
    if (row.kind === "welcome") {
      const { data: client } = await service.from("profiles").select("full_name,email,banned").eq("id", row.user_id).maybeSingle();
      const dest = realEmail(client?.email);
      if (!client || client.banned || !dest) {
        await skip("compte absent, bloqué ou sans adresse e-mail réelle");
        continue;
      }
      await send(dest, client.full_name, welcomeEmail(client.full_name));
      continue;
    }

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

    await send(to, profile?.full_name, mail);
  }
  return { ok: true, sent, failed, skipped };
}
