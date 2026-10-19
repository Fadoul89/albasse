// Notifications push programmées : l'heure du Tchad (UTC+1 toute l'année), le titre et les vérifications avant de programmer.
// Sans accès à la base : testable seul.
import { chadDayIso, dayLabelOf } from './assistantSales';

export const PUSH_MESSAGE_MAX = 120;
export const PUSH_TITLE_MAX = 60;
const CHAD_OFFSET_MS = 3600000;

// « 2026-10-20 » + « 18:30 » (heure du Tchad) -> l'instant exact (ISO, UTC) ; null si la date ou l'heure est invalide.
export function chadToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// L'heure du Tchad d'un instant : « 18:30 ».
export function chadTimeOf(iso: string): string {
  const d = new Date(new Date(iso).getTime() + CHAD_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// « lundi 20 oct. à 18:30 » (heure du Tchad).
export function chadLabel(iso: string): string {
  return `${dayLabelOf(chadDayIso(new Date(iso)))} à ${chadTimeOf(iso)}`;
}

// Le titre de la notification : le nom de l'article (coupé proprement s'il est long).
export function pushTitleFor(productName: string): string {
  const name = productName.replace(/\s+/g, ' ').trim();
  const full = `🛍️ ${name}`;
  return full.length <= PUSH_TITLE_MAX ? full : `${full.slice(0, PUSH_TITLE_MAX - 1).trimEnd()}…`;
}

// Le jour et l'heure proposés par défaut : dans une heure, à l'heure pile (heure du Tchad).
export function defaultChadSlot(now: Date = new Date()): { date: string; time: string } {
  const next = new Date(now.getTime() + 3600000);
  next.setUTCMinutes(0, 0, 0);
  return { date: chadDayIso(next), time: chadTimeOf(next.toISOString()) };
}

// Ce qui manque avant de programmer ; null si tout est bon.
export function scheduleProblem(
  input: { productId: string | null; message: string; date: string; time: string },
  now: Date = new Date()
): string | null {
  if (!input.productId) return 'Choisissez un article.';
  const message = input.message.trim();
  if (!message) return 'Écrivez un message court.';
  if (message.length > PUSH_MESSAGE_MAX) return `Le message est trop long (${PUSH_MESSAGE_MAX} caractères au plus).`;
  const iso = chadToIso(input.date, input.time);
  if (!iso) return 'Choisissez le jour et l’heure.';
  if (new Date(iso).getTime() <= now.getTime()) return 'Cette heure est déjà passée : choisissez une heure à venir.';
  return null;
}

// La marque d'une notification touchée (même calcul que public/sw.js et la base) : les 16 premiers caractères du SHA-256
// de « titre + retour à la ligne + message ».
export async function pushClickHash(title: string, message: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${title}\n${message}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// La marque « ?push=… » dans l'adresse ouverte par une notification ; null s'il n'y en a pas (ou si elle est mal formée).
export function readPushTag(search: string): string | null {
  const m = /[?&]push=([0-9a-f]{16})(?:&|#|$)/.exec(search);
  return m ? m[1] : null;
}

// « 👆 3 clics » et « envoyée à 11 téléphones · 27 % » sous une notification envoyée.
export function clickStats(clicks: number | null | undefined, recipients: number | null | undefined): { main: string; sub: string | null } {
  const n = Math.max(0, Number(clicks) || 0);
  const main = `👆 ${n} clic${n > 1 ? 's' : ''}`;
  const r = Number(recipients) || 0;
  if (r <= 0) return { main, sub: null };
  const rate = Math.round((n / r) * 100);
  return { main, sub: `envoyée à ${r} téléphone${r > 1 ? 's' : ''} · ${rate} %` };
}
