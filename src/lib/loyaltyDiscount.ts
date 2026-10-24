// Remise fidélité : −10 % sur les articles (pas la livraison ni l'emballage cadeau) à la 7ᵉ commande, c'est-à-dire quand le client
// a déjà 6 commandes LIVRÉES (les commandes en attente, annulées ou signalées fausses ne comptent pas). Une seule fois par client :
// dès qu'une commande non annulée porte la remise, elle n'est plus proposée. Même règle sur la page de commande et avec Zara.
import { supabase, isSupabaseConfigured } from './supabase';

export const LOYALTY_DISCOUNT_RATE = 0.1;
export const LOYALTY_MIN_DELIVERED = 6;

export interface LoyaltyStatus {
  delivered: number; // commandes livrées
  used: boolean; // remise déjà utilisée (ou impossible à vérifier : pas de remise par erreur)
}

export function loyaltyDiscount(itemsSubtotal: number, status: LoyaltyStatus | null): number {
  return status && !status.used && status.delivered >= LOYALTY_MIN_DELIVERED ? Math.round(itemsSubtotal * LOYALTY_DISCOUNT_RATE) : 0;
}

// Commandes encore à faire livrer avant d'avoir la remise (0 : la remise s'applique).
export const ordersBeforeDiscount = (delivered: number) => Math.max(0, LOYALTY_MIN_DELIVERED - delivered);

// Relu dans la base au moment de commander. Si on ne peut pas vérifier (réseau, colonne loyalty_discount absente), pas de remise.
export async function fetchLoyaltyStatus(userId: string): Promise<LoyaltyStatus> {
  if (!isSupabaseConfigured) return { delivered: 0, used: true };
  try {
    const [deliv, used] = await Promise.all([
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'delivered')
        .eq('is_flagged_fake', false),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('loyalty_discount', 0)
        .neq('status', 'cancelled'),
    ]);
    return { delivered: deliv.error ? 0 : deliv.count ?? 0, used: used.error ? true : (used.count ?? 0) > 0 };
  } catch {
    return { delivered: 0, used: true };
  }
}
