import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Heart,
  ChevronDown,
  Search,
  ArrowUp,
  Smile,
  MessageCircle,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../api/api';
import { useUserStore } from '../../../store/userStore';
import { getMediaUrl } from '../../../utils/imageUtils';
import { emitHeart } from '../../../components/TikTokHearts';
import MentionInput from '../../../components/MentionInput';
import MentionText from '../../../components/MentionText';
import Spinner from '../../../components/ui/Spinner';
import { logger } from '../../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommentData {
  comment_id: string;
  username: string;
  avatar_url?: string;
  content: string;
  created_at: string;
  like_count?: number;
  is_liked?: boolean;
  replies?: CommentData[];
  parent_comment_id?: string | null;
}

interface GiphyResult {
  id: string;
  images: { fixed_height: { url: string } };
}

interface MomentsCommentSheetProps {
  open: boolean;
  momentId: string | null;
  onClose: () => void;
  onCommentAdded?: () => void;
}

// ─── Relative Time ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 52) return `${w}w`;
  return `${Math.floor(w / 52)}y`;
}

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS = ['Top', 'Newest', 'Oldest'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function sortComments(list: CommentData[], sort: SortOption): CommentData[] {
  const copy = [...list];
  if (sort === 'Top') {
    copy.sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0));
  } else if (sort === 'Newest') {
    copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else {
    copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  return copy;
}

// ─── Single comment/reply row ──────────────────────────────────────────────────

interface CommentRowProps {
  comment: CommentData;
  isReply?: boolean;
  onLike: (id: string, e: React.MouseEvent) => void;
  onReplyTarget: (username: string, parentId: string) => void;
}

const CommentRow: React.FC<CommentRowProps> = ({ comment, isReply = false, onLike, onReplyTarget }) => {
  const isGif = comment.content.includes('giphy.com');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={clsx('flex gap-3 items-start', isReply ? 'ml-11 mt-3' : 'mt-4')}
    >
      {/* Avatar */}
      <img
        src={getMediaUrl(comment.avatar_url) || '/uploads/avatars/no-profile.png'}
        alt={comment.username}
        className={clsx(
          'rounded-full object-cover shrink-0 border border-white/10',
          isReply ? 'w-7 h-7' : 'w-9 h-9'
        )}
      />

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13px] font-bold text-gray-900 dark:text-white leading-none">
            @{comment.username}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-zinc-500 leading-none">
            {relativeTime(comment.created_at)}
          </span>
        </div>

        <div className="text-[14px] text-gray-800 dark:text-zinc-200 leading-snug break-words">
          {isGif ? (
            <img
              src={comment.content}
              alt="sticker"
              className="w-[120px] h-[120px] object-contain rounded-xl mt-1"
            />
          ) : (
            <MentionText content={comment.content} className="text-gray-800 dark:text-zinc-200" />
          )}
        </div>

        <div className="flex items-center gap-5 mt-2">
          <button
            onClick={() => onReplyTarget(comment.username, comment.comment_id)}
            className="text-[12px] font-semibold text-gray-400 dark:text-zinc-500 hover:text-[#fe2c55] transition-colors active:opacity-50"
          >
            Reply
          </button>
        </div>
      </div>

      {/* Like */}
      <button
        onClick={(e) => onLike(comment.comment_id, e)}
        className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0 active:scale-125 transition-transform"
      >
        <Heart
          size={isReply ? 14 : 16}
          className={clsx(
            'transition-colors',
            comment.is_liked ? 'fill-[#fe2c55] stroke-[#fe2c55]' : 'stroke-gray-400 dark:stroke-zinc-500'
          )}
        />
        {(comment.like_count ?? 0) > 0 && (
          <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 leading-none">
            {comment.like_count}
          </span>
        )}
      </button>
    </motion.div>
  );
};

// ─── Top-level comment with collapsible replies ───────────────────────────────

interface CommentThreadProps {
  comment: CommentData;
  onLike: (id: string, e: React.MouseEvent) => void;
  onReplyTarget: (username: string, parentId: string) => void;
}

const CommentThread: React.FC<CommentThreadProps> = ({ comment, onLike, onReplyTarget }) => {
  const [expanded, setExpanded] = useState(true);
  const hasReplies = (comment.replies?.length ?? 0) > 0;

  return (
    <div className="mb-1">
      <CommentRow comment={comment} onLike={onLike} onReplyTarget={onReplyTarget} />

      {hasReplies && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="ml-12 mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[#fe2c55] active:opacity-60 transition-opacity"
        >
          <div className="h-px w-6 bg-[#fe2c55]/40 rounded-full" />
          {expanded
            ? `Hide ${comment.replies!.length} repl${comment.replies!.length === 1 ? 'y' : 'ies'}`
            : `View ${comment.replies!.length} repl${comment.replies!.length === 1 ? 'y' : 'ies'}`}
          <ChevronDown
            size={12}
            className={clsx('transition-transform', expanded ? 'rotate-180' : 'rotate-0')}
          />
        </button>
      )}

      <AnimatePresence initial={false}>
        {expanded && hasReplies && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {comment.replies!.map((reply) => (
              <CommentRow
                key={reply.comment_id}
                comment={reply}
                isReply
                onLike={onLike}
                onReplyTarget={onReplyTarget}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Quick emoji reaction chips ───────────────────────────────────────────────

const QUICK_EMOJIS = ['❤️', '🔥', '😍', '😮', '😂', '💯', '🙌', '✨'];

// ─── Main Sheet ───────────────────────────────────────────────────────────────

const MomentsCommentSheet: React.FC<MomentsCommentSheetProps> = ({
  open,
  momentId,
  onClose,
  onCommentAdded,
}) => {
  const { user } = useUserStore();

  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortOption>('Top');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ username: string; parentId: string } | null>(null);
  const [focusComposer, setFocusComposer] = useState(false);

  const [showStickers, setShowStickers] = useState(false);
  const [giphySearch, setGiphySearch] = useState('');
  const [giphyResults, setGiphyResults] = useState<GiphyResult[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/moments/${id}/comments`);
      const raw: CommentData[] = res.data.comments || res.data || [];
      setComments(raw);
    } catch (err) {
      logger.error('[CommentSheet] fetch comments', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && momentId) {
      setComments([]);
      setText('');
      setReplyTo(null);
      setShowStickers(false);
      setGiphySearch('');
      fetchComments(momentId);
    }
  }, [open, momentId, fetchComments]);

  useEffect(() => {
    if (!showStickers) return;
    let alive = true;
    const timer = setTimeout(async () => {
      setGiphyLoading(true);
      try {
        const endpoint = giphySearch.trim()
          ? `/giphy/search?q=${encodeURIComponent(giphySearch)}`
          : '/giphy/trending';
        const res = await api.get(endpoint);
        if (alive) setGiphyResults(res.data.data || []);
      } catch { /* best-effort */ }
      finally { if (alive) setGiphyLoading(false); }
    }, 400);
    return () => { alive = false; clearTimeout(timer); };
  }, [giphySearch, showStickers]);

  const handleLike = useCallback(async (commentId: string, e: React.MouseEvent) => {
    emitHeart(e.clientX, e.clientY);

    const toggle = (list: CommentData[]): CommentData[] =>
      list.map((c) => {
        if (c.comment_id === commentId) {
          return {
            ...c,
            is_liked: !c.is_liked,
            like_count: (c.like_count ?? 0) + (c.is_liked ? -1 : 1),
          };
        }
        if (c.replies?.length) return { ...c, replies: toggle(c.replies) };
        return c;
      });

    setComments((prev) => toggle(prev));
    try {
      await api.post(`/moments/comment/${commentId}/like`);
    } catch {
      setComments((prev) => toggle(prev));
    }
  }, []);

  const handleReplyTarget = useCallback((username: string, parentId: string) => {
    setReplyTo({ username, parentId });
    setText('');
    setFocusComposer(true);
    setTimeout(() => setFocusComposer(false), 300);
  }, []);

  const clearReply = useCallback(() => {
    setReplyTo(null);
    setText('');
  }, []);

  const handleSubmit = useCallback(async (content?: string) => {
    const body = content || text;
    if (!body.trim() || !momentId) return;
    if (!user) return;

    setSubmitting(true);
    try {
      const payload: Record<string, string> = { comment: body };
      if (replyTo?.parentId) payload.parentId = replyTo.parentId;

      const res = await api.post(`/moments/${momentId}/comments`, payload);
      const added: CommentData = res.data.comment || res.data;

      if (replyTo?.parentId) {
        setComments((prev) =>
          prev.map((c) =>
            c.comment_id === replyTo.parentId
              ? { ...c, replies: [...(c.replies ?? []), added] }
              : c
          )
        );
      } else {
        setComments((prev) => [added, ...prev]);
      }

      setText('');
      setReplyTo(null);
      setShowStickers(false);
      onCommentAdded?.();
    } catch (err) {
      logger.error('[CommentSheet] submit', err);
    } finally {
      setSubmitting(false);
    }
  }, [text, momentId, replyTo, user, onCommentAdded]);

  const sorted = sortComments(comments, sort);
  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.9 }}
            className="fixed bottom-0 left-0 lg:left-72 right-0 z-[1001] flex flex-col bg-white dark:bg-[#1c1c1e] rounded-t-[24px] shadow-[0_-8px_60px_rgba(0,0,0,0.25)] overflow-hidden"
            style={{ maxHeight: '72vh', minHeight: '40vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag pill */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-1 rounded-full bg-gray-200 dark:bg-zinc-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-gray-900 dark:text-white">Comments</span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-[11px] font-bold text-gray-500 dark:text-zinc-400">
                  {totalCount}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Sort picker */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu((p) => !p)}
                    className="flex items-center gap-1 text-[12px] font-semibold text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95"
                  >
                    {sort}
                    <ChevronDown size={12} />
                  </button>
                  <AnimatePresence>
                    {showSortMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden z-10 min-w-[110px]"
                      >
                        {SORT_OPTIONS.map((o) => (
                          <button
                            key={o}
                            onClick={() => { setSort(o); setShowSortMenu(false); }}
                            className={clsx(
                              'w-full text-left px-4 py-2.5 text-[13px] font-semibold transition-colors',
                              o === sort
                                ? 'text-[#fe2c55] bg-[#fe2c55]/5'
                                : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                            )}
                          >
                            {o}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all active:scale-90"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Comment list */}
            <div className="flex-1 overflow-y-auto px-4 pb-2" style={{ overscrollBehavior: 'contain' }}>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner size="medium" color="text-[#fe2c55]" />
                </div>
              ) : sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
                  <MessageCircle size={44} strokeWidth={1.25} className="text-gray-400 dark:text-zinc-600" />
                  <p className="text-[13px] font-semibold text-gray-500 dark:text-zinc-500 tracking-wide">
                    No comments yet. Be the first!
                  </p>
                </div>
              ) : (
                <div className="pb-4">
                  {sorted.map((c) => (
                    <CommentThread
                      key={c.comment_id}
                      comment={c}
                      onLike={handleLike}
                      onReplyTarget={handleReplyTarget}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Composer area */}
            <div className="shrink-0 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-[#1c1c1e]">
              {/* Giphy picker */}
              <AnimatePresence>
                {showStickers && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 280, opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden border-b border-gray-100 dark:border-zinc-800"
                  >
                    <div className="p-3 flex flex-col gap-2 h-[280px]">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="Search GIPHY…"
                            value={giphySearch}
                            onChange={(e) => setGiphySearch(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-zinc-800 rounded-xl py-2 pl-4 pr-9 text-[13px] outline-none focus:ring-2 focus:ring-[#fe2c55]/20 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                          />
                          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                        <button
                          onClick={() => setShowStickers(false)}
                          className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors active:scale-90"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                        {giphyLoading ? (
                          <div className="flex items-center justify-center h-full">
                            <Spinner size="medium" color="text-[#fe2c55]" />
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5">
                            {giphyResults.map((gif) => (
                              <button
                                key={gif.id}
                                onClick={() => handleSubmit(gif.images.fixed_height.url)}
                                className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 hover:scale-105 active:scale-95 transition-transform"
                              >
                                <img
                                  src={gif.images.fixed_height.url}
                                  className="w-full h-full object-cover"
                                  alt=""
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reply target banner */}
              <AnimatePresence>
                {replyTo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
                      <span className="text-[12px] text-gray-500 dark:text-zinc-400">
                        Replying to{' '}
                        <span className="font-bold text-[#fe2c55]">@{replyTo.username}</span>
                      </span>
                      <button
                        onClick={clearReply}
                        className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors active:scale-90"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick emoji row */}
              <div className="flex items-center justify-between px-5 pt-3 pb-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSubmit(emoji)}
                    className="text-[22px] hover:scale-125 active:scale-90 transition-transform leading-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Input row */}
              <div
                className="flex items-center gap-2.5 px-3 pt-2"
                style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
              >
                {/* User avatar */}
                {user?.avatar_url && (
                  <img
                    src={getMediaUrl(user.avatar_url) || '/uploads/avatars/no-profile.png'}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200 dark:border-zinc-700"
                  />
                )}

                {/* Input pill */}
                <div className="flex-1 flex items-center min-h-[44px] bg-gray-100 dark:bg-zinc-800 rounded-full px-3 gap-1.5 focus-within:ring-2 focus-within:ring-[#fe2c55]/25 transition-all border border-transparent focus-within:border-[#fe2c55]/30">
                  <div className="flex-1">
                    <MentionInput
                      value={text}
                      onChange={setText}
                      placeholder={replyTo ? `Reply to @${replyTo.username}…` : 'Add a comment…'}
                      onSubmit={() => handleSubmit()}
                      autoFocus={focusComposer}
                      className="w-full bg-transparent border-none outline-none text-[14px] font-medium py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                    />
                  </div>

                  <button
                    onClick={() => setText((p) => p + (p.endsWith(' ') || p === '' ? '@' : ' @'))}
                    className="text-[16px] font-bold text-gray-400 hover:text-[#fe2c55] transition-colors active:scale-90 w-7 h-7 flex items-center justify-center"
                  >
                    @
                  </button>

                  <button
                    onClick={() => setShowStickers((p) => !p)}
                    className={clsx(
                      'w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90',
                      showStickers ? 'bg-[#fe2c55] text-white' : 'text-gray-400 hover:text-[#fe2c55]'
                    )}
                  >
                    <Smile size={18} strokeWidth={2} />
                  </button>
                </div>

                {/* Send */}
                <button
                  onClick={() => handleSubmit()}
                  disabled={!text.trim() || submitting}
                  className={clsx(
                    'w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 shadow-lg',
                    text.trim()
                      ? 'bg-[#fe2c55] text-white shadow-[#fe2c55]/30'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-zinc-600'
                  )}
                >
                  {submitting ? (
                    <Spinner size="small" color="text-white" />
                  ) : (
                    <ArrowUp size={20} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MomentsCommentSheet;
