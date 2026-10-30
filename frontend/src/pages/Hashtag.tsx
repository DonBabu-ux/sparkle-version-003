import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hash, ArrowLeft } from 'lucide-react';
import PostCard from '../components/PostCard';
import api from '../api/api';
import type { Post } from '../types/post';
import { logger } from '../utils/logger';

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
      logger.error('Failed to follow hashtag:', err);
    }
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/search?type=posts&q=${encodeURIComponent(tag || '')}`);
      setPosts(res.data.posts || res.data || []);
    } catch (err) {
      logger.error('Hashtag fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    if (tag) fetchPosts();
  }, [tag, fetchPosts]);

  return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 overflow-x-hidden font-sans">

      <main className="flex-1 p-6 lg:p-12 relative z-10 max-w-4xl mx-auto w-full">

        <button
          onClick={() => navigate(-1)}
          className="mb-8 w-12 h-12 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-full shadow-sm flex items-center justify-center text-[#18181b] dark:text-zinc-100 hover:text-primary transition-colors active:scale-95 group"
        >
          <ArrowLeft size={20} strokeWidth={2.5} className="group-hover:-translate-x-1 transition-transform" />
        </button>

        <header className="flex flex-col md:flex-row items-center justify-between gap-5 mb-8 animate-fade-in p-6 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-5">
               <Hash size={28} strokeWidth={2.5} className="text-primary shrink-0" />
               <div className="text-center md:text-left min-w-0">
                  <h1 className="text-3xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight leading-none">#{tag}</h1>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</p>
               </div>
            </div>

            <button
              onClick={handleFollow}
              className={`w-full md:w-auto px-6 h-11 rounded-full text-sm font-bold transition-colors ${isFollowing ? 'bg-[#f0e5ec] dark:bg-zinc-700 text-[#18181b] dark:text-zinc-100' : 'bg-primary text-white hover:bg-[#ff2d87]'}`}
            >
              {isFollowing ? 'Following' : 'Follow tag'}
            </button>
        </header>

        <div className="flex flex-col gap-5 animate-fade-in relative z-10 pb-20 px-2">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-64 bg-[#f6eef3] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl animate-pulse" />
            ))
          ) : posts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center gap-4 bg-[#f6eef3] dark:bg-zinc-900 border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 rounded-3xl px-6">
               <Hash size={32} strokeWidth={1.5} className="text-slate-600 dark:text-zinc-400" />
               <div className="space-y-4">
                  <h3 className="text-lg font-bold text-[#18181b] dark:text-zinc-100">You've seen it all</h3>
                  <p className="text-[13px] text-slate-600 dark:text-zinc-400 max-w-sm mx-auto">Nobody has posted with this hashtag yet. Be the first to add something.</p>
                  <button onClick={() => navigate('/dashboard')} className="mt-2 px-5 h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors">Create a post</button>
               </div>
            </div>
          ) : (
            posts.map(post => <PostCard key={post.post_id} post={post} />)
          )}
        </div>
      </main>
    </div>
  );
}



