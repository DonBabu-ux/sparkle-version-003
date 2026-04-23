export interface Post {
  post_id: string;
  user_id?: string;
  username: string;
  name: string;
  avatar_url?: string;
  content: string;
  media_url?: string;
  spark_count: number;
  comment_count: number;
  is_sparked: boolean;
  is_saved: boolean;
  created_at: string;
  campus?: string;
  original_post_id?: string;
  original_content?: string;
  original_username?: string;
  original_avatar_url?: string;
  original_media_url?: string;
  original_media_type?: string;
  reshare_count?: number;
  resharer_avatars?: string[];
  reposter_username?: string;
  reposter_avatar?: string;
  repost_comment?: string;
  is_reshared?: boolean;
  is_pinned?: boolean;
  feed_id?: string;
  resharers?: {
    username: string;
    avatar: string;
    comment: string;
  }[];
  // Add missing properties found during build
  sparks?: number | unknown[];
  media?: string[];
  media_type?: string;
  image_url?: string;
  likes_count?: number;
  comments_count?: number;
  comments?: number | unknown[];
}
