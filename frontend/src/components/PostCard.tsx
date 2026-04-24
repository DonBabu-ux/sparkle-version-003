import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, MessageCircle, Share2, Globe, Users, Ghost, Zap, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/api';
import { Link, useNavigate } from 'react-router-dom';
import { useModalStore } from '../store/modalStore';
import { useUserStore } from '../store/userStore';
import { formatCount } from '../utils/format';

import type { Post } from '../types/post';

interface PostCardProps {
  post: Post;
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const navigate = useNavigate();
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 backdrop-blur-3xl rounded-[40px] border border-black/[0.03] shadow-xl shadow-black/[0.02] overflow-hidden mb-8 transition-all hover:shadow-2xl hover:shadow-primary/5 group"
    >
      {/* Header */}
      <div className="flex items-center gap-4 p-6 lg:p-8">
        <Link to={`/profile/${post.username}`} className="relative shrink-0 group/avatar">
          <img 
            src={post.avatar_url || '/uploads/avatars/default.png'} 
            className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-lg group-hover/avatar:scale-110 transition-transform duration-500"
            alt={post.username}
          />
          <div className="absolute inset-0 rounded-2xl bg-primary/10 opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
        </Link>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={`/profile/${post.username}`} className="font-black text-base text-black italic tracking-tight hover:text-primary transition-colors truncate">
              {post.name || post.username}
            </Link>
            {post.is_verified && <Zap size={14} className="text-primary fill-primary" />}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-black/20 uppercase tracking-widest mt-1">
             <span>{timeAgo}</span>
             <span className="opacity-50">•</span>
             <div className="flex items-center gap-1">
                {post.post_type === 'public' ? <Globe size={10} /> : post.post_type === 'campus_only' ? <Users size={10} /> : <Ghost size={10} />}
                <span className="leading-none">{post.post_type || 'Public'} Signal</span>
             </div>
          </div>
        </div>

        <button className="w-10 h-10 flex items-center justify-center bg-black/[0.02] hover:bg-black hover:text-white rounded-xl transition-all">
          <MoreHorizontal size={18} strokeWidth={3} />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 lg:px-10 pb-6">
        {post.content && (
          <div className="text-base lg:text-lg font-bold text-black/80 leading-relaxed italic whitespace-pre-wrap">
            {post.content.length > 280 && !isExpanded ? (
              <>
                {post.content.substring(0, 280)}... 
                <button 
                  onClick={() => setIsExpanded(true)}
                  className="text-primary font-black ml-2 hover:underline uppercase text-[10px] tracking-widest"
                >
                  Expand Signal
                </button>
              </>
            ) : (
              <>
                {post.content}
                {post.content.length > 280 && isExpanded && (
                  <button 
                    onClick={() => setIsExpanded(false)}
                    className="text-primary font-black ml-2 hover:underline uppercase text-[10px] tracking-widest"
                  >
                    Collapse
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Media */}
      {!isTextOnly && post.media_url && (
        <div 
          className="relative mx-4 mb-4 rounded-[32px] overflow-hidden bg-black/[0.02] cursor-pointer group/media" 
          onClick={() => setActiveModal('media_preview', null, { post })}
        >
          {isVideo ? (
            <video src={post.media_url} className="w-full h-auto block group-hover/media:scale-[1.02] transition-transform duration-1000" />
          ) : (
            <img src={post.media_url} loading="lazy" alt="" className="w-full h-auto block object-contain group-hover/media:scale-[1.02] transition-transform duration-1000" />
          )}
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover/media:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Stats & Actions */}
      <div className="p-4 lg:p-6 bg-black/[0.01] border-t border-black/[0.02]">
        <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 group/spark cursor-pointer" onClick={handleSpark}>
                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isSparked ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-black/5 text-black/20 group-hover/spark:bg-primary/10 group-hover/spark:text-primary'}`}>
                        <Heart size={18} strokeWidth={3} className={isSparked ? 'fill-white' : ''} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isSparked ? 'text-primary' : 'text-black/20'}`}>
                        {formatCount(sparkCount)} Sparks
                    </span>
                </div>
                
                <div className="flex items-center gap-2 group/comment cursor-pointer" onClick={() => setActiveModal('post_comments', null, { post })}>
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/5 text-black/20 group-hover/comment:bg-indigo-500/10 group-hover/comment:text-indigo-500 transition-all">
                        <MessageCircle size={18} strokeWidth={3} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/20 group-hover/comment:text-indigo-500">
                        {formatCount(post.comment_count || 0)} Signals
                    </span>
                </div>
            </div>

            <button 
                onClick={() => setActiveModal('share', null, { post })}
                className="w-12 h-12 flex items-center justify-center bg-black/5 text-black/20 hover:bg-black hover:text-white rounded-2xl transition-all"
            >
                <Share2 size={18} strokeWidth={3} />
            </button>
        </div>
      </div>
    </motion.div>
  );
};

export default PostCard;
