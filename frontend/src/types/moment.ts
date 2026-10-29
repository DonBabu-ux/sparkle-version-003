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
  /** 1/0 (or '1'/'0'); absent = default on. See utils/watermark.ts. */
  watermark?: string | number | boolean | null;
  /** JSON string (or object) from the composer: { id, title, artist, thumbnail }. */
  music_info?: string | { id?: string; title?: string; artist?: string; thumbnail?: string } | null;
}
