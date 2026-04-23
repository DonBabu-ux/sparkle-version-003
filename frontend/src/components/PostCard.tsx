import React, { useState } from 'react';
import { MoreHorizontal, Repeat2, Heart, MessageCircle, Bookmark, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/api';
import { Link } from 'react-router-dom';
import { useModalStore } from '../store/modalStore';
import { useUserStore } from '../store/userStore';
import MentionInput from './MentionInput';
import { formatCount } from '../utils/format';

import type { Post } from '../types/post';

interface PostCardProps {
  post: Post;
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const { setActiveModal } = useModalStore();
  const { user: currentUser } = useUserStore();
  
  const [isSparked, setIsSparked] = useState(post.is_sparked);
  const [isReshared, setIsReshared] = useState(post.is_reshared);
  const [isSaved, setIsSaved] = useState(post.is_saved || false);
  const [isPinned, setIsPinned] = useState(post.is_pinned || false);
  const [sparkCount, setSparkCount] = useState(post.spark_count || 0);
  const [reshareCount, setReshareCount] = useState(post.reshare_count || 0);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isTruncated, setIsTruncated] = useState((post.content || '').length > 280);

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

  const handleReshare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const originalReshared = isReshared;
    const originalCount = reshareCount;
    
    setIsReshared(!originalReshared);
    setReshareCount(prev => originalReshared ? Math.max(0, prev - 1) : prev + 1);
    
    try {
      await api.post(`/posts/${post.post_id}/reshare`);
    } catch (err) {
      setIsReshared(originalReshared);
      setReshareCount(originalCount);
      console.error('Reshare toggle failed:', err);
    }
  };

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/posts/${post.post_id}/pin`);
      setIsPinned(!isPinned);
    } catch (err) {
      console.error('Pin failed:', err);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const originalSaved = isSaved;
    setIsSaved(!originalSaved);
    try {
      await api.post(`/posts/${post.post_id}/save`);
    } catch (err) {
      setIsSaved(originalSaved);
      console.error('Save failed:', err);
    }
  };

  const handleCommentSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      await api.post(`/posts/${post.post_id}/comments`, { content: newComment });
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const isVideo = post.media_type === 'video' || post.media_url?.match(/\.(mp4|webm|ogg|mov|quicktime)$/i);
  const isTextOnly = !post.media_url || post.media_url === 'undefined' || post.media_url === 'null' || post.media_url.trim() === '';

  return (
    <div className="group/card bg-white/80 backdrop-blur-3xl border border-white rounded-[40px] overflow-hidden relative shadow-xl animate-fade-in">
      {/* Repost Header */}
      {post.reposter_username && (
        <div className="flex items-center gap-3 px-8 py-3 bg-primary/5 border-b border-black/5">
           <div className="flex -space-x-1.5 shrink-0">
              <img 
                src={post.reposter_avatar || '/uploads/avatars/default.png'} 
                className="w-5 h-5 rounded-full object-cover ring-2 ring-white"
                alt=""
              />
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white ring-2 ring-white z-10 shadow-sm">
                <Repeat2 size={10} strokeWidth={4} />
              </div>
           </div>
          <p className="text-[10px] font-black text-black/40 uppercase tracking-widest italic">
            <Link to={`/profile/${post.reposter_username}`} className="text-primary hover:underline">{post.reposter_username}</Link> reshared this post
          </p>
        </div>
      )}

      {/* Post Header */}
      <div className="flex items-center gap-5 px-8 pt-8 relative z-10">
        <Link to={`/profile/${post.username}`} className="relative shrink-0">
          <div className="p-0.5 rounded-2xl bg-white shadow-sm border border-black/5 overflow-hidden">
            <img 
              src={post.avatar_url || '/uploads/avatars/default.png'} 
              className="w-12 h-12 rounded-[14px] object-cover"
              alt={post.username}
            />
          </div>
          {post.is_online && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-white rounded-full shadow-lg"></div>}
        </Link>
        
        <div className="flex-1 flex flex-col min-w-0 pt-1">
          <div className="flex items-center gap-2">
            <Link to={`/profile/${post.username}`} className="font-black text-lg text-black truncate hover:text-primary transition-colors leading-none italic uppercase">
              {post.name || post.username}
            </Link>
            {post.is_pinned && <Bookmark size={14} className="text-primary fill-primary" strokeWidth={3} />}
          </div>
          <div className="flex items-center gap-2 mt-1.5 opacity-40">
             <p className="text-[10px] font-black text-black uppercase tracking-widest truncate">@{post.username} • {post.campus || 'Village'}</p>
             <div className="w-1 h-1 bg-black rounded-full" />
             <p className="text-[10px] font-black text-black uppercase tracking-widest shrink-0">{timeAgo}</p>
          </div>
        </div>

        <button 
          className="w-11 h-11 flex items-center justify-center text-black/10 hover:text-primary hover:bg-primary/5 rounded-xl transition-all active:scale-90"
          onClick={(e) => {
            e.stopPropagation();
            const isOwner = currentUser?.username === post.username;
            if (isOwner) {
              handlePin(e);
            } else {
              setActiveModal('share', null, { post });
            }
          }}
        >
          <MoreHorizontal size={20} strokeWidth={3} />
        </button>
      </div>

      {/* Post Content */}
      <div className="px-8 py-6">
        {post.content && (
          <p className="text-lg text-black leading-relaxed font-semibold italic whitespace-pre-wrap">
            {isTruncated ? (
                <>
                    {post.content.substring(0, 280)}
                    <button onClick={(e) => { e.stopPropagation(); setIsTruncated(false); }} className="text-primary font-black ml-2 hover:underline">... amplify</button>
                </>
            ) : post.content}
          </p>
        )}
      </div>

      {/* Media Section */}
      {!isTextOnly && post.media_url && (
        <div className="relative overflow-hidden group/media bg-black/5 cursor-pointer mx-6 rounded-[32px] border border-white shadow-sm" onDoubleClick={handleSpark}>
          {isVideo ? (
            <video src={post.media_url} autoPlay loop muted playsInline className="w-full h-auto block" />
          ) : (
            <img src={post.media_url} loading="lazy" alt="" className="w-full h-auto block transition-transform duration-[1s]" />
          )}

          {/* Spark Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-active/media:opacity-100 transition-opacity">
            <Heart size={120} fill="#e11d48" strokeWidth={0} className="scale-0 group-active/media:scale-100 transition-transform duration-300 drop-shadow-2xl" />
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-black/[0.03]">
        <div className="flex items-center gap-8">
          <button 
            onClick={handleSpark}
            className={`flex items-center gap-3 transition-all group/btn ${isSparked ? 'text-primary' : 'text-black/20 hover:text-primary'}`}
          >
            <div className={`w-12 h-12 rounded-2xl transition-all flex items-center justify-center ${isSparked ? 'bg-primary/10 shadow-inner' : 'bg-white/40 border border-white group-hover/btn:bg-primary/5'}`}>
              <Heart size={24} fill={isSparked ? "currentColor" : "none"} strokeWidth={3} className={isSparked ? 'scale-110' : 'transition-transform'} />
            </div>
            <p className="text-[14px] font-black tracking-tight">{formatCount(sparkCount)}</p>
          </button>

          <button 
            onClick={() => setActiveModal('post_comments', null, { post })}
            className="flex items-center gap-3 text-black/20 hover:text-blue-500 transition-all group/btn"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/40 border border-white flex items-center justify-center group-hover/btn:bg-blue-50 transition-all">
              <MessageCircle size={24} strokeWidth={3} className="transition-transform" />
            </div>
            <p className="text-[14px] font-black tracking-tight">{formatCount(post.comment_count || 0)}</p>
          </button>

          <button 
            onClick={handleReshare}
            className={`flex items-center gap-3 transition-all group/btn ${isReshared ? 'text-emerald-500' : 'text-black/20 hover:text-emerald-500'}`}
          >
            <div className={`w-12 h-12 rounded-2xl transition-all flex items-center justify-center ${isReshared ? 'bg-emerald-50 shadow-inner border border-emerald-100' : 'bg-white/40 border border-white group-hover/btn:bg-emerald-50'}`}>
              <Repeat2 size={24} strokeWidth={3} className={isReshared ? 'scale-110' : 'transition-transform duration-700'} />
            </div>
            <p className="text-[14px] font-black tracking-tight">{formatCount(reshareCount)}</p>
          </button>
        </div>

        <button 
          onClick={handleSave}
          className={`w-12 h-12 rounded-2xl transition-all flex items-center justify-center shadow-sm ${isSaved ? 'text-amber-500 bg-amber-50 border border-amber-100' : 'text-black/10 bg-white/40 border border-white hover:text-amber-500 hover:bg-amber-50'}`}
        >
          <Bookmark size={24} fill={isSaved ? "currentColor" : "none"} strokeWidth={3} />
        </button>
      </div>

      {/* Quick Comment Input */}
      <div className="px-8 py-5 bg-white/40 flex items-center gap-5">
        <div className="w-10 h-10 rounded-[14px] overflow-hidden shrink-0 shadow-sm border border-white">
           <img 
              src={currentUser?.avatar_url || '/uploads/avatars/default.png'} 
              className="w-full h-full object-cover"
              alt="" 
           />
        </div>
        <div className="flex-1">
          <MentionInput
            value={newComment}
            onChange={setNewComment}
            className="w-full text-sm font-bold text-black bg-transparent outline-none placeholder:text-black/10 italic"
            placeholder="Write a comment..."
          />
        </div>
        <button 
          onClick={handleCommentSubmit}
          disabled={isSubmittingComment || !newComment.trim()}
          className="bg-primary text-white p-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-0 active:scale-95"
        >
          <Send size={16} strokeWidth={4} />
        </button>
      </div>
    </div>
  );
};

export default PostCard;
