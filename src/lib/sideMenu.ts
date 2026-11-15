// Menu ☰ de l'accueil (demande du patron, 15 novembre 2026 : « un menu comme Jumia : le profil du client avec ses points, puis les catégories une à une »).
// Ce fichier ne fait que PRÉPARER ce que le menu montre : aucun réseau, rien d'inventé (les points viennent du compte, les catégories de la boutique).
import { getLoyaltyStatus } from './loyalty';
import { formatClientNumber } from './clientNumber';
import { mainCategories } from './subCategories';
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
