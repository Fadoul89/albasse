// Zara Marketing Intelligence : le rapport de l'administrateur (campagnes mises en file et envoyées, livraison, clics, désinscriptions,
// rebonds, plaintes, commandes et revenus attribués, comparaison des segments et des variantes). Calculé côté serveur, car la désinscription
// (table email_prefs) n'est lisible que par la fonction. Testé dans tests/email/marketing-report.test.ts.
// Honnêteté des chiffres :
//  - « envoyé » = accepté par Brevo ; « confirmé » = Brevo a donné l'identifiant du message ; « livré », « clics », « rebonds » et « plaintes » viennent
//    seulement des événements lus chez Brevo (marketingRun.syncEvents) : tant qu'ils n'ont pas été lus, ils restent NON MESURÉS (null), jamais 0 ;
//  - les commandes et revenus attribués sont ceux dont la session du site porte le suivi de la campagne (utm_medium=email, utm_campaign=zmi-…) :
//    le client qui commande plus tard, depuis une autre visite, n'est pas compté. Le revenu ne compte que les commandes livrées et non signalées fausses.
import { DAY_MS, SEGMENT_PRIORITY, type SegmentKey } from "./marketing.ts";
import type { Deps } from "./drain.ts";

export interface Bucket {
  queued: number; // lignes mises en file par le plan
  skipped: number; // annulées au moment de l'envoi (désinscrit, suppression, article épuisé, verrou…)
  failed: number; // refusées par Brevo
  pending: number; // encore en attente d'envoi
  sent: number; // acceptées par Brevo
  confirmed: number; // acceptées avec l'identifiant du message donné par Brevo
  measured: number; // confirmées dont les événements ont été lus chez Brevo
  delivered: number;
  clicked: number; // e-mails avec au moins un clic
  clicks: number;
  bounced: number;
  hardBounced: number;
  complaints: number;
  unsubscribed: number; // désinscriptions dans les 7 jours après l'envoi
  orders: number;
  revenue: number;
}
const empty = (): Bucket => ({ queued: 0, skipped: 0, failed: 0, pending: 0, sent: 0, confirmed: 0, measured: 0, delivered: 0, clicked: 0, clicks: 0, bounced: 0, hardBounced: 0, complaints: 0, unsubscribed: 0, orders: 0, revenue: 0 });

export interface ReportRow {
  user_id: string | null;
  segment: string | null;
  variant: string | null;
  status: string;
  sent_at: string | null;
  provider_message_id: string | null;
  delivered_at: string | null;
  click_count: number | null;
  bounce_type: string | null;
  complaint_at: string | null;
  events_synced_at: string | null;
  error: string | null;
}
export interface ReportInput {
  now: number;
  days: number;
  rows: ReportRow[];
  unsubscribes: { user_id: string; unsubscribed_at: string }[];
  orders: { session_id: string | null; status: string; total: number | string; is_flagged_fake: boolean | null }[];
  sessions: { id: string; utm_medium: string | null; utm_campaign: string | null }[];
}
export interface Report {
  days: number;
  totals: Bucket;
  bySegment: Record<string, Bucket>;
  byVariant: Record<string, Bucket>;
  errors: { reason: string; count: number }[];
  eventsAwaiting: number; // e-mails confirmés dont les événements n'ont pas encore été lus
  attribution: { orders: number; revenue: number; note: string };
}

const bump = (rows: Bucket[], f: (b: Bucket) => void) => rows.forEach(f);

export function computeReport(i: ReportInput): Report {
  const totals = empty();
  const bySegment: Record<string, Bucket> = {};
  const byVariant: Record<string, Bucket> = {};
  const errs = new Map<string, number>();
  const buckets = (r: { segment: string | null; variant: string | null }): Bucket[] => {
    const seg = r.segment ?? "inconnu";
    const out = [totals, (bySegment[seg] ??= empty())];
    if (r.variant) out.push((byVariant[r.variant] ??= empty()));
    return out;
  };
  const byUser = new Map<string, ReportRow[]>();
  for (const r of i.rows) {
    const b = buckets(r);
    bump(b, (x) => x.queued++);
    if (r.status === "pending" || r.status === "sending") bump(b, (x) => x.pending++);
    if (r.status === "skipped") {
      bump(b, (x) => x.skipped++);
      if (r.error) errs.set(r.error, (errs.get(r.error) ?? 0) + 1);
    }
    if (r.status === "failed") {
      bump(b, (x) => x.failed++);
      if (r.error) errs.set(r.error.slice(0, 80), (errs.get(r.error.slice(0, 80)) ?? 0) + 1);
    }
    if (r.status === "sent") {
      bump(b, (x) => x.sent++);
      if (r.user_id) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
      if (r.provider_message_id) bump(b, (x) => x.confirmed++);
      if (r.provider_message_id && r.events_synced_at) {
        bump(b, (x) => x.measured++);
        if (r.delivered_at) bump(b, (x) => x.delivered++);
        if ((r.click_count ?? 0) > 0) bump(b, (x) => (x.clicked++, (x.clicks += r.click_count ?? 0)));
        if (r.bounce_type) bump(b, (x) => (x.bounced++, r.bounce_type === "hard" && x.hardBounced++));
        if (r.complaint_at) bump(b, (x) => x.complaints++);
      }
    }
  }
  // désinscription : rattachée au dernier e-mail de campagne reçu dans les 7 jours avant
  for (const u of i.unsubscribes) {
    const at = Date.parse(u.unsubscribed_at);
    const last = (byUser.get(u.user_id) ?? [])
      .filter((r) => r.sent_at && Date.parse(r.sent_at) <= at && at - Date.parse(r.sent_at) <= 7 * DAY_MS)
      .sort((a, b) => Date.parse(b.sent_at!) - Date.parse(a.sent_at!))[0];
    if (last) bump(buckets(last), (x) => x.unsubscribed++);
  }
  // commandes attribuées : la session porte le suivi de la campagne ; le revenu ne compte que les commandes livrées et vraies
  const tagOf = new Map<string, string>();
  for (const s of i.sessions) if (s.utm_medium === "email" && /^zmi-\d{8}-.+$/.test(s.utm_campaign ?? "")) tagOf.set(s.id, s.utm_campaign!);
  let orders = 0;
  let revenue = 0;
  for (const o of i.orders) {
    const tag = o.session_id ? tagOf.get(o.session_id) : undefined;
    if (!tag || o.is_flagged_fake === true || o.status === "cancelled") continue;
    const seg = tag.replace(/^zmi-\d{8}-/, "");
    const b = (bySegment[seg] ??= empty());
    b.orders++;
    totals.orders++;
    orders++;
    if (o.status === "delivered") {
      const t = Number(o.total) || 0;
      b.revenue += t;
      totals.revenue += t;
      revenue += t;
    }
  }
  // les segments sans aucun e-mail apparaissent quand même (comparaison complète)
  for (const key of SEGMENT_PRIORITY as SegmentKey[]) bySegment[key] ??= empty();
  return {
    days: i.days,
    totals,
    bySegment,
    byVariant,
    errors: [...errs.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    eventsAwaiting: i.rows.filter((r) => r.status === "sent" && r.provider_message_id && !r.events_synced_at).length,
    attribution: { orders, revenue, note: "Commandes passées pendant la visite ouverte par un clic dans l'e-mail ; revenu = commandes livrées seulement. Un client qui commande plus tard, depuis une autre visite, n'est pas compté." },
  };
}

export async function loadReport(deps: Deps, days = 30): Promise<Report> {
  const since = new Date(deps.now() - days * DAY_MS).toISOString();
  const { service } = deps;
  const [rows, prefs, orders, sessions] = await Promise.all([
    service.from("email_outbox").select("user_id,segment,variant,status,sent_at,provider_message_id,delivered_at,click_count,bounce_type,complaint_at,events_synced_at,error").eq("kind", "marketing").gte("created_at", since).order("created_at").limit(5000),
    service.from("email_prefs").select("user_id,unsubscribed_at").gte("unsubscribed_at", since).limit(5000),
    service.from("orders").select("session_id,status,total,is_flagged_fake").gte("created_at", since).not("session_id", "is", null).limit(5000),
    service.from("visitor_sessions").select("id,utm_medium,utm_campaign").like("utm_campaign", "zmi-%").gte("created_at", since).limit(5000),
  ]);
  return computeReport({ now: deps.now(), days, rows: rows.data ?? [], unsubscribes: prefs.data ?? [], orders: orders.data ?? [], sessions: sessions.data ?? [] });
}
