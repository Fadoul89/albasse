import { supabase, isSupabaseConfigured } from './supabase';
import { getCurrentSessionId, getCurrentReferrerSource } from './analytics';
import { trackTikTokEvent } from './tiktokPixel';
import { currentDevice } from './assistantAttribution';
import { isMissingColumn } from './dbErrors';
import { trackCartEvent } from './browsingTracker';
import type { CartItem, Order, OrderItem, PaymentMethod } from '../types';

export interface CreateOrderInput {
  userId: string | null;
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  giftWrap?: boolean;
  // Numéro de commande choisi à l'avance : si on réessaie après une coupure de réseau, la même commande n'est pas enregistrée deux fois.
  id?: string;
  // Commande passée par Zara dans le chat : la commande note l'appareil du client (statistiques de Zara).
  viaAssistant?: boolean;
}

export function generateOrderId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function createOrder(input: CreateOrderInput): Promise<{ order: Order | null; error: string | null }> {
  const orderItems: OrderItem[] = input.items.map((i) => ({
    product_id: i.product.id,
    product_name: i.product.name,
    product_image: i.product.images[0] ?? null,
    unit_price: i.product.price,
    quantity: i.quantity,
    color: i.color,
    size: i.size,
  }));

  const sessionId = await getCurrentSessionId(input.userId);
  const contents = orderItems.map((i) => ({ content_id: i.product_id, quantity: i.quantity }));
  const contentIds = orderItems.map((i) => i.product_id);

  const order: Order = {
    id: input.id ?? generateOrderId(),
    user_id: input.userId,
    items: orderItems,
    total: input.total,
    status: 'pending',
    payment_method: input.paymentMethod,
    payment_reference: null,
    shipping_name: input.shippingName,
    shipping_phone: input.shippingPhone,
    shipping_address: input.shippingAddress,
    shipping_city: input.shippingCity,
    session_id: sessionId,
    referrer_source: getCurrentReferrerSource(),
    is_flagged_fake: false,
    gift_wrap: !!input.giftWrap,
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    trackTikTokEvent('PlaceAnOrder', { value: input.total, currency: 'XAF', content_id: contentIds, contents });
    trackTikTokEvent('CompletePayment', { value: input.total, currency: 'XAF', content_id: contentIds, contents });
    return { order, error: null };
  }

  // Pas de .select() apres l'insertion : un client invite (sans compte) n'a
  // pas le droit de relire les commandes en base (confidentialite), donc on
  // renvoie directement l'objet construit ci-dessus plutot que de le relire.
  const row = {
    id: order.id,
    user_id: order.user_id,
    items: order.items,
    total: order.total,
    status: order.status,
    payment_method: order.payment_method,
    shipping_name: order.shipping_name,
    shipping_phone: order.shipping_phone,
    shipping_address: order.shipping_address,
    shipping_city: order.shipping_city,
    session_id: order.session_id,
    referrer_source: order.referrer_source,
    // le champ n'est envoye que si le service est choisi : les commandes normales ne changent pas
    ...(order.gift_wrap ? { gift_wrap: true } : {}),
  };
  const payload: Record<string, unknown> = input.viaAssistant ? { ...row, assistant_device: currentDevice() } : row;
  let { error } = await supabase.from('orders').insert(payload);
  // La colonne des statistiques de Zara n'existe pas encore dans la base : la commande ne doit JAMAIS échouer pour ça, on la refait sans.
  if (input.viaAssistant && error && isMissingColumn(error, 'assistant_device')) {
    ({ error } = await supabase.from('orders').insert(row));
  }

  // Numéro déjà enregistré par un essai précédent (réponse perdue) : la commande existe bien, on ne la refait pas.
  const alreadySaved = !!input.id && (error as { code?: string } | null)?.code === '23505';
  if (error && !alreadySaved) return { order: null, error: error.message };
  // pour le suivi de Zara : ces articles sont achetés (ils ne seront plus proposés comme « à regarder »)
  for (const i of input.items) trackCartEvent({ id: i.product.id, name: i.product.name, slug: i.product.slug, categoryId: i.product.category_id }, 'purchase');
  trackTikTokEvent('PlaceAnOrder', { value: input.total, currency: 'XAF', content_id: contentIds, contents });
  trackTikTokEvent('CompletePayment', { value: input.total, currency: 'XAF', content_id: contentIds, contents });
  return { order, error: null };
}
