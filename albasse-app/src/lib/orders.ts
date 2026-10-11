import { supabase } from './supabase';
import type { CartItem } from '../store/cartStore';
import type { Order, OrderItem, PaymentMethod } from '../types/order';

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
    product_id: i.productId,
    product_name: i.name,
    product_image: i.image || null,
    unit_price: i.price,
    quantity: i.quantity,
    color: i.color,
    size: i.size,
  }));

  const order: Order = {
    id: generateOrderId(),
    user_id: input.userId,
    items: orderItems,
    total: input.total,
    status: 'pending',
    payment_method: input.paymentMethod,
    shipping_name: input.shippingName,
    shipping_phone: input.shippingPhone,
    shipping_address: input.shippingAddress,
    shipping_city: input.shippingCity,
    created_at: new Date().toISOString(),
  };

  // Pas de .select() apres l'insertion : un client invite (sans compte) n'a
  // pas le droit de relire les commandes en base (RLS), donc on renvoie
  // directement l'objet construit ci-dessus plutot que de le relire.
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
    referrer_source: 'App Mobile',
  });

  if (error) return { order: null, error: error.message };
  return { order, error: null };
}

const ORDER_COLUMNS =
  'id, user_id, items, total, status, payment_method, shipping_name, shipping_phone, shipping_address, shipping_city, created_at';

export async function getMyOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erreur chargement commandes:', error.message);
    return [];
  }
  return (data ?? []) as Order[];
}

// Reserve aux admins (policy RLS `orders_own_read` : auth.uid() = user_id OR
// is_admin()) — renvoie toutes les commandes, pas seulement celles de
// l'utilisateur connecte.
export async function getAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from('orders').select(ORDER_COLUMNS).order('created_at', { ascending: false });

  if (error) {
    console.error('Erreur chargement commandes (admin):', error.message);
    return [];
  }
  return (data ?? []) as Order[];
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<{ error: string | null }> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  return { error: error?.message ?? null };
}
