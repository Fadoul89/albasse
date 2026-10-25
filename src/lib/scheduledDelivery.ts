// Livraison programmée (clients de N'Djamena) : jours et heures de rendez-vous proposés, contrôle, texte affiché.
// Des fonctions pures, sans réseau ni base : testées dans tests/email/scheduled-delivery.test.ts.
// Toutes les heures sont celles de N'Djamena (UTC+1 toute l'année, sans heure d'été), quel que soit le fuseau du téléphone du client :
// on ne lit jamais l'heure locale de l'appareil, tout est calculé en UTC avec le décalage d'une heure.
import { SCHEDULED_DELIVERY } from '../constants/shopRules';

const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;
const DAY_MS = 86_400_000;
const NDJAMENA_OFFSET_MS = HOUR_MS;

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

const two = (n: number) => String(n).padStart(2, '0');

// date et heure de N'Djamena d'un instant (en millisecondes)
export function ndjamenaParts(ms: number) {
  const d = new Date(ms + NDJAMENA_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay() };
}

// « 2026-10-31 » : le jour de N'Djamena d'un instant
export const dayKeyOf = (ms: number): string => {
  const p = ndjamenaParts(ms);
  return `${p.year}-${two(p.month)}-${two(p.day)}`;
};

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;

// l'instant (UTC) de « jour + heure de N'Djamena » ; null si le jour ou l'heure est mal écrit
export function slotInstant(dayKey: string, time: string): number | null {
  const d = DAY_KEY.exec(dayKey);
  const t = TIME_KEY.exec(time);
  if (!d || !t) return null;
  const ms = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])) - NDJAMENA_OFFSET_MS;
  // « 2026-02-31 » n'existe pas : le jour relu doit être le même
  return dayKeyOf(ms) === dayKey ? ms : null;
}

const minutesOf = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// tous les créneaux d'une journée : 08:30, 09:00 … 15:30
export function allSlots(): string[] {
  const out: string[] = [];
  const { firstSlot, lastSlot, stepMinutes } = SCHEDULED_DELIVERY;
  for (let m = minutesOf(firstSlot); m <= minutesOf(lastSlot); m += stepMinutes) out.push(`${two(Math.floor(m / 60))}:${two(m % 60)}`);
  return out;
}

export interface Slot {
  time: string; // « 14:30 »
  label: string; // « 14h30 »
  available: boolean; // false : trop proche (moins de 2 h)
}
export const timeLabel = (time: string) => `${Number(time.slice(0, 2))}h${time.slice(3, 5)}`;

// les créneaux d'un jour, avec ceux qui sont encore possibles
export function slotsOfDay(dayKey: string, now: number): Slot[] {
  return allSlots().map((time) => {
    const at = slotInstant(dayKey, time);
    return { time, label: timeLabel(time), available: at !== null && at - now >= SCHEDULED_DELIVERY.minLeadMinutes * MIN_MS };
  });
}

export interface DayOption {
  key: string; // « 2026-10-31 »
  label: string; // « Aujourd'hui », « Demain », « sam. 31/10 »
}

// les jours proposés : de aujourd'hui à dans 7 jours, seulement ceux où il reste au moins un créneau
export function dayOptions(now: number): DayOption[] {
  const out: DayOption[] = [];
  const todayStart = slotInstant(dayKeyOf(now), '00:00') as number;
  for (let i = 0; i <= SCHEDULED_DELIVERY.maxDaysAhead; i++) {
    const at = todayStart + i * DAY_MS;
    const key = dayKeyOf(at);
    if (!slotsOfDay(key, now).some((s) => s.available)) continue;
    const p = ndjamenaParts(at);
    out.push({ key, label: i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : `${DAYS_SHORT[p.weekday]} ${two(p.day)}/${two(p.month)}` });
  }
  return out;
}

// pourquoi un rendez-vous est refusé (null : il est bon). Même contrôle que la base.
export function slotProblem(dayKey: string | null, time: string | null, now: number): string | null {
  if (!dayKey || !time) return 'Choisissez le jour et l’heure du rendez-vous.';
  const at = slotInstant(dayKey, time);
  if (at === null) return 'Ce rendez-vous n’est pas valide. Choisissez un autre jour ou une autre heure.';
  if (!allSlots().includes(time)) return `Les rendez-vous sont possibles de ${timeLabel(SCHEDULED_DELIVERY.firstSlot)} à ${timeLabel(SCHEDULED_DELIVERY.lastSlot)}.`;
  if (at - now < SCHEDULED_DELIVERY.minLeadMinutes * MIN_MS) return `Choisissez un rendez-vous au moins ${SCHEDULED_DELIVERY.minLeadMinutes / 60} h après votre commande.`;
  if (at - now > (SCHEDULED_DELIVERY.maxDaysAhead + 1) * DAY_MS) return `Le rendez-vous doit avoir lieu dans les ${SCHEDULED_DELIVERY.maxDaysAhead} prochains jours.`;
  return null;
}

// l'heure à enregistrer sur la commande (UTC, format ISO)
export function slotToIso(dayKey: string, time: string): string | null {
  const at = slotInstant(dayKey, time);
  return at === null ? null : new Date(at).toISOString();
}

// Délai de 48 h après lequel une commande « en attente » est signalée fausse (voir auto_flag_stale_orders). Une livraison programmée payée à la
// livraison attend son rendez-vous : le délai court alors à partir du rendez-vous. Mobile Money : il faut payer sous 48 h, rendez-vous ou non.
// Même règle que add-scheduled-delivery.sql.
const FLAG_AFTER_MS = 48 * HOUR_MS;
export function waitsForAppointment(o: { payment_method?: string | null; delivery_type?: string | null; scheduled_for?: string | null }): boolean {
  return o.delivery_type === 'scheduled' && o.payment_method === 'cash_on_delivery' && Number.isFinite(Date.parse(String(o.scheduled_for ?? '')));
}
export function flagDeadlineIso(o: { created_at: string; payment_method?: string | null; delivery_type?: string | null; scheduled_for?: string | null }): string {
  const created = Date.parse(o.created_at);
  const base = waitsForAppointment(o) ? Math.max(created, Date.parse(o.scheduled_for as string)) : created;
  return new Date(base + FLAG_AFTER_MS).toISOString();
}

// « aujourd'hui à 14h30 », « demain à 9h00 », « samedi 31/10 à 14h30 » (par rapport à maintenant)
export function formatSlot(iso: string | null | undefined, now: number = Date.now()): string {
  const at = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(at)) return '';
  const p = ndjamenaParts(at);
  const time = `${p.hour}h${two(p.minute)}`;
  const today = dayKeyOf(now);
  const day = dayKeyOf(at);
  if (day === today) return `aujourd'hui à ${time}`;
  if (day === dayKeyOf(now + DAY_MS)) return `demain à ${time}`;
  return `${DAYS[p.weekday]} ${two(p.day)}/${two(p.month)} à ${time}`;
}
