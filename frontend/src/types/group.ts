export interface Group {
  group_id: string;
  name: string;
  description?: string;
  icon_url?: string;
  cover_image?: string;
  member_count?: number;
  is_public?: number | boolean;
  category?: string;
  campus?: string;
  verified?: boolean;
  user_membership_status?: string;
}
