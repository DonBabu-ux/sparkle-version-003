import React, { useState } from 'react';
import { MoreHorizontal, Heart, MessageCircle, Send, Bookmark, Repeat2 } from 'lucide-react';
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
    <div className={`post-card animate-fade-in ${isTextOnly ? 'text-only' : ''}`} style={{ background: '#fff', color: '#262626', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div className="post-header" style={{ padding: '12px 16px', background: '#fff' }}>
        <Link to={`/profile/${post.username}`} className="post-avatar-wrapper group" style={{ position: 'relative' }}>
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#FF3D6D] to-[#FF8E53] group-hover:scale-105 transition-transform duration-300">
            <img 
              src={post.avatar_url || '/uploads/avatars/default.png'} 
              className="post-avatar border-2 border-white"
              style={{ width: '42px', height: '42px', borderRadius: '50%' }}
              alt={post.username}
            />
          </div>
        </Link>
        <div className="post-info" style={{ marginLeft: '4px' }}>
          <div className="post-author-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link to={`/profile/${post.username}`} style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: '700', color: '#262626' }}>
              {post.username}
            </Link>
            <span style={{ color: '#8e8e8e', fontSize: '14px' }}>•</span>
            <span style={{ color: '#8e8e8e', fontSize: '14px' }}>{timeAgo.replace(' ago', '').replace('about ', '')}</span>
          </div>
          <div className="post-meta" style={{ color: '#8e8e8e', fontSize: '12px', fontWeight: '400', marginTop: '-2px' }}>
            {post.campus || 'Main Campus'}
          </div>
        </div>
        <button className="post-options" style={{ color: '#262626' }}>
          <MoreHorizontal size={24} />
        </button>
      </div>

      {!isTextOnly && post.media_url && (
        <div className="post-media" style={{ background: '#f8f9fa', maxHeight: 'none' }} onDoubleClick={handleSpark}>
          {isVideo ? (
            <video src={post.media_url} autoPlay loop muted playsInline className="w-full h-auto object-contain" />
          ) : (
            <img src={post.media_url} loading="lazy" alt="Post content" className="w-full h-auto object-contain" />
          )}
        </div>
      )}

      <div className="post-content" style={{ padding: '0 16px 12px', background: '#fff' }}>
        {post.content && (
          <div className="post-text" style={{ fontSize: '14px', color: '#262626', lineHeight: '1.4' }}>
            <span style={{ fontWeight: '700', marginRight: '6px' }}>{post.username}</span>
            {isTruncated ? post.content.substring(0, 150) : post.content}
            {isTruncated && <span style={{ color: '#8e8e8e', cursor: 'pointer' }} onClick={() => setIsTruncated(false)}> ... more</span>}
          </div>
        )}
        <div style={{ marginTop: '8px' }}>
          <button style={{ background: 'none', border: 'none', padding: '0', color: '#8e8e8e', fontSize: '12px', cursor: 'pointer' }}>
            See Translation
          </button>
        </div>
      </div>

      <div className="post-actions" style={{ padding: '10px 16px 16px', background: '#fff', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="actions-left" style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <button className={`action-btn ${isSparked ? 'liked' : ''}`} onClick={handleSpark} style={{ display: 'flex', alignItems: 'center' }}>
              <Heart size={25} color={isSparked ? '#FF3D6D' : '#262626'} fill={isSparked ? '#FF3D6D' : 'none'} strokeWidth={1.5} />
            </button>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#262626' }}>{sparkCount}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <button className="action-btn" style={{ display: 'flex', alignItems: 'center' }}>
              <MessageCircle size={25} color="#262626" strokeWidth={1.5} />
            </button>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#262626' }}>{post.comment_count || 0}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <button className="action-btn" style={{ display: 'flex', alignItems: 'center' }}>
              <Repeat2 size={25} color="#262626" strokeWidth={1.5} />
            </button>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#262626' }}>0</span>
          </div>

          <button className="action-btn" style={{ display: 'flex', alignItems: 'center' }}>
            <Send size={25} color="#262626" strokeWidth={1.5} />
          </button>
        </div>
        
        <div className="actions-right">
          <button className="action-btn" style={{ display: 'flex', alignItems: 'center' }}>
            <Bookmark size={25} color="#262626" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostCard;
