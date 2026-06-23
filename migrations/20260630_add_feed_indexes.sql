/* migrations/20260630_add_feed_indexes.sql */
-- Add indexes to support feed retrieval performance
-- Index on posts for filtering and ordering
ALTER TABLE posts
  ADD INDEX IF NOT EXISTS idx_posts_is_deleted_is_hidden_scheduled_created (is_deleted, is_hidden, scheduled_at, created_at);

-- Index on sparks for like count aggregation per post and user
ALTER TABLE sparks
  ADD INDEX IF NOT EXISTS idx_sparks_post_user (post_id, user_id);

-- Index on comments for counting comments per post
ALTER TABLE comments
  ADD INDEX IF NOT EXISTS idx_comments_post (post_id);

-- Index on post_images for ordering images per post
ALTER TABLE post_images
  ADD INDEX IF NOT EXISTS idx_post_images_post_order (post_id, image_order);
