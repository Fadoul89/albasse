export interface CustomerMessage {
  id: string;
  user_id: string;
  admin_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
