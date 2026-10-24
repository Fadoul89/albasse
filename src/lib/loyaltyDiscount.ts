// Remise fidélité : −10 % sur les articles (pas la livraison ni l'emballage cadeau) dès la 3ᵉ commande,
// c'est-à-dire quand le client a déjà 2 commandes LIVRÉES (les commandes en attente, annulées ou signalées fausses ne comptent pas).
// Même règle sur la page de commande et dans la commande avec Zara.
import { supabase, isSupabaseConfigured } from './supabase';

export const LOYALTY_DISCOUNT_RATE = 0.1;
export const LOYALTY_MIN_DELIVERED = 2;

export function loyaltyDiscount(itemsSubtotal: number, deliveredOrders: number): number {
  return deliveredOrders >= LOYALTY_MIN_DELIVERED ? Math.round(itemsSubtotal * LOYALTY_DISCOUNT_RATE) : 0;
}

// Commandes encore à faire livrer avant d'avoir la remise (0 : la remise s'applique).
export const ordersBeforeDiscount = (deliveredOrders: number) => Math.max(0, LOYALTY_MIN_DELIVERED - deliveredOrders);

// Nombre de commandes livrées du client, relu dans la base. 0 si on ne peut pas le lire : jamais de remise par erreur.
export async function fetchDeliveredOrderCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'delivered')
      .eq('is_flagged_fake', false);
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}
