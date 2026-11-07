import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Heart,
  ChevronDown,
  Search,
  ArrowUp,
  Smile,
  MessageCircle,
  Copy,
  CornerUpLeft,
  Pencil,
  Trash2,
  Flag,
  Check,
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
import { showSuccess, showError, showInfo } from '../../../utils/toast';
import { confirmDialog, promptDialog } from '../../../store/dialogStore';
import { useLongPress } from '../../../hooks/useLongPress';
import { audioEventBus } from '../../../audio/EventBus';
import CommentActionMenu, { type CommentActionItem, type CommentActionKind } from './CommentActionMenu';
import CommentModerationDialog, { type ModerationReason } from './CommentModerationDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommentData {
  comment_id: string;
  user_id?: string;
  username: string;
  avatar_url?: string;
  content: string;
  created_at: string;
  updated_at?: string | null;
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
  /** Called after a deletion with how many rows the server removed. */
  onCommentRemoved?: (deletedCount: number) => void;
  isOwner?: boolean;
}

interface MenuTarget {
  comment: CommentData;
  isReply: boolean;
  rect: DOMRect;
}

interface EditingTarget {
  id: string;
  original: string;
  isReply?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Server-enforced edit window (mirrors the backend's 48h policy). */
const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

import { parseCommentDate, relativeTime } from '../utils/commentFormat';
export { parseCommentDate, relativeTime };

/** Backend sets updated_at only when a comment is edited (not on like or other actions). */
const isEdited = (c: CommentData): boolean => {
  if (!c.updated_at) return false;
  const created = parseCommentDate(c.created_at);
  const updated = parseCommentDate(c.updated_at);
  if (!updated) return false;
  if (!created) return true;
  // If updated_at is at least 2s after created_at, it was genuinely edited
  return Math.abs(updated.getTime() - created.getTime()) > 2000;
};

const withinEditWindow = (c: CommentData): boolean => {
  const date = parseCommentDate(c.created_at);
  if (!date) return true; // Fail open for author UI check (server strictly re-verifies)
  return Date.now() - date.getTime() <= EDIT_WINDOW_MS;
};

const apiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; message?: string } } };
  return e?.response?.data?.error || e?.response?.data?.message || fallback;
};

/** Immutably patches one comment (or reply) in the tree. */
const mapComment = (
  list: CommentData[],
  id: string,
  patch: Partial<CommentData>
): CommentData[] =>
  list.map((c) => {
    if (c.comment_id === id) return { ...c, ...patch };
    if (c.replies?.length) return { ...c, replies: mapComment(c.replies, id, patch) };
    return c;
  });

/** Immutably removes a comment; removing a root removes its whole thread. */
const removeCommentLocal = (list: CommentData[], id: string): CommentData[] =>
  list
    .filter((c) => c.comment_id !== id)
    .map((c) =>
      c.replies?.length
        ? { ...c, replies: c.replies.filter((r) => r.comment_id !== id) }
        : c
    );

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

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
  highlighted?: boolean;
  onLike: (id: string, e: React.MouseEvent) => void;
  onReplyTarget: (username: string, parentId: string) => void;
  onOpenMenu: (comment: CommentData, isReply: boolean, rect: DOMRect) => void;
}

const isInteractiveTarget = (e: { target: EventTarget | null }): boolean =>
  !!(e.target as HTMLElement | null)?.closest?.('button, a, input, textarea, select');

const CommentRow: React.FC<CommentRowProps> = ({
  comment,
  isReply = false,
  highlighted = false,
  onLike,
  onReplyTarget,
  onOpenMenu,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const isGif = comment.content.includes('giphy.com');

  const openMenu = useCallback(() => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;
    onOpenMenu(comment, isReply, rect);
  }, [comment, isReply, onOpenMenu]);

  // Long press (pointer-based, 10px move tolerance → scrolling never opens
  // the menu; the hook also swallows the click that follows a fired press).
  const longPress = useLongPress(openMenu, 500);

  return (
    <motion.div
      ref={rowRef}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        'flex gap-3 items-start rounded-xl -mx-2 px-2 py-1.5 transition-colors outline-none',
        isReply ? 'ml-9 mt-3' : 'mt-4',
        highlighted && 'bg-[#fe2c55]/[0.07] ring-1 ring-[#fe2c55]/25'
      )}
      tabIndex={0}
      aria-label={`Comment by @${comment.username}: ${comment.content}. Long press or press the context menu key for actions.`}
      onPointerDown={(e) => {
        if (isInteractiveTarget(e)) return;
        longPress.onPointerDown(e);
      }}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onClick={longPress.onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault();
          openMenu();
        }
      }}
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
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[13px] font-bold text-gray-900 dark:text-white leading-none">
            @{comment.username}
          </span>
          <span
            className="text-[11px] text-gray-400 dark:text-zinc-500 leading-none"
            title={parseCommentDate(comment.created_at)?.toLocaleString() || undefined}
          >
            {relativeTime(comment.created_at)}
          </span>
          {isEdited(comment) && (
            <span
              className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500 leading-none italic"
              aria-label="Edited"
            >
              Edited
            </span>
          )}
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

        <div className="flex items-center gap-5 mt-1">
          <button
            onClick={() => onReplyTarget(comment.username, comment.parent_comment_id || comment.comment_id)}
            className="text-[12px] font-semibold text-gray-400 dark:text-zinc-500 hover:text-[#fe2c55] transition-colors active:opacity-50 min-h-[44px] flex items-center pr-2"
          >
            Reply
          </button>
        </div>
      </div>

      {/* Like */}
      <button
        onClick={(e) => onLike(comment.comment_id, e)}
        aria-label={comment.is_liked ? 'Unlike comment' : 'Like comment'}
        className="flex flex-col items-center justify-center gap-0.5 pt-0.5 shrink-0 active:scale-125 transition-transform min-w-[44px] min-h-[44px]"
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
  highlightedId?: string | null;
  onLike: (id: string, e: React.MouseEvent) => void;
  onReplyTarget: (username: string, parentId: string) => void;
  onOpenMenu: (comment: CommentData, isReply: boolean, rect: DOMRect) => void;
}

const CommentThread: React.FC<CommentThreadProps> = ({
  comment,
  highlightedId,
  onLike,
  onReplyTarget,
  onOpenMenu,
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasReplies = (comment.replies?.length ?? 0) > 0;

  return (
    <div className="mb-1">
      <CommentRow
        comment={comment}
        highlighted={highlightedId === comment.comment_id}
        onLike={onLike}
        onReplyTarget={onReplyTarget}
        onOpenMenu={onOpenMenu}
      />

      {hasReplies && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="ml-12 mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[#fe2c55] active:opacity-60 transition-opacity min-h-[32px]"
          aria-expanded={expanded}
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
                highlighted={highlightedId === reply.comment_id}
                onLike={onLike}
                onReplyTarget={onReplyTarget}
                onOpenMenu={onOpenMenu}
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
  onCommentRemoved,
  isOwner: isOwnerProp,
}) => {
  const { user } = useUserStore();
  const currentUserId = String(user?.user_id || (user as any)?.id || '');

  const [comments, setComments] = useState<CommentData[]>([]);
  const [reelOwnerId, setReelOwnerId] = useState<string | null>(null);
  const isOwner = Boolean(isOwnerProp || (reelOwnerId && currentUserId && String(reelOwnerId) === String(currentUserId)));
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

  // Contextual action menu (long press)
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  // Edit mode
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Owner/platform moderation
  const [moderating, setModerating] = useState<CommentData | null>(null);
  const [modSubmitting, setModSubmitting] = useState(false);

  // Keyboard awareness for mobile viewports
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const lastWidthRef = { current: null as number | null };
    let baseHeight = vv.height ?? window.innerHeight;

    const handleResize = () => {
      const height = vv.height ?? window.innerHeight;
      const width = vv.width ?? window.innerWidth;
      if (lastWidthRef.current !== null && Math.abs(lastWidthRef.current - width) > 2) {
        baseHeight = height;
      }
      lastWidthRef.current = width;

      const shrink = baseHeight - height;
      if (shrink > 150) {
        setIsKeyboardOpen(true);
      } else {
        baseHeight = height;
        setIsKeyboardOpen(false);
      }
    };

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  const sheetRef = useRef<HTMLDivElement>(null);

  const isReelOwner = !!reelOwnerId && !!currentUserId && reelOwnerId === currentUserId;
  const isPlatformModerator = user?.role === 'admin' || user?.role === 'moderator';

  const fetchComments = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/moments/${id}/comments`);
      const raw: CommentData[] = res.data.comments || res.data || [];
      setComments(raw);
      setReelOwnerId(
        res.data.reel_owner_id != null ? String(res.data.reel_owner_id) : null
      );
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
      setMenuTarget(null);
      setEditing(null);
      setModerating(null);
      setReelOwnerId(null);
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
    if (editing) return;
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
      showError(apiError(err, 'Could not post your comment'));
    } finally {
      setSubmitting(false);
    }
  }, [text, momentId, replyTo, user, editing, onCommentAdded]);

  // ── Contextual menu ────────────────────────────────────────────────────────

  const openActionMenu = useCallback(
    (comment: CommentData, isReply: boolean, rect: DOMRect) => {
      // Haptic tick (respects the user's haptics preference via HapticManager).
      audioEventBus.emit('trigger_haptic', 'click');
      setMenuTarget({ comment, isReply, rect });
    },
    []
  );

  const menuActions = useMemo<CommentActionItem[]>(() => {
    if (!menuTarget) return [];
    const c = menuTarget.comment;
    const commentAuthorId = String(c.user_id || (c as any)?.userId || '');
    const isAuthor = !!currentUserId && !!commentAuthorId && commentAuthorId === currentUserId;
    const canModerate = !isAuthor && (isReelOwner || isPlatformModerator);

    const items: CommentActionItem[] = [
      { kind: 'copy', label: 'Copy', icon: <Copy size={17} /> },
      { kind: 'reply', label: 'Reply', icon: <CornerUpLeft size={17} /> },
    ];
    // Edit is strictly for the author (never the reel owner, never a mod).
    if (isAuthor && withinEditWindow(c)) {
      items.push({ kind: 'edit', label: 'Edit', icon: <Pencil size={17} /> });
    }
    if (isAuthor || canModerate) {
      items.push({
        kind: 'delete',
        label: c.parent_comment_id ? 'Delete reply' : 'Delete comment',
        icon: <Trash2 size={17} />,
        danger: true,
      });
    }
    // Reporting is only meaningful for someone else's content and never
    // deletes anything — it goes to platform moderation, not the creator.
    if (!isAuthor) {
      items.push({ kind: 'report', label: 'Report', icon: <Flag size={17} /> });
    }
    return items;
  }, [menuTarget, currentUserId, isReelOwner, isPlatformModerator]);

  // ── Edit ───────────────────────────────────────────────────────────────────

  const startEdit = useCallback((c: CommentData) => {
    setEditing({ id: c.comment_id, original: c.content, isReply: !!c.parent_comment_id });
    setReplyTo(null);
    setShowStickers(false);
    setText(c.content);
    setFocusComposer(true);
    setTimeout(() => setFocusComposer(false), 300);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setText('');
  }, []);

  const submitEdit = useCallback(async () => {
    if (!editing || editSaving) return;
    const trimmed = text.trim();
    if (!trimmed || trimmed === editing.original) return;

    const { id } = editing;
    const stamp = new Date().toISOString();

    // Optimistic update — flip immediately, roll back if the server rejects.
    const prev = comments;
    setComments((list) => mapComment(list, id, { content: trimmed, updated_at: stamp }));
    setEditSaving(true);
    try {
      const res = await api.put(`/moments/comment/${id}`, { content: trimmed });
      const updated: CommentData | undefined = res.data?.comment;
      if (updated) {
        setComments((list) =>
          mapComment(list, id, {
            content: updated.content,
            updated_at: updated.updated_at ?? stamp,
          })
        );
      }
      setEditing(null);
      setText('');
      showSuccess('Comment updated');
    } catch (err) {
      setComments(prev); // rollback
      logger.error('[CommentSheet] edit', err);
      showError(apiError(err, 'Could not update the comment'));
    } finally {
      setEditSaving(false);
    }
  }, [editing, editSaving, text, comments]);

  // ── Delete (own) ───────────────────────────────────────────────────────────

  const performDelete = useCallback(
    async (target: CommentData) => {
      const prev = comments;
      setComments((list) => removeCommentLocal(list, target.comment_id));
      try {
        const res = await api.delete(`/moments/comment/${target.comment_id}`);
        const removed = Number(res.data?.deletedCount) || 1;
        onCommentRemoved?.(removed);
        showSuccess(target.parent_comment_id ? 'Reply deleted' : 'Comment deleted');
      } catch (err) {
        setComments(prev); // rollback
        logger.error('[CommentSheet] delete', err);
        showError(apiError(err, 'Could not delete the comment'));
      }
    },
    [comments, onCommentRemoved]
  );

  const requestDelete = useCallback(
    async (target: CommentData) => {
      const isReply = !!target.parent_comment_id;
      const preview = target.content.length > 50 ? `${target.content.slice(0, 47)}…` : target.content;
      const ok = await confirmDialog(
        isReply
          ? `Delete reply "${preview}"? This reply will be permanently removed. This cannot be undone.`
          : `Delete comment "${preview}"? This comment and all replies under it will be permanently removed. This cannot be undone.`,
        {
          title: isReply ? 'Delete reply?' : 'Delete comment?',
          confirmLabel: 'Delete',
          danger: true,
        }
      );
      if (!ok) return;
      await performDelete(target);
    },
    [performDelete]
  );

  // ── Moderation (reel owner / platform moderator) ───────────────────────────

  const performModeration = useCallback(
    async (reason: ModerationReason, details?: string) => {
      if (!moderating || modSubmitting) return;
      const target = moderating;
      const prev = comments;

      setModSubmitting(true);
      setComments((list) => removeCommentLocal(list, target.comment_id));
      try {
        const res = await api.post(`/moments/comment/${target.comment_id}/moderate`, {
          reason,
          ...(details ? { reasonDetails: details } : {}),
        });
        const removed = Number(res.data?.deletedCount) || 1;
        onCommentRemoved?.(removed);
        setModerating(null);
        showSuccess('Comment removed');
      } catch (err) {
        setComments(prev); // rollback
        logger.error('[CommentSheet] moderate', err);
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 409) {
          setModerating(null);
          showInfo('This comment has already been moderated.');
        } else {
          showError(apiError(err, 'Could not remove the comment'));
        }
      } finally {
        setModSubmitting(false);
      }
    },
    [moderating, modSubmitting, comments, onCommentRemoved]
  );

  // ── Report (platform moderation — never deletes) ───────────────────────────

  const requestReport = useCallback(async (target: CommentData) => {
    const reason = await promptDialog('Why are you reporting this comment?', {
      confirmLabel: 'Report',
    });
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    try {
      await api.post(`/moments/comment/${target.comment_id}/report`, { reason: trimmed });
      showInfo('Report submitted. Thanks for keeping Sparkle safe.');
    } catch (err) {
      logger.error('[CommentSheet] report', err);
      showError(apiError(err, 'Could not submit the report'));
    }
  }, []);

  const handleMenuAction = useCallback(
    (kind: CommentActionKind) => {
      const target = menuTarget?.comment;
      if (!target) return;
      switch (kind) {
        case 'copy':
          void copyToClipboard(target.content).then((ok) =>
            ok ? showSuccess('Comment copied') : showError('Could not copy the comment')
          );
          break;
        case 'reply':
          handleReplyTarget(
            target.username,
            target.parent_comment_id || target.comment_id
          );
          break;
        case 'edit':
          startEdit(target);
          break;
        case 'delete': {
          const isAuthor = !!target.user_id && target.user_id === currentUserId;
          if (isAuthor) void requestDelete(target);
          else setModerating(target); // owner/mod path → reason dialog
          break;
        }
        case 'report':
          void requestReport(target);
          break;
      }
    },
    [menuTarget, currentUserId, handleReplyTarget, startEdit, requestDelete, requestReport]
  );

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
            className="fixed inset-0 z-(--z-scrim) bg-black/50 backdrop-blur-[2px]"
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
            className={clsx(
              "fixed z-(--z-sheet) flex flex-col bg-white dark:bg-[#1c1c1e] shadow-[0_-8px_60px_rgba(0,0,0,0.35)] overflow-hidden transition-all",
              isOwner
                ? "bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-[440px] rounded-[28px] border border-white/20 dark:border-white/10 max-h-[65vh] min-h-[35vh] backdrop-blur-xl bg-white/95 dark:bg-zinc-900/95"
                : "bottom-0 left-0 lg:left-72 right-0 rounded-t-[24px] max-h-[72vh] min-h-[40vh]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag pill */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-1 rounded-full bg-gray-200 dark:bg-zinc-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-gray-900 dark:text-white">
                  {isOwner ? 'Floating Comments' : 'Comments'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-[11px] font-bold text-gray-500 dark:text-zinc-400">
                  {totalCount}
                </span>
                {isOwner && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-tight">
                    Creator
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Sort picker */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu((p) => !p)}
                    aria-label={`Sort comments: ${sort}`}
                    aria-expanded={showSortMenu}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 min-h-[44px]"
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
                              'w-full text-left px-4 py-2.5 text-[13px] font-semibold transition-colors min-h-[44px] flex items-center',
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
                  aria-label="Close comments"
                  className="w-11 h-11 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Comment list */}
            <div
              className="flex-1 overflow-y-auto px-4 pb-2"
              style={{ overscrollBehavior: 'contain' }}
              onScroll={() => setMenuTarget(null)}
            >
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
                      highlightedId={menuTarget?.comment.comment_id ?? null}
                      onLike={handleLike}
                      onReplyTarget={handleReplyTarget}
                      onOpenMenu={openActionMenu}
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
                          aria-label="Close stickers"
                          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors active:scale-90"
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
                                aria-label="Send sticker"
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

              {/* Editing banner (takes precedence over the reply banner) */}
              <AnimatePresence>
                {editing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-2 bg-[#fe2c55]/[0.06] border-b border-[#fe2c55]/15">
                      <span className="text-[12px] font-semibold text-[#fe2c55]">
                        Editing {editing.isReply ? 'reply' : 'comment'}
                      </span>
                      <button
                        onClick={cancelEdit}
                        disabled={editSaving}
                        aria-label="Cancel edit"
                        className="text-gray-500 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors active:scale-90 disabled:opacity-40 min-h-[44px] px-2 flex items-center font-semibold text-[13px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reply target banner */}
              <AnimatePresence>
                {replyTo && !editing && (
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
                        aria-label="Cancel reply"
                        className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors active:scale-90"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick emoji row */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() =>
                      editing
                        ? setText((p) => p + emoji)
                        : void handleSubmit(emoji)
                    }
                    aria-label={`Insert ${emoji}`}
                    className="text-[22px] hover:scale-125 active:scale-90 transition-transform leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Input row */}
              <div
                className="flex items-center gap-2.5 px-3 pt-2"
                style={{
                  paddingBottom: isKeyboardOpen
                    ? '0.5rem'
                    : 'calc(0.75rem + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))',
                  paddingLeft:
                    'calc(0.75rem + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)))',
                  paddingRight:
                    'calc(0.75rem + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)))',
                }}
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
                      placeholder={
                        editing
                          ? (editing.isReply ? 'Edit your reply…' : 'Edit your comment…')
                          : replyTo
                            ? `Reply to @${replyTo.username}…`
                            : 'Add a comment…'
                      }
                      onSubmit={() => (editing ? void submitEdit() : void handleSubmit())}
                      autoFocus={focusComposer}
                      className="w-full bg-transparent border-none outline-none text-[14px] font-medium py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                    />
                  </div>

                  <button
                    onClick={() => setText((p) => p + (p.endsWith(' ') || p === '' ? '@' : ' @'))}
                    aria-label="Mention someone"
                    className="text-[16px] font-bold text-gray-400 hover:text-[#fe2c55] transition-colors active:scale-90 min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    @
                  </button>

                  <button
                    onClick={() => {
                      if (editing) return;
                      setShowStickers((p) => !p);
                    }}
                    disabled={!!editing}
                    aria-label="Stickers"
                    aria-pressed={showStickers}
                    className={clsx(
                      'min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full transition-all active:scale-90',
                      editing && 'opacity-35 cursor-not-allowed',
                      showStickers && !editing
                        ? 'bg-[#fe2c55] text-white'
                        : 'text-gray-400 hover:text-[#fe2c55]'
                    )}
                  >
                    <Smile size={18} strokeWidth={2} />
                  </button>
                </div>

                {/* Send / Save */}
                <button
                  onClick={() => (editing ? void submitEdit() : void handleSubmit())}
                  disabled={
                    editing
                      ? !text.trim() || editSaving || text === editing.original
                      : !text.trim() || submitting
                  }
                  aria-label={editing ? 'Save edit' : 'Send comment'}
                  className={clsx(
                    'w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 shadow-lg',
                    editing
                      ? text.trim() && text !== editing.original && !editSaving
                        ? 'bg-[#fe2c55] text-white shadow-[#fe2c55]/30'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-zinc-600'
                      : text.trim()
                        ? 'bg-[#fe2c55] text-white shadow-[#fe2c55]/30'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-zinc-600'
                  )}
                >
                  {editing ? (
                    editSaving ? (
                      <Spinner size="small" color="text-white" />
                    ) : (
                      <Check size={20} strokeWidth={2.5} />
                    )
                  ) : submitting ? (
                    <Spinner size="small" color="text-white" />
                  ) : (
                    <ArrowUp size={20} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Long-press contextual menu (above the sheet, below dialogs) */}
          <CommentActionMenu
            open={!!menuTarget}
            anchor={menuTarget?.rect ?? null}
            actions={menuActions}
            title={menuTarget ? `@${menuTarget.comment.username}` : undefined}
            onSelect={handleMenuAction}
            onClose={() => setMenuTarget(null)}
          />

          {/* Owner/platform moderation confirmation */}
          <CommentModerationDialog
            open={!!moderating}
            username={moderating?.username ?? ''}
            content={moderating?.content ?? ''}
            isReply={!!moderating?.parent_comment_id}
            submitting={modSubmitting}
            onCancel={() => { if (!modSubmitting) setModerating(null); }}
            onConfirm={(reason, details) => void performModeration(reason, details)}
          />
        </>
      )}
    </AnimatePresence>
  );
};

export default MomentsCommentSheet;
