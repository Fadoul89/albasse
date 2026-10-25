// Achats récents (barre bleue en haut du site) : de vraies commandes, lues par la fonction recent_purchases (add-recent-purchases.sql).
// Seulement la ville et l'article, jamais le nom du client. Tant que la base ne répond pas ou qu'il n'y a pas de commande récente,
// la liste est vide et la barre reste cachée : rien n'est jamais inventé.
import { supabase, isSupabaseConfigured } from './supabase';
import type { RecentPurchase } from './recentPurchasesText';

export async function fetchRecentPurchases(): Promise<RecentPurchase[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('recent_purchases', { p_limit: 12 });
  if (error || !Array.isArray(data)) return [];
  return data.filter((r): r is RecentPurchase => !!r && typeof r.product === 'string' && r.product.trim() !== '' && typeof r.created_at === 'string');
}
