// Les moments forts de l'année (Tabaski, Ramadan, Korité, mariages, fête des mères, Saint-Valentin, Black Friday) : Zara les reconnaît
// quand le client en parle, et en parle d'elle-même quand la date approche. Elle n'annonce AUCUNE remise (seulement les vraies promotions
// de la boutique, pour le Black Friday). Aucun écran, aucun réseau : tout est testable.

import { foldArabic } from './assistantLang';
import { normalize } from './assistantBrain';

export type OccasionKey = 'tabaski' | 'ramadan' | 'korite' | 'wedding' | 'mothersDay' | 'valentine' | 'blackFriday';

const ar = (pattern: string) => new RegExp(foldArabic(pattern));

// Dans l'ordre : le plus précis d'abord (« Aïd el Fitr » avant « Aïd »).
const OCCASIONS: { key: OccasionKey; re: RegExp }[] = [
  { key: 'blackFriday', re: ar('black ?friday|blackfriday|الجمعه السوداء|بلاك ?فرايداي|بلاك ?فراي ?داي') },
  { key: 'valentine', re: ar('saint ?valentin|st valentin|valentin|valentine|عيد الحب|فالنتاين|فالنتين') },
  { key: 'mothersDay', re: ar('fete des meres|fete de la mere|fete maman|jour de la mere|mother s day|mothers day|عيد الام') },
  { key: 'korite', re: ar('korite|aid el fitr|aid al fitr|eid al fitr|eid el fitr|eid fitr|عيد الفطر') },
  { key: 'tabaski', re: ar('tabaski|aid el kebir|aid al adha|eid al adha|eid el adha|eid adha|عيد الاضحي|عيد الأضحى') },
  { key: 'ramadan', re: ar('ramadan|ramadhan|ramazan|رمضان') },
  { key: 'wedding', re: ar('mariage|(me|se|nous) (marie|marier|marions|marient)|noces|wedding|fiancailles|زواج|عرس|زفاف|خطوبه') },
];

export function occasionOf(text: string): OccasionKey | null {
  const n = normalize(text);
  if (!n) return null;
  for (const o of OCCASIONS) if (o.re.test(n)) return o.key;
  return null;
}

// Le texte sans le nom du moment fort (« un parfum pour la fête des mères » -> « un parfum pour la ») : le reste dit ce que cherche le client.
export function stripOccasion(text: string): string {
  let n = normalize(text);
  for (const o of OCCASIONS) n = n.replace(new RegExp(o.re.source, 'g'), ' ');
  return n.replace(/\s+/g, ' ').trim();
}

// Les dates des fêtes qui suivent la lune (Ramadan, Korité, Tabaski) sont des estimations à un jour près : les fenêtres sont larges, donc
// sans importance. Après la dernière date de cette liste, Zara arrête d'en parler d'elle-même (elle répond toujours si le client en parle).
interface EventWindow {
  key: OccasionKey;
  date: string; // jour de la fête (ou début du Ramadan)
  lead: number; // Zara en parle ce nombre de jours avant
  after: number; // et ce nombre de jours après
}

export const OCCASION_EVENTS: EventWindow[] = [
  { key: 'valentine', date: '2026-02-14', lead: 10, after: 0 },
  { key: 'ramadan', date: '2026-02-18', lead: 14, after: 14 },
  { key: 'korite', date: '2026-03-20', lead: 7, after: 0 },
  { key: 'tabaski', date: '2026-05-27', lead: 14, after: 0 },
  { key: 'blackFriday', date: '2026-11-27', lead: 21, after: 0 },
  { key: 'valentine', date: '2027-02-14', lead: 10, after: 0 },
  { key: 'ramadan', date: '2027-02-08', lead: 14, after: 14 },
  { key: 'korite', date: '2027-03-10', lead: 7, after: 0 },
  { key: 'tabaski', date: '2027-05-17', lead: 14, after: 0 },
  { key: 'blackFriday', date: '2027-11-26', lead: 21, after: 0 },
];

const DAY = 24 * 3600 * 1000;

// Le moment fort dont la date approche (ou qui vient de commencer) : le plus proche ; rien en dehors de ces périodes.
export function upcomingOccasion(now: number | Date = Date.now()): OccasionKey | null {
  const t = typeof now === 'number' ? now : now.getTime();
  let best: { key: OccasionKey; gap: number } | null = null;
  for (const e of OCCASION_EVENTS) {
    const day = Date.parse(`${e.date}T12:00:00Z`);
    if (t >= day - e.lead * DAY - DAY / 2 && t <= day + e.after * DAY + DAY / 2) {
      const gap = Math.abs(day - t);
      if (!best || gap < best.gap) best = { key: e.key, gap };
    }
  }
  return best ? best.key : null;
}
