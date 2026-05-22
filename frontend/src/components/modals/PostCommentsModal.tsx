import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Heart, Loader2, ChevronDown, Check, Smile, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useUserStore } from '../../store/userStore';
import { useModalStore } from '../../store/modalStore';
import api from '../../api/api';
import MentionInput from '../MentionInput';
import MentionText from '../MentionText';
import { formatCount } from '../../utils/format';
import { emitHeart } from '../TikTokHearts';
import Spinner from '../ui/Spinner';

interface Comment {
  comment_id: string;
  content: string;
  user_id: string;
  username: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  like_count: number;
  is_liked: boolean;
  replies?: Comment[];
}

interface PostCommentsModalProps {
  post: {
    post_id: string;
    content: string;
    username: string;
    name?: string;
    avatar_url?: string;
    comment_count?: number;
  };
  onClose: () => void;
}

export default function PostCommentsModal({ post, onClose }: PostCommentsModalProps) {
  const { user } = useUserStore();
  const { setActiveModal } = useModalStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sortMode, setSortMode] = useState('relevant');
  const [showSortModal, setShowSortModal] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    const mockIds = ['d9b2f1e0-3c2b-4b1a-9d8e-7f6a5b4c3d2e', 'a1b2c3d4-e5f6-4a5b-bcde-f01234567890'];
    if (mockIds.includes(post.post_id)) {
      setLoading(false);
      setComments([]);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/posts/${post.post_id}/comments?sort=${sortMode}`);
      if (res.data.status === 'success') {
        setComments(res.data.data);
      } else {
        setComments(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      setLoading(false);
    }
  }, [post.post_id, sortMode]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleLike = async (commentId: string, e?: React.MouseEvent) => {
    if (e) emitHeart(e.clientX, e.clientY, 'v');
    try {
      const res = await api.post(`/comments/${commentId}/like`);
      if (res.data.action === 'liked' || res.data.action === 'unliked') {
        const updateComments = (list: Comment[]): Comment[] => {
          return list.map(c => {
            if (c.comment_id === commentId) {
              return {
                ...c,
                is_liked: res.data.action === 'liked',
                like_count: Math.max(0, (c.like_count || 0) + (res.data.action === 'liked' ? 1 : -1))
              };
            }
            if (c.replies) {
              return { ...c, replies: updateComments(c.replies) };
            }
            return c;
          });
        };
        setComments(updateComments(comments));
      }
    } catch (err) {
      console.error('Failed to toggle like', err);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, manualText?: string) => {
    if (e) e.preventDefault();
    const textToSubmit = (manualText || commentText).trim();
    if (!textToSubmit || submitting) return;

    setSubmitting(true);
    try {
      const payload: { content: string; parent_comment_id?: string } = {
        content: textToSubmit
      };
      if (replyingTo?.comment_id) {
        payload.parent_comment_id = replyingTo.comment_id;
      }

      const mockIds = ['d9b2f1e0-3c2b-4b1a-9d8e-7f6a5b4c3d2e', 'a1b2c3d4-e5f6-4a5b-bcde-f01234567890'];
      let resId = '';
      
      if (!mockIds.includes(post.post_id)) {
        const res = await api.post(`/posts/${post.post_id}/comments`, payload);
        resId = res.data.comment_id;
      } else {
        resId = `mock-comment-${Date.now()}`;
        await new Promise(r => setTimeout(r, 400));
      }
      
      const newComment = {
        comment_id: resId,
        content: textToSubmit,
        user_id: user?.id || user?.user_id,
        username: user?.username,
        name: user?.name,
        avatar_url: user?.avatar_url,
        created_at: new Date().toISOString(),
        like_count: 0,
        is_liked: false,
        replies: []
      };

      if (replyingTo) {
        const appendReply = (list: Comment[]): Comment[] => {
          return list.map(c => {
            if (c.comment_id === replyingTo.comment_id) {
              return { ...c, replies: [...(c.replies || []), newComment] };
            }
            if (c.replies) {
              return { ...c, replies: appendReply(c.replies) };
            }
            return c;
          });
        };
        setComments(appendReply(comments));
      } else {
        setComments([newComment, ...comments]);
      }

      setCommentText('');
      setReplyingTo(null);
      
      // Trigger heart burst on successful post
      emitHeart(window.innerWidth / 2, window.innerHeight / 2, 'v');
    } catch (err) {
      console.error('Failed to post comment', err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const [showStickers, setShowStickers] = useState(false);
  const [giphySearch, setGiphySearch] = useState('');
  const [giphyResults, setGiphyResults] = useState<any[]>([]);
  const [loadingGiphy, setLoadingGiphy] = useState(false);
  const GIPHY_API_KEY = 'V4AnAfCCCGEVjlUjiNMWWXCoW1JrAn4p';

  useEffect(() => {
    if (showStickers) {
      const fetchGiphy = async () => {
        setLoadingGiphy(true);
        try {
          const endpoint = giphySearch ? 'search' : 'trending';
          const query = giphySearch ? `&q=${encodeURIComponent(giphySearch)}` : '';
          const url = `https://api.giphy.com/v1/stickers/${endpoint}?api_key=${GIPHY_API_KEY}${query}&limit=24&rating=g`;
          const res = await fetch(url);
          const data = await res.json();
          setGiphyResults(data.data || []);
        } catch (err) {
          console.error('Giphy fetch error', err);
        } finally {
          setLoadingGiphy(false);
        }
      };
      const timer = setTimeout(fetchGiphy, giphySearch ? 500 : 0);
      return () => clearTimeout(timer);
    }
  }, [showStickers, giphySearch]);

  return (
    <div className="flex flex-col h-[85vh] md:h-[600px] w-full max-w-full bg-white dark:bg-[#101217] overflow-hidden relative border-x border-t border-black/5 dark:border-white/10 rounded-t-[12px] shadow-2xl mx-auto">
      {/* Sticker Picker Overlay */}
      <AnimatePresence>
        {showStickers && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-[70px] left-4 right-4 z-50 bg-white dark:bg-zinc-900 rounded-[24px] shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden flex flex-col max-h-[350px]"
          >
            <div className="p-3 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
              <input 
                type="text"
                placeholder="Search GIPHY Stickers..."
                value={giphySearch}
                onChange={(e) => setGiphySearch(e.target.value)}
                className="w-full bg-black/5 dark:bg-white/5 border-none rounded-full px-4 py-2 text-[14px] outline-none focus:ring-1 ring-primary/30"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-3 min-h-[300px] content-start">
              {loadingGiphy ? (
                <div className="col-span-3 flex items-center justify-center py-12">
                  <Spinner size="medium" color="text-primary" />
                </div>
              ) : giphyResults.length > 0 ? (
                giphyResults.map(g => (
                  <button 
                    key={g.id} 
                    onClick={() => {
                      const url = g.images.fixed_height.url;
                      setCommentText(url);
                      handleSubmit(undefined, url);
                      setShowStickers(false);
                      setGiphySearch('');
                    }}
                    className="w-full aspect-square bg-black/[0.03] dark:bg-white/[0.05] rounded-2xl flex items-center justify-center p-2 hover:scale-105 transition-transform active:scale-95 group"
                  >
                    <img 
                      src={g.images.fixed_height_small.url} 
                      alt="giphy" 
                      className="w-full h-full object-contain group-hover:drop-shadow-lg transition-all" 
                    />
                  </button>
                ))
              ) : (
                <div className="col-span-3 text-center py-12 text-black/40 dark:text-white/40 text-[14px] font-bold">
                  No stickers found
                </div>
              )}
            </div>
            <div className="p-2 border-t border-black/5 dark:border-white/10 flex justify-center bg-white dark:bg-zinc-900">
               <img src="https://giphy.com/static/img/powered_by_giphy_light.png" alt="Powered by GIPHY" className="h-4 dark:invert opacity-50" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/10 bg-white dark:bg-[#101217]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[17px] text-black dark:text-white">Comments</h3>
            <button 
              onClick={() => setShowSortModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95 group"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-black/40 dark:text-white/40 group-hover:text-primary transition-colors">
                {sortMode === 'relevant' ? 'Relevant' : 
                 sortMode === 'smart' ? 'Smart' :
                 sortMode === 'followers' ? 'Followers' :
                 sortMode === 'engaging' ? 'Engaging' :
                 sortMode === 'newest' ? 'Newest' : 'All'}
              </span>
              <ChevronDown size={12} className="text-black/20 dark:text-white/20 group-hover:text-primary transition-colors" />
            </button>
          </div>
          {!loading && post.comment_count && (
            <p className="text-[11px] text-black/40 dark:text-white/40 font-bold mt-0.5 uppercase tracking-[0.05em]">
              {sortMode === 'relevant' ? 'Most relevant' : 
               sortMode === 'smart' ? 'Smart Mix' :
               sortMode === 'followers' ? 'Followers first' :
               sortMode === 'engaging' ? 'Most engaging' :
               sortMode === 'newest' ? 'Newest' : 'All signals'} • {formatCount(post.comment_count)}
            </p>
          )}
        </div>
        <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all">
          <X size={20} className="text-black/40 dark:text-white/40" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white dark:bg-[#101217] custom-scrollbar">
        {/* Original Post Context */}
        <div className="flex gap-3 pb-4 border-b border-black/5 dark:border-white/10">
          <img src={post.avatar_url || '/uploads/avatars/default.png'} className="w-9 h-9 rounded-full object-cover border border-black/5 dark:border-white/10 shrink-0" alt="" />
          <div className="min-w-0">
            <div className="font-bold text-black dark:text-white text-[15px]">
              {post.name || post.username}
            </div>
            <div className="text-black/80 dark:text-white/80 text-[15px] mt-0.5 whitespace-pre-wrap leading-relaxed">{post.content}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="medium" color="text-primary" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12 text-black/20 dark:text-white/20 font-semibold text-[13px]">No comments yet.</div>
        ) : (
          <div className="space-y-6">
            {comments.map((comment) => (
              <CommentItem 
                key={comment.comment_id} 
                comment={comment} 
                post={post}
                onReply={(c) => setReplyingTo(c)} 
                onLike={(id) => handleLike(id)} 
                onDelete={(id) => {
                   if (!window.confirm('Delete this comment?')) return;
                   api.delete(`/posts/comments/${id}`).then(() => {
                      setComments(prev => prev.filter(c => c.comment_id !== id));
                   });
                }}
                onUpdate={(id, content) => {
                   api.patch(`/posts/comments/${id}`, { content }).then(() => {
                      setComments(prev => prev.map(c => c.comment_id === id ? { ...c, content } : c));
                   });
                }}
                onCloseModal={onClose}
              />
            ))}
            <div ref={commentsEndRef} />
          </div>
        )}
      </div>

      <div className="px-4 py-3 pb-safe bg-transparent">
        {replyingTo && (
          <div className="flex items-center justify-between bg-primary/5 dark:bg-primary/10 px-4 py-1.5 text-[11px] font-bold text-primary rounded-lg mb-4 border border-primary/10">
            <span className="flex items-center gap-1">
              Replying to <span className="text-primary/80">@{replyingTo.username}</span>
            </span>
            <button onClick={() => setReplyingTo(null)} className="hover:text-primary transition-colors bg-primary/10 p-0.5 rounded-full"><X size={10} /></button>
          </div>
        )}

        {/* Quick Reactions - One by one, spaced */}
        <div className="flex items-center justify-between mb-4 px-2">
          {['❤️', '🔥', '😍', '😮', '😊', '😂', '💯', '🙌'].map(emoji => (
            <button 
              key={emoji}
              onClick={() => handleSubmit(undefined, emoji)}
              className="text-[22px] hover:scale-125 active:scale-90 transition-transform duration-200"
            >
              {emoji}
            </button>
          ))}
        </div>

      <div className="p-3 pb-8 md:pb-6 bg-transparent flex items-center gap-2.5 min-w-0">
        {/* Profile Avatar - Edge anchored */}
        <div className="w-8 h-8 rounded-full overflow-hidden border border-black/5 dark:border-white/10 shrink-0">
            <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-full h-full object-cover" alt="" />
        </div>

        {/* Unified Input Pill - High-density interactions on the right */}
        <div className="flex-1 flex items-center bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-full px-4 min-h-[44px] gap-2 shadow-sm min-w-0">
          <form onSubmit={handleSubmit} className="flex-1 min-w-0 h-full flex items-center">
             <MentionInput
                value={commentText}
                onChange={setCommentText}
                placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : "Add a comment..."}
                onSubmit={handleSubmit}
                className="w-full bg-transparent border-none outline-none text-[14px] text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 py-3"
             />
          </form>
          
          <div className="flex items-center gap-3.5 shrink-0 ml-1">
            <button 
              onClick={() => {
                setCommentText(prev => prev + (prev.endsWith(' ') || prev === '' ? '@' : ' @'));
              }}
              className="text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors font-black text-[17px] select-none"
            >
              @
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowStickers(!showStickers);
              }}
              className={`hover:text-black dark:hover:text-white transition-colors flex items-center justify-center ${showStickers ? 'text-primary' : 'text-black/40 dark:text-white/40'}`}
            >
              <Smile size={21} />
            </button>
          </div>
        </div>
        
        {/* Send Button */}
        <button 
          onClick={() => handleSubmit()}
          disabled={!commentText.trim() || submitting}
          className={clsx(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90",
            commentText.trim() ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-black/5 dark:bg-white/5 text-black/20 dark:text-white/20"
          )}
        >
          {submitting ? (
            <Spinner size="small" color="text-white" />
          ) : (
            <ArrowUp size={22} strokeWidth={3} />
          )}
        </button>
      </div>
      </div>

      {/* Sort Bottom Sheet */}
      <AnimatePresence>
        {showSortModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSortModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000]"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#101217] rounded-t-[32px] z-[2001] shadow-2xl p-6 pb-12 border-t border-black/5 dark:border-white/10"
            >
              <div className="w-12 h-1 bg-black/10 dark:bg-white/10 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-black dark:text-white">Sort Comments</h3>
                <button onClick={() => setShowSortModal(false)} className="text-[12px] font-bold text-primary uppercase">Done</button>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'relevant', label: 'Most Relevant', desc: 'Top comments based on engagement' },
                  { id: 'smart', label: 'Smart Mix', desc: 'Balanced mix of trending and recent' },
                  { id: 'followers', label: 'Followers First', desc: 'Comments from people you follow first' },
                  { id: 'engaging', label: 'Most Engaging', desc: 'Highest interaction volume' },
                  { id: 'newest', label: 'Newest', desc: 'Real-time chronological feed' },
                  { id: 'all', label: 'All Comments', desc: 'Includes everything, unfiltered' }
                ].map(mode => (
                  <button 
                    key={mode.id}
                    onClick={() => { setSortMode(mode.id); setShowSortModal(false); }}
                    className={clsx(
                      "w-full flex items-start gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]",
                      sortMode === mode.id ? "bg-primary/5 dark:bg-primary/10 border border-primary/20" : "bg-black/5 dark:bg-white/5 border border-transparent"
                    )}
                  >
                    <div className={clsx(
                      "mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      sortMode === mode.id ? "border-primary bg-primary" : "border-black/20 dark:border-white/20"
                    )}>
                      {sortMode === mode.id && <Check size={12} className="text-white" />}
                    </div>
                    <div className="text-left">
                      <p className={clsx("text-[14px] font-bold", sortMode === mode.id ? "text-primary" : "text-black dark:text-white")}>
                        {mode.label}
                      </p>
                      <p className="text-[11px] font-medium text-black/40 dark:text-white/40 mt-0.5">{mode.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommentItem({ 
  comment, 
  post,
  onReply, 
  onLike, 
  onDelete,
  onUpdate,
  onCloseModal 
}: { 
  comment: Comment, 
  post: any,
  onReply: (c: Comment) => void, 
  onLike: (id: string) => void, 
  onDelete: (id: string) => void,
  onUpdate: (id: string, content: string) => void,
  onCloseModal: () => void 
}) {
  const { user: currentUser } = useUserStore();
  const [showReplies, setShowReplies] = useState(false);
  const [translated, setTranslated] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const isAuthor = currentUser?.user_id === comment.user_id || currentUser?.id === comment.user_id;
  const isGroupAdmin = post.group_id && (post.user_role === 'admin' || post.user_role === 'owner' || post.user_role === 'moderator');
  const canDelete = isAuthor || isGroupAdmin || currentUser?.role === 'admin';

  const hasReplies = comment.replies && comment.replies.length > 0;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}D`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `${hours}H`;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins > 0) return `${mins}M`;
    return 'NOW';
  };

  const handleProfileClick = () => {
    onCloseModal();
    window.location.href = `/profile/${comment.username}`;
  };

  const handleTranslate = async () => {
    if (translated) {
      setTranslated(false);
      return;
    }
    if (translatedContent) {
      setTranslated(true);
      return;
    }
    setTranslating(true);
    try {
      const res = await api.get(`/posts/comments/${comment.comment_id}/translate`);
      setTranslatedContent(res.data.translatedText);
      setTranslated(true);
    } catch (err) {
      console.error('Translation failed', err);
      setTranslatedContent('Translation failed.');
      setTranslated(true);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="flex gap-2 w-full pb-1">
      <img 
        src={comment.avatar_url || '/uploads/avatars/default.png'} 
        className="w-8 h-8 rounded-full object-cover border border-black/5 dark:border-white/10 shrink-0 mt-1 cursor-pointer" 
        onClick={handleProfileClick}
        alt="" 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-1 py-0.5">
          <p onClick={handleProfileClick} className="font-bold text-[14px] text-black dark:text-white cursor-pointer hover:underline inline-block mr-2">
            {comment.username}
          </p>
          <div className="text-[14px] text-black/90 dark:text-white/90 break-words whitespace-pre-wrap leading-[1.4] tracking-tight inline">
            {isEditing ? (
              <div className="flex flex-col gap-2 mt-1">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-white dark:bg-[#101217] border border-black/5 dark:border-white/10 rounded-lg p-2 text-[14px] outline-none focus:border-primary"
                  rows={2}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setIsEditing(false); setEditContent(comment.content); }} className="text-[12px] font-bold text-black/40 dark:text-white/40 hover:underline">Cancel</button>
                  <button onClick={() => { onUpdate(comment.comment_id, editContent); setIsEditing(false); }} className="text-[12px] font-bold text-primary hover:underline">Save</button>
                </div>
              </div>
            ) : translating ? (
              <div className="flex items-center gap-2 text-black/40 dark:text-white/40 py-1">
                <Spinner size="medium" color="text-primary" />
                <span className="text-[12px]">Translating...</span>
              </div>
            ) : translated ? (
              <span className="italic text-black/60 dark:text-white/60">{translatedContent || "Translation not available."}</span>
            ) : (
              comment.content.includes('giphy.com') ? (
                <div className="mt-2 mb-1">
                  <img 
                    src={comment.content} 
                    alt="sticker" 
                    className="w-[120px] h-[120px] object-contain rounded-lg"
                  />
                </div>
              ) : (
                <MentionText content={comment.content} className={clsx(comment.content.length > 200 && !isExpanded && "line-clamp-6")} />
              )
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-1 px-2 text-[12px] font-bold text-black/40 dark:text-white/40">
          <span className="text-[11px] font-normal">{timeAgo(comment.created_at)}</span>
          <button onClick={(e) => onLike(comment.comment_id, e)} className={`hover:underline ${comment.is_liked ? 'text-primary' : ''}`}>Like{comment.like_count > 0 && ` (${formatCount(comment.like_count)})`}</button>
          <button onClick={() => onReply(comment)} className="hover:underline">Reply</button>
          <button onClick={handleTranslate} className="hover:underline text-[11px] font-normal">{translated ? 'Original' : 'Translate'}</button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="hover:text-black dark:hover:text-white font-bold tracking-widest px-1">•••</button>
            {showMenu && (
              <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-[#101217] rounded-lg shadow-xl border border-black/5 dark:border-white/10 py-1 z-50 animate-scale-in">
                {!isAuthor && (
                  <button onClick={() => { setShowMenu(false); alert('Comment reported.'); }} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5">Report</button>
                )}
                <button onClick={() => { setShowMenu(false); navigator.clipboard.writeText(comment.content); alert('Copied!'); }} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5">Copy</button>
                {isAuthor && (
                  <button onClick={() => { setShowMenu(false); setIsEditing(true); }} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5">Edit</button>
                )}
                {canDelete && (
                  <button onClick={() => { setShowMenu(false); onDelete(comment.comment_id); }} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">Delete</button>
                )}
              </div>
            )}
          </div>
        </div>

        {hasReplies && (
          <div className="mt-1">
            {!showReplies ? (
              <button onClick={() => setShowReplies(true)} className="flex items-center gap-2 text-[12px] font-bold text-black/40 dark:text-white/40 hover:underline mt-1">
                View {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            ) : (
              <div className="space-y-4 mt-3 ml-2 border-l-2 border-black/5 dark:border-white/10 pl-4">
                {comment.replies.map((reply) => (
                  <CommentItem key={reply.comment_id} comment={reply} post={post} onReply={onReply} onLike={onLike} onDelete={onDelete} onUpdate={onUpdate} onCloseModal={onCloseModal} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
