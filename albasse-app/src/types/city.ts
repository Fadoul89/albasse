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
