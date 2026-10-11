export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'airtel_money' | 'moov_money' | 'cash_on_delivery' | 'stripe';

export interface OrderItem {
  product_id: string;
  product_name: string;
  product_image: string | null;
  unit_price: number;
  quantity: number;
  color: string | null;
  size: string | null;
}

export interface Order {
  id: string;
  user_id: string | null;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  created_at: string;
}
