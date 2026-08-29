export type CategorySlug = string;

export interface Category {
  id: string;
  slug: CategorySlug;
  name: string;
  image_url: string | null;
  affiliate_commission_rate: number | null;
}

export interface ProductVariantOption {
  colors: string[];
  sizes: string[];
}

export interface Product {
  id: string;
  category_id: string;
  category?: Category;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  images: string[];
  colors: string[];
  sizes: string[];
  stock: number;
  is_flash_sale: boolean;
  flash_sale_ends_at: string | null;
  notify_on_publish: boolean;
  is_active: boolean;
  affiliate_commission_rate: number | null;
  rating: number;
  review_count: number;
  created_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string | null;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  avatar_url: string | null;
  full_name: string | null;
  phone: string | null;
  profession: string | null;
  region: string | null;
  country: string | null;
  address: string | null;
  is_admin: boolean;
  last_login_at: string | null;
  login_count: number;
  banned: boolean;
  fake_order_count: number;
  loyalty_points: number;
  is_affiliate: boolean;
  affiliate_status: 'pending' | 'approved' | 'blocked' | null;
  referral_code: string | null;
  social_link: string | null;
  affiliate_type: string | null;
  affiliate_mobile_money: string | null;
  notify_new_products: boolean;
  notify_promotions: boolean;
  notify_flash_sale: boolean;
  notifications_last_seen_at: string | null;
  created_at: string;
}

export interface CustomerMessage {
  id: string;
  user_id: string;
  admin_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ProductNotification {
  id: string;
  product_id: string;
  title: string;
  message: string;
  created_at: string;
}

export type SanctionAction = 'ban' | 'reactivate';

export interface CustomerSanction {
  id: string;
  user_id: string;
  action: SanctionAction;
  reason: string | null;
  admin_id: string | null;
  created_at: string;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  color: string | null;
  size: string | null;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

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
  user_id: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  session_id: string | null;
  referrer_source: string | null;
  is_flagged_fake: boolean;
  created_at: string;
}

export type FlightRequestStatus = 'pending' | 'contacted' | 'booked' | 'cancelled';

export interface FlightRequest {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  origin_city: string;
  destination_city: string;
  preferred_airline: string | null;
  departure_date: string;
  return_date: string | null;
  passenger_count: number;
  notes: string;
  status: FlightRequestStatus;
  created_at: string;
}

export interface VisitorSession {
  id: string;
  user_id: string | null;
  visitor_id: string | null;
  started_at: string;
  last_seen_at: string;
  duration_seconds: number;
  page_views: number;
  referrer_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referral_code: string | null;
  created_at: string;
}

export type AffiliateCommissionStatus = 'pending' | 'validated' | 'cancelled';

export interface AffiliateCommission {
  id: string;
  affiliate_id: string;
  order_id: string;
  amount: number;
  status: AffiliateCommissionStatus;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface AffiliateCommissionItem {
  id: string;
  commission_id: string;
  affiliate_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  amount: number;
  created_at: string;
}

export interface AffiliateSettings {
  id: number;
  default_commission_rate: number;
  updated_at: string;
}

export interface ProductView {
  id: string;
  session_id: string | null;
  user_id: string | null;
  product_id: string;
  viewed_at: string;
}

export interface CartEvent {
  id: string;
  session_id: string | null;
  user_id: string | null;
  product_id: string;
  created_at: string;
}

export interface SmartPromotion {
  id: string;
  name: string;
  category_id: string | null;
  product_id: string | null;
  gift: string;
  min_purchase: number;
  start_date: string;
  end_date: string;
  end_time: string;
  max_beneficiaries: number | null;
  claimed_count: number;
  message: string;
  image_url: string | null;
  button_text: string;
  is_active: boolean;
  created_at: string;
}

export interface WheelPrize {
  id: string;
  label: string;
  icon: string;
  weight: number;
  is_lose: boolean;
  is_grand_prize: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface WheelSpin {
  id: string;
  user_id: string;
  milestone: number;
  prize_id: string | null;
  prize_label: string;
  created_at: string;
}

export type AdminNotificationType =
  | 'new_order'
  | 'payment_received'
  | 'order_delivered'
  | 'new_customer'
  | 'low_stock';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CustomerSummary {
  profile: Profile;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  completedOrders: number;
  cancelledOrders: number;
  sessionCount: number;
  totalDurationSeconds: number;
  lastVisitAt: string | null;
  productViewCount: number;
  cartAddCount: number;
  topReferrerSource: string | null;
}

export interface StoreSettings {
  id: number;
  shop_name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  hours: string | null;
  google_maps_url: string | null;
  updated_at: string;
}

export interface City {
  id: string;
  name: string;
  is_active: boolean;
  delivery_fee: number | null;
  delivery_agency: string | null;
  sort_order: number;
  created_at: string;
}

export interface PaymentSettings {
  id: number;
  airtel_number: string | null;
  airtel_payment_url: string | null;
  moov_number: string | null;
  moov_payment_url: string | null;
  instructions: string | null;
  updated_at: string;
}
