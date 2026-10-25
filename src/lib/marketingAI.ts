// Zara Marketing Intelligence, côté application (écran administrateur) : types, libellés et petits calculs. Le moteur lui-même est dans
// supabase/functions/brevo-email (marketing.ts) ; ici on ne fait qu'afficher et appeler la fonction. Testé dans tests/email/marketing-ui-lib.test.ts.

export type MarketingMode = 'off' | 'simulation' | 'live';

export interface MarketingSettingsRow {
  id: 1;
  mode: MarketingMode;
  run_hour: number;
  daily_limit: number;
  min_days_between: number;
  max_per_30_days: number;
  require_approval: boolean;
  brevo_ok: boolean | null;
  brevo_checked_at: string | null;
  brevo_detail: BrevoDetail | null;
  last_simulation_at: string | null;
  last_simulation_blocking: number | null;
  test_email_at: string | null;
  test_email_message_id: string | null;
  validated_at: string | null;
  last_run_date: string | null;
}
export interface BrevoDetail {
  ok?: boolean;
  reason?: string;
  limited_key?: boolean;
  key_present?: boolean;
  events_api?: { accessible: boolean } | null;
  report_7d?: Record<string, number> | null;
  sender?: { email: string; found: boolean | null; active: boolean | null } | null;
  domain?: { name: string; authenticated: boolean | null } | null;
  endpoints?: { endpoint: string; http_status: number; message?: string }[];
}
export interface MarketingRunRow {
  id: string;
  created_at: string;
  run_date: string;
  mode: 'simulation' | 'live';
  status: 'simulated' | 'pending_approval' | 'queued' | 'expired' | 'blocked' | 'error';
  error: string | null;
  approved_at: string | null;
  planned: string | null; // summary->>recipientCount
  blocking: string | null; // summary->>blocking
}
export interface PlanSummary {
  runDate: string;
  recipientCount: number;
  blocking: number;
  deferred: number;
  catalog: { total: number; verified: number; rejected: Record<string, number>; warnings: Record<string, number> };
  clients: { total: number; eligible: number; excluded: Record<string, number> };
  segments: { key: string; label: string; eligible: number; planned: number; paused?: string | null }[];
  issues: { level: 'blocking' | 'warning' | 'info'; code: string; message: string }[];
  previews: { segment: string; label: string; lang: 'fr' | 'ar'; variant: string; subject: string; html: string }[];
  sample: { emailMasked: string; segment: string; topic?: string | null; lang: string; variant: string; subject: string; productNames: string[] }[];
  learning?: LearningSummary; // absent des anciens passages
}
// ce que Zara a appris des campagnes passées (voir marketingLearning.ts) : notes en français simple, pauses automatiques, résultats par segment
export interface LearningStats {
  sent: number;
  measured: number;
  delivered: number;
  clicked: number;
  unsubscribed: number;
  complaints: number;
  hardBounced: number;
  orders: number;
  revenue: number;
}
export interface LearningSummary {
  notes: string[];
  pausedSegments: Record<string, string>;
  bestVariant: Record<string, string>;
  segmentOrder: string[] | null;
  stats: Record<string, LearningStats>;
}

export const MODE_LABELS: Record<MarketingMode, string> = { off: 'Éteint', simulation: 'Simulation : aucun envoi', live: 'Actif : envois réels' };
export const RUN_STATUS_LABELS: Record<MarketingRunRow['status'], string> = {
  simulated: 'Simulation',
  pending_approval: 'En attente de votre approbation',
  queued: 'Mise en file',
  expired: 'Expirée',
  blocked: 'Bloquée par le verrou',
  error: 'Erreur',
};
export const EXCLUSION_LABELS: Record<string, string> = {
  desinscrit: 'Désinscrits',
  adresse_en_suppression: 'Adresses en suppression (rebond, plainte)',
  sans_adresse_reelle: 'Sans adresse e-mail réelle',
  administrateur: 'Administrateurs',
  compte_bloque: 'Comptes bloqués',
  autorisation_manquante: 'Sans autorisation marketing',
  aucun_segment_pertinent: 'Aucun segment pertinent aujourd’hui',
  frequence_minimale: 'Déjà sollicités récemment',
  plafond_30_jours: 'Plafond sur 30 jours atteint',
  commande_recente: 'Ont commandé depuis moins de 3 jours',
  pas_assez_de_nouveaux_articles: 'Pas assez de nouveaux articles à leur montrer',
  segment_en_pause: 'Leur segment est en pause automatique',
  envois_suspendus_plaintes: 'Envois suspendus (trop de plaintes)',
};
export const GATE_LABELS: Record<string, string> = {
  controle_brevo: 'Contrôle de la connexion à Brevo',
  simulation: 'Simulation sans blocage',
  email_de_test_confirme: 'E-mail de test confirmé par Brevo',
};

// les mêmes durées que le verrou de la fonction (marketing.ts : liveGate) et de la base (marketing_ai_guard)
const HOUR = 3_600_000;
export const GATE_MAX_AGE = { brevo: 24 * HOUR, simulation: 48 * HOUR, test: 30 * 24 * HOUR };
const ms = (v: string | null | undefined) => {
  const t = Date.parse(String(v ?? ''));
  return Number.isFinite(t) ? t : null;
};

export interface GateItem {
  key: 'brevo' | 'simulation' | 'test';
  ok: boolean;
  at: number | null;
  stale: boolean; // fait, mais trop ancien
}
export function gateView(s: Pick<MarketingSettingsRow, 'brevo_ok' | 'brevo_checked_at' | 'last_simulation_at' | 'last_simulation_blocking' | 'test_email_at' | 'test_email_message_id'>, now: number): GateItem[] {
  const brevoAt = ms(s.brevo_checked_at);
  const simAt = ms(s.last_simulation_at);
  const testAt = ms(s.test_email_at);
  const fresh = (at: number | null, max: number) => at !== null && now - at <= max;
  return [
    { key: 'brevo', at: brevoAt, ok: s.brevo_ok === true && fresh(brevoAt, GATE_MAX_AGE.brevo), stale: s.brevo_ok === true && brevoAt !== null && !fresh(brevoAt, GATE_MAX_AGE.brevo) },
    { key: 'simulation', at: simAt, ok: fresh(simAt, GATE_MAX_AGE.simulation) && s.last_simulation_blocking === 0, stale: simAt !== null && s.last_simulation_blocking === 0 && !fresh(simAt, GATE_MAX_AGE.simulation) },
    { key: 'test', at: testAt, ok: !!s.test_email_message_id && fresh(testAt, GATE_MAX_AGE.test), stale: !!s.test_email_message_id && testAt !== null && !fresh(testAt, GATE_MAX_AGE.test) },
  ];
}
export const gateOk = (items: GateItem[]) => items.every((i) => i.ok);

export const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)} %` : '—');

export function since(at: number | null, now: number): string {
  if (at === null) return 'jamais';
  const m = Math.max(0, Math.round((now - at) / 60_000));
  if (m < 2) return 'à l’instant';
  if (m < 90) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} jours`;
}

export function clampInt(v: string | number, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(String(v).replace(',', '.')));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

// ce que la fonction répond à « marketing_report » (voir marketingReport.ts)
export interface ReportBucket {
  queued: number;
  skipped: number;
  failed: number;
  pending: number;
  sent: number;
  confirmed: number;
  measured: number;
  delivered: number;
  clicked: number;
  clicks: number;
  bounced: number;
  hardBounced: number;
  complaints: number;
  unsubscribed: number;
  orders: number;
  revenue: number;
}
export interface MarketingReport {
  days: number;
  totals: ReportBucket;
  bySegment: Record<string, ReportBucket>;
  byVariant: Record<string, ReportBucket>;
  errors: { reason: string; count: number }[];
  eventsAwaiting: number;
  attribution: { orders: number; revenue: number; note: string };
}
