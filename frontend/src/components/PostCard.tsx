import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  MoreHorizontal, ThumbsUp, MessageCircle, Share2, Globe, Lock, X, Users,
  Bookmark, Link as LinkIcon, PlusCircle, MinusCircle, Flag, Pencil, Trash2,
  Bell, Info, Clock, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import Avatar from './Avatar';
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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, caretLeft: 0 });
  const [deleting, setDeleting] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwner = currentUser?.user_id === post.user_id || currentUser?.username === post.username;
  const isGroupAdmin = post.group_id && (post.user_role === 'admin' || post.user_role === 'owner' || post.user_role === 'moderator');
  const canDelete = isOwner || isGroupAdmin || currentUser?.role === 'admin';
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

  // Close dropdown on page scroll or resize, but NOT when scrolling inside the dropdown
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      // If the scroll originated inside the dropdown panel, don't close
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
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
      if (post.group_id) {
        await api.delete(`/groups/${post.group_id}/posts/${post.post_id}`);
      } else {
        await api.delete(`/posts/${post.post_id}`);
      }
      onDeleted?.(post.post_id);
    } catch (err) {
      console.error('Failed to delete post:', err);
      setDeleting(false);
      alert('Failed to delete post.');
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

  const handleInterested = async () => {
    setMenuOpen(false);
    try {
      await api.post(`/posts/${post.post_id}/action`, { action_type: 'click' });
      alert('Noted! We will show you more posts like this.');
    } catch (err) {
      console.error('Failed to log interest', err);
    }
  };

  const handleNotInterestedAction = async () => {
    setMenuOpen(false);
    try {
      await api.post(`/posts/${post.post_id}/action`, { action_type: 'dislike' });
      window.dispatchEvent(new CustomEvent('hidePost', { detail: post.post_id }));
      alert('Hidden. We will show you less of this.');
    } catch (err) {
      console.error('Failed to log dislike', err);
    }
  };

  const handleSavePost = async () => {
    setMenuOpen(false);
    try {
      await api.post(`/posts/${post.post_id}/save`);
      alert('Post saved to bookmarks!');
    } catch (err) {
      console.error('Failed to save post', err);
      alert('Failed to save post.');
    }
  };

  const handleSnooze = async () => {
    setMenuOpen(false);
    try {
      await api.post(`/posts/${post.post_id}/action`, { action_type: 'snooze' });
      window.dispatchEvent(new CustomEvent('hidePost', { detail: post.post_id }));
      alert(`Snoozed ${post.name || post.username} for 30 days.`);
    } catch (err) {
      console.error('Failed to snooze', err);
    }
  };

  const handleHideAll = async () => {
    setMenuOpen(false);
    try {
      await api.post(`/posts/${post.post_id}/action`, { action_type: 'hide_all' });
      window.dispatchEvent(new CustomEvent('hidePost', { detail: post.post_id }));
      alert(`Hiding all posts from ${post.name || post.username}.`);
    } catch (err) {
      console.error('Failed to hide all', err);
    }
  };

  const handleWhySeeing = () => {
    setMenuOpen(false);
    let reason = "This post was recommended based on your interests and activity on Sparkle.";
    if (isFollowed) {
      reason = `You're seeing this because you follow ${post.name || post.username}.`;
    } else if (post.category && post.category !== 'General') {
      reason = `You're seeing this because you've shown interest in ${post.category} content.`;
    }
    alert(reason);
  };

  const handleToggleNotifications = () => {
    setMenuOpen(false);
    alert('Notifications turned on for this post! You will be alerted of new activity.');
  };

  const handleNotInterested = () => {
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent('hidePost', { detail: post.post_id }));
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
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-3 p-4 border border-gray-200 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2">
          <Lock size={20} className="text-gray-400" />
        </div>
        <h3 className="text-gray-900 font-bold text-[14px] mb-1">Post Unavailable</h3>
        <p className="text-gray-500 text-[12px]">This post is private and cannot be viewed.</p>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-[8px] sm:rounded-[12px] shadow-sm overflow-hidden border border-gray-200 transition-opacity duration-300 ${
        deleting ? 'opacity-30 pointer-events-none' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-2 p-2.5 pb-1.5">
        <Link to={`/profile/${post.username}`} className="shrink-0 mt-0.5">
          <Avatar 
            src={post.avatar_url} 
            name={post.name || post.username} 
            size="sm" 
          />
        </Link>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1 flex-wrap leading-tight">
            <Link
              to={`/profile/${post.username}`}
              className="font-bold text-[13px] text-gray-900 hover:underline"
            >
              {post.name || post.username}
            </Link>
            
            {(post.feeling || post.activity) && (
              <div className="flex items-center gap-1 text-[12px] text-gray-500 font-medium flex-wrap">
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
                className="ml-0.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                · Follow
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500 leading-tight mt-0.5">
            <span className="hover:underline cursor-pointer">{timeAgo.replace('about ', '').replace('less than a minute ago', 'Just now')}</span>
            <span>·</span>
            {post.post_type === 'public' ? (
              <Globe size={11} className="fill-current text-gray-500" />
            ) : post.post_type === 'private' || post.post_type === 'campus_only' ? (
              <Lock size={11} className="fill-current text-gray-500" />
            ) : (
              <IncognitoIcon size={11} className="text-gray-500" />
            )}
          </div>
        </div>

        {/* 3-dot and X menu Trigger */}
        <div className="flex items-center gap-2">
          <button
            ref={menuBtnRef}
            onClick={e => {
              e.stopPropagation();
              if (window.innerWidth < 640) {
                setActiveModal('post_options', null, { post });
              } else {
                if (!menuOpen) {
                  const rect = menuBtnRef.current!.getBoundingClientRect();
                  const DROPDOWN_W = 380;
                  const CARET_HALF = 14;
                  // Button center X in viewport
                  const btnCenterX = (rect.left + rect.right) / 2;
                  // Align dropdown's right edge with button's right edge, clamped to viewport
                  const leftPos = Math.max(8, Math.min(rect.right - DROPDOWN_W, window.innerWidth - DROPDOWN_W - 8));
                  // Caret's left offset inside the dropdown so it always points at the button center
                  const caretLeft = Math.max(8, Math.min(btnCenterX - leftPos - CARET_HALF, DROPDOWN_W - 36));
                  setDropdownPos({ top: rect.bottom + 8, left: leftPos, caretLeft });
                }
                setMenuOpen(prev => !prev);
              }
            }}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <MoreHorizontal size={20} />
          </button>

          <button
            onClick={handleNotInterested}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {createPortal(
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[9990]" onClick={() => setMenuOpen(false)} />
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                  style={{ top: dropdownPos.top, left: dropdownPos.left, position: 'fixed' }}
                  className="w-[380px] bg-white rounded-[14px] shadow-[0_2px_32px_rgba(0,0,0,0.22)] z-[9991] relative"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Triangle caret — dynamically aligned to the ··· button center */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-13px',
                      left: `${dropdownPos.caretLeft}px`,
                      width: 0,
                      height: 0,
                      borderLeft: '14px solid transparent',
                      borderRight: '14px solid transparent',
                      borderBottom: '14px solid white',
                      filter: 'drop-shadow(0 -4px 4px rgba(0,0,0,0.18))',
                      zIndex: 1,
                    }}
                  />
                  {/* Inner wrapper clips items to the rounded corners */}
                  <div className="overflow-hidden rounded-[14px]">
                  {/* Scrollable list */}
                  <div className="overflow-y-auto max-h-[480px] py-1">

                    {/* Group 1 — Interest signals */}
                    {!isOwner && (
                      <>
                        <button onClick={handleInterested} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                            <PlusCircle size={18} className="text-[#050505]" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Interested</p>
                            <p className="text-[13px] text-[#65676b] leading-[1.3]">More of your posts will be like this.</p>
                          </div>
                        </button>
                        <button onClick={handleNotInterestedAction} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                            <MinusCircle size={18} className="text-[#050505]" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Not interested</p>
                            <p className="text-[13px] text-[#65676b] leading-[1.3]">Less of your posts will be like this.</p>
                          </div>
                        </button>
                        <div className="h-px bg-[#ced0d4] my-1 mx-3" />
                      </>
                    )}

                    {/* Group 2 — Save */}
                    <button onClick={handleSavePost} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                      <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                        <Bookmark size={18} className="text-[#050505]" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Save post</p>
                        <p className="text-[13px] text-[#65676b] leading-[1.3]">Add this to your saved items.</p>
                      </div>
                    </button>

                    <div className="h-px bg-[#ced0d4] my-1 mx-3" />

                    {/* Group 3 — Info actions */}
                    <button onClick={handleToggleNotifications} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                      <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                        <Bell size={18} className="text-[#050505]" strokeWidth={2} />
                      </div>
                      <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Turn on notifications for this post</p>
                    </button>
                    <button onClick={handleWhySeeing} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                      <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                        <Info size={18} className="text-[#050505]" strokeWidth={2} />
                      </div>
                      <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Why am I seeing this post?</p>
                    </button>

                    {!isOwner && (
                      <>
                        <div className="h-px bg-[#ced0d4] my-1 mx-3" />
                        <button onClick={handleReport} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                            <Flag size={18} className="text-[#050505]" strokeWidth={2} />
                          </div>
                          <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Report post</p>
                        </button>
                        <button onClick={handleNotInterestedAction} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                            <EyeOff size={18} className="text-[#050505]" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Hide post</p>
                            <p className="text-[13px] text-[#65676b] leading-[1.3]">See fewer posts like this.</p>
                          </div>
                        </button>
                        <button onClick={handleSnooze} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                            <Clock size={18} className="text-[#050505]" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Snooze {post.name || post.username} for 30 days</p>
                            <p className="text-[13px] text-[#65676b] leading-[1.3]">Temporarily stop seeing posts.</p>
                          </div>
                        </button>
                        <button onClick={handleHideAll} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                            <X size={18} className="text-[#050505]" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Hide all from {post.name || post.username}</p>
                            <p className="text-[13px] text-[#65676b] leading-[1.3]">Stop seeing posts from this person.</p>
                          </div>
                        </button>
                        <button onClick={handleCopyLink} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                            <LinkIcon size={18} className="text-[#050505]" strokeWidth={2} />
                          </div>
                          <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Copy link</p>
                        </button>
                      </>
                    )}

                    {(isOwner || canDelete) && (
                      <>
                        <div className="h-px bg-[#ced0d4] my-1 mx-3" />
                        <button onClick={handleCopyLink} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                            <LinkIcon size={18} className="text-[#050505]" strokeWidth={2} />
                          </div>
                          <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Copy link</p>
                        </button>
                        
                        {isOwner && (
                          <button onClick={() => { setMenuOpen(false); setActiveModal('post', null, { editPost: post }); }} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                            <div className="w-9 h-9 rounded-full bg-[#e4e6eb] flex items-center justify-center shrink-0">
                              <Pencil size={18} className="text-[#050505]" strokeWidth={2} />
                            </div>
                            <p className="text-[15px] font-semibold text-[#050505] leading-[1.3]">Edit post</p>
                          </button>
                        )}
                        
                        {canDelete && (
                          <button onClick={handleDelete} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-[#f2f2f2] transition-colors text-left">
                            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                              <Trash2 size={18} className="text-red-600" strokeWidth={2} />
                            </div>
                            <p className="text-[15px] font-semibold text-red-600 leading-[1.3]">Delete post</p>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>

      {/* Content */}
      <div className="px-3 pb-2 pt-1">
        {post.content && (
          <div className="text-[14px] text-gray-900 leading-snug">
            <MentionText
              content={post.content.length > 150 && !isExpanded ? post.content.substring(0, 150) + '...' : post.content}
            />
            {post.content.length > 150 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-500 font-bold hover:underline ml-1 text-[13px]"
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
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center cursor-pointer hover:underline">
          {/* Primary Like Icon - Restored and spaced to avoid collision */}
          <div className="w-[16px] h-[16px] rounded-full bg-[#1877F2] flex items-center justify-center ring-2 ring-white z-30 shadow-sm mr-2">
            <ThumbsUp size={8} fill="white" className="text-white" />
          </div>
 
          <div className="ml-2 flex items-center leading-tight">
            {sparkCount > 0 && (
              <span className="text-[12px] text-gray-600 font-medium">
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
        <div className="text-[12px] text-gray-400 flex gap-2.5">
          {post.comment_count ? <span className="hover:underline cursor-pointer">{formatCount(post.comment_count)} comments</span> : null}
          {post.reshare_count ? <span className="hover:underline cursor-pointer">{formatCount(post.reshare_count)} shares</span> : null}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center border-t border-gray-100 mx-2 py-0.5 mt-0.5 mb-1">
        <button
          onClick={handleSpark}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all active:scale-95 group ${
            isSparked ? 'text-primary' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <ThumbsUp 
            size={16} 
            strokeWidth={isSparked ? 2.5 : 2} 
            className={isSparked ? 'fill-primary animate-spark-pop' : 'group-hover:scale-110 transition-transform'} 
          />
          <span className="text-[12px] font-bold tracking-tight">Like</span>
        </button>
        
        <button
          onClick={() => setActiveModal('post_comments', null, { post })}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-all active:scale-95 group"
        >
          <MessageCircle size={16} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
          <span className="text-[12px] font-bold tracking-tight">Comment</span>
        </button>
        
        <button
          onClick={() => setActiveModal('share', null, { post })}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-all active:scale-95 group"
        >
          <Share2 size={16} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
          <span className="text-[12px] font-bold tracking-tight">Share</span>
        </button>
      </div>


    </div>
  );
};

export default React.memo(PostCard);
