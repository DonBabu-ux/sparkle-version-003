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
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-4xl mx-auto w-full pt-20 md:pt-32">
        
        <button 
          onClick={() => navigate(-1)}
          className="mb-12 w-16 h-16 rounded-[24px] bg-white border border-white shadow-2xl flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all group"
        >
          <ArrowLeft size={28} strokeWidth={4} className="group-hover:-translate-x-1.5 transition-transform" />
        </button>

        <header className="flex flex-col md:flex-row items-center justify-between gap-12 mb-20 animate-fade-in p-12 bg-white/80 backdrop-blur-3xl border border-white/65 rounded-[56px] shadow-2xl shadow-primary/5">
            <div className="flex items-center gap-8">
               <div className="w-24 h-24 bg-primary text-white rounded-[32px] flex items-center justify-center shadow-2xl shadow-primary/30 group-hover:rotate-12 transition-transform duration-700">
                  <Hash size={48} strokeWidth={4} />
               </div>
               <div>
                  <h1 className="text-5xl md:text-7xl font-black text-black tracking-tighter leading-none italic uppercase underline decoration-primary decoration-8 underline-offset-[16px]">#{tag}</h1>
                  <p className="text-[10px] font-black text-black uppercase tracking-[0.4em] mt-8 italic px-2">{posts.length} Active Harmonics</p>
               </div>
            </div>
            
            <button 
              onClick={handleFollow}
              className={`px-12 h-18 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] italic transition-all duration-500 shadow-2xl ${isFollowing ? 'bg-black text-white hover:bg-black/80' : 'bg-primary text-white shadow-primary/30 hover:scale-105 active:scale-95'}`}
            >
              {isFollowing ? 'Locked Sync' : 'Synchronize'}
            </button>
        </header>

        <div className="flex flex-col gap-12 animate-fade-in relative z-10 pb-64 px-2">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-72 bg-white/40 backdrop-blur-3xl border border-white rounded-[56px] animate-pulse" />
            ))
          ) : posts.length === 0 ? (
            <div className="py-64 flex flex-col items-center justify-center text-center gap-12 bg-white/40 backdrop-blur-3xl border-4 border-dashed border-white rounded-[80px] shadow-2xl shadow-primary/5">
               <Orbit size={140} strokeWidth={2} className="text-primary/10 animate-spin-slow" />
               <div className="space-y-6">
                  <h3 className="text-5xl font-black text-black opacity-5 italic uppercase tracking-tighter">No signals.</h3>
                  <p className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] max-w-xs mx-auto italic">Be the first to initiate a signal using this tag in the village network.</p>
                  <button onClick={() => navigate('/dashboard')} className="mt-8 px-12 h-18 bg-primary text-white rounded-[24px] font-black uppercase tracking-widest italic hover:scale-105 transition-all shadow-xl shadow-primary/30">Start Broadcast</button>
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
