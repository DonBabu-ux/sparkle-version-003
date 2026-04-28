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
    comment_count?: number;
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
      const payload: { content: string; parent_comment_id?: string } = {
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
    <div className="flex flex-col h-[90vh] md:h-[600px] bg-white overflow-hidden relative border border-gray-200 rounded-t-xl md:rounded-xl shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
        <div>
          <h3 className="font-bold text-[17px] text-gray-900">Comments</h3>
          {!loading && post.comment_count && post.comment_count > comments.length && (
            <p className="text-[12px] text-gray-400 font-normal mt-0.5">
              Showing {comments.length} of {formatCount(post.comment_count)}
            </p>
          )}
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all">
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white custom-scrollbar">
        {/* Original Post Context */}
        <div className="flex gap-3 pb-4 border-b border-gray-100">
          <img src={post.avatar_url || '/uploads/avatars/default.png'} className="w-9 h-9 rounded-full object-cover border border-gray-100 shrink-0" alt="" />
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-[15px]">
              {post.name || post.username}
            </div>
            <div className="text-gray-800 text-[15px] mt-0.5 whitespace-pre-wrap leading-relaxed">{post.content}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-black/10" size={32} />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 font-semibold text-[13px]">No comments yet.</div>
        ) : (
          <div className="space-y-6">
            {comments.map((comment) => (
              <CommentItem 
                key={comment.comment_id} 
                comment={comment} 
                onReply={(c) => setReplyingTo(c)} 
                onLike={(id) => handleLike(id)} 
                onCloseModal={onClose}
              />
            ))}
            {/* Show "top comments" note when display count > physical rows */}
            {post.comment_count && post.comment_count > comments.length && (
              <div className="text-center py-3 text-[12px] text-gray-400 border-t border-gray-100">
                Showing top comments · {formatCount(post.comment_count)} total
              </div>
            )}
            <div ref={commentsEndRef} />
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-100 p-3 pb-safe">
        {replyingTo && (
          <div className="flex items-center justify-between bg-gray-50 px-4 py-2 text-[12px] font-semibold text-gray-500 rounded-lg mb-2">
            <span>Replying to <span className="text-blue-600">@{replyingTo.username}</span></span>
            <button onClick={() => setReplyingTo(null)} className="hover:text-gray-700 transition-colors"><X size={14} /></button>
          </div>
        )}
        <div className="px-3 py-2 bg-gray-100 rounded-2xl">
          <form onSubmit={handleSubmit} className="flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 shrink-0">
                <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-full h-full object-cover" alt="" />
            </div>
            <div className="flex-1 relative min-w-0">
               <MentionInput
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={handleSubmit}
                  placeholder={replyingTo ? `Replying to ${replyingTo.username}...` : "Write a comment..."}
                  className="bg-transparent text-[14px] text-gray-900 placeholder:text-gray-400 outline-none w-full py-1"
               />
            </div>
            <button 
              type="submit" 
              disabled={!commentText.trim() || submitting}
              className="text-blue-600 font-bold text-[14px] disabled:opacity-30 px-2"
            >
              {submitting ? '...' : 'Post'}
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
  const [isExpanded, setIsExpanded] = useState(false);
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

  return (
    <div className="flex gap-2 w-full pb-1">
      <img 
        src={comment.avatar_url || '/uploads/avatars/default.png'} 
        className="w-8 h-8 rounded-full object-cover border border-gray-100 shrink-0 mt-1 cursor-pointer" 
        onClick={handleProfileClick}
        alt="" 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-gray-100 rounded-2xl px-3 py-2 w-fit max-w-[95%]">
          <p onClick={handleProfileClick} className="font-bold text-[13px] text-gray-900 cursor-pointer hover:underline">
            {comment.username}
          </p>
          <div className="text-[14px] text-gray-800 break-words whitespace-pre-wrap leading-tight mt-0.5">
            {translated ? (
               "Translation lost."
            ) : (
              <>
                {comment.content.length > 200 && !isExpanded ? (
                  <>
                    {comment.content.substring(0, 200)}... 
                    <button 
                      onClick={() => setIsExpanded(true)}
                      className="text-gray-500 font-bold hover:underline ml-1"
                    >
                      See more
                    </button>
                  </>
                ) : (
                  <>
                    {comment.content}
                    {comment.content.length > 200 && isExpanded && (
                      <button 
                        onClick={() => setIsExpanded(false)}
                        className="text-gray-500 font-bold hover:underline ml-1"
                      >
                        See less
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-1 px-2 text-[12px] font-bold text-gray-500">
          <span className="text-[11px] font-normal text-gray-400">
            {timeAgo(comment.created_at)}
          </span>
          <button 
            onClick={() => onLike(comment.comment_id)} 
            className={`hover:underline transition-all ${comment.is_liked ? 'text-blue-600' : ''}`}
          >
            Like{comment.like_count > 0 && ` (${formatCount(comment.like_count)})`}
          </button>
          <button onClick={() => onReply(comment)} className="hover:underline">Reply</button>
          <button onClick={() => setTranslated(!translated)} className="hover:underline text-[11px] font-normal">
            {translated ? 'Original' : 'Translate'}
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="hover:text-gray-900 font-bold tracking-widest px-1">•••</button>
            {showMenu && (
              <div className="absolute top-full left-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 animate-scale-in">
                <button onClick={() => setShowMenu(false)} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">Report</button>
                <button onClick={() => setShowMenu(false)} className="w-full text-left px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">Copy</button>
              </div>
            )}
          </div>
        </div>

        {hasReplies && (
          <div className="mt-1">
            {!showReplies ? (
              <button onClick={() => setShowReplies(true)} className="flex items-center gap-2 text-[12px] font-bold text-gray-500 hover:underline mt-1">
                View {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            ) : (
              <div className="space-y-4 mt-3 ml-2 border-l-2 border-gray-100 pl-4 animate-fade-in">
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
