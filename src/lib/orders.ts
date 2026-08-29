import { supabase, isSupabaseConfigured } from './supabase';
import { getCurrentSessionId, getCurrentReferrerSource } from './analytics';
import { trackTikTokEvent } from './tiktokPixel';
import type { CartItem, Order, OrderItem, PaymentMethod } from '../types';

export interface CreateOrderInput {
  userId: string;
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
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

  if (!isSupabaseConfigured) {
    const order: Order = {
      id: `local-${Date.now()}`,
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
    trackTikTokEvent('PlaceAnOrder', { value: input.total, currency: 'XAF', content_id: contentIds, contents });
    trackTikTokEvent('CompletePayment', { value: input.total, currency: 'XAF', content_id: contentIds, contents });
    return { order, error: null };
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      user_id: input.userId,
      items: orderItems,
      total: input.total,
      status: 'pending',
      payment_method: input.paymentMethod,
      shipping_name: input.shippingName,
      shipping_phone: input.shippingPhone,
      shipping_address: input.shippingAddress,
      shipping_city: input.shippingCity,
      session_id: sessionId,
      referrer_source: getCurrentReferrerSource(),
    })
    .select()
    .single();

  if (error) return { order: null, error: error.message };
  trackTikTokEvent('PlaceAnOrder', { value: input.total, currency: 'XAF', content_id: contentIds, contents });
  trackTikTokEvent('CompletePayment', { value: input.total, currency: 'XAF', content_id: contentIds, contents });
  return { order: data as Order, error: null };
}
