import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hash, ArrowLeft, Orbit } from 'lucide-react';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import api from '../api/api';
import type { Post } from '../types/post';

export default function Hashtag() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const handleFollow = async () => {
    try {
      await api.post(`/search/hashtags/${tag}/follow`);
      setIsFollowing(!isFollowing);
    } catch (err) {
      console.error('Failed to follow hashtag:', err);
    }
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/search?type=posts&q=${encodeURIComponent(tag || '')}`);
      setPosts(res.data.posts || res.data || []);
    } catch (err) {
      console.error('Hashtag fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    if (tag) fetchPosts();
  }, [tag, fetchPosts]);

  return (
    <div className="flex bg-white dark:bg-[#101217] min-h-screen text-black dark:text-white overflow-x-hidden font-sans transition-colors duration-300">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-primary/10 dark:bg-primary/5 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-primary/10 dark:bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-4xl mx-auto w-full pt-20 md:pt-32">
        
        <button 
          onClick={() => navigate(-1)}
          className="mb-8 w-12 h-12 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl shadow-sm flex items-center justify-center text-black dark:text-white hover:border-primary/30 hover:text-primary transition-all active:scale-95 group"
        >
          <ArrowLeft size={20} strokeWidth={2.5} className="group-hover:-translate-x-1 transition-transform" />
        </button>

        <header className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12 animate-fade-in p-6 md:p-10 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-3xl shadow-xl">
            <div className="flex flex-col md:flex-row items-center gap-6">
               <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                  <Hash size={28} strokeWidth={3} />
               </div>
               <div className="text-center md:text-left min-w-0">
                  <h1 className="text-4xl md:text-5xl font-black text-black dark:text-white tracking-tight leading-none italic uppercase">#{tag}</h1>
                  <p className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mt-2">{posts.length} Posts In Feed</p>
               </div>
            </div>
            
            <button 
              onClick={handleFollow}
              className={`w-full md:w-auto px-10 h-12 rounded-xl font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-lg ${isFollowing ? 'bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90' : 'bg-primary text-white shadow-primary/20 hover:shadow-xl hover:translate-y-[-2px] active:translate-y-0'}`}
            >
              {isFollowing ? 'Following' : 'Follow Tag'}
            </button>
        </header>

        <div className="flex flex-col gap-12 animate-fade-in relative z-10 pb-64 px-2">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-64 bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-3xl animate-pulse" />
            ))
          ) : posts.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center gap-8 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-3xl shadow-xl px-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-10 text-primary/5 pointer-events-none">
                  <Orbit size={200} strokeWidth={1} className="animate-spin-slow" />
               </div>
               <div className="space-y-4">
                  <h3 className="text-4xl font-black text-black dark:text-white italic uppercase tracking-tight">Quiet Zone</h3>
                  <p className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest max-w-xs mx-auto">Be the first to ignite this hashtag with your content.</p>
                  <button onClick={() => navigate('/dashboard')} className="mt-4 h-12 px-8 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:translate-y-[-2px] transition-all shadow-lg shadow-primary/10">Start The Conversation</button>
               </div>
            </div>
          ) : (
            posts.map(post => <PostCard key={post.post_id} post={post} />)
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
