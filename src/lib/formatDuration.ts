export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${totalSeconds} s`;
}

export type EngagementLevel = 'high' | 'medium' | 'low';

export function engagementLevel(totalSeconds: number): EngagementLevel {
  const minutes = totalSeconds / 60;
  if (minutes >= 30) return 'high';
  if (minutes >= 10) return 'medium';
  return 'low';
}

export const ENGAGEMENT_LABEL: Record<EngagementLevel, string> = {
  high: '🟢 Très actif',
  medium: '🟡 Actif',
  low: '⚪ Peu actif',
};

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export type AccountStatus = 'active' | 'inactive' | 'banned';

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: '🟢 Actif',
  inactive: '🟡 Inactif',
  banned: '🔴 Banni',
};

export function accountStatus(banned: boolean, lastLoginAt: string | null): AccountStatus {
  if (banned) return 'banned';
  if (!lastLoginAt) return 'inactive';
  const daysSinceLogin = (Date.now() - new Date(lastLoginAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLogin < 60 ? 'active' : 'inactive';
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export type OrderDay = 'today' | 'yesterday' | 'older';

export function getOrderDay(iso: string): OrderDay {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(date, now)) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'yesterday';
  return 'older';
}

// Date + heure toujours affichees, en plus du badge Aujourd'hui/Hier (voir
// getOrderDay) qui permet a client et admin de reperer les commandes
// recentes en un coup d'oeil dans une liste.
export function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${time}`;
}
