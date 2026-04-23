import { useState, useEffect, useCallback, useRef } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import PostCard from '../components/PostCard';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useModalStore } from '../store/modalStore';
import { 
  Check, 
  Image as ImageIcon, 
  PlayCircle, 
  Ghost, 
  RefreshCw, 
  Plus, 
  Sparkles, 
  Flame,
  TrendingUp,
  Orbit,
  Send,
  ChevronRight,
  BarChart3,
  Calendar
} from 'lucide-react';
import type { User } from '../types/user';
import type { Post } from '../types/post';

interface StoryGroup {
  user_id: string;
  username?: string;
  user_name?: string;
  avatar_url?: string;
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
    <div className="flex items-center gap-5 p-4 rounded-[32px] hover:bg-white/80 transition-all group cursor-pointer border border-transparent" onClick={() => navigate(`/profile/${s.username}`)}>
      <div className="relative shrink-0">
        <div className="p-1 bg-white rounded-2xl overflow-hidden shadow-lg border border-black/5 transition-transform duration-500">
           <img 
            src={s.avatar_url || '/uploads/avatars/default.png'} 
            className="w-14 h-14 rounded-xl transition-transform duration-1000 object-cover" 
            alt="" 
          />
        </div>
        {s.is_online && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-white rounded-full shadow-lg"></div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-black text-base text-black truncate leading-none uppercase tracking-tighter italic">
          {s.username}
        </div>
        <p className="text-[10px] font-black text-black/20 truncate mt-2 uppercase tracking-[0.2em] italic">
          {s.campus || 'Main Frequency'}
        </p>
      </div>
      <button 
        className={`shrink-0 w-11 h-11 rounded-[18px] flex items-center justify-center transition-all duration-500 active:scale-90 ${following ? 'bg-black/5 text-black/10' : 'bg-primary text-white shadow-xl shadow-primary/30 hover:scale-105'}`} 
        onClick={handleFollow}
        disabled={loading || following}
      >
        {loading ? '...' : following ? <Check size={18} strokeWidth={4} /> : <Plus size={22} strokeWidth={4} />}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const { setActiveModal } = useModalStore();

  const [newPostContent, setNewPostContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchDashboardData = useCallback(async (pageNum = 1) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const [dashRes, storiesRes, suggestionsRes] = await Promise.all([
        api.get(`/posts/feed?page=${pageNum}&limit=10`),
        pageNum === 1 ? api.get('/stories/active').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        pageNum === 1 ? api.get('/users/suggestions').catch(() => ({ data: { suggestions: [] } })) : Promise.resolve({ data: { suggestions: [] } })
      ]);
      
      const newPosts = Array.isArray(dashRes.data) ? dashRes.data : (dashRes.data.feed || dashRes.data.posts || []);
      
      if (pageNum === 1) {
        setPosts(newPosts);
        if (Array.isArray(storiesRes.data)) setStories(storiesRes.data);
        if (suggestionsRes.data.suggestions) setSuggestions(suggestionsRes.data.suggestions);
        setTrendingTags([
          { tag: 'campus_life', count: '12.4k' },
          { tag: 'high_frequency', count: '8.8k' },
          { tag: 'announcements', count: '5.1k' },
          { tag: 'village_vibes', count: '942' }
        ]);
      } else {
        setPosts(prev => {
          const uniqueNew = newPosts.filter((p: Post) => !prev.some(existing => existing.post_id === p.post_id));
          return [...prev, ...uniqueNew];
        });
      }
      
      setHasMore(newPosts.length === 10);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const { refreshCounter } = useModalStore();
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDashboardData(1);
    setPage(1); // Reset page on refresh
  }, [fetchDashboardData, refreshCounter]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage(p => {
             const next = p + 1;
             fetchDashboardData(next);
             return next;
          });
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchDashboardData]);

  const handlePublish = async () => {
    if (!newPostContent.trim() && mediaFiles.length === 0) return;
    setIsPublishing(true);
    
    const formData = new FormData();
    formData.append('content', newPostContent.trim() || ' ');
    mediaFiles.forEach(file => formData.append('media', file));

    try {
      const response = await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.status === 201 || response.data.success || response.data) {
        setNewPostContent('');
        setMediaFiles([]);
        fetchDashboardData(1);
      }
    } catch (err) {
      console.error('Failed to publish spark:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] left-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-7xl mx-auto w-full pt-20 lg:pt-12">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-16 mt-6 lg:mt-0">
          
          {/* Main Content Area */}
          <section className="flex flex-col gap-16">
            {/* STORIES */}
            <div className="space-y-10 animate-fade-in">
              <div className="flex items-center justify-between px-4">
                <h2 className="text-2xl font-black tracking-tighter text-black uppercase italic flex items-center gap-4">
                   <div className="w-2.5 h-8 bg-primary rounded-full"></div>
                   Stories
                </h2>
                <div className="w-10 h-10 rounded-2xl bg-white/60 border border-white flex items-center justify-center text-primary shadow-sm hover:bg-white transition-transform">
                   <Sparkles size={18} className="animate-pulse" />
                </div>
              </div>
              <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar px-2">
                {/* Add Story */}
                <button 
                  onClick={() => navigate('/afterglow/create')}
                  className="flex-shrink-0 w-32 h-48 bg-white/80 backdrop-blur-3xl border border-white rounded-[40px] flex flex-col items-center justify-center gap-4 group hover:bg-white transition-all shadow-xl shadow-primary/5 active:scale-95 duration-500"
                >
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-[22px] flex items-center justify-center transition-transform duration-700 shadow-inner">
                    <Plus size={28} strokeWidth={4} />
                  </div>
                  <p className="text-[10px] font-black text-black uppercase tracking-[0.3em] italic">Add Story</p>
                </button>

                {stories.map(group => (
                  <button 
                    key={group.user_id}
                    onClick={() => navigate(`/stories/${group.user_id}`)}
                    className="flex-shrink-0 w-32 h-48 bg-white/40 backdrop-blur-3xl border border-white rounded-[40px] p-1.5 group transition-all duration-700 shadow-xl relative overflow-hidden active:scale-95"
                  >
                    <div className="w-full h-full rounded-[34px] overflow-hidden relative">
                        <img 
                          src={group.stories[0].media_url || group.avatar_url || '/uploads/avatars/default.png'} 
                          className="w-full h-full object-cover transition-transform duration-1000"
                          alt=""
                        />
                        <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                          <p className="text-[10px] font-black text-white truncate text-center uppercase tracking-widest italic">{group.username}</p>
                        </div>
                        {/* Avatar ring */}
                        <div className="absolute top-4 left-4 p-0.5 bg-white rounded-xl shadow-2xl border-2 border-primary overflow-hidden">
                           <img src={group.avatar_url || '/uploads/avatars/default.png'} className="w-6 h-6 rounded-lg object-cover" />
                        </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* COMPOSER */}
            <div className="bg-white/80 backdrop-blur-3xl border border-white p-6 lg:p-12 rounded-[32px] lg:rounded-[56px] shadow-2xl shadow-primary/5 transition-all duration-700 hover:shadow-primary/10 animate-fade-in group">
              <div className="flex gap-8 mb-10">
                <div className="p-1 rounded-[28px] bg-white shadow-2xl overflow-hidden shrink-0 border border-black/5 transition-transform duration-700">
                  <img 
                    src={user?.avatar_url || '/uploads/avatars/default.png'} 
                    className="w-16 h-16 rounded-[24px] object-cover transition-transform duration-1000 group-hover:scale-110" 
                    alt="" 
                  />
                </div>
                <textarea 
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder={`What's on your mind, ${user?.name?.split(' ')[0] || ''}?`}
                  className="w-full bg-transparent border-none outline-none text-2xl font-black text-black placeholder:text-black/5 resize-none min-h-[140px] py-4 italic tracking-tighter no-scrollbar"
                />
              </div>

              <div className="flex items-center justify-between pt-10 border-t border-black/[0.03]">
                <div className="flex items-center gap-4">
                   <label className="p-4.5 bg-primary/5 text-primary rounded-[22px] hover:bg-primary/10 hover:shadow-lg transition-all cursor-pointer active:scale-90 border border-primary/10 shadow-sm">
                      <ImageIcon size={24} strokeWidth={3} />
                      <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => setMediaFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
                   </label>
                   <button className="p-4.5 bg-black/5 text-black/20 rounded-[22px] hover:bg-white hover:text-primary hover:shadow-lg transition-all border border-transparent hover:border-primary/20 active:scale-90" onClick={() => navigate('/moments/create')}>
                      <PlayCircle size={24} strokeWidth={3} />
                   </button>
                   <button className="p-4.5 bg-black/5 text-black/20 rounded-[22px] hover:bg-white hover:text-primary hover:shadow-lg transition-all border border-transparent hover:border-primary/20 active:scale-90" onClick={() => setActiveModal('poll')}>
                      <BarChart3 size={24} strokeWidth={3} />
                   </button>
                </div>

                <div className="flex items-center gap-6">
                   {mediaFiles.length > 0 && (
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest italic">{mediaFiles.length} files attached</span>
                   )}
                   <button 
                    onClick={handlePublish}
                    disabled={isPublishing || (!newPostContent.trim() && mediaFiles.length === 0)}
                    className="bg-primary text-white font-black text-sm uppercase tracking-[0.2em] px-12 py-5 rounded-[22px] shadow-2xl shadow-primary/30 hover:scale-[1.03] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-4 italic"
                  >
                    {isPublishing ? 'Posting...' : 'Post'} <Send size={20} strokeWidth={4} />
                  </button>
                </div>
              </div>
            </div>

            {/* FEED */}
            <div className="space-y-12 pb-48 animate-fade-in px-2">
              <div className="flex items-center justify-between px-4">
                 <h2 className="text-2xl font-black text-black uppercase tracking-tighter italic flex items-center gap-4">
                    <div className="w-2.5 h-8 bg-black/5 rounded-full"></div>
                    Feed
                 </h2>
                 <div className="flex items-center gap-4 px-6 py-2.5 bg-white/60 backdrop-blur-3xl border border-white rounded-full text-[10px] font-black text-primary shadow-xl shadow-primary/5 italic">
                    <div className="w-2 h-2 bg-primary rounded-full animate-ping"></div>
                    LIVE
                 </div>
              </div>

              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="bg-white/40 border-4 border-dashed border-white h-96 rounded-[56px] animate-pulse"></div>
                ))
              ) : posts.length > 0 ? (
                <>
                  {posts.map((post) => <PostCard key={post.post_id} post={post} />)}
                  <div ref={observerTarget} className="h-10 w-full flex items-center justify-center">
                     {loadingMore && <RefreshCw size={24} className="animate-spin text-primary" />}
                  </div>
                </>
              ) : (
                <div className="py-48 bg-white/20 border-4 border-dashed border-white rounded-[64px] flex flex-col items-center justify-center gap-10 text-center shadow-inner mx-4">
                   <Ghost size={120} strokeWidth={1} className="text-black/5 animate-bounce-slow" />
                   <div className="space-y-6">
                     <h3 className="text-4xl font-black text-black/10 uppercase tracking-tighter italic leading-none">No Posts Yet.</h3>
                     <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.3em] max-w-xs mx-auto leading-loose italic">Follow some people to see their posts here.</p>
                     <button onClick={() => navigate('/connect')} className="mt-8 px-12 py-5 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 italic">Find Friends</button>
                   </div>
                </div>
              )}
            </div>
          </section>

          {/* Sidebar Area */}
          <aside className="hidden xl:flex flex-col gap-12 sticky top-32 h-fit animate-fade-in">
            {/* Suggested People */}
            <div className="bg-white/80 backdrop-blur-3xl border border-white rounded-[56px] p-10 shadow-2xl shadow-primary/5 transition-all duration-700 hover:shadow-primary/10">
              <div className="flex items-center justify-between mb-10 px-4">
                 <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic">Suggested People</h3>
                 <Link to="/connect" className="text-[9px] font-black text-primary hover:tracking-[0.4em] transition-all uppercase italic">View All</Link>
              </div>
              <div className="space-y-4">
                {suggestions.length > 0 ? suggestions.map(s => (
                  <SuggestionItem key={s.user_id} s={s} navigate={navigate} />
                )) : (
                   <div className="flex flex-col items-center py-12 gap-6 opacity-30">
                      <Orbit size={48} className="text-black animate-spin-slow" />
                      <p className="text-[10px] font-black text-black uppercase tracking-[0.3em] text-center italic">No Suggestions</p>
                   </div>
                )}
              </div>
            </div>

            {/* Trending */}
            <div className="bg-white/80 backdrop-blur-3xl border border-white rounded-[56px] p-12 relative overflow-hidden shadow-2xl shadow-primary/5 group transition-all duration-700 hover:shadow-primary/10">
               <div className="absolute -top-16 -right-16 text-primary/5 group-hover:text-primary/10 group-hover:scale-125 transition-all duration-1000">
                  <Flame size={280} fill="currentColor" strokeWidth={0} />
               </div>
               <div className="relative z-10 flex flex-col gap-10">
                  <h3 className="text-3xl font-black flex items-center gap-5 text-black uppercase tracking-tighter italic leading-none">
                     <span className="w-2.5 h-10 bg-primary rounded-full"></span>
                     Trending
                  </h3>
                  <div className="space-y-5">
                    {trendingTags.map(tag => (
                      <Link key={tag.tag} to={`/search?q=${tag.tag}`} className="block p-6 bg-white/60 border border-white rounded-[32px] hover:bg-white hover:border-black/5 hover:-translate-y-2 transition-all duration-500 group/tag shadow-xl shadow-primary/5 hover:shadow-primary/10">
                         <div className="flex items-center justify-between">
                            <p className="text-xl font-black text-black italic uppercase tracking-tighter group-hover/tag:text-primary transition-colors">#{tag.tag}</p>
                            <TrendingUp size={18} strokeWidth={4} className="text-primary/20 group-hover/tag:text-primary transition-colors opacity-0 group-hover/tag:opacity-100 group-hover/tag:animate-pulse" />
                         </div>
                         <p className="text-[10px] font-black text-black/20 mt-3 uppercase tracking-[0.3em] italic">{tag.count} POSTS</p>
                      </Link>
                    ))}
                  </div>
                  
                  <Link to="/explore" className="w-full py-5 bg-black/5 rounded-3xl flex items-center justify-center gap-4 text-[10px] font-black text-black/20 uppercase tracking-[0.4em] hover:bg-black hover:text-white transition-all duration-500 italic group/more">
                      Explore More <ChevronRight size={18} strokeWidth={4} className="group-hover/more:translate-x-2 transition-transform" />
                  </Link>
               </div>
            </div>

            {/* Village Ad-Banner Placeholder */}
            <div className="bg-black text-white rounded-[56px] p-12 relative overflow-hidden shadow-2xl group cursor-pointer transition-all duration-1000 hover:shadow-primary/20">
                <div className="absolute inset-0 bg-primary/20 blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10 space-y-6">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                       <Calendar size={24} strokeWidth={3} className="text-white fill-white/10" />
                    </div>
                    <div className="space-y-2">
                       <h4 className="text-3xl font-black italic uppercase tracking-tighter leading-none">The Sparkle Ball</h4>
                       <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] italic">GRAND GATHERING — SOUTH HUB</p>
                    </div>
                    <button className="w-full py-5 bg-white text-black rounded-[22px] font-black text-xs uppercase tracking-[0.2em] italic shadow-2xl transition-all hover:scale-[1.05] active:scale-95">
                        Sync Attendance
                    </button>
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
