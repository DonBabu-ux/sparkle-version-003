import { useState, useEffect, useCallback } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import PostCard from '../components/PostCard';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Plus, RefreshCw, TrendingUp, Image, Video, Smile } from 'lucide-react';

export default function Dashboard() {
  const { user } = useUserStore();
  const navigate = useNavigate();

  const [newPostContent, setNewPostContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchDashboardData = useCallback(async (pageNum = 1, refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const endpoint = `/dashboard?page=${pageNum}&limit=10`;
      const [dashRes, storiesRes] = await Promise.all([
        api.get(endpoint),
        pageNum === 1 ? api.get('/stories/active') : Promise.resolve({ data: { stories: [] } })
      ]);
      
      const newPosts = dashRes.data.feed || dashRes.data.posts || [];
      
      if (refresh || pageNum === 1) {
        setPosts(newPosts);
        setPage(1);
        if (pageNum === 1 && storiesRes.data.stories) setStories(storiesRes.data.stories);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      
      setHasMore(newPosts.length === 10);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [stories]);

  useEffect(() => {
    fetchDashboardData(1, true);
  }, []);

  const { lastElementRef } = useInfiniteScroll({
    loading: loading || loadingMore,
    hasNextPage: hasMore,
    onLoadMore: () => {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchDashboardData(nextPage);
    }
  });

  const handleRefresh = () => {
    fetchDashboardData(1, true);
  };

  const handlePublish = async () => {
    if (!newPostContent.trim() && mediaFiles.length === 0) return;
    setIsPublishing(true);
    
    const formData = new FormData();
    formData.append('content', newPostContent);
    mediaFiles.forEach(file => formData.append('media', file));

    try {
      const response = await api.post('/posts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      if (response.data.success) {
        setNewPostContent('');
        setMediaFiles([]);
        handleRefresh(); // Refresh feed after publishing
      }
    } catch (err) {
      console.error('Failed to publish spark:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <Navbar />
      
      <div className="flex-1 ml-20 lg:ml-64 transition-all duration-300">
        <main className="max-w-7xl mx-auto px-4 lg:grid lg:grid-cols-12 lg:gap-10 pb-20 pt-8">
        {/* Left Sidebar - Trending */}
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="premium-card bg-white border-white p-6 shadow-xl shadow-slate-200/50 sticky top-28">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp size={16} className="text-indigo-600" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trending Now</h3>
            </div>
            <div className="space-y-5">
              {[
                { tag: '#CampusGossip', posts: '2.4k' },
                { tag: '#MarketplaceSteals', posts: '1.8k' },
                { tag: '#ProjectPartnerSearch', posts: '942' },
                { tag: '#FinalsWeekCry', posts: '5.1k' }
              ].map(item => (
                <div key={item.tag} className="group cursor-pointer">
                  <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{item.tag}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{item.posts} sparkles</p>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 border-2 border-slate-50 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 hover:border-indigo-50 transition-all">
              See All Trends
            </button>
          </div>
        </div>

        {/* Center Main Feed */}
        <div className="lg:col-span-6 space-y-8">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl shadow-lg shadow-pink-200/40 flex items-center justify-center overflow-hidden border border-pink-100">
                 <img src="/logo.png" alt="Sparkle Feed" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Feed</h2>
                <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mt-0.5">Atmosphere Pulse</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`p-3 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`}
                title="Refresh Feed"
              >
                <RefreshCw size={20} />
              </button>
              <div className="md:flex hidden bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200">
                Online: 1,242
              </div>
            </div>
          </div>

          {/* Create Post Section */}
          <div className="premium-card bg-white border-white/60 p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-50" alt="" />
              <input 
                type="text"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="w-full bg-slate-100/50 hover:bg-slate-100 border-none rounded-full px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-500"
                placeholder={`What's on your mind, ${user?.name?.split(' ')[0] || user?.username || 'Naty'}?`}
              />
            </div>
            
            {mediaFiles.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2 pl-13">
                {mediaFiles.map((f, i) => (
                  <div key={i} className="relative group flex-shrink-0">
                    <img src={URL.createObjectURL(f)} className="w-20 h-20 rounded-xl object-cover border border-slate-100 shadow-sm" alt="" />
                    <button 
                      onClick={() => setMediaFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 bg-rose-600 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center shadow-xl border border-white"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <label className="flex items-center justify-center gap-2 flex-1 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors text-slate-500 text-sm font-semibold group">
                <Image className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform" /> Photo
                <input type="file" multiple className="hidden" accept="image/*" onChange={(e) => setMediaFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
              </label>
              <button className="flex items-center justify-center gap-2 flex-1 p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 text-sm font-semibold group">
                <Video className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" /> Video
              </button>
              <button className="flex items-center justify-center gap-2 flex-1 p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 text-sm font-semibold group">
                <Smile className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" /> Feeling
              </button>
            </div>
            {(newPostContent.trim() || mediaFiles.length > 0) && (
               <button 
                 onClick={handlePublish}
                 disabled={isPublishing}
                 className="w-full mt-3 bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold shadow-md active:scale-[0.98] transition-transform disabled:opacity-50"
               >
                 {isPublishing ? 'Publishing...' : 'Publish'}
               </button>
            )}
          </div>

          {/* Stories Bar (Afterglow) */}
          <div className="mb-6">
            <h3 className="text-sm font-black text-slate-800 tracking-tight ml-1 mb-3">Afterglow</h3>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
               <div className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-2xl border-2 border-dashed border-slate-300 group-hover:border-indigo-400 transition-all relative">
                     <Plus size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">Add </span>
               </div>

               {stories.map(group => (
                 <div 
                   key={group.user_id} 
                   onClick={() => navigate(`/stories/${group.user_id}`)}
                   className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group"
                 >
                    <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-rose-500 to-indigo-500 group-hover:scale-105 transition-transform">
                       <img src={group.avatar_url || '/uploads/avatars/default.png'} className="w-full h-full rounded-full object-cover border-2 border-white" alt="" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 tracking-tight text-center w-16 truncate">{group.user_name}</span>
                 </div>
               ))}
            </div>
          </div>

          {/* Posts Feed */}
          <div className="space-y-8">
            {posts.map((post: any, idx: number) => (
              <div key={post.post_id} ref={idx === posts.length - 1 ? lastElementRef : null}>
                 <PostCard post={post} />
              </div>
            ))}
            
            {loading && posts.length === 0 && (
              <div className="text-center py-20 flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading feed...</p>
              </div>
            )}

            {loadingMore && (
              <div className="text-center py-10 flex flex-col items-center">
                 <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div className="text-center py-10">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">You've reached the end of the galaxy.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Suggestions */}
        <aside className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="premium-card bg-indigo-900 border-none text-white p-8 shadow-2xl shadow-indigo-200">
             <h4 className="text-sm font-black uppercase tracking-widest mb-4 opacity-60">Go Premium</h4>
             <p className="text-xs font-bold leading-relaxed mb-6">Unlock exclusive campus events and advanced marketplace tools.</p>
             <button className="w-full py-3 bg-white text-indigo-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">
                Upgrade Aura
             </button>
          </div>

          <div className="premium-card bg-white border-white p-6 shadow-xl shadow-slate-200/50">
            <h3 className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">Global Members</h3>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse" />
                    <div>
                      <div className="w-20 h-2 bg-slate-100 rounded animate-pulse mb-1" />
                      <div className="w-12 h-1.5 bg-slate-50 rounded animate-pulse" />
                    </div>
                  </div>
                  <button className="text-[9px] font-black text-indigo-600 uppercase">Connect</button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
      </div>
    </div>
  );
}
