import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Heart, Loader2 } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import api from '../../api/api';
import MentionInput from '../MentionInput';
import { formatCount } from '../../utils/format';

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
  };
  onClose: () => void;
}

export default function PostCommentsModal({ post, onClose }: PostCommentsModalProps) {
  const { user } = useUserStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/posts/${post.post_id}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      setLoading(false);
    }
  }, [post.post_id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleLike = async (commentId: string) => {
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const payload: any = {
        content: commentText.trim()
      };
      if (replyingTo?.comment_id) {
        payload.parent_comment_id = replyingTo.comment_id;
      }

      const res = await api.post(`/posts/${post.post_id}/comments`, payload);
      
      const newComment = {
        comment_id: res.data.comment_id,
        content: commentText.trim(),
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
        setComments([...comments, newComment]);
        setTimeout(() => {
          commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }

      setCommentText('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Failed to post comment', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden relative">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <h3 className="font-bold text-lg text-slate-800">Comments</h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X size={20} className="text-slate-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white">
        {/* Original Post Context */}
        <div className="flex gap-3 pb-4 border-b border-slate-200">
          <img src={post.avatar_url || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-full object-cover shadow-sm" alt="" />
          <div>
            <div className="font-bold text-slate-800 text-sm">
              {post.name || post.username}
            </div>
            <div className="text-slate-600 text-sm mt-1 whitespace-pre-wrap">{post.content}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-slate-300" size={32} />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-slate-400 font-medium">No comments yet. Be the first to start the conversation!</div>
        ) : (
          <div className="space-y-5">
            {comments.map((comment) => (
              <CommentItem 
                key={comment.comment_id} 
                comment={comment} 
                onReply={(c) => setReplyingTo(c)} 
                onLike={(id) => handleLike(id)} 
                onCloseModal={onClose}
              />
            ))}
            <div ref={commentsEndRef} />
          </div>
        )}
      </div>

      <div className="bg-white border-t border-slate-200 z-50">
        {replyingTo && (
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
            <span>Replying to <span className="font-bold text-slate-800">@{replyingTo.username}</span></span>
            <button onClick={() => setReplyingTo(null)} className="hover:text-slate-800"><X size={14} /></button>
          </div>
        )}
        <div className="px-4 py-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-3 w-full">
            <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
            <div className="flex-1 relative min-w-0">
               <MentionInput
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={handleSubmit}
                  placeholder={replyingTo ? `Replying to ${replyingTo.username}...` : "Add a comment..."}
               />
            </div>
            <button 
              type="submit" 
              disabled={!commentText.trim() || submitting}
              className="text-blue-500 font-bold text-sm disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0"
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function CommentItem({ comment, onReply, onLike, onCloseModal }: { comment: Comment, onReply: (c: Comment) => void, onLike: (id: string) => void, onCloseModal: () => void }) {
  const [showReplies, setShowReplies] = useState(false);
  const [translated, setTranslated] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const hasReplies = comment.replies && comment.replies.length > 0;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins > 0) return `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;
    return 'just now';
  };

  const handleProfileClick = () => {
    onCloseModal();
    window.location.href = `/profile/${comment.username}`;
  };

  return (
    <div className="flex gap-3 w-full pb-1">
      <img 
        src={comment.avatar_url || '/uploads/avatars/default.png'} 
        onClick={handleProfileClick}
        className="w-8 h-8 rounded-full object-cover mt-0.5 cursor-pointer hover:opacity-80 transition-opacity" 
        alt="" 
      />
      
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex items-center gap-2">
          <span onClick={handleProfileClick} className="font-bold text-[13px] text-slate-900 cursor-pointer hover:underline">
            {comment.username}
          </span>
          <span className="font-normal text-[11px] text-slate-400">
            {timeAgo(comment.created_at)}
          </span>
        </div>

        <div className="text-[14px] text-slate-800 break-words whitespace-pre-wrap leading-snug mt-0.5">
          {translated ? "Translation is not available for this language yet." : comment.content}
        </div>

        <div className="flex items-center gap-4 mt-1.5 text-[11px] font-semibold text-slate-500 relative">
          <button 
            onClick={() => onLike(comment.comment_id)} 
            className={`flex items-center gap-1.5 hover:text-rose-500 transition-colors ${comment.is_liked ? 'text-rose-500' : 'text-slate-500'}`}
          >
            <Heart size={13} fill={comment.is_liked ? "currentColor" : "none"} strokeWidth={comment.is_liked ? 0 : 2} />
            {comment.like_count > 0 && <span>{formatCount(comment.like_count)} {comment.like_count === 1 ? 'like' : 'likes'}</span>}
          </button>
          <button onClick={() => onReply(comment)} className="hover:text-slate-800 transition-colors">Reply</button>
          <button onClick={() => setTranslated(!translated)} className="hover:text-slate-800 transition-colors">
            {translated ? 'See Original' : 'See Translation'}
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="hover:text-slate-800 transition-colors">•••</button>
            {showMenu && (
              <div className="absolute top-full left-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50">
                <button onClick={() => setShowMenu(false)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">Report</button>
                <button onClick={() => setShowMenu(false)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">Copy Text</button>
              </div>
            )}
          </div>
        </div>

        {hasReplies && (
          <div className="mt-1">
            {!showReplies ? (
              <button onClick={() => setShowReplies(true)} className="flex items-center gap-3 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors mt-2">
                <div className="w-6 h-[1px] bg-slate-400"></div> View replies ({comment.replies.length})
              </button>
            ) : (
              <div className="space-y-4 mt-4 mb-2 ml-2 border-l-2 border-slate-200 pl-4">
                {comment.replies.map((reply) => (
                  <CommentItem 
                    key={reply.comment_id} 
                    comment={reply} 
                    onReply={onReply} 
                    onLike={onLike} 
                    onCloseModal={onCloseModal}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
