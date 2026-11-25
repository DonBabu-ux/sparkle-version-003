export interface Post {
  post_id: string;
  user_id?: string;
  username: string;
  name: string;
  avatar_url?: string;
  content: string;
  media_url?: string;
  thumbnail_url?: string;
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
  /** Item originates from the moments (reel) table — navigate to /moments/:id. */
  is_moment?: boolean;
  resharers?: {
    username: string;
    avatar: string;
    comment: string;
  }[];
  // Counts are plain numbers in every API response that returns them;
  // `sparks` count lives in spark_count and is kept as a number alias.
  sparks?: number;
  media?: string[];
  media_type?: string;
  type?: string;
  image_url?: string;
  likes_count?: number;
  comments_count?: number;
  comments?: number;
  share_count?: number;
  top_liker_name?: string;
  media_files?: { url: string; type: string }[];
  group_id?: string;
  feeling?: string;
  activity?: string;
  tagged_users?: {
    user_id: string;
    username: string;
    name: string;
  }[] | string;
  /** Feed item type discriminator returned by the posts feed. */
  post_type?: string;
  /** Viewer's role in the post's group ('admin' | 'moderator' | 'member'). */
  user_role?: string;
  /** 1 when the author's account is deleted/anonymized. */
  author_deleted?: boolean | number;
  location?: string;
  category?: string;
}
