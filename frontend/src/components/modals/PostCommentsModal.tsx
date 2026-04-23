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
    <div className="flex flex-col h-full bg-white overflow-hidden relative border border-black/5 rounded-[32px]">
      <div className="flex items-center justify-between p-6 border-b border-black/5 bg-black/[0.02]">
        <h3 className="font-heading font-black text-xl text-black tracking-tighter uppercase italic">Signals</h3>
        <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-all active:scale-90">
          <X size={20} className="text-black/20 hover:text-black transition-colors" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white custom-scrollbar">
        {/* Original Post Context */}
        <div className="flex gap-4 pb-6 border-b border-black/5">
          <div className="p-0.5 rounded-full bg-black shadow-sm shrink-0 h-fit">
            <img src={post.avatar_url || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-full object-cover border-2 border-white" alt="" />
          </div>
          <div className="min-w-0">
            <div className="font-heading font-black text-black text-[15px] tracking-tight uppercase italic">
              {post.name || post.username}
            </div>
            <div className="text-black text-[15px] mt-1 whitespace-pre-wrap font-bold leading-relaxed">{post.content}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-black/10" size={32} />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-16 text-black/20 font-black text-[10px] uppercase tracking-[0.3em]">the signal is silent.</div>
        ) : (
          <div className="space-y-8">
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

      <div className="bg-white border-t border-black/5 z-50 p-4">
        {replyingTo && (
          <div className="flex items-center justify-between bg-black/5 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 rounded-2xl mb-3">
            <span>Replying to <span className="text-black">@{replyingTo.username}</span></span>
            <button onClick={() => setReplyingTo(null)} className="hover:text-black transition-colors"><X size={14} /></button>
          </div>
        )}
        <div className="px-4 py-3 bg-black/[0.02] rounded-3xl border border-black/5 focus-within:bg-black/[0.05] transition-all">
          <form onSubmit={handleSubmit} className="flex items-center gap-4 w-full">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-black/5 shrink-0 shadow-sm">
                <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-full h-full object-cover" alt="" />
            </div>
            <div className="flex-1 relative min-w-0">
               <MentionInput
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={handleSubmit}
                  placeholder={replyingTo ? `Replying to ${replyingTo.username}...` : "Signal your thoughts..."}
                  className="bg-transparent text-[13px] font-bold text-black placeholder:text-black/20 outline-none w-full"
               />
            </div>
            <button 
              type="submit" 
              disabled={!commentText.trim() || submitting}
              className="px-6 py-2 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-full hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all whitespace-nowrap shrink-0 shadow-lg shadow-primary/20"
            >
              {submitting ? '...' : 'SEND'}
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
    <div className="flex gap-4 w-full pb-1">
      <div className="p-0.5 rounded-full bg-black shadow-sm shrink-0 h-fit mt-0.5 cursor-pointer hover:scale-110 transition-transform" onClick={handleProfileClick}>
         <img 
            src={comment.avatar_url || '/uploads/avatars/default.png'} 
            className="w-8 h-8 rounded-full object-cover border-2 border-white" 
            alt="" 
         />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex items-center gap-3">
          <span onClick={handleProfileClick} className="font-heading font-black text-[13px] text-black cursor-pointer hover:opacity-70 transition-opacity uppercase italic tracking-tight">
            {comment.username}
          </span>
          <span className="font-black text-[10px] text-black/20 uppercase tracking-widest">
            {timeAgo(comment.created_at)}
          </span>
        </div>

        <div className="text-[14px] text-black break-words whitespace-pre-wrap leading-relaxed mt-1 font-bold">
          {translated ? "Translation signal lost." : comment.content}
        </div>

        <div className="flex items-center gap-5 mt-2.5 text-[10px] font-black text-black/30 uppercase tracking-[0.2em] relative">
          <button 
            onClick={() => onLike(comment.comment_id)} 
            className={`flex items-center gap-2 hover:text-black transition-all active:scale-95 ${comment.is_liked ? 'text-black' : 'text-black/30'}`}
          >
            <Heart size={14} fill={comment.is_liked ? "currentColor" : "none"} strokeWidth={3} className={comment.is_liked ? 'animate-pulse' : ''} />
            {comment.like_count > 0 && <span>{formatCount(comment.like_count)}</span>}
          </button>
          <button onClick={() => onReply(comment)} className="hover:text-black transition-colors">Reply</button>
          <button onClick={() => setTranslated(!translated)} className="hover:text-black transition-colors">
            {translated ? 'original' : 'translate'}
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="hover:text-black transition-all active:scale-125 font-bold tracking-widest">•••</button>
            {showMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-36 bg-white rounded-2xl shadow-xl border border-black/5 py-2 z-50 animate-scale-in">
                <button onClick={() => setShowMenu(false)} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 hover:bg-black/5 hover:text-black transition-all">Report</button>
                <button onClick={() => setShowMenu(false)} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-black/40 hover:bg-black/5 hover:text-black transition-all">Copy</button>
              </div>
            )}
          </div>
        </div>

        {hasReplies && (
          <div className="mt-2">
            {!showReplies ? (
              <button onClick={() => setShowReplies(true)} className="flex items-center gap-4 text-[10px] font-black text-black/20 hover:text-black transition-all mt-3 group uppercase tracking-widest">
                <div className="w-8 h-[2px] bg-black/5 group-hover:bg-black transition-colors"></div> signals ({comment.replies.length})
              </button>
            ) : (
              <div className="space-y-6 mt-6 mb-2 ml-4 border-l-2 border-black/5 pl-6 animate-fade-in">
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
