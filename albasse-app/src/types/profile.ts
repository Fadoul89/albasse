export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  is_admin: boolean;
  banned: boolean;
  loyalty_points: number;
  telegram_chat_id: number | null;
  created_at: string;
}
