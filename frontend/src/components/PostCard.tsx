import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, ThumbsUp, MessageCircle, Share2, Globe, Users, Ghost, Pencil, Trash2, Flag, Bookmark, X, Link as LinkIcon, BellOff, PlusCircle, MinusCircle, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/api';
import { Link } from 'react-router-dom';
import { useModalStore } from '../store/modalStore';
import { useUserStore } from '../store/userStore';
import { formatCount } from '../utils/format';
import type { Post } from '../types/post';
import { getAvatarUrl, getMediaUrl } from '../utils/imageUtils';

interface PostCardProps {
  post: Post;
  onDeleted?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onDeleted }) => {
  const { setActiveModal } = useModalStore();
  const { user: currentUser } = useUserStore();

  const [isSparked, setIsSparked] = useState(post.is_sparked);
  const [sparkCount, setSparkCount] = useState(post.spark_count || 0);
  const [isFollowed, setIsFollowed] = useState(post.is_followed);
  const [isExpanded, setIsExpanded] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwner = currentUser?.user_id === post.user_id || currentUser?.username === post.username;
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : 'recently';

  // --- DWELL TIME TRACKING (Algorithm 7.6) ---
  const cardRef = useRef<HTMLDivElement>(null);
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasLoggedDwell = useRef<boolean>(false);
  const hasLoggedImpression = useRef<boolean>(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
            // Started looking prominently
            if (!startTimeRef.current) {
              startTimeRef.current = Date.now();
            }
            
            if (!hasLoggedDwell.current) {
              dwellTimerRef.current = setTimeout(() => {
                // Log dwell action only if viewed prominently for 1.5 seconds
                hasLoggedDwell.current = true;
                if (currentUser) {
                  api.post(`/posts/${post.post_id}/action`, { action_type: 'dwell' }).catch(() => {});
                }
              }, 1500);
            }
          } else {
            // Stopped looking
            if (dwellTimerRef.current) {
              clearTimeout(dwellTimerRef.current);
              dwellTimerRef.current = null;
            }
            if (startTimeRef.current) {
              const duration = Date.now() - startTimeRef.current;
              // If they looked for > 1s, it's a valid impression signal (only log once)
              if (duration > 1000 && !hasLoggedImpression.current) {
                hasLoggedImpression.current = true;
                if (currentUser) {
                  api.post(`/posts/${post.post_id}/action`, { action_type: 'click', duration }).catch(() => {});
                }
              }
              startTimeRef.current = null;
            }
          }
        });
      },
      { threshold: [0, 0.7, 1.0] }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [post.post_id]);

  useEffect(() => {
    const handleGlobalFollow = (e: any) => {
      if (e.detail === post.user_id) {
        setIsFollowed(true);
      }
    };
    window.addEventListener('userFollowed', handleGlobalFollow);
    return () => window.removeEventListener('userFollowed', handleGlobalFollow);
  }, [post.user_id]);

  // Prevent background scrolling when modal is open

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [menuOpen]);

  const handleSpark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const originalSparked = isSparked;
    const originalCount = sparkCount;
    setIsSparked(!originalSparked);
    setSparkCount(prev => (originalSparked ? prev - 1 : prev + 1));
    try {
      await api.post(`/posts/${post.post_id}/spark`);
    } catch {
      setIsSparked(originalSparked);
      setSparkCount(originalCount);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(true);
    setMenuOpen(false);
    try {
      await api.delete(`/posts/${post.post_id}`);
      onDeleted?.(post.post_id);
    } catch (err) {
      console.error('Failed to delete post:', err);
      setDeleting(false);
    }
  };

  const handleReport = async () => {
    setMenuOpen(false);
    const reason = window.prompt('Why are you reporting this post? (e.g. spam, inappropriate)', 'Inappropriate content');
    if (!reason) return;

    try {
      await api.post('/moderation/reports', { post_id: post.post_id, reason });
      alert('Post reported. Our moderation team and AI engine will review it shortly.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to report post.');
    }
  };

  const handleCopyLink = () => {
    setMenuOpen(false);
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.post_id}`);
    alert('Link copied to clipboard!');
  };

  const handleNotInterested = () => {
    setMenuOpen(false);
    alert('Post hidden. We\'ll show you less of this.');
  };

  const isVideo =
    post.media_type === 'video' ||
    post.media_url?.match(/\.(mp4|webm|ogg|mov|quicktime)$/i);
  const isTextOnly =
    !post.media_url ||
    post.media_url === 'undefined' ||
    post.media_url === 'null' ||
    post.media_url.trim() === '';

  // If this is a private post and not owner, we shouldn't even render it, 
  // but if backend sent it, let's just make sure.
  if (post.post_type === 'private' && !isOwner) {
    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-4 p-6 border border-gray-200 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <Lock size={24} className="text-gray-400" />
        </div>
        <h3 className="text-gray-900 font-bold text-[16px] mb-1">Post Unavailable</h3>
        <p className="text-gray-500 text-[14px]">This post is private and cannot be viewed.</p>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-[6px] sm:rounded-xl shadow-sm overflow-hidden border border-gray-200 transition-opacity duration-300 ${
        deleting ? 'opacity-30 pointer-events-none' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-2 p-3 pb-2">
        <Link to={`/profile/${post.username}`} className="shrink-0 mt-0.5">
          <img
            src={getAvatarUrl(post.avatar_url, post.username)}
            className="w-10 h-10 rounded-full object-cover"
            alt={post.username}
          />
        </Link>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1 flex-wrap leading-tight">
            <Link
              to={`/profile/${post.username}`}
              className="font-bold text-[15px] text-gray-900 hover:underline"
            >
              {post.name || post.username}
            </Link>
            {!isOwner && !isFollowed && (
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  setIsFollowed(true);
                  try {
                    await api.post(`/users/${post.user_id}/follow`);
                    window.dispatchEvent(new CustomEvent('userFollowed', { detail: post.user_id }));
                  } catch (err) {
                    console.error('Follow failed', err);
                    setIsFollowed(false);
                  }
                }}
                className="ml-1 text-[13px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                · Follow
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-[13px] text-gray-500 leading-tight mt-0.5">
            <span className="hover:underline cursor-pointer">{timeAgo.replace('about ', '').replace('less than a minute ago', 'Just now')}</span>
            <span>·</span>
            {post.post_type === 'public' ? (
              <Globe size={12} className="fill-current text-gray-500" />
            ) : post.post_type === 'private' || post.post_type === 'campus_only' ? (
              <Lock size={12} className="fill-current text-gray-500" />
            ) : (
              <Ghost size={12} className="fill-current text-gray-500" />
            )}
          </div>
        </div>

        {/* 3-dot and X menu Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={e => {
              e.stopPropagation();
              setActiveModal('post_options', null, { post });
            }}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <MoreHorizontal size={20} />
          </button>
          <button
            onClick={handleNotInterested}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-2 pt-1">
        {post.content && (
          <div className="text-[15px] text-gray-900 leading-normal whitespace-pre-wrap">
            {post.content.length > 150 && !isExpanded ? (
              <>
                {post.content.substring(0, 150)}...{' '}
                <button
                  onClick={() => setIsExpanded(true)}
                  className="text-gray-600 font-semibold hover:underline ml-1"
                >
                  more
                </button>
              </>
            ) : (
              <>
                {post.content}
                {post.content.length > 150 && isExpanded && (
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="text-gray-600 font-semibold hover:underline ml-2"
                  >
                    less
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
          className="relative bg-[#f0f2f5] cursor-pointer overflow-hidden flex items-center justify-center w-full"
          onClick={() => setActiveModal('media_preview', null, { post })}
        >
          {isVideo ? (
            <video src={getMediaUrl(post.media_url)} className="w-full h-auto block max-h-[85vh] sm:max-h-[700px] object-contain" />
          ) : (
            <img
              src={getMediaUrl(post.media_url)}
              loading="lazy"
              alt=""
              className="w-full h-auto block max-h-[85vh] sm:max-h-[700px] object-contain"
            />
          )}
        </div>
      )}

      {/* Stats */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center cursor-pointer hover:underline">
          {/* Primary Like Icon - Restored and spaced to avoid collision */}
          <div className="w-[18px] h-[18px] rounded-full bg-[#1877F2] flex items-center justify-center ring-2 ring-white z-30 shadow-sm mr-3">
            <ThumbsUp size={10} fill="white" className="text-white" />
          </div>

          <div className="flex items-center gap-4 h-12">
             {/* Dynamic Swaying Avatars - Max 3, staggered heights, same-direction sway */}
             {!isOwner && Array.isArray(post.liker_avatars) && post.liker_avatars.length > 0 && post.liker_avatars.map((avatar, i) => (
               <motion.div
                 key={i}
                 animate={{ 
                   y: [0, -5, 0],
                   rotate: [0, -1, 0, 1, 0]
                 }}
                 transition={{ 
                   duration: 4, 
                   repeat: Infinity, 
                   ease: "easeInOut"
                 }}
                 className="relative"
                 style={{ 
                   zIndex: 10 - i,
                   // Staggered height: second one is higher
                   marginTop: i === 1 ? '-12px' : '4px'
                 }}
               >
                 <img 
                   src={getAvatarUrl(avatar)} 
                   className="w-[32px] h-[32px] rounded-full border-2 border-white object-cover shadow-md" 
                   alt="mutual" 
                 />
                 {/* Tiny Blue Like Badge at bottom right - Tucked inward */}
                 <div className="absolute bottom-0 right-0 w-[14px] h-[14px] bg-[#1877F2] rounded-full flex items-center justify-center ring-[1.5px] ring-white shadow-sm">
                    <ThumbsUp size={8} fill="white" className="text-white" />
                 </div>
               </motion.div>
             ))}
          </div>

          <div className="ml-5 flex items-center leading-tight">
            {sparkCount > 0 && (
              <span className="text-[14px] text-gray-700 font-medium">
                {post.top_liker_name ? (
                  <>
                    Liked by <span className="font-bold text-gray-900">{post.top_liker_name}</span>
                    {sparkCount > 1 && (
                      <> and <span className="font-bold text-gray-900">{formatCount(sparkCount - 1)} others</span></>
                    )}
                  </>
                ) : (
                  <span className="font-bold text-gray-900">{formatCount(sparkCount)} {sparkCount === 1 ? 'like' : 'likes'}</span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="text-[14px] text-gray-500 flex gap-3">
          {post.comment_count ? <span className="hover:underline cursor-pointer">{formatCount(post.comment_count)} comments</span> : null}
          {post.reshare_count ? <span className="hover:underline cursor-pointer">{formatCount(post.reshare_count)} shares</span> : null}
        </div>
      </div>

      {/* Actions */}
      <div className="relative px-3 py-1 flex items-center border-t border-gray-200 mx-3 mb-1">

        <button
          onClick={handleSpark}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 mt-1 hover:bg-gray-100 rounded-md transition-colors ${
            isSparked ? 'text-[#1877F2]' : 'text-[#65676B]'
          }`}
        >
          <ThumbsUp 
            size={20} 
            strokeWidth={isSparked ? 2.5 : 2} 
            className={isSparked ? 'fill-[#1877F2]' : ''} 
          />
          <span className="text-[14px] font-semibold">Like</span>
        </button>

        <button
          onClick={() => setActiveModal('post_comments', null, { post })}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 mt-1 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
        >
          <MessageCircle size={20} strokeWidth={2} />
          <span className="text-[14px] font-semibold">Comment</span>
        </button>

        <button
          onClick={() => setActiveModal('share', null, { post })}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 mt-1 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
        >
          <Share2 size={20} strokeWidth={2} />
          <span className="text-[14px] font-semibold">Share</span>
        </button>
      </div>
    </div>
  );
};

export default React.memo(PostCard);
