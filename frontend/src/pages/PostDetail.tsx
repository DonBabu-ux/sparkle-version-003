import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import { getOptimizedMediaUrl } from '../utils/imageUtils';
import { Heart, MessageSquare, Send, ArrowLeft, Orbit, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

import type { Post } from '../types/post';
import PostHeader from '../components/PostHeader';
import Spinner from '../components/ui/Spinner';
import { logger } from '../utils/logger';
import { showError } from '../utils/toast';

interface Comment {
  comment_id: string;
  content: string;
  user_id: string;
  username: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
}

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sortMode, setSortMode] = useState('relevant');
  const [showSortModal, setShowSortModal] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await api.get(`/posts/${id}/comments?sort=${sortMode}`);
      if (res.data.status === 'success') {
        setComments(res.data.data);
      }
    } catch (err) {
      logger.error('Failed to fetch comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postRes = await api.get(`/posts/${id}`);
        if (postRes.data.status === 'success') {
          setPost(postRes.data.data);
        }
      } catch (err) {
        logger.error('Failed to fetch post details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
    fetchComments();
  }, [id, sortMode]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;
    
    setSubmitting(true);
    try {
      const response = await api.post(`/posts/${id}/comments`, { content: commentText.trim() });
      if (response.data.status === 'success') {
        const newComment = {
          comment_id: response.data.data.commentId,
          content: commentText.trim(),
          user_id: user?.id || user?.user_id,
          username: user?.username,
          name: user?.name,
          avatar_url: user?.avatar_url,
          created_at: new Date().toISOString()
        };
        setComments(prev => [newComment, ...prev]);
        setCommentText('');
      }
    } catch (err) {
      logger.error('Failed to add comment:', err);
      showError('Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 overflow-x-hidden font-sans">
        <div className="flex-1 flex flex-col items-center justify-center">
          <Spinner size="large" color="text-primary" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 overflow-x-hidden font-sans">
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <Orbit size={64} strokeWidth={1.5} className="text-slate-600 dark:text-zinc-400" />
            <h2 className="text-2xl font-bold text-[#18181b] dark:text-zinc-100 mt-6 mb-2">Post not found</h2>
            <p className="text-[13px] text-slate-600 dark:text-zinc-400 max-w-sm mx-auto mb-6">This post could not be found.</p>
            <button onClick={() => navigate(-1)} className="px-5 h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 overflow-x-hidden font-sans">

      <main className="flex-1 p-6 lg:p-12 relative z-10 max-w-4xl mx-auto w-full pb-40">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 dark:text-zinc-400 hover:text-primary transition-colors font-semibold text-sm mb-8 group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to feed
        </button>

        {/* Post Detail Card */}
        <div className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 shadow-sm p-6 md:p-8 mb-8 animate-fade-in">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <PostHeader
                  heading
                  username={post.username}
                  name={post.name}
                  avatar={<img src={post.avatar_url || '/uploads/avatars/no-profile.png'} className="w-16 h-16 rounded-2xl object-cover border border-[#e6d8e1] dark:border-zinc-700" alt="" />}
                  nameClassName="text-xl font-bold text-[#18181b] leading-tight"
                  meta={<p className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">@{post.username} • {new Date(post.created_at).toLocaleDateString()}</p>}
                />
              </div>
           </div>

           <p className="text-[#18181b] dark:text-zinc-100 text-lg leading-relaxed mb-8 whitespace-pre-wrap">{post.content}</p>

           {post.media?.length > 0 && (
             <div className="grid grid-cols-1 gap-4 mb-8 rounded-2xl overflow-hidden">
               {post.media.map((m: { url: string }, i: number) => (
                 <img key={i} src={getOptimizedMediaUrl(m.url, 'hd', 1200)} className="w-full min-h-[320px] max-h-[800px] bg-[#f6eef3] dark:bg-zinc-900 object-cover rounded-2xl border border-[#e6d8e1] dark:border-zinc-700" alt="" />
               ))}
             </div>
           )}

           <div className="flex items-center gap-8 pt-6 border-t border-[#ede3e9] dark:border-zinc-900">
              <div className="flex items-center gap-2.5">
                <Heart size={20} className="text-[#ff1493]" fill={post.spark_count && post.spark_count > 0 ? "currentColor" : "none"} strokeWidth={2.5} />
                <span className="text-sm font-semibold text-[#18181b] dark:text-zinc-300">{post.spark_count || 0} sparks</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MessageSquare size={20} className="text-slate-600 dark:text-zinc-400" strokeWidth={2.5} />
                <span className="text-sm font-semibold text-[#18181b] dark:text-zinc-300">{comments.length} comments</span>
              </div>
           </div>
         </div>

         {/* Comments Section */}
         <section className="space-y-8">
            <div className="flex items-center justify-between gap-3 px-1 mb-6">
               <div className="flex items-center gap-3">
                 <div className="w-1 h-6 bg-primary rounded-full" />
                 <h3 className="text-lg font-bold text-[#18181b] dark:text-zinc-100">Comments</h3>
               </div>

               <button
                 onClick={() => setShowSortModal(true)}
                 className="flex items-center gap-2 px-4 h-10 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-full shadow-sm hover:border-primary transition-colors group"
               >
                 <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 group-hover:text-primary">
                   {sortMode === 'relevant' ? 'Most relevant' :
                    sortMode === 'smart' ? 'Balanced mix' :
                    sortMode === 'followers' ? 'People you follow' :
                    sortMode === 'engaging' ? 'Most engaging' :
                    sortMode === 'newest' ? 'Newest' : 'All comments'}
                 </span>
                 <ChevronDown size={14} className="text-slate-600 dark:text-zinc-400 group-hover:text-primary transition-colors" />
               </button>
            </div>

            <form onSubmit={handleAddComment} className="relative group mb-8 px-1">
               <textarea
                 value={commentText}
                 onChange={(e) => setCommentText(e.target.value)}
                 placeholder="Write a comment..."
                 className="w-full bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl p-5 pr-32 text-sm font-medium shadow-sm focus:border-primary transition-colors placeholder:text-slate-600 dark:placeholder:text-zinc-400 resize-none h-28"
               />
               <button
                 type="submit"
                 disabled={!commentText.trim() || submitting}
                 className="absolute right-4 bottom-4 px-6 h-10 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors disabled:opacity-40 flex items-center gap-2"
               >
                 {submitting ? '...' : <><Send size={15} /> Send</>}
               </button>
            </form>

            <div className="grid gap-4 px-1 relative">
               {loadingComments && (
                 <div className="absolute inset-0 z-10 bg-[#f8e7ed]/60 dark:bg-zinc-900/60 flex items-center justify-center rounded-3xl">
                   <Spinner size="medium" color="text-primary" />
                 </div>
               )}
               {comments.length === 0 ? (
                 <div className="py-12 text-center bg-[#f6eef3] dark:bg-zinc-900 border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 rounded-3xl">
                    <p className="text-[13px] text-slate-600 dark:text-zinc-400">No comments yet.</p>
                 </div>
               ) : (
                 comments.map(comment => (
                   <div key={comment.comment_id} className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 p-5 md:p-6 rounded-2xl flex gap-4 shadow-sm group">
                      <img src={comment.avatar_url || '/uploads/avatars/no-profile.png'} className="w-12 h-12 rounded-full object-cover border border-[#e6d8e1] dark:border-zinc-700" alt="" />
                      <div className="flex-1 min-w-0 pt-1">
                         <div className="flex justify-between items-start mb-1">
                           <span className="text-sm font-bold text-[#18181b] dark:text-zinc-100">{comment.name || comment.username}</span>
                           <span className="text-xs text-slate-600 dark:text-zinc-400">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                         </div>
                         <p className="text-[13px] text-[#18181b] dark:text-zinc-300 leading-relaxed">{comment.content}</p>
                      </div>
                   </div>
                 ))
               )}
            </div>
        </section>
      </main>

      {/* Comment Sort Bottom Sheet */}
      <AnimatePresence>
        {showSortModal && (
          <>
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowSortModal(false)}
               className="fixed inset-0 bg-black/40 z-(--z-chrome)"
             />
             <motion.div
               initial={{ y: "100%" }}
               animate={{ y: 0 }}
               exit={{ y: "100%" }}
               transition={{ type: "spring", damping: 25, stiffness: 200 }}
               className="fixed bottom-0 left-0 lg:left-72 right-0 bg-[#fdf8fa] dark:bg-zinc-800 rounded-t-3xl z-[1001] shadow-2xl p-8 pb-12 md:p-12"
             >
                <div className="w-12 h-1.5 bg-[#f0e5ec] dark:bg-zinc-700 rounded-full mx-auto mb-8" />

                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-[#18181b] dark:text-zinc-100">Sort comments</h3>
                  <button onClick={() => setShowSortModal(false)} className="text-sm font-bold text-primary">Done</button>
                </div>

                <div className="space-y-2">
                  {[
                    { id: 'relevant', label: 'Most relevant', desc: 'The comments other people found most useful' },
                    { id: 'smart', label: 'Balanced mix', desc: 'A mix of newer and more popular comments' },
                    { id: 'followers', label: 'People you follow', desc: 'See comments from people you follow first' },
                    { id: 'engaging', label: 'Most engaging', desc: 'The comments getting the most replies and likes' },
                    { id: 'newest', label: 'Newest', desc: 'The most recent comments first' },
                    { id: 'all', label: 'All comments', desc: 'Every comment, no filtering' }
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => { setSortMode(mode.id); setShowSortModal(false); }}
                      className={clsx(
                        "w-full flex items-start gap-4 p-4 rounded-2xl transition-colors text-left",
                        sortMode === mode.id ? "bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700" : "border border-transparent hover:bg-[#f6eef3] dark:hover:bg-zinc-900"
                      )}
                    >
                      <div className={clsx(
                        "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                        sortMode === mode.id ? "border-primary bg-primary" : "border-[#e6d8e1] dark:border-zinc-600"
                      )}>
                        {sortMode === mode.id && <Check size={12} className="text-white" />}
                      </div>
                      <div className="text-left">
                        <p className={clsx("text-sm font-bold transition-colors", sortMode === mode.id ? "text-primary" : "text-[#18181b] dark:text-zinc-100")}>
                          {mode.label}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">{mode.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}



