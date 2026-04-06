import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/api';

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
  onSpark?: (postId: string) => void;
  onComment?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const [isSparked, setIsSparked] = useState(post.is_sparked);
  const [sparkCount, setSparkCount] = useState(post.spark_count || 0);

  const timeAgo = post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : 'recently';

  const handleSpark = async () => {
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


  return (
    <div className="premium-card bg-white border border-slate-100 rounded-xl p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="relative group cursor-pointer mt-1">
            <img 
              src={post.avatar_url || '/uploads/avatars/default.png'} 
              className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-50 group-hover:ring-indigo-100 transition-all"
              alt={post.username}
            />
          </div>
          <div className="flex flex-col">
            <h4 className="font-bold text-[15px] text-slate-800 leading-tight">{post.username}</h4>
            <div className="flex items-center text-sm text-slate-600 leading-tight mt-0.5">
              <span>{post.name || post.username}{post.campus}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{timeAgo}</p>
          </div>
        </div>
        <button className="text-slate-400 hover:text-slate-600 p-1">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Media */}
      {post.media_url && (
        <div className="rounded-xl overflow-hidden my-3 border border-slate-100 bg-slate-50">
          <img 
            src={post.media_url} 
            className="w-full h-auto object-cover max-h-[500px]" 
            alt="Post content"
          />
        </div>
      )}

      {/* Content */}
      <div className="mb-4 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap mt-2">
        {post.content}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6 pt-3 border-t border-slate-100 mt-2">
        <button 
          onClick={handleSpark}
          className={`flex items-center gap-1.5 group ${isSparked ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600 transition-colors'}`}
        >
          <span className="text-sm font-semibold">{sparkCount} sparks</span>
        </button>
        <button className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-500">
          <span className="text-sm font-semibold">{post.comment_count || 0} comments</span>
        </button>
      </div>
    </div>
  );
};


export default PostCard;
