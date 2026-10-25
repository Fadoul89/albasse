// Zara Marketing Intelligence : l'apprentissage commercial. Zara relit les résultats des campagnes passées et en tire quatre réglages pour les suivantes :
//  1. la meilleure variante d'objet de chaque segment (celle qui donne le plus de clics) ;
//  2. l'ordre des segments (ceux qui rapportent clics et commandes passent devant ceux qui fatiguent les clients) ;
//  3. la pause automatique d'un segment qui provoque trop de plaintes, de désinscriptions ou de rebonds, et l'arrêt de tout envoi si les plaintes
//     sont trop nombreuses ;
//  4. les articles cliqués dans les e-mails, qui nourrissent les centres d'intérêt de chaque client (voir marketing.ts : buildFacts).
// Des fonctions pures, sans réseau ni base : testées dans tests/email/marketing-learning.test.ts.
// Règles d'honnêteté :
//  - un résultat que Brevo n'a pas encore donné n'est jamais compté comme 0 : seuls les e-mails « mesurés » comptent ;
//  - rien n'est conclu sans assez de mesures (30 e-mails par variante, 100 e-mails livrés par segment) ; en dessous, Zara garde ses règles de départ ;
//  - les commandes comptées sont celles de la visite ouverte par un clic dans l'e-mail (voir marketingReport.ts).
import { DAY_MS, FIXED_FIRST, SEGMENT_LABELS, SEGMENT_PRIORITY, type Learning, type SegmentKey, type SegmentStats, type Snapshot, type Variant } from "./marketing.ts";

export const HEALTH_WINDOW_DAYS = 30; // santé des segments : les 30 derniers jours
export const LEARN_WINDOW_DAYS = 60; // meilleure variante : les 60 derniers jours
export const UNSUB_WINDOW_DAYS = 7; // une désinscription est rattachée au dernier e-mail reçu dans les 7 jours avant
export const MIN_VARIANT_SAMPLE = 30; // e-mails mesurés par variante avant d'en préférer une
export const MIN_SEGMENT_SAMPLE = 100; // e-mails livrés par segment avant de le classer
export const MIN_VARIANT_LEAD = 1.25; // la meilleure variante doit avoir au moins 25 % de clics en plus que la deuxième…
export const MIN_VARIANT_GAP = 0.02; // … et au moins 2 points de plus (sinon c'est du hasard)

// seuils de santé (sur 30 jours) : au-delà, le segment est mis en pause tout seul
export const HEALTH = {
  segmentComplaintsMin: 2, // plaintes minimum pour mettre un segment en pause…
  globalComplaintsMin: 3, // … ou pour tout suspendre…
  complaintRateMax: 0.003, // … quand elles dépassent 0,3 % des e-mails livrés
  unsubRateMax: 0.02, // désinscriptions : plus de 2 % des e-mails livrés
  unsubFrom: 50, // … à partir de 50 e-mails livrés
  hardBounceRateMax: 0.05, // rebonds définitifs : plus de 5 % des e-mails mesurés
  hardBounceFrom: 50,
};
// la valeur d'un segment : chaque clic compte 1, une commande attribuée 10, une désinscription −10, une plainte −20 (par e-mail livré)
export const ORDER_WEIGHT = 10;
export const UNSUB_WEIGHT = 10;
export const COMPLAINT_WEIGHT = 20;
export const segmentValue = (s: SegmentStats) => (s.delivered > 0 ? (s.clicked + ORDER_WEIGHT * s.orders - UNSUB_WEIGHT * s.unsubscribed - COMPLAINT_WEIGHT * s.complaints) / s.delivered : 0);

const VARIANTS: Variant[] = ["A", "B", "C"];
const isSegment = (s: unknown): s is SegmentKey => typeof s === "string" && (SEGMENT_PRIORITY as string[]).includes(s);
const emptyStats = (): SegmentStats => ({ sent: 0, measured: 0, delivered: 0, clicked: 0, unsubscribed: 0, complaints: 0, hardBounced: 0, orders: 0, revenue: 0 });
const pct = (n: number, d: number) => (d > 0 ? `${(Math.round((n / d) * 1000) / 10).toString().replace(".", ",")} %` : "—");

export function computeLearning(snap: Snapshot, orderStats?: Partial<Record<string, { orders: number; revenue: number }>>): Learning {
  const { now } = snap;
  const sent = snap.sent.filter((h) => h.kind === "marketing" && h.status === "sent" && isSegment(h.segment));

  // 1. les résultats par segment (30 jours) et par variante (60 jours)
  const stats: Partial<Record<SegmentKey, SegmentStats>> = {};
  const variants: Partial<Record<SegmentKey, Partial<Record<Variant, { measured: number; clicked: number }>>>> = {};
  const recent: typeof sent = [];
  for (const h of sent) {
    const seg = h.segment as SegmentKey;
    const age = now - h.createdAt;
    if (age <= HEALTH_WINDOW_DAYS * DAY_MS) {
      recent.push(h);
      const s = (stats[seg] ??= emptyStats());
      s.sent++;
      if (h.measured) {
        s.measured++;
        if (h.delivered) s.delivered++;
        if (h.clicked) s.clicked++;
        if (h.hardBounced) s.hardBounced++;
        if (h.complaint) s.complaints++;
      }
    }
    if (age <= LEARN_WINDOW_DAYS * DAY_MS && h.measured && VARIANTS.includes(h.variant as Variant)) {
      const v = ((variants[seg] ??= {})[h.variant as Variant] ??= { measured: 0, clicked: 0 });
      v.measured++;
      if (h.clicked) v.clicked++;
    }
  }
  // une désinscription compte pour le dernier e-mail de campagne reçu dans les 7 jours avant (jamais pour deux)
  const byUser = new Map<string, typeof recent>();
  for (const h of recent) byUser.set(h.userId, [...(byUser.get(h.userId) ?? []), h]);
  for (const c of snap.clients) {
    const u = c.unsubscribedAt;
    if (u === null) continue;
    const last = (byUser.get(c.id) ?? [])
      .filter((h) => (h.sentAt ?? h.createdAt) <= u && u - (h.sentAt ?? h.createdAt) <= UNSUB_WINDOW_DAYS * DAY_MS)
      .sort((a, b) => (b.sentAt ?? b.createdAt) - (a.sentAt ?? a.createdAt))[0];
    if (last) (stats[last.segment as SegmentKey] as SegmentStats).unsubscribed++;
  }
  for (const [seg, o] of Object.entries(orderStats ?? {})) {
    if (!isSegment(seg) || !o) continue;
    const s = (stats[seg] ??= emptyStats());
    s.orders = o.orders;
    s.revenue = o.revenue;
  }

  const notes: string[] = [];

  // 2. la santé : un segment qui fatigue ses clients est mis en pause tout seul
  const pausedSegments: Partial<Record<SegmentKey, string>> = {};
  for (const seg of SEGMENT_PRIORITY) {
    const s = stats[seg];
    if (!s) continue;
    let why: string | null = null;
    if (s.complaints >= HEALTH.segmentComplaintsMin && s.complaints / Math.max(1, s.delivered) > HEALTH.complaintRateMax) why = `${s.complaints} plainte(s) sur ${s.delivered} e-mails livrés`;
    else if (s.delivered >= HEALTH.unsubFrom && s.unsubscribed / s.delivered > HEALTH.unsubRateMax) why = `${s.unsubscribed} désinscription(s) sur ${s.delivered} e-mails livrés (${pct(s.unsubscribed, s.delivered)})`;
    else if (s.measured >= HEALTH.hardBounceFrom && s.hardBounced / s.measured > HEALTH.hardBounceRateMax) why = `${s.hardBounced} rebond(s) définitif(s) sur ${s.measured} e-mails mesurés (${pct(s.hardBounced, s.measured)})`;
    if (why) {
      pausedSegments[seg] = why;
      notes.push(`Segment « ${SEGMENT_LABELS[seg]} » mis en pause : ${why}.`);
    }
  }
  const total = Object.values(stats).reduce((a, s) => ({ delivered: a.delivered + (s?.delivered ?? 0), complaints: a.complaints + (s?.complaints ?? 0) }), { delivered: 0, complaints: 0 });
  const globalAlert = total.complaints >= HEALTH.globalComplaintsMin && total.complaints / Math.max(1, total.delivered) > HEALTH.complaintRateMax ? `${total.complaints} plainte(s) sur ${total.delivered} e-mails livrés en ${HEALTH_WINDOW_DAYS} jours : tous les envois sont suspendus` : null;
  if (globalAlert) notes.push(`${globalAlert}.`);

  // 3. la meilleure variante d'objet : seulement avec assez de mesures pour chacune des trois et une vraie avance
  const bestVariant: Partial<Record<SegmentKey, Variant>> = {};
  for (const seg of SEGMENT_PRIORITY) {
    const byV = variants[seg];
    if (!byV) continue;
    const rows = VARIANTS.map((v) => ({ v, n: byV[v]?.measured ?? 0, clicked: byV[v]?.clicked ?? 0 })).map((r) => ({ ...r, rate: r.n ? r.clicked / r.n : 0 }));
    if (rows.some((r) => r.n < MIN_VARIANT_SAMPLE)) continue;
    const [first, second] = [...rows].sort((a, b) => b.rate - a.rate);
    if (first.rate >= second.rate * MIN_VARIANT_LEAD && first.rate - second.rate >= MIN_VARIANT_GAP) {
      bestVariant[seg] = first.v;
      notes.push(`« ${SEGMENT_LABELS[seg]} » : l'objet ${first.v} donne le plus de clics (${pct(first.clicked, first.n)} contre ${pct(second.clicked, second.n)}) : 7 clients sur 10 le reçoivent, les autres continuent d'essayer les trois.`);
    }
  }

  // 4. l'ordre des segments : les trois premiers restent en tête ; parmi les autres, ceux qui ont assez de mesures sont classés par valeur et
  //    reprennent les places de ceux qu'ils remplacent (un segment sans assez de mesures garde sa place)
  const open = SEGMENT_PRIORITY.filter((s) => !FIXED_FIRST.includes(s));
  const measured = open.filter((s) => (stats[s]?.delivered ?? 0) >= MIN_SEGMENT_SAMPLE);
  let segmentOrder: SegmentKey[] | null = null;
  if (measured.length >= 2) {
    const ranked = [...measured].sort((a, b) => segmentValue(stats[b]!) - segmentValue(stats[a]!) || SEGMENT_PRIORITY.indexOf(a) - SEGMENT_PRIORITY.indexOf(b));
    const slots = open.map((s, i) => (measured.includes(s) ? i : -1)).filter((i) => i >= 0);
    const placed = [...open];
    slots.forEach((slot, k) => (placed[slot] = ranked[k]));
    if (placed.some((s, i) => s !== open[i])) {
      segmentOrder = [...FIXED_FIRST, ...placed];
      notes.push(`Nouvel ordre : ${ranked.map((s) => SEGMENT_LABELS[s]).join(", puis ")} (clics, commandes attribuées, moins de désinscriptions et de plaintes).`);
    }
  }
  for (const seg of measured) {
    const s = stats[seg]!;
    notes.push(`« ${SEGMENT_LABELS[seg]} » : ${pct(s.clicked, s.delivered)} de clics, ${s.orders} commande(s) attribuée(s), ${pct(s.unsubscribed, s.delivered)} de désinscriptions sur ${s.delivered} e-mails livrés.`);
  }
  if (notes.length === 0) notes.push("Pas encore assez de résultats mesurés pour apprendre : Zara garde ses règles de départ.");
  return { stats, pausedSegments, globalAlert, bestVariant, segmentOrder, notes };
}
