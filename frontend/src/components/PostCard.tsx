import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MoreHorizontal, Share2, MessageCircle, Heart, Bookmark, X, 
  Globe, Lock, MapPin, Smile, Clock, EyeOff, Flag, Pencil, 
  Trash2, Bell, Info, Link as LinkIcon, UserPlus, UserMinus,
  Sparkles, Zap, ChevronDown, Check, Send
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';
import { useNetworkStore } from '../store/networkStore';
import { useOfflineQueueStore } from '../store/offlineQueueStore';
import { useFeedStore } from '../store/feedStore';
import { formatCount } from '../utils/format';
import MentionText from './MentionText';
import Avatar from './Avatar';
import { ProgressiveImage } from './ProgressiveImage';
import { emitHeart as spawnTikTokHeart } from './TikTokHearts';
import clsx from 'clsx';

interface Post {
  post_id: string;
  user_id: string;
  username: string;
  name?: string;
  avatar_url?: string;
  content: string;
  media_url?: string;
  media_type?: string;
  media_files?: { url: string; type: string }[];
  post_type: string;
  created_at: string;
  spark_count: number;
  comment_count: number;
  reshare_count: number;
  is_sparked: boolean;
  is_saved: boolean;
  location?: string;
  feeling?: string;
  activity?: string;
  user_role?: string;
  group_id?: string;
  top_liker_name?: string;
}

interface PostCardProps {
  post: Post;
  onRefresh?: () => void;
}

// Custom Icons for better branding
const HeartIcon = ({ size = 20, active = false, className = "" }) => (
  <svg 
    width={size} height={size} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} 
    stroke="currentColor" strokeWidth={active ? "0" : "2.5"} strokeLinecap="round" strokeLinejoin="round" 
    className={className}
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const CommentIcon = ({ size = 20, className = "" }) => (
  <svg 
    width={size} height={size} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
    className={className}
  >
    <path d="M16.1 20A9 9 0 1 1 20 16.1L22 22Z" />
  </svg>
);

const SendIcon = ({ size = 20, className = "" }) => (
  <svg 
    width={size} height={size} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
    className={className}
  >
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

const BookmarkIcon = ({ size = 20, active = false, className = "" }) => (
  <svg 
    width={size} height={size} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} 
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
    className={className}
  >
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />
  </svg>
);

const IncognitoIcon = ({ size = 16, className = "" }) => (
  <svg 
    width={size} height={size} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
    className={className}
  >
    <path d="M17 10c.5-1.5 0-3-1-4l-1-1h-6l-1 1c-1 1-1.5 2.5-1 4" />
    <path d="M3 10h18l-1.5 3H4.5L3 10z" />
    <circle cx="8.5" cy="17" r="2.5" />
    <circle cx="15.5" cy="17" r="2.5" />
    <path d="M11 17h2" />
  </svg>
);

const PostCard: React.FC<PostCardProps> = ({ post, onRefresh }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useUserStore();
  const { setActiveModal, triggerRefresh } = useModalStore();
  const { isOffline } = useNetworkStore();
  const { enqueueAction } = useOfflineQueueStore();

  // Unified single source of truth selector from useFeedStore
  const storePost = useFeedStore(state => state.postsById[post.post_id]) || post;
  const patchPost = useFeedStore(state => state.patchPost);
  const removePost = useFeedStore(state => state.removePost);

  const isSparked = storePost.is_sparked;
  const sparkCount = storePost.spark_count || 0;
  const isSaved = storePost.is_saved;

  const [menuOpen, setMenuOpen] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, caretLeft: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isOwner = currentUser?.user_id === post.user_id || currentUser?.username === post.username;
  const isGroupAdmin = post.group_id && (post.user_role === 'admin' || post.user_role === 'owner' || post.user_role === 'moderator');
  const canDelete = isOwner || isGroupAdmin || currentUser?.role === 'admin';

  const handleSpark = async (e?: React.MouseEvent, fromDoubleTap = false) => {
    if (e) {
      e.stopPropagation();
      if (fromDoubleTap) {
        spawnTikTokHeart(e.clientX, e.clientY);
        if (isSparked) return; // Don't unlike on double tap
      }
    }
    
    const newSparked = fromDoubleTap ? true : !isSparked;
    const newCount = Math.max(0, sparkCount + (newSparked ? 1 : -1));

    // Optimistically update normalized store
    patchPost(post.post_id, { is_sparked: newSparked, spark_count: newCount });

    if (isOffline) {
      enqueueAction({
        type: 'LIKE_POST',
        endpoint: `/posts/${post.post_id}/like`,
        method: 'POST',
        payload: {}
      });
      return;
    }

    try {
      await api.post(`/posts/${post.post_id}/like`);
    } catch (err) {
      // Rollback on failure
      patchPost(post.post_id, { is_sparked: !newSparked, spark_count: sparkCount });
    }
  };

  const handleSavePost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newSaved = !isSaved;

    // Optimistically update normalized store
    patchPost(post.post_id, { is_saved: newSaved });

    try {
      await api.post(`/posts/${post.post_id}/save`);
    } catch (err) {
      // Rollback on failure
      patchPost(post.post_id, { is_saved: !newSaved });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post?')) return;
    setDeleting(true);
    setMenuOpen(false);
    try {
      if (post.group_id) {
        await api.delete(`/groups/${post.group_id}/posts/${post.post_id}`);
      } else {
        await api.delete(`/posts/${post.post_id}`);
      }
      removePost(post.post_id);
      triggerRefresh();
    } catch (err) {
      setDeleting(false);
      alert('Failed to delete post');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.post_id}`);
    alert('Link copied to clipboard!');
    setMenuOpen(false);
  };

  const handleReport = () => {
    const reason = window.prompt('Why are you reporting this post?', 'Inappropriate content');
    if (!reason) return;
    api.post('/moderation/reports', { post_id: post.post_id, reason })
      .then(() => alert('Post reported.'))
      .catch(() => alert('Failed to report.'));
    setMenuOpen(false);
  };

  const handleSnooze = () => {
    alert(`Snoozed ${post.name || post.username} for 30 days.`);
    setMenuOpen(false);
  };

  const handleHideAll = () => {
    alert(`Hiding all posts from ${post.name || post.username}.`);
    setMenuOpen(false);
  };

  const handleWhySeeing = () => {
    setMenuOpen(false);
    let reason = "You're seeing this because it's a popular post in your community.";
    if (post.group_id) {
      reason = "You're seeing this because it was posted in a group you're a member of.";
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

  if (post.post_type === 'private' && !isOwner) {
    return (
      <div className="bg-white dark:bg-black rounded-none sm:rounded-[12px] shadow-sm overflow-hidden mb-3 p-4 border border-black/5 dark:border-white/10 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mb-2">
          <Lock size={20} className="text-black/40 dark:text-white/40" />
        </div>
        <h3 className="text-black dark:text-white font-bold text-[14px] mb-1">Post Unavailable</h3>
        <p className="text-black/40 dark:text-white/40 text-[12px]">This post is private and cannot be viewed.</p>
      </div>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(post.created_at));
  const getMediaUrl = (url: string) => url.startsWith('http') ? url : `${api.defaults.baseURL}${url}`;

  const getFeelingIcon = (feeling: string) => {
    const f = feeling.toLowerCase();
    if (f.includes('happy')) return Smile;
    if (f.includes('sad')) return Smile; // maybe use a sad icon if available
    return Smile;
  };

  return (
    <div 
      ref={cardRef}
      className={`bg-white dark:bg-black rounded-none sm:rounded-[12px] shadow-sm dark:shadow-none overflow-hidden border-b sm:border border-black/5 dark:border-white/10 transition-opacity duration-300 ${
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
              className="font-bold text-[15px] text-black dark:text-white hover:underline tracking-tighter"
            >
              {post.name || post.username}
            </Link>

            {(post.feeling || post.activity) && (
               <div className="flex items-center gap-1 text-[12px] text-black/40 dark:text-white/40 font-medium flex-wrap">
                {post.feeling && (
                  <>
                    <span>is feeling</span>
                    <span className="font-bold text-black dark:text-white capitalize flex items-center gap-1">
                      {post.feeling}
                      {(() => { const Icon = getFeelingIcon(post.feeling); return Icon ? <Icon size={14} className="text-primary" /> : null; })()}
                    </span>
                  </>
                )}
                {post.feeling && post.activity && <span>and</span>}
                {post.activity && (
                  <>
                    <span>is</span>
                    <span className="font-bold text-black dark:text-white capitalize">{post.activity}</span>
                  </>
                )}
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
                className="ml-0.5 text-[13px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                · Follow
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-black/40 dark:text-white/40 leading-tight mt-0.5">
            <span className="hover:underline cursor-pointer">{timeAgo.replace('about ', '').replace('less than a minute ago', 'Just now')}</span>
            <span>·</span>
            {post.post_type === 'public' ? (
              <Globe size={11} className="fill-current text-black/40 dark:text-white/40" />
            ) : post.post_type === 'private' || post.post_type === 'campus_only' ? (
              <Lock size={11} className="fill-current text-black/40 dark:text-white/40" />
            ) : (
              <IncognitoIcon size={11} className="text-black/40 dark:text-white/40" />
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
                  const btnCenterX = (rect.left + rect.right) / 2;
                  const leftPos = Math.max(8, Math.min(rect.right - DROPDOWN_W, window.innerWidth - DROPDOWN_W - 8));
                  const caretLeft = Math.max(8, Math.min(btnCenterX - leftPos - CARET_HALF, DROPDOWN_W - 36));
                  setDropdownPos({ top: rect.bottom + 8, left: leftPos, caretLeft });
                }
                setMenuOpen(prev => !prev);
              }
            }}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-black/40 dark:text-white/60"
          >
            <MoreHorizontal size={20} />
          </button>

          <button 
            onClick={handleNotInterested}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-black/40 dark:text-white/60"
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
                  className="w-[380px] bg-white dark:bg-black rounded-[14px] shadow-2xl dark:shadow-none z-[9991] relative border border-black/5 dark:border-white/10"
                  onClick={e => e.stopPropagation()}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '-13px',
                      left: `${dropdownPos.caretLeft}px`,
                      width: 0, height: 0,
                      borderLeft: '14px solid transparent',
                      borderRight: '14px solid transparent',
                      borderBottom: '14px solid currentColor',
                    }}
                    className="text-white dark:text-black"
                  />
                  
                  <div className="p-1.5 overflow-y-auto max-h-[85vh] custom-scrollbar">
                    <button onClick={handleSavePost} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left group">
                      <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                        <Bookmark size={18} className="text-black dark:text-white" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-black dark:text-white leading-[1.3]">Save post</p>
                        <p className="text-[13px] text-black/40 dark:text-white/40 leading-[1.3]">Add this to your saved items.</p>
                      </div>
                    </button>
                    <button onClick={handleToggleNotifications} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                      <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                        <Bell size={18} className="text-black dark:text-white" strokeWidth={2} />
                      </div>
                      <p className="text-[15px] font-semibold text-black dark:text-white leading-[1.3]">Turn on notifications for this post</p>
                    </button>
                    <button onClick={handleWhySeeing} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                      <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                        <Info size={18} className="text-black dark:text-white" strokeWidth={2} />
                      </div>
                      <p className="text-[15px] font-semibold text-black dark:text-white leading-[1.3]">Why am I seeing this post?</p>
                    </button>

                    {!isOwner && (
                      <>
                        <div className="h-px bg-black/5 dark:bg-white/10 my-1 mx-3" />
                        <button onClick={handleReport} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                            <Flag size={18} className="text-black dark:text-white" strokeWidth={2} />
                          </div>
                          <p className="text-[15px] font-semibold text-black dark:text-white leading-[1.3]">Report post</p>
                        </button>
                        <button onClick={handleNotInterested} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                            <EyeOff size={18} className="text-black dark:text-white" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-black dark:text-white leading-[1.3]">Hide post</p>
                            <p className="text-[13px] text-black/40 dark:text-white/40 leading-[1.3]">See fewer posts like this.</p>
                          </div>
                        </button>
                        <button onClick={handleSnooze} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                            <Clock size={18} className="text-black dark:text-white" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-black dark:text-white leading-[1.3]">Snooze {post.name || post.username} for 30 days</p>
                            <p className="text-[13px] text-black/40 dark:text-white/40 leading-[1.3]">Temporarily stop seeing posts.</p>
                          </div>
                        </button>
                        <button onClick={handleHideAll} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                            <X size={18} className="text-black dark:text-white" strokeWidth={2} />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-black dark:text-white leading-[1.3]">Hide all from {post.name || post.username}</p>
                            <p className="text-[13px] text-black/40 dark:text-white/40 leading-[1.3]">Stop seeing posts from this person.</p>
                          </div>
                        </button>
                        <button onClick={handleCopyLink} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                            <LinkIcon size={18} className="text-black dark:text-white" strokeWidth={2} />
                          </div>
                          <p className="text-[15px] font-semibold text-black dark:text-white leading-[1.3]">Copy link</p>
                        </button>
                      </>
                    )}

                    {(isOwner || canDelete) && (
                      <>
                        <div className="h-px bg-black/5 dark:bg-white/10 my-1 mx-3" />
                        <button onClick={handleCopyLink} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                            <LinkIcon size={18} className="text-black dark:text-white" strokeWidth={2} />
                          </div>
                          <p className="text-[15px] font-semibold text-black dark:text-white leading-[1.3]">Copy link</p>
                        </button>
                        
                        {isOwner && (
                          <button onClick={() => { setMenuOpen(false); setActiveModal('post', null, { editPost: post }); }} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                            <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                              <Pencil size={18} className="text-black dark:text-white" strokeWidth={2} />
                            </div>
                            <p className="text-[15px] font-semibold text-black dark:text-white leading-[1.3]">Edit post</p>
                          </button>
                        )}
                        
                        {canDelete && (
                          <button onClick={handleDelete} className="w-full flex items-center gap-3 px-3 py-[10px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                            <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                              <Trash2 size={18} className="text-red-500" strokeWidth={2} />
                            </div>
                            <p className="text-[15px] font-semibold text-red-500 leading-[1.3]">Delete post</p>
                          </button>
                        )}
                      </>
                    )}
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
          <div className="text-[14px] text-black dark:text-white leading-snug">
            <MentionText 
              content={post.content.length > 150 && !isExpanded ? post.content.substring(0, 150) + '...' : post.content} 
            />
            {post.content.length > 150 && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-black/40 dark:text-white/40 font-bold hover:underline ml-1 text-[13px]"
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
          className="relative bg-black/5 dark:bg-black cursor-pointer overflow-hidden w-full"
          onClick={(e) => {
            spawnTikTokHeart(e.clientX, e.clientY);
            setActiveModal('media_preview', null, { post });
          }}
          onDoubleClick={(e) => handleSpark(e, true)}
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
                  <ProgressiveImage
                    src={file.url}
                    alt=""
                    imageClassName="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                    width={800}
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
                <ProgressiveImage
                  src={post.media_url}
                  alt=""
                  imageClassName="w-full h-auto block max-h-[85vh] sm:max-h-[700px] object-contain transition-transform duration-700 hover:scale-105"
                  width={1080}
                />
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Stats */}
      <div 
        className="px-3 py-2 flex items-center justify-between cursor-pointer active:bg-black/5 dark:active:bg-white/5 transition-colors"
        onClick={(e) => {
          spawnTikTokHeart(e.clientX, e.clientY);
          handleSpark(e, true);
        }}
      >
        <div className="flex items-center hover:underline">
          <div className="w-[16px] h-[16px] rounded-full bg-primary flex items-center justify-center ring-2 ring-white dark:ring-black z-30 shadow-sm mr-2">
            <HeartIcon size={10} active={true} className="text-white" />
          </div>
 
          <div className="ml-2 flex items-center leading-tight">
            {sparkCount > 0 && (
              <span className="text-[12px] text-black/40 dark:text-white/40 font-medium">
                {post.top_liker_name ? (
                  <>
                    Liked by <span className="font-bold text-black dark:text-white">{post.top_liker_name}</span>
                    {sparkCount > 1 && (
                      <> and <span className="font-bold text-black dark:text-white">{formatCount(sparkCount - 1)} others</span></>
                    )}
                  </>
                ) : (
                  <span className="font-bold text-black dark:text-white">{formatCount(sparkCount)} {sparkCount === 1 ? 'like' : 'likes'}</span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="text-[12px] text-black/40 dark:text-white/40 flex gap-2.5 font-bold">
          {(post.comment_count || post.comments_count || (typeof post.comments === 'number' ? post.comments : 0)) ? <span className="hover:underline cursor-pointer">{formatCount(post.comment_count || post.comments_count || (typeof post.comments === 'number' ? post.comments : 0))} comments</span> : null}
          {(post.reshare_count || post.share_count) ? <span className="hover:underline cursor-pointer">{formatCount(post.reshare_count || post.share_count)} shares</span> : null}
        </div>
      </div>

      {/* Actions Row - Integrated for a unified look */}
      <div 
        className="flex items-center justify-between px-4 pb-2.5 pt-0.5 cursor-pointer"
        onClick={(e) => {
          spawnTikTokHeart(e.clientX, e.clientY);
          handleSpark(e, true);
        }}
      >
        <div className="flex items-center gap-6">
          {/* Spark (Like) */}
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-black text-black/40 dark:text-white/40 mb-0.5 tracking-tighter">
              {formatCount(
                post.spark_count || 
                post.likes_count || 
                (typeof post.sparks === 'number' ? post.sparks : 0) || 
                (Array.isArray(post.sparks) ? post.sparks.length : 0) || 
                0
              )}
            </span>
            <button
              onClick={(e) => {
                spawnTikTokHeart(e.clientX, e.clientY, 'v');
                handleSpark(e);
              }}
              className={`p-1 transition-all active:scale-90 group ${
                isSparked ? 'text-primary' : 'text-black/90 dark:text-white/90 hover:text-primary'
              }`}
            >
              <HeartIcon 
                size={22} 
                active={isSparked}
                className="transition-transform group-hover:scale-110" 
              />
            </button>
          </div>
          
          {/* Comment */}
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-black text-black/40 dark:text-white/40 mb-0.5 tracking-tighter">
              {formatCount(
                post.comment_count || 
                post.comments_count || 
                (typeof post.comments === 'number' ? post.comments : 0) || 
                (Array.isArray(post.comments) ? post.comments.length : 0) || 
                0
              )}
            </span>
            <button
              onClick={(e) => {
                spawnTikTokHeart(e.clientX, e.clientY, 'v');
                setActiveModal('post_comments', null, { post });
              }}
              className="p-1 text-black/90 dark:text-white/90 hover:text-primary transition-all active:scale-90 group"
            >
              <CommentIcon size={22} className="transition-transform group-hover:scale-110" />
            </button>
          </div>
          
          {/* Send / Share */}
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-black text-black/40 dark:text-white/40 mb-0.5 tracking-tighter invisible">0</span>
            <button
              onClick={(e) => {
                spawnTikTokHeart(e.clientX, e.clientY, 'v');
                setActiveModal('share', null, { post });
              }}
              className="flex items-center justify-center p-1 text-black/90 dark:text-white/90 hover:text-primary transition-all active:scale-90 group"
            >
              <SendIcon className="transition-transform group-hover:scale-110" />
            </button>
          </div>
        </div>

        {/* Bookmark / Save */}
        <div className="flex flex-col items-center">
          <span 
            onClick={(e) => {
              e.stopPropagation();
              setActiveModal('post_comments', null, { post });
            }}
            className="text-[11px] font-black text-black/40 dark:text-white/40 mb-0.5 tracking-tighter cursor-pointer hover:text-primary"
          >
            {formatCount(post.comment_count || post.comments_count || 0)}
          </span>
          <button
            onClick={(e) => {
              spawnTikTokHeart(e.clientX, e.clientY, 'v');
              handleSavePost(e);
            }}
            className={`p-1 transition-colors ${
              isSaved ? 'text-yellow-500' : 'text-black/90 dark:text-white/90 hover:text-yellow-500'
            }`}
          >
            <BookmarkIcon size={22} active={isSaved} className="transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

    </div>
  );
};

export default PostCard;
