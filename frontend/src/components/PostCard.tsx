import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, ThumbsUp, MessageCircle, Share2, Globe, Lock, X, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import api from '../api/api';
import { Link } from 'react-router-dom';
import { useModalStore } from '../store/modalStore';
import { useUserStore } from '../store/userStore';
import { formatCount } from '../utils/format';
import { trackingService } from '../services/TrackingService';
import type { Post } from '../types/post';
import { getAvatarUrl, getMediaUrl } from '../utils/imageUtils';
import MentionText from './MentionText';
import { getFeelingIcon, getActivityIcon } from '../utils/postUtils';

interface PostCardProps {
  post: Post;
  onDeleted?: (postId: string) => void;
}

const IncognitoIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 12c-1.5 0-2.8 1.1-3 2.5a3.5 3.5 0 0 0-4 0c-.2-1.4-1.5-2.5-3-2.5a3.5 3.5 0 1 0 3.5 3.5c0-.1 0-.3 0-.4a1.5 1.5 0 0 1 3 0c0 .1 0 .3 0 .4a3.5 3.5 0 1 0 3.5-3.5Z" />
    <path d="M3 11c1-2 3-3 5-3h8c2 0 4 1 5 3" />
    <path d="M12 3v5" />
    <path d="M8 3h8" />
  </svg>
);

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

  // --- HIGH-FIDELITY TELEMETRY (Algorithm 10.1) ---
  const cardRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
            // Started viewing
            if (!startTimeRef.current) {
              startTimeRef.current = Date.now();
              trackingService.trackImpression(post.post_id);
            }
          } else {
            // Stopped viewing
            if (startTimeRef.current) {
              const watchTime = Date.now() - startTimeRef.current;
              // Only log if they looked for at least 500ms
              if (watchTime > 500) {
                trackingService.trackExit(post.post_id, watchTime);
              }
              startTimeRef.current = null;
            }
          }
        });
      },
      { threshold: [0, 0.7] }
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
      if (!originalSparked) {
        trackingService.trackEngagement(post.post_id, 'like');
      }
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
    (!post.media_url ||
     post.media_url === 'undefined' ||
     post.media_url === 'null' ||
     post.media_url.trim() === '') &&
    (!post.media_files || post.media_files.length === 0);

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
            
            {(post.feeling || post.activity) && (
              <div className="flex items-center gap-1 text-[14px] text-gray-500 font-medium flex-wrap">
                {post.feeling && (
                  <>
                    <span>is feeling</span>
                    <span className="font-bold text-gray-900 capitalize flex items-center gap-1">
                      {post.feeling}
                      {(() => { const Icon = getFeelingIcon(post.feeling); return Icon ? <Icon size={14} className="text-primary" /> : null; })()}
                    </span>
                  </>
                )}
                {post.feeling && post.activity && <span>and</span>}
                {post.activity && (
                  <>
                    {!post.feeling && <span>is</span>}
                    <span className="font-bold text-gray-900 capitalize flex items-center gap-1">
                      {post.activity}
                      {(() => { const Icon = getActivityIcon(post.activity!); return Icon ? <Icon size={14} className="text-primary" /> : null; })()}
                    </span>
                  </>
                )}

                {post.tagged_users && (() => {
                  const users = typeof post.tagged_users === 'string' ? JSON.parse(post.tagged_users) : post.tagged_users;
                  if (!users || users.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1">
                      <span>with</span>
                      <span className="font-bold text-gray-900">
                        {users[0].name || users[0].username}
                        {users.length > 1 && ` and ${users.length - 1} others`}
                      </span>
                      <Users size={14} className="text-primary ml-0.5" />
                    </div>
                  );
                })()}
              </div>
            )}

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
              <IncognitoIcon size={12} className="text-gray-500" />
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
          <div className="text-[15px] text-gray-900 leading-normal">
            <MentionText
              content={post.content.length > 150 && !isExpanded ? post.content.substring(0, 150) + '...' : post.content}
            />
            {post.content.length > 150 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-600 font-semibold hover:underline ml-1"
              >
                {isExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Media Grid */}
      {!isTextOnly && (
        <div 
          className="relative bg-[#f0f2f5] cursor-pointer overflow-hidden w-full"
          onClick={() => setActiveModal('media_preview', null, { post })}
        >
          {post.media_files && post.media_files.length > 0 ? (
            <div className={`grid gap-0.5 ${
              post.media_files.length === 1 ? 'grid-cols-1' : 
              post.media_files.length === 2 ? 'grid-cols-2' : 
              post.media_files.length === 3 ? 'grid-cols-2' : 'grid-cols-2'
            }`}>
              {post.media_files.slice(0, 4).map((file, idx) => (
                <div 
                  key={idx} 
                  className={clsx(
                    "relative overflow-hidden",
                    post.media_files!.length === 3 && idx === 0 ? "row-span-2" : "aspect-square"
                  )}
                >
                  <img
                    src={getMediaUrl(file.url)}
                    loading="lazy"
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                  {idx === 3 && post.media_files!.length > 4 && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="text-white text-2xl font-black">+{post.media_files!.length - 3}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : post.media_url ? (
            <div className="w-full flex items-center justify-center">
              {isVideo ? (
                <video src={getMediaUrl(post.media_url)} className="w-full h-auto block max-h-[85vh] sm:max-h-[700px] object-contain" />
              ) : (
                <img
                  src={getMediaUrl(post.media_url)}
                  loading="lazy"
                  alt=""
                  className="w-full h-auto block max-h-[85vh] sm:max-h-[700px] object-contain transition-transform duration-700 hover:scale-105"
                />
              )}
            </div>
          ) : null}
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
      <div className="flex items-center border-t border-gray-100 mx-3 py-1 mt-1 mb-1">
        <button
          onClick={handleSpark}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all active:scale-95 group ${
            isSparked ? 'text-primary' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <ThumbsUp 
            size={18} 
            strokeWidth={isSparked ? 2.5 : 2} 
            className={isSparked ? 'fill-primary animate-spark-pop' : 'group-hover:scale-110 transition-transform'} 
          />
          <span className="text-[13px] font-bold tracking-tight">Like</span>
        </button>
        
        <button
          onClick={() => setActiveModal('post_comments', null, { post })}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-gray-500 hover:bg-gray-50 rounded-lg transition-all active:scale-95 group"
        >
          <MessageCircle size={18} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
          <span className="text-[13px] font-bold tracking-tight">Comment</span>
        </button>
        
        <button
          onClick={() => setActiveModal('share', null, { post })}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-gray-500 hover:bg-gray-50 rounded-lg transition-all active:scale-95 group"
        >
          <Share2 size={18} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
          <span className="text-[13px] font-bold tracking-tight">Share</span>
        </button>
      </div>


    </div>
  );
};

export default React.memo(PostCard);
