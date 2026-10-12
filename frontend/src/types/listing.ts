export interface Listing {
  listing_id: string;
  title: string;
  description?: string;
  price: number | string;
  image_url?: string;
  condition?: string;
  category?: string;
  campus?: string;
  location?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  seller_id?: string;
  seller_name?: string;
  seller_username?: string;
  seller_avatar?: string;
  seller_verified?: number | boolean;
  is_wishlisted?: boolean;
  media?: { media_url: string }[];
  image_urls?: string[];
  created_at?: string;
}

export interface Review {
  review_id?: string;
  reviewer_name: string;
  avatar_url?: string;
  rating: number;
  review_text: string;
}
