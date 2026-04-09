import React, { useState } from 'react';
import { MoreHorizontal, Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/api';
import { Link } from 'react-router-dom';

interface PostCardProps {
  post: {
    post_id: string;
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
  };
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const [isSparked, setIsSparked] = useState(post.is_sparked);
  const [sparkCount, setSparkCount] = useState(post.spark_count || 0);
  const [isTruncated, setIsTruncated] = useState((post.content || '').length > 150);

  const timeAgo = post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : 'recently';

  const handleSpark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const originalSparked = isSparked;
    const originalCount = sparkCount;
    
    // Optimistic Update
    setIsSparked(!originalSparked);
    setSparkCount(prev => originalSparked ? prev - 1 : prev + 1);

    try {
      await api.post(`/posts/${post.post_id}/spark`);
    } catch (err) {
      // Revert on failure
      setIsSparked(originalSparked);
      setSparkCount(originalCount);
      console.error('Failed to spark post:', err);
    }
  };

  const isVideo = post.media_url?.match(/\.(mp4|webm|ogg|mov)$/i);
  const isTextOnly = !post.media_url || post.media_url === 'undefined' || post.media_url === 'null' || post.media_url.trim() === '';

  return (
    <div className={`post-card animate-fade-in ${isTextOnly ? 'text-only' : ''}`}>
      <div className="post-header">
        <Link to={`/profile/${post.username}`} className="post-avatar-wrapper">
          <img 
            src={post.avatar_url || '/uploads/avatars/default.png'} 
            className="post-avatar"
            alt={post.username}
          />
        </Link>
        <div className="post-info">
          <div className="post-author-name">
            <Link to={`/profile/${post.username}`}>{post.username}</Link>
            {post.campus && <span className="campus-badge" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, marginLeft: '5px' }}>{post.campus}</span>}
          </div>
          <div className="post-meta">{timeAgo}</div>
        </div>
        <button className="post-options">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {!isTextOnly && post.media_url && (
        <div className="post-media" onDoubleClick={handleSpark}>
          {isVideo ? (
            <video src={post.media_url} autoPlay loop muted playsInline />
          ) : (
            <img src={post.media_url} loading="lazy" alt="Post content" />
          )}
        </div>
      )}

      <div className="post-content">
        {post.content && (
          <>
            <div className={`post-text ${isTruncated ? 'truncated' : ''}`} style={{ display: isTruncated ? '-webkit-box' : 'block', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: isTruncated ? 'hidden' : 'visible' }}>
              <strong style={{ marginRight: '6px' }}>{post.username}</strong>
              {post.content}
            </div>
            {isTruncated && (
              <button className="read-more-btn" onClick={() => setIsTruncated(false)}>
                ... more
              </button>
            )}
          </>
        )}
      </div>

      <div className="post-actions">
        <div className="actions-left">
          <button className={`action-btn ${isSparked ? 'liked' : ''}`} onClick={handleSpark}>
            <Heart size={24} fill={isSparked ? 'var(--primary)' : 'none'} stroke={isSparked ? 'var(--primary)' : 'currentColor'} />
          </button>
          <button className="action-btn">
            <MessageCircle size={24} />
          </button>
          <button className="action-btn">
            <Send size={24} />
          </button>
        </div>
        <div className="actions-right">
          <button className="action-btn">
            <Bookmark size={24} />
          </button>
        </div>
      </div>

      <div className="post-stats">
        <span>{sparkCount} sparks</span>
        {post.comment_count > 0 && <span>View all {post.comment_count} comments</span>}
      </div>
    </div>
  );
};

export default PostCard;
