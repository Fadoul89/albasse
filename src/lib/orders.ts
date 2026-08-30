import { supabase, isSupabaseConfigured } from './supabase';
import { getCurrentSessionId, getCurrentReferrerSource } from './analytics';
import { trackTikTokEvent } from './tiktokPixel';
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
}

function generateOrderId(): string {
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
    id: generateOrderId(),
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
  const { error } = await supabase.from('orders').insert({
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
  });

  if (error) return { order: null, error: error.message };
  trackTikTokEvent('PlaceAnOrder', { value: input.total, currency: 'XAF', content_id: contentIds, contents });
  trackTikTokEvent('CompletePayment', { value: input.total, currency: 'XAF', content_id: contentIds, contents });
  return { order, error: null };
}
