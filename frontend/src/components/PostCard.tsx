import React, { useState } from 'react';
import { MoreHorizontal, ThumbsUp, MessageCircle, Share2, Globe, Users, Ghost } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/api';
import { Link } from 'react-router-dom';
import { useModalStore } from '../store/modalStore';
import { useUserStore } from '../store/userStore';
import { formatCount } from '../utils/format';

import type { Post } from '../types/post';

interface PostCardProps {
  post: Post;
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const { setActiveModal } = useModalStore();
  const { user: currentUser } = useUserStore();
  
  const [isSparked, setIsSparked] = useState(post.is_sparked);
  const [sparkCount, setSparkCount] = useState(post.spark_count || 0);
  const [isExpanded, setIsExpanded] = useState(false);

  const timeAgo = post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : 'recently';

  const handleSpark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const originalSparked = isSparked;
    const originalCount = sparkCount;
    
    setIsSparked(!originalSparked);
    setSparkCount(prev => originalSparked ? prev - 1 : prev + 1);

    try {
      await api.post(`/posts/${post.post_id}/spark`);
    } catch (err) {
      setIsSparked(originalSparked);
      setSparkCount(originalCount);
      console.error('Failed to spark post:', err);
    }
  };

  const isVideo = post.media_type === 'video' || post.media_url?.match(/\.(mp4|webm|ogg|mov|quicktime)$/i);
  const isTextOnly = !post.media_url || post.media_url === 'undefined' || post.media_url === 'null' || post.media_url.trim() === '';

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden mb-4 animate-fade-in border border-gray-200">
      {/* Post Header */}
      <div className="flex items-center gap-3 p-4">
        <Link to={`/profile/${post.username}`} className="shrink-0">
          <img 
            src={post.avatar_url || '/uploads/avatars/default.png'} 
            className="w-10 h-10 rounded-full object-cover border border-gray-100"
            alt={post.username}
          />
        </Link>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <Link to={`/profile/${post.username}`} className="font-bold text-[15px] text-gray-900 hover:underline">
              {post.name || post.username}
            </Link>
          </div>
          <div className="flex items-center gap-1 text-[13px] text-gray-500 font-normal">
             <span>{timeAgo}</span>
             <span>•</span>
             {post.post_type === 'public' ? <Globe size={12} /> : post.post_type === 'campus_only' ? <Users size={12} /> : <Ghost size={12} />}
          </div>
        </div>

        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <MoreHorizontal size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        {post.content && (
          <div className="text-[15px] text-gray-900 leading-normal whitespace-pre-wrap">
            {post.content.length > 250 && !isExpanded ? (
              <>
                {post.content.substring(0, 250)}... 
                <button 
                  onClick={() => setIsExpanded(true)}
                  className="text-gray-500 font-bold hover:underline ml-1"
                >
                  See more
                </button>
              </>
            ) : (
              <>
                {post.content}
                {post.content.length > 250 && isExpanded && (
                  <button 
                    onClick={() => setIsExpanded(false)}
                    className="text-gray-500 font-bold hover:underline ml-1"
                  >
                    See less
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Media Section */}
      {!isTextOnly && post.media_url && (
        <div 
          className="relative bg-gray-100 cursor-pointer overflow-hidden flex items-center justify-center max-h-[600px]" 
          onClick={() => setActiveModal('media_preview', null, { post })}
        >
          {isVideo ? (
            <video src={post.media_url} className="w-full h-auto block" />
          ) : (
            <img src={post.media_url} loading="lazy" alt="" className="w-full h-auto block object-contain" />
          )}
        </div>
      )}

      {/* Stats Bar */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 mx-1">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
            <ThumbsUp size={10} className="text-white fill-white" />
          </div>
          <span className="text-[14px] text-gray-500">{formatCount(sparkCount)}</span>
        </div>
        <div className="text-[14px] text-gray-500 flex gap-3">
          <span>{formatCount(post.comment_count || 0)} comments</span>
          <span>{formatCount(post.reshare_count || 0)} shares</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-1 py-1 flex items-center justify-between">
        <button 
          onClick={handleSpark}
          className={`flex-1 flex items-center justify-center gap-2 py-2 hover:bg-gray-100 rounded-md transition-colors ${isSparked ? 'text-blue-600' : 'text-gray-600'}`}
        >
          <ThumbsUp size={20} className={isSparked ? 'fill-blue-600' : ''} />
          <span className="text-[14px] font-semibold">Like</span>
        </button>

        <button 
          onClick={() => setActiveModal('post_comments', null, { post })}
          className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
        >
          <MessageCircle size={20} />
          <span className="text-[14px] font-semibold">Comment</span>
        </button>

        <button 
          onClick={() => setActiveModal('share', null, { post })}
          className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
        >
          <Share2 size={20} />
          <span className="text-[14px] font-semibold">Share</span>
        </button>
      </div>
    </div>
  );
};

export default PostCard;
