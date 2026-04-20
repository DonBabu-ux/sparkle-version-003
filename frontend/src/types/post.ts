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
}
