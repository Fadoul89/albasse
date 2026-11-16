// Menu ☰ de l'accueil (demande du patron, 15 novembre 2026 : « un menu comme Jumia : le profil du client avec ses points, puis les catégories une à une »).
// Ce fichier ne fait que PRÉPARER ce que le menu montre : aucun réseau, rien d'inventé (les points viennent du compte, les catégories de la boutique).
import { getLoyaltyStatus } from './loyalty';
import { formatClientNumber } from './clientNumber';
import { mainCategories, parentOf, subCategoriesOf } from './subCategories';
import { OCCASION_EVENTS, upcomingOccasion, type OccasionKey } from './assistantOccasions';
import type { Category, Profile } from '../types';

export interface MenuProfile {
  name: string;
  initial: string;
  avatarUrl: string | null;
  clientNumber: string | null; // « AS-000883 »
  points: number;
  tierLabel: string; // « Argent »
  tierIcon: string; // « 🥈 »
  progress: number; // 0 à 1 vers le prochain palier
  hint: string; // « 23 pts avant le palier 🥇 Or » / « Palier le plus haut atteint 👑 »
}

export const MENU_TEXT = {
  open: 'Ouvrir le menu',
  close: 'Fermer le menu',
  title: 'Menu',
  profileTitle: '👤 Profil client',
  guestLine: 'Connectez-vous pour voir votre profil et vos points.',
  login: 'Se connecter',
  register: 'Créer un compte',
  categories: '🗂️ Catégories',
  noCategories: 'Aucune catégorie pour le moment.',
  viewProfile: 'Voir mon compte ›',
  // menu « verre courbé » (demande du patron, 16 novembre 2026, comme la vidéo « Curved Sidebar »)
  brand: 'ALBASSE',
  categoriesLabel: 'CATÉGORIES',
  seeAll: 'Tout voir',
  openSubs: (name: string) => `Voir les sous-catégories de ${name}`,
  closeSubs: (name: string) => `Cacher les sous-catégories de ${name}`,
  account: 'Mon compte',
  signOut: 'Se déconnecter',
  highlightTag: 'À LA UNE',
  highlightCta: 'VOIR LES PROMOS ›',
};

/** Le profil montré dans le menu, ou null pour un visiteur sans compte. */
export function menuProfile(profile: Pick<Profile, 'full_name' | 'email' | 'avatar_url' | 'client_number' | 'loyalty_points'> | null | undefined): MenuProfile | null {
  if (!profile) return null;
  const name = (profile.full_name ?? '').trim() || 'Client Albasse';
  const points = Math.max(0, Math.floor(Number(profile.loyalty_points) || 0));
  const s = getLoyaltyStatus(points);
  return {
    name,
    initial: (name[0] ?? '?').toUpperCase(),
    avatarUrl: profile.avatar_url || null,
    clientNumber: formatClientNumber(profile.client_number),
    points,
    tierLabel: s.current.label,
    tierIcon: s.current.icon,
    progress: s.progress,
    hint: s.next ? `${s.pointsToNext} pts avant le palier ${s.next.icon} ${s.next.label}` : `Palier le plus haut atteint ${s.current.icon}`,
  };
}

/** « 27 pts » (« 0 pt » et « 1 pt » au singulier, comme en français). */
export const pointsLabel = (n: number): string => `${n} ${n <= 1 ? 'pt' : 'pts'}`;

/** Les catégories une à une, dans l'ordre choisi dans l'administration : seulement les catégories principales (les sous-catégories sont dans la page de leur catégorie). */
export function menuCategories(categories: readonly Category[]): Category[] {
  return mainCategories([...categories]).filter((c) => (c.name ?? '').trim() !== '');
}

/** Les sous-catégories d'une catégorie principale (celles qui ont un nom), dans l'ordre choisi dans l'administration. */
export function menuSubs<T extends Category>(categories: readonly T[], mainId: string): T[] {
  return subCategoriesOf([...categories], mainId).filter((c) => (c.name ?? '').trim() !== '');
}

/** La catégorie de la page ouverte (ex. /categorie/montre-feminin) : sa catégorie principale (ouverte dans le menu) et la ligne à mettre en avant. */
export function menuActive(categories: readonly Category[], slug: string | null | undefined): { mainId: string; activeId: string } | null {
  if (!slug) return null;
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) return null;
  const parent = parentOf([...categories], cat);
  return { mainId: (parent ?? cat).id, activeId: cat.id };
}

export interface MenuHighlight {
  key: OccasionKey;
  title: string; // « BLACK FRIDAY »
  emoji: string;
  when: string; // « Le 27 novembre » / « Depuis le 18 février »
  monthTag: string; // « NOV. »
}

const HIGHLIGHT: Partial<Record<OccasionKey, { title: string; emoji: string }>> = {
  blackFriday: { title: 'BLACK FRIDAY', emoji: '🖤' },
  tabaski: { title: 'TABASKI', emoji: '🐑' },
  ramadan: { title: 'RAMADAN', emoji: '🌙' },
  korite: { title: 'KORITÉ', emoji: '🎉' },
  valentine: { title: 'SAINT-VALENTIN', emoji: '❤️' },
};
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTH_TAGS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];

/**
 * La carte « À la une » du menu : seulement pendant un VRAI moment fort de l'année (les mêmes dates que Zara, lib/assistantOccasions.ts).
 * En dehors de ces périodes : null, pas de carte (rien d'inventé).
 */
export function menuHighlight(now: number | Date = Date.now()): MenuHighlight | null {
  const t = typeof now === 'number' ? now : now.getTime();
  const key = upcomingOccasion(t);
  const look = key ? HIGHLIGHT[key] : undefined;
  if (!key || !look) return null;
  // la date de CE moment fort : la plus proche parmi celles de la même fête
  const dates = OCCASION_EVENTS.filter((e) => e.key === key).map((e) => e.date);
  const date = dates.sort((a, b) => Math.abs(Date.parse(`${a}T12:00:00Z`) - t) - Math.abs(Date.parse(`${b}T12:00:00Z`) - t))[0];
  const [, m, d] = date.split('-').map(Number);
  const day = `${d === 1 ? '1er' : d} ${MONTHS[m - 1]}`;
  const started = Date.parse(`${date}T00:00:00Z`) + 24 * 3600 * 1000 <= t; // la fête est passée (Ramadan : il continue)
  return { key, title: look.title, emoji: look.emoji, when: started ? `Depuis le ${day}` : `Le ${day}`, monthTag: MONTH_TAGS[m - 1] };
}
