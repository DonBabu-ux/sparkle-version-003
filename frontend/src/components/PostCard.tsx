import React, { useState } from 'react';
import { MoreHorizontal, Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/api';
import { Link } from 'react-router-dom';

import type { Post } from '../types/post';

interface PostCardProps {
  post: Post;
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
        <Link to={`/profile/${post.username}`} className="post-avatar-wrapper group">
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#FF3D6D] to-[#FF8E53] group-hover:scale-105 transition-transform duration-300">
            <img 
              src={post.avatar_url || '/uploads/avatars/default.png'} 
              className="post-avatar border-2 border-white"
              alt={post.username}
            />
          </div>
        </Link>
        <div className="post-info">
          <div className="post-author-name">
            <Link to={`/profile/${post.username}`} style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem' }}>{post.username}</Link>
            {post.campus && (
              <span className="campus-badge glass-card" style={{ 
                color: 'var(--primary)', 
                fontSize: '0.65rem', 
                padding: '3px 10px', 
                borderRadius: '100px', 
                fontWeight: 800, 
                marginLeft: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                border: '1px solid rgba(255, 61, 109, 0.1)'
              }}>
                {post.campus}
              </span>
            )}
          </div>
          <div className="post-meta">{timeAgo}</div>
        </div>
        <button className="post-options">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {!isTextOnly && post.media_url && (
        <div className="post-media" onDoubleClick={handleSpark}>
          {isVideo ? (
            <video src={post.media_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          ) : (
            <img src={post.media_url} loading="lazy" alt="Post content" className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-700 ease-out" />
          )}
        </div>
      )}

      <div className="post-content">
        {post.content && (
          <div className={`post-text ${isTruncated ? 'truncated' : ''}`} style={{ 
            display: isTruncated ? '-webkit-box' : 'block', 
            WebkitLineClamp: 3, 
            WebkitBoxOrient: 'vertical', 
            overflow: isTruncated ? 'hidden' : 'visible',
            color: '#334155',
            fontWeight: 500,
            lineHeight: 1.6
          }}>
            <strong style={{ marginRight: '8px', color: '#1e293b', fontFamily: 'Outfit, sans-serif' }}>{post.username}</strong>
            {post.content}
          </div>
        )}
        {isTruncated && (
          <button className="read-more-btn" onClick={() => setIsTruncated(false)}>
            read more
          </button>
        )}
      </div>

      <div className="post-actions">
        <div className="actions-left">
          <button className={`action-btn ${isSparked ? 'liked' : ''} hover:scale-125 transition-transform`} onClick={handleSpark}>
            <Heart size={26} fill={isSparked ? 'var(--primary)' : 'none'} stroke={isSparked ? 'var(--primary)' : '#475569'} strokeWidth={isSparked ? 0 : 2} />
          </button>
          <button className="action-btn hover:scale-125 transition-transform">
            <MessageCircle size={26} stroke="#475569" strokeWidth={2} />
          </button>
          <button className="action-btn hover:scale-125 transition-transform">
            <Send size={26} stroke="#475569" strokeWidth={2} />
          </button>
        </div>
        <div className="actions-right">
          <button className="action-btn hover:scale-125 transition-transform">
            <Bookmark size={26} stroke="#475569" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="post-stats" style={{ color: '#64748b', fontSize: '0.85rem' }}>
        <span className="font-bold text-slate-800">{sparkCount.toLocaleString()} sparks</span>
        {post.comment_count > 0 && <span>View all {post.comment_count} comments</span>}
      </div>
    </div>
  );
};

export default PostCard;
