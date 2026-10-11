export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_admin: boolean;
  banned: boolean;
  loyalty_points: number;
  created_at: string;
}
