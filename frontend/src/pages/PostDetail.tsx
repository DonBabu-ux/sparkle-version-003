import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { Heart, MessageSquare, Send, ArrowLeft, Orbit } from 'lucide-react';

import type { Post } from '../types/post';

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

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const [postRes, commentsRes] = await Promise.all([
          api.get(`/posts/${id}`),
          api.get(`/posts/${id}/comments`)
        ]);
        if (postRes.data.status === 'success') {
          setPost(postRes.data.data);
        }
        if (commentsRes.data.status === 'success') {
          setComments(commentsRes.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch post details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

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
      console.error('Failed to add comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center lg:ml-72">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 text-center p-12">
            <Orbit size={120} strokeWidth={1} className="text-black/5" />
            <h2 className="text-4xl font-black text-black mt-8 mb-4 tracking-tight italic">Signal Lost.</h2>
            <p className="text-black font-medium max-w-sm mx-auto mb-8">This signal was not found in the village network.</p>
            <button onClick={() => navigate(-1)} className="px-10 py-4 bg-primary text-white rounded-2xl font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />
      
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-red-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-4xl mx-auto w-full pb-40">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-black/40 hover:text-primary transition-all font-bold text-sm mb-12 group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Pulse
        </button>

        {/* Post Detail Card */}
        <div className="bg-white/80 backdrop-blur-3xl rounded-[48px] border border-white/65 shadow-xl shadow-primary/5 p-8 md:p-12 mb-12 animate-fade-in">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Link to={`/profile/${post.username}`}>
                  <img src={post.avatar_url || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-[24px] object-cover border border-white/65 shadow-sm" alt="" />
                </Link>
                <div>
                   <h3 className="text-xl font-bold text-black leading-tight">{post.name}</h3>
                   <p className="text-[11px] font-bold text-primary uppercase tracking-widest">@{post.username} • {new Date(post.created_at).toLocaleDateString()}</p>
                </div>
              </div>
           </div>

           <p className="text-black text-xl font-medium leading-relaxed mb-10 whitespace-pre-wrap">{post.content}</p>

           {post.media?.length > 0 && (
             <div className="grid grid-cols-1 gap-6 mb-10 rounded-[32px] overflow-hidden">
               {post.media.map((m: { url: string }, i: number) => (
                 <img key={i} src={m.url} className="w-full object-cover max-h-[800px] rounded-[32px] border border-white shadow-xl shadow-primary/5" alt="" />
               ))}
             </div>
           )}

           <div className="flex items-center gap-8 pt-8 border-t border-black/5">
              <div className="flex items-center gap-3">
                <Heart size={24} className="text-primary" fill={post.spark_count && post.spark_count > 0 ? "currentColor" : "none"} strokeWidth={3} />
                <span className="text-sm font-bold text-black">{post.spark_count || 0} Sparks</span>
              </div>
              <div className="flex items-center gap-3">
                <MessageSquare size={24} className="text-black/20" strokeWidth={3} />
                <span className="text-sm font-bold text-black">{comments.length} Signals</span>
              </div>
           </div>
        </div>

        {/* Comments Section */}
        <section className="space-y-10">
           <div className="flex items-center gap-3 px-1 mb-8">
              <div className="w-1 h-8 bg-primary rounded-full" />
              <h3 className="text-2xl font-black text-black italic">Channel Signals</h3>
           </div>
           
           <form onSubmit={handleAddComment} className="relative group mb-16 px-1">
              <textarea 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Transmit your thoughts..." 
                className="w-full bg-white/60 backdrop-blur-xl border border-white rounded-[32px] p-6 pr-32 text-md font-bold shadow-xl shadow-primary/5 focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-black/20 resize-none h-28"
              />
              <button 
                type="submit"
                disabled={!commentText.trim() || submitting}
                className="absolute right-6 bottom-6 px-8 py-3 bg-primary text-white rounded-2xl text-[12px] font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-30 disabled:scale-100 flex items-center gap-2"
              >
                {submitting ? '...' : <><Send size={16} /> Signal</>}
              </button>
           </form>

           <div className="grid gap-6 px-1">
              {comments.length === 0 ? (
                <div className="py-20 text-center bg-white/40 border border-white rounded-[40px] shadow-inner">
                   <p className="text-black font-medium text-black/20 uppercase tracking-widest">No signals transmitted yet.</p>
                </div>
              ) : (
                comments.map(comment => (
                  <div key={comment.comment_id} className="bg-white/60 backdrop-blur-xl border border-white p-6 md:p-8 rounded-[32px] flex gap-6 shadow-sm hover:bg-white/80 transition-all group">
                     <img src={comment.avatar_url || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-2xl object-cover border border-white/65 shadow-sm" alt="" />
                     <div className="flex-1 min-w-0 pt-1">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-black text-black">{comment.name || comment.username}</span>
                          <span className="text-[10px] font-bold text-black/20 uppercase">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-base text-black font-medium leading-relaxed">{comment.content}</p>
                     </div>
                  </div>
                ))
              )}
           </div>
        </section>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
