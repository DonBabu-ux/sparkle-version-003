export interface User {
  id?: string;
  user_id?: string;
  username?: string;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string;
  avatar_url?: string;
  campus?: string;
  major?: string;
  year_of_study?: string;
  bio?: string;
  headline?: string;
  website?: string;
  phone_number?: string;
  birthday?: string;
  two_factor_enabled?: boolean;
  is_private?: boolean;
  show_contact_info?: boolean;
  show_birthday?: boolean;
  dm_permission?: 'everyone' | 'followers' | 'none';
  theme?: 'light' | 'dark';
  email_verified?: boolean;
  phone_verified?: boolean;
  is_followed?: boolean;
  is_followed_by_me?: boolean;
  is_requested_by_me?: boolean;
  request_status?: string | null;
  is_online?: boolean;
  is_verified?: boolean;
  mutual_connections?: number;
  mutual_followers?: { id: string; name: string; avatar: string }[];
  suggestion_reason?: string;
  followers_count?: number;
  invited_users_count?: number;
  following_count?: number;
  pending_requests_count?: number;
  has_story?: boolean;
  note?: string;
  highlights?: { id: string; img: string; title: string }[];
  onboarding_step?: number;
  // Settings / privacy preferences (server user_settings shape)
  user_type?: string;
  push_notifications?: number;
  message_privacy?: string;
  last_seen_privacy?: string;
  chat_theme?: string;
  auto_download_media?: string;
  link_previews_enabled?: number;
  media_quality?: string;
  // Digital Identity cooldown timestamps (server-authoritative)
  name_updated_at?: string | null;
  username_updated_at?: string | null;
  // Reputation shape returned from User.deriveReputation()
  reputation?: {
    trustLevel: number;
    prestigeScore: number;
    nextThreshold: number;
    isVerified: boolean;
  };
}

