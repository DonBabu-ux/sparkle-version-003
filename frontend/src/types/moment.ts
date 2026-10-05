export interface Moment {
  moment_id: string;
  username: string;
  user_name?: string;
  caption?: string;
  avatar_url?: string;
  thumbnail_url?: string;
  media_url?: string;
  video_url?: string;
  streaming_url?: string;
  resolution?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  created_at: string;
  is_video?: boolean;
  media_type?: string;
  is_liked?: boolean;
  is_saved?: boolean;
  is_following?: boolean;
  user_id?: string;
}
