import { useState, useEffect, useCallback, useRef } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import PostCard from '../components/PostCard';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useModalStore } from '../store/modalStore';
import { useFeedStore } from '../store/feedStore';
import { 
  Check, Image, Video, Smile, Ghost, RefreshCw, 
  Plus, Sparkles, Flame, TrendingUp, Orbit, Send, 
  ChevronRight, BarChart3, Calendar 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '../types/user';
import type { Post } from '../types/post';
import { getAvatarUrl } from '../utils/imageUtils';

interface StoryGroup {
  user_id: string;
  username: string;
  user_name: string;
  avatar_url?: string;
  is_fully_viewed?: boolean;
  unviewed_count?: number;
  stories: { media_type: string; media_url?: string; caption?: string }[];
}

interface TrendingTag {
  tag: string;
  count: string;
}

function SuggestionItem({ s, navigate }: { s: User, navigate: (path: string) => void }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await api.post(`/users/${s.user_id}/follow`);
      setFollowing(true);
    } catch (err) {
      console.error('Failed to follow', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => navigate(`/profile/${s.username}`)}>
      <img src={getAvatarUrl(s.avatar_url, s.username)} className="w-10 h-10 rounded-full object-cover border border-gray-200" alt="" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[14px] text-gray-900 truncate">{s.username}</p>
        <p className="text-[12px] text-gray-500 truncate">{s.campus || 'Main Frequency'}</p>
      </div>
      <button className={`px-4 py-1.5 rounded-md font-bold text-[13px] transition-all ${following ? 'bg-gray-200 text-gray-500' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`} onClick={handleFollow} disabled={loading || following}>
        {loading ? '...' : following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const { setActiveModal } = useModalStore();
  const { posts, stories, suggestions, setPosts, appendPosts, prependPosts, setStories, setSuggestions, lastFetched } = useFeedStore();
  
  const [newPostContent, setNewPostContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [loading, setLoading] = useState(!lastFetched);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const [feedSeed, setFeedSeed] = useState<number>(Math.floor(Math.random() * 1000000));
  const offsetRef = useRef<number>(0);
  const lastSyncTime = useRef<number>(Date.now());
  const isInitialMount = useRef(true);

  const fetchDeltaData = useCallback(async () => {
    try {
      const since = new Date(lastSyncTime.current).toISOString();
      const res = await api.get(`/posts/new?since=${since}`);
      const newPosts = res.data;
      
      if (Array.isArray(newPosts) && newPosts.length > 0) {
        prependPosts(newPosts);
        lastSyncTime.current = Date.now();
      }
    } catch (err) {
      console.error('Delta sync failed:', err);
    }
  }, [prependPosts]);

  const fetchDashboardData = useCallback(async (isInitial = true, force = false) => {
    // Reduce 'fresh' window to 10s for production variety
    const isFresh = lastFetched && (Date.now() - lastFetched < 10000);
    
    if (isInitial && isFresh && posts.length > 0 && !force) {
      setLoading(false);
      return; 
    }

    if (isInitial) {
      setLoading(true);
      if (force) {
        offsetRef.current = 0;
        // Rotate seed on manual refresh to get new variety
        setFeedSeed(Math.floor(Math.random() * 1000000));
      }
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isInitial ? 0 : offsetRef.current;
      const currentSeed = isInitial && force ? Math.floor(Math.random() * 1000000) : feedSeed;
      
      const [dashRes, storiesRes, suggestionsRes] = await Promise.all([
        api.get(`/posts/feed?offset=${currentOffset}&limit=10&seed=${currentSeed}${force ? '&force=true' : ''}`),
        isInitial ? api.get('/stories/active').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        isInitial ? api.get('/users/suggestions').catch(() => ({ data: { suggestions: [] } })) : Promise.resolve({ data: { suggestions: [] } })
      ]);
      
      const newPosts = Array.isArray(dashRes.data) ? dashRes.data : (dashRes.data.feed || dashRes.data.posts || []);
      
      if (isInitial) {
        setPosts(newPosts);
        lastSyncTime.current = Date.now();
        if (Array.isArray(storiesRes.data)) setStories(storiesRes.data);
        if (suggestionsRes.data.suggestions) setSuggestions(suggestionsRes.data.suggestions);
        setTrendingTags([
          { tag: 'campus_life', count: '12.4k' },
          { tag: 'high_frequency', count: '8.8k' },
          { tag: 'announcements', count: '5.1k' },
          { tag: 'village_vibes', count: '942' }
        ]);
      } else {
        appendPosts(newPosts);
      }

      if (newPosts.length > 0) {
        offsetRef.current = isInitial ? newPosts.length : offsetRef.current + newPosts.length;
      }
      
      setHasMore(newPosts.length === 10);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [lastFetched, posts.length, setPosts, appendPosts, setStories, setSuggestions, feedSeed]);

  useEffect(() => {
    const hidden = JSON.parse(localStorage.getItem('hiddenPostIds') || '[]');
    setHiddenPostIds(hidden);

    const handlePostHidden = (e: any) => {
      const postId = e.detail;
      setHiddenPostIds(prev => [...prev, postId]);
    };

    const handleFocus = () => {
      fetchDeltaData();
    };

    window.addEventListener('postHidden', handlePostHidden);
    window.addEventListener('focus', handleFocus);

    const handleScrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      fetchDashboardData(true, true);
    };
    window.addEventListener('scrollDashboardToTop', handleScrollToTop);
    
    return () => {
      window.removeEventListener('postHidden', handlePostHidden);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('scrollDashboardToTop', handleScrollToTop);
    };
  }, [fetchDashboardData, fetchDeltaData]);

  const { refreshCounter } = useModalStore();
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isInitialMount.current || refreshCounter > 0) {
      fetchDashboardData(true, true);
      isInitialMount.current = false;
    }
  }, [refreshCounter, fetchDashboardData]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchDashboardData(false);
        }
      },
      { 
        threshold: 0,
        rootMargin: '400px' // Start loading 400px before reaching the bottom
      }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchDashboardData]);

  return (
    <div className="flex bg-[#f0f2f5] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />
      <div className="fixed top-0 left-0 w-full h-full bg-[#f0f2f5] z-[-1]" />

      <main className="flex-1 lg:ml-72 p-0 sm:p-4 lg:p-8 relative z-10 max-w-[1035px] mx-auto w-full pt-20 lg:pt-8">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 mt-4 sm:mt-6 lg:mt-0">
          <section className="flex flex-col gap-1.5 sm:gap-4">
            {/* COMPOSER */}
            <div className="bg-white sm:rounded-xl shadow-sm p-4 animate-fade-in border-y sm:border border-gray-200">
              <div className="flex gap-3 items-center mb-4">
                <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-10 h-10 rounded-full object-cover border border-gray-100" alt="" />
                <button onClick={() => setActiveModal('creationHub')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full py-2 px-4 text-left transition-colors text-[16px]">What's on your mind, {user?.name?.split(' ')[0] || ''}?</button>
              </div>
              <div className="border-t border-gray-100 pt-2 flex items-center justify-around px-1">
                <button onClick={() => navigate('/moments/create')} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors group"><Video size={20} className="text-[#f02849]" /><span className="text-[13px] font-semibold text-gray-500">Live video</span></button>
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer group"><Image size={20} className="text-[#45bd62]" /><span className="text-[13px] font-semibold text-gray-500">Photo/video</span><input type="file" multiple className="hidden" accept="image/*" onChange={(e) => { setMediaFiles(prev => [...prev, ...Array.from(e.target.files || [])]); setActiveModal('creationHub'); }} /></label>
                <button onClick={() => setActiveModal('poll')} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors group"><Smile size={20} className="text-[#f7b928]" /><span className="text-[13px] font-semibold text-gray-500">Feeling/activity</span></button>
              </div>
            </div>

            {/* STORIES - GENIUS RING & BADGE IMPLEMENTATION (Requirement) */}
            <div className="animate-fade-in py-2 px-2 sm:px-0">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {/* Add Story Card */}
                <div onClick={() => navigate('/afterglow/create')} className="flex-shrink-0 w-[112px] h-[200px] bg-white rounded-lg shadow-md cursor-pointer group relative overflow-hidden transition-all hover:brightness-95 active:scale-[0.98]">
                  <div className="h-[150px] w-full overflow-hidden">
                    <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                  </div>
                  <div className="h-[50px] w-full flex flex-col items-center justify-end pb-2 relative">
                    <div className="absolute top-[-20px] w-10 h-10 bg-[#1877F2] rounded-full border-4 border-white flex items-center justify-center text-white shadow-sm z-10"><Plus size={24} strokeWidth={3} /></div>
                    <span className="text-[12px] font-bold text-gray-700">Create story</span>
                  </div>
                </div>

                {/* Story Cards */}
                {stories.map((group: StoryGroup) => {
                  const unviewed = group.unviewed_count || (group.is_fully_viewed ? 0 : group.stories.length);
                  return (
                    <div 
                      key={group.user_id}
                      onClick={() => navigate(`/stories/${group.user_id}`)}
                      className="flex-shrink-0 w-[112px] h-[200px] rounded-lg shadow-md cursor-pointer relative overflow-hidden group transition-all hover:brightness-90 active:scale-[0.98]"
                    >
                      <img src={getAvatarUrl(group.stories[0].media_url || group.avatar_url, group.username)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                      
                      {/* GENIUS: Ring & Badge Indicator (Requirement) */}
                      <div className="absolute top-3 left-3 w-10 h-10 rounded-full relative z-10">
                         <div className={`absolute inset-[-4px] rounded-full border-[3px] transition-colors duration-500 ${unviewed > 0 ? 'border-[#1877F2] shadow-[0_0_10px_rgba(24,119,242,0.4)]' : 'border-gray-400/50'}`} />
                         <div className="w-full h-full rounded-full border-2 border-black overflow-hidden relative">
                            <img src={getAvatarUrl(group.avatar_url, group.username)} className="w-full h-full object-cover" alt="" />
                         </div>
                         {/* Unviewed Count Badge */}
                         {unviewed > 0 && (
                           <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#1877F2] text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                              {unviewed}
                           </motion.div>
                         )}
                      </div>
                      
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-[12px] font-bold text-white truncate">{group.username || group.user_name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FEED */}
            <div className="space-y-[3px] sm:space-y-3 pb-48 animate-fade-in">
              <div className="flex items-center justify-between px-4 mb-2 mt-2"><h2 className="text-[17px] font-bold text-gray-500 uppercase tracking-wide">Feed</h2><div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full text-[11px] font-bold text-red-500 shadow-sm"><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>LIVE</div></div>
              {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="bg-white/40 border-4 border-dashed border-white h-96 rounded-[56px] animate-pulse"></div>) : posts.length > 0 ? (
                <>
                  {posts.filter(post => !hiddenPostIds.includes(post.post_id)).map((post) => <PostCard key={post.post_id} post={post} />)}
                  <div ref={observerTarget} className="h-10 w-full flex items-center justify-center">{loadingMore && <RefreshCw size={24} className="animate-spin text-primary" />}</div>
                </>
              ) : (
                <div className="py-48 bg-white/20 border-4 border-dashed border-white rounded-[64px] flex flex-col items-center justify-center gap-10 text-center shadow-inner mx-4">
                   <Ghost size={120} strokeWidth={1} className="text-black/5 animate-bounce-slow" />
                   <div className="space-y-6"><h3 className="text-4xl font-black text-black/10 uppercase tracking-tighter italic leading-none">No Posts Yet.</h3><p className="text-[10px] font-black text-black/30 uppercase tracking-[0.3em] max-w-xs mx-auto leading-loose italic">Follow some people to see their posts here.</p><button onClick={() => navigate('/connect')} className="mt-8 px-12 py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 italic">Find Friends</button></div>
                </div>
              )}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="hidden xl:flex flex-col gap-4 sticky top-24 h-fit animate-fade-in">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4"><h3 className="text-[17px] font-bold text-gray-500 uppercase tracking-wide">Suggested People</h3><Link to="/connect" className="text-[12px] font-bold text-blue-600 hover:underline">See all</Link></div>
              <div className="space-y-2">{suggestions.length > 0 ? suggestions.map(s => <SuggestionItem key={s.user_id} s={s} navigate={navigate} />) : <div className="flex flex-col items-center py-8 gap-4 opacity-30"><Orbit size={32} className="text-gray-400 animate-spin-slow" /><p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest text-center">No Suggestions</p></div>}</div>
            </div>
            {/* Trending */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm overflow-hidden group">
               <div className="flex flex-col gap-4">
                  <h3 className="text-[17px] font-bold text-gray-500 uppercase tracking-wide">Trending</h3>
                  <div className="space-y-3">{trendingTags.map(tag => (
                      <Link key={tag.tag} to={`/search?q=${tag.tag}`} className="block p-3 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100 transition-colors group/tag">
                         <div className="flex items-center justify-between"><p className="text-[15px] font-bold text-gray-900 group-hover/tag:text-blue-600">#{tag.tag}</p><TrendingUp size={14} className="text-blue-600 opacity-0 group-hover/tag:opacity-100 transition-opacity" /></div>
                         <p className="text-[11px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">{tag.count} POSTS</p>
                      </Link>
                    ))}</div>
                  <Link to="/explore" className="w-full py-2 bg-gray-100 rounded-lg flex items-center justify-center gap-2 text-[12px] font-bold text-gray-600 hover:bg-gray-200 transition-colors group/more">Explore More <ChevronRight size={14} className="group-hover/more:translate-x-1 transition-transform" /></Link>
               </div>
            </div>
          </aside>
        </div>
      </main>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        .animate-bounce-slow { animation: bounce-slow 4s infinite ease-in-out; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
