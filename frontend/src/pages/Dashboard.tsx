import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import PostCard from '../components/PostCard';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AppScreen from '../components/AppScreen';
import { useModalStore } from '../store/modalStore';
import { useFeedStore } from '../store/feedStore';
import { 
  Check, Image, Video, Smile, Ghost, RefreshCw, 
  Plus, Sparkles, Flame, TrendingUp, Orbit, Send, 
  ChevronRight, BarChart3, Calendar 
} from 'lucide-react';
import VirtualizedFeed from '../components/VirtualizedFeed';
import Spinner from '../components/ui/Spinner';
import { useDeviceSeed } from '../hooks/useDeviceSeed';
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
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => navigate(`/profile/${s.username}`)}>
      <img src={getAvatarUrl(s.avatar_url, s.username)} className="w-10 h-10 rounded-full object-cover border border-black/5 dark:border-white/10" alt="" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[14px] text-black dark:text-white truncate">{s.username}</p>
        <p className="text-[12px] text-black/40 dark:text-white/40 truncate">{s.campus || 'Main Campus'}</p>
      </div>
      <button className={`px-4 py-1.5 rounded-lg font-bold text-[13px] transition-all ${following ? 'bg-black/5 dark:bg-white/5 text-black/20 dark:text-white/20' : 'bg-primary/5 text-primary hover:bg-primary/10'}`} onClick={handleFollow} disabled={loading || following}>
        {loading ? '...' : following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const { setActiveModal } = useModalStore();
  const { stories, suggestions, setPosts, appendPosts, prependPosts, setStories, setSuggestions, lastFetched, orderedPostIds, postsById } = useFeedStore();
const posts = orderedPostIds.map(id => postsById[id]);
  
  const [newPostContent, setNewPostContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [loading, setLoading] = useState(!lastFetched);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const offsetRef = useRef<number>(0);
  const lastSyncTime = useRef<number>(Date.now());
  const isInitialMount = useRef(true);
  const { seed: deviceSeed, deviceId } = useDeviceSeed();

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
    // Reduce 'fresh' window to 30s for variety but stability
    const isFresh = lastFetched && (Date.now() - lastFetched < 30000);
    
    // Only skip if it's an initial load AND we have fresh data AND not forcing
    if (isInitial && isFresh && posts.length > 0 && !force) {
      setLoading(false);
      return; 
    }

    if (isInitial) {
      setLoading(true);
      if (force) {
        offsetRef.current = 0;
      }
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isInitial ? 0 : offsetRef.current;
      
      const [dashRes, storiesRes, suggestionsRes] = await Promise.all([
        api.get(`/posts/feed?offset=${currentOffset}&limit=10&seed=${deviceSeed}&device_id=${deviceId}${force ? '&force=true' : ''}`),
        isInitial ? api.get('/stories/active').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        isInitial ? api.get(`/users/suggestions?seed=${deviceSeed}${force ? '&force=true' : ''}`).catch(() => ({ data: { suggestions: [] } })) : Promise.resolve({ data: { suggestions: [] } })
      ]);
      
      const newPosts = Array.isArray(dashRes.data) ? dashRes.data : (dashRes.data.feed || dashRes.data.posts || []);
      
      if (isInitial) {
        setPosts(newPosts);
        lastSyncTime.current = Date.now();
        if (Array.isArray(storiesRes.data)) setStories(storiesRes.data);
        if (suggestionsRes.data.suggestions) setSuggestions(suggestionsRes.data.suggestions);
        setTrendingTags([
          { tag: 'campus_life', count: '12.4k' },
          { tag: 'campus_talk', count: '8.8k' },
          { tag: 'announcements', count: '5.1k' },
          { tag: 'campus_vibes', count: '942' }
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
  }, [lastFetched, posts.length, setPosts, appendPosts, setStories, setSuggestions]);

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
    const storyJustPosted = sessionStorage.getItem('sparkle_story_posted');
    if (isInitialMount.current || refreshCounter > 0 || storyJustPosted) {
      fetchDashboardData(true, true);
      isInitialMount.current = false;
      if (storyJustPosted) {
        sessionStorage.removeItem('sparkle_story_posted');
      }
    }
  }, [refreshCounter, fetchDashboardData]);

  // Feed managed by VirtualizedFeed component
  
  return (
    <AppScreen immersive={true} className="flex min-h-screen font-sans overflow-x-hidden transition-colors duration-300">
      <Navbar />

      <main className="flex-1 lg:ml-72 p-0 sm:p-2 lg:p-8 relative z-10 max-w-[1035px] mx-auto w-full pt-[calc(4rem+env(safe-area-inset-top))] lg:pt-8 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 mt-0.5 lg:mt-0">
          <section className="flex flex-col gap-0 bg-white dark:bg-black">
            {/* COMPOSER */}
            <div className="bg-white dark:bg-[#000000] rounded-lg shadow-sm p-4 animate-fade-in border border-black/5 dark:border-white/5">
              <div className="flex gap-4 items-center mb-5">
                <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-11 h-11 rounded-full object-cover border border-black/5 dark:border-white/10 shadow-sm" alt="" />
                <button onClick={() => setActiveModal('feeling')} className="flex-1 h-11 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-black dark:text-white rounded-lg px-5 text-left transition-colors font-medium text-sm">
                  What's on your mind, {user?.name || user?.username}?
                </button>
              </div>
              <div className="border-t border-black/5 dark:border-white/5 pt-3 flex items-center justify-around">
                <label className="flex items-center gap-2.5 px-4 py-2 hover:bg-red-500/5 rounded-xl transition-all cursor-pointer group text-red-500/60 dark:text-red-400">
                  <Video size={20} className="text-red-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Video</span>
                  <input type="file" className="hidden" accept="video/*" onChange={(e) => { setActiveModal('post', null, { initialFiles: Array.from(e.target.files || []) }); }} />
                </label>
                <label className="flex items-center gap-2.5 px-4 py-2 hover:bg-emerald-500/5 rounded-xl transition-all cursor-pointer group text-emerald-500/60 dark:text-emerald-400">
                  <Image size={20} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Photo</span>
                  <input type="file" multiple className="hidden" accept="image/*,video/*" onChange={(e) => { setActiveModal('post', null, { initialFiles: Array.from(e.target.files || []) }); }} />
                </label>
                <button onClick={() => setActiveModal('post')} className="flex items-center gap-2.5 px-4 py-2 hover:bg-amber-500/5 rounded-xl transition-all group text-amber-500/60 dark:text-amber-400">
                  <Smile size={20} className="text-amber-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Feeling</span>
                </button>
              </div>
            </div>

            {/* STORIES - GENIUS RING & BADGE IMPLEMENTATION (Requirement) */}
            <div className="animate-fade-in py-0.5 px-2 sm:px-0 bg-white dark:bg-black sm:bg-transparent rounded-[8px] sm:rounded-none border-none shadow-none">
              <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar px-2 sm:px-0">
                {/* Add Story Card */}
                <div onClick={() => navigate('/afterglow/create')} className="flex-shrink-0 w-[112px] h-[200px] bg-white dark:bg-black rounded-lg shadow-lg cursor-pointer group relative overflow-hidden transition-all hover:brightness-95 active:scale-[0.98] border border-black/5 dark:border-white/10">
                  <div className="h-[150px] w-full overflow-hidden">
                    <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                  </div>
                  <div className="h-[50px] w-full flex flex-col items-center justify-end pb-3 relative bg-white dark:bg-[#121212]">
                    <div className="absolute top-[-20px] w-10 h-10 bg-primary rounded-full border-4 border-white dark:border-[#121212] flex items-center justify-center text-white shadow-xl z-10"><Plus size={24} strokeWidth={4} /></div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-black dark:text-white">Add Story</span>
                  </div>
                </div>

                {/* Story Cards */}
                {stories.map((group: StoryGroup) => {
                  const unviewed = group.unviewed_count || (group.is_fully_viewed ? 0 : group.stories.length);
                  return (
                    <div 
                      key={group.user_id}
                      onClick={() => navigate(`/stories/${group.user_id}`)}
                      className="flex-shrink-0 w-[112px] h-[200px] rounded-lg shadow-lg cursor-pointer relative overflow-hidden group transition-all hover:brightness-90 active:scale-[0.98]"
                    >
                      <img src={getAvatarUrl(group.stories[0].media_url || group.avatar_url, group.username)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                      
                      <div className="absolute top-3 left-3 w-10 h-10 rounded-full relative z-10">
                         <div className={`absolute inset-[-4px] rounded-full border-[3px] transition-colors duration-500 ${unviewed > 0 ? 'border-primary shadow-[0_0_12px_rgba(232,53,131,0.5)]' : 'border-black/20 dark:border-white/20'}`} />
                         <div className="w-full h-full rounded-full border-2 border-black/10 dark:border-white/10 overflow-hidden relative">
                            <img src={getAvatarUrl(group.avatar_url, group.username)} className="w-full h-full object-cover" alt="" />
                         </div>
                         {unviewed > 0 && (
                           <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-black rounded-full border-2 border-white dark:border-black flex items-center justify-center shadow-lg">
                              {unviewed}
                           </motion.div>
                         )}
                      </div>
                      
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                        <p className="text-[10px] font-black text-white uppercase tracking-widest truncate">{group.username || group.user_name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FEED */}
            <div className="space-y-[3px] sm:space-y-3 pb-48 animate-fade-in mt-[-8px]">
              <VirtualizedFeed initialPosts={posts} suggestions={suggestions} />
            </div>
          </section>

          {/* Sidebar */}
          <aside className="hidden xl:flex flex-col gap-4 sticky top-24 h-fit animate-fade-in">
            <div className="bg-white dark:bg-[#121212] rounded-2xl border border-black/5 dark:border-white/10 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[11px] font-black text-black/30 dark:text-white/30 uppercase tracking-widest">Connect</h3>
                <Link to="/connect" className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">View All</Link>
              </div>
              <div className="space-y-4">{suggestions.length > 0 ? suggestions.map(s => <SuggestionItem key={s.user_id} s={s} navigate={navigate} />) : <div className="flex flex-col items-center py-8 gap-4 opacity-30"><Spinner size="medium" color="text-black/30 dark:text-white/30" /><p className="text-[12px] font-semibold text-black/30 dark:text-white/30 uppercase tracking-widest text-center">No Suggestions</p></div>}</div>
            </div>
            {/* Trending */}
            <div className="bg-white dark:bg-[#121212] rounded-2xl border border-black/5 dark:border-white/10 p-6 shadow-sm overflow-hidden group">
               <div className="flex flex-col gap-6">
                  <h3 className="text-[11px] font-black text-black/30 dark:text-white/30 uppercase tracking-widest">Hot Right Now</h3>
                  <div className="space-y-3">{trendingTags.map(tag => (
                      <Link key={tag.tag} to={`/search?q=${tag.tag}`} className="block p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-primary/20 rounded-2xl transition-all group/tag">
                         <div className="flex items-center justify-between">
                            <p className="text-[15px] font-black text-black dark:text-white group-hover/tag:text-primary italic uppercase tracking-tight">#{tag.tag}</p>
                            <TrendingUp size={14} className="text-primary opacity-0 group-hover/tag:opacity-100 transition-opacity" />
                         </div>
                         <p className="text-[10px] font-bold text-black/30 dark:text-white/30 mt-1 uppercase tracking-widest">{tag.count} Sparks</p>
                      </Link>
                    ))}</div>
                  <Link to="/explore" className="w-full h-11 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center gap-2 text-[11px] font-black text-black/40 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-all group/more uppercase tracking-widest">Explore More <ChevronRight size={14} className="group-hover/more:translate-x-1 transition-transform" /></Link>
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
    </AppScreen>
  );
}
