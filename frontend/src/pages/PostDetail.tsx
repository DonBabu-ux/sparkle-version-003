import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useUserStore();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
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
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
           <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
           <div className="text-6xl">🔭</div>
           <h2 className="text-xl font-black text-slate-800">Signal Lost</h2>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">The requested post was not found in this quadrant.</p>
           <Link to="/dashboard" className="text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline pt-4">Return to Fleet</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4">
        {/* Post Card - Detailed */}
        <div className="premium-card bg-white border-white shadow-2xl shadow-slate-200 mb-10 overflow-hidden">
           <div className="p-8">
             <div className="flex items-center gap-4 mb-8">
               <Link to={`/profile/${post.username}`}>
                 <img src={post.avatar_url || '/uploads/avatars/default.png'} className="w-14 h-14 rounded-2xl object-cover shadow-lg" alt="" />
               </Link>
               <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">{post.name}</h3>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">@{post.username} • {new Date(post.created_at).toLocaleDateString()}</p>
               </div>
             </div>

             <p className="text-slate-700 text-lg font-medium leading-relaxed mb-8 whitespace-pre-wrap">{post.content}</p>

             {post.media?.length > 0 && (
               <div className="grid grid-cols-1 gap-4 mb-8 rounded-3xl overflow-hidden shadow-2xl">
                 {post.media.map((m: any, i: number) => (
                   <img key={i} src={m.url} className="w-full object-cover max-h-[600px]" alt="" />
                 ))}
               </div>
             )}

             <div className="flex items-center gap-10 pt-8 border-t border-slate-50">
                <div className="flex items-center gap-2 group cursor-pointer">
                  <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center text-lg group-hover:bg-rose-500 group-hover:text-white transition-all shadow-sm">✨</div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{post.spark_count || 0} Sparks</span>
                </div>
                <div className="flex items-center gap-2 group">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center text-lg shadow-sm">💬</div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{comments.length} Signals</span>
                </div>
             </div>
           </div>
        </div>

        {/* Comment Section */}
        <section className="space-y-8">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Sub-Frequency Signals</h3>
           
           <form onSubmit={handleAddComment} className="relative group">
              <textarea 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Transmit your signature..." 
                className="w-full bg-white border border-slate-100 rounded-3xl p-6 pr-28 text-sm font-medium shadow-xl shadow-slate-100 focus:ring-4 focus:ring-indigo-50 outline-none transition-all placeholder:text-slate-300 resize-none h-24"
              />
              <button 
                type="submit"
                disabled={!commentText.trim() || submitting}
                className="absolute right-4 bottom-4 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-30"
              >
                {submitting ? '...' : 'Signal'}
              </button>
           </form>

           <div className="space-y-4">
              {comments.map(comment => (
                <div key={comment.comment_id} className="premium-card bg-white/70 border-white p-6 flex gap-4 group">
                   <img src={comment.avatar_url || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-xl object-cover shadow-sm bg-slate-100" alt="" />
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-black text-slate-800 tracking-tight">{comment.name || comment.username}</span>
                        <span className="text-[9px] font-black text-slate-300 uppercase">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">{comment.content}</p>
                   </div>
                </div>
              ))}
           </div>
        </section>
      </main>
    </div>
  );
}
