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
  creator_id?: string;
  creator_name?: string;
  created_at?: string;
}

/** A group's member as returned by the group detail endpoint. */
export interface GroupMember {
  user_id: string;
  username: string;
  name?: string;
  /** The group endpoint returns `avatar`; `avatar_url` is kept for compat. */
  avatar?: string;
  avatar_url?: string;
  role?: 'owner' | 'admin' | 'moderator' | 'member';
  joined_at?: string;
  user_membership_status?: string;
  campus?: string;
}
