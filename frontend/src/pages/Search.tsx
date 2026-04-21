import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search as SearchIcon, X, Clock, MoreHorizontal,
  ChevronRight, Hash, ChevronLeft, Trash2, 
  RotateCw, User
} from 'lucide-react';
import api from '../api/api';
import Navbar from '../components/Navbar';
import UserCard from '../components/UserCard';
import PostCard from '../components/PostCard';
import { useUserStore } from '../store/userStore';

type TabType = 'all' | 'users' | 'posts' | 'groups' | 'marketplace' | 'clubs';

// 🎨 CUSTOM META STYLE ICONS (BLACK EDITION) 🎨
const MessengerIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-black">
    <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.908 1.464 5.482 3.753 7.158V22l3.418-1.875c.905.251 1.861.391 2.829.391 5.523 0 10-4.145 10-9.258S17.523 2 12 2zm1.096 12.63l-2.585-2.756-5.045 2.756 5.545-5.886 2.585 2.756 5.045-2.756-5.545 5.886z"/>
  </svg>
);

const PointingFingerIcon = () => (
  <span className="text-[28px] grayscale contrast-125 brightness-0">👉</span>
);

export default function Search() {
  const navigate = useNavigate();
  const { user: currentUser } = useUserStore();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [results, setResults] = useState<any>({});
  const [history, setHistory] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [discovery, setDiscovery] = useState<{ creators: any[], groups: any[] }>({ creators: [], groups: [] });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionItem, setActionItem] = useState<any | null>(null);
  const [poking, setPoking] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchInitialData = useCallback(async () => {
    setInitialLoading(true);
    try {
      const [historyRes, trendingRes, discoveryRes] = await Promise.all([
        api.get('/search/history'),
        api.get('/search/trending'),
        api.get('/search/discovery')
      ]);
      
      if (historyRes.data.status === 'success') setHistory(historyRes.data.data || []);
      if (trendingRes.data.status === 'success') setTrending(trendingRes.data.data || []);
      if (discoveryRes.data.status === 'success') setDiscovery(discoveryRes.data.data || { creators: [], groups: [] });
    } catch (err) {
      console.error('Discovery fetch error:', err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const deleteHistoryItem = async (id: number) => {
    try {
        await api.delete(`/search/history/${id}`);
        setHistory(prev => prev.filter(h => h.id !== id));
        setActionItem(null);
    } catch (err) {
        console.error('Delete history failed:', err);
    }
  };

  const handlePoke = async (userId: string, name: string) => {
    if (poking) return;
    setPoking(true);
    try {
        await api.post(`/users/${userId}/poke`);
        alert(`You poked ${name}! 👋`);
        setActionItem(null);
    } catch (err) {
        console.error('Poke failed:', err);
        alert('Failed to send poke. Try again later.');
    } finally {
        setPoking(false);
    }
  };

  const handleSearch = useCallback(async (q: string, type: TabType) => {
    if (!q.trim()) {
        setResults({});
        return;
    }
    setLoading(true);
    try {
      const response = await api.get('/search', {
        params: { q, type, campus: currentUser?.campus }
      });
      if (response.data.status === 'success') {
        if (type === 'all') {
            setResults(response.data.data.results || {});
        } else {
            setResults({ [type]: response.data.data || [] });
        }
        api.post('/search/history', { q }).catch(() => {});
        fetchInitialData();
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.campus, fetchInitialData]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!query) return;
    const delayDebounce = setTimeout(() => {
      handleSearch(query, activeTab);
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [query, activeTab, handleSearch]);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'users', label: 'People' },
    { id: 'posts', label: 'Posts' },
    { id: 'groups', label: 'Groups' },
    { id: 'marketplace', label: 'Market' },
    { id: 'clubs', label: 'Clubs' },
  ];

  return (
    <div className="bg-white min-h-screen">
      <Navbar />
      
      {/* 🏙️ FACEBOOK STYLE DISCOVERY hub 🏙️ */}
      <div className="lg:ml-[80px] xl:ml-[80px] bg-white min-h-screen">
        
        {/* TOP SEARCH HEADER */}
        <header className="sticky top-0 z-[1000] bg-white/95 backdrop-blur-md px-4 py-3 md:py-4 border-b border-slate-100">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full shrink-0 transition-colors">
                  <ChevronLeft size={24} className="text-[#111]" strokeWidth={2.5} />
              </button>
              
              <div className="flex-1 bg-[#F0F2F5] rounded-full h-[48px] relative flex items-center" ref={searchRef}>
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6e6e6e] z-10 pointer-events-none">
                      <SearchIcon size={20} strokeWidth={2.5} />
                  </div>
                  <input 
                      type="text" 
                      placeholder="Search Sparkle"
                      className="w-full h-full bg-transparent border-none outline-none focus:ring-0 text-[16px] font-medium text-[#111] transition-all placeholder:text-[#6e6e6e] leading-none text-center"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                      <button onClick={() => { setQuery(''); setResults({}); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[#6e6e6e] hover:text-[#111] z-10">
                          <X size={18} strokeWidth={3} />
                      </button>
                  )}
              </div>
          </div>
        </header>

        {/* CONTENT FLOW */}
        <main className="max-w-2xl mx-auto w-full px-4 md:px-6 py-6 pb-40">
            
            {!query.trim() ? (
                <div className="space-y-10">
                    
                    {/* RECENT SECTION */}
                    <section>
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-[17px] font-bold text-[#111]">Recent</h2>
                            <button onClick={() => navigate('/search/history')} className="text-[14px] font-bold text-blue-600 hover:opacity-70">See all</button>
                        </div>
                        
                        <div className="divide-y divide-slate-50">
                            {/* Previous Search Queries */}
                            {Array.isArray(history) && history.slice(0, 5).map((h, i) => (
                                <div key={`hist-${h.id || i}`} className="group flex items-center gap-4 py-3.5 px-2 hover:bg-slate-50 rounded-xl transition-all">
                                    <div className="flex-1 flex items-center gap-4 cursor-pointer" onClick={() => setQuery(h.query)}>
                                        <div className="w-[40px] h-[40px] rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                            <Clock size={20} />
                                        </div>
                                        <span className="text-[15px] font-semibold text-slate-800">{h.query}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActionItem({ ...h, type: 'history' }); }}
                                        className="p-2 hover:bg-white rounded-full transition-all text-slate-300 hover:text-slate-900"
                                    >
                                        <MoreHorizontal size={20} />
                                    </button>
                                </div>
                            ))}

                            {/* Recent People */}
                            {Array.isArray(discovery.creators) && discovery.creators.slice(0, 3).map((u, i) => (
                                <div key={`user-${u.user_id || i}`} className="group flex items-center gap-4 py-3.5 px-2 hover:bg-slate-50 rounded-xl transition-all">
                                    <div className="flex-1 flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/profile/${u.username}`)}>
                                        <img src={u.avatar_url || '/uploads/avatars/default.png'} className="w-[44px] h-[44px] rounded-full object-cover shadow-sm" alt="" />
                                        <div className="min-w-0">
                                            <div className="text-[15px] font-bold text-slate-900 truncate leading-tight">{u.name}</div>
                                            <div className="text-[12px] text-slate-400 font-medium truncate">@{u.username}</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActionItem({ ...u, type: 'user' }); }}
                                        className="p-2 hover:bg-white rounded-full transition-all text-slate-300 hover:text-slate-900"
                                    >
                                        <MoreHorizontal size={20} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* TRENDING SECTION */}
                    <section>
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-[17px] font-bold text-[#111]">Trending Now</h2>
                            <RotateCw size={14} className="text-slate-300 cursor-pointer hover:rotate-180 transition-transform duration-500" onClick={fetchInitialData} />
                        </div>
                        <div className="space-y-1">
                            {Array.isArray(trending) && trending.map((tag, i) => (
                                <div key={`tag-${i}`} onClick={() => setQuery(tag.name.replace('#', ''))} className="flex items-center gap-4 py-3.5 px-2 hover:bg-slate-50 rounded-xl cursor-pointer group transition-all">
                                    <div className="w-[36px] h-[36px] rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                        <Hash size={18} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1">
                                        <span className="block text-[15px] font-bold text-slate-800">{tag.name}</span>
                                        <span className="text-[12px] font-medium text-slate-400 tracking-tight">{tag.count} sparks</span>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-200" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* COMMUNITIES SECTION */}
                    <section>
                        <div className="px-2 mb-6 pt-4 border-t border-slate-50">
                            <h2 className="text-[17px] font-bold text-[#111]">Suggested Communities</h2>
                            <p className="text-[12px] font-medium text-slate-400 mt-0.5 uppercase tracking-widest font-black">Community Discovery</p>
                        </div>
                        <div className="space-y-4">
                            {Array.isArray(discovery.groups) && discovery.groups.map((g, i) => (
                                <div key={`g-${g.id || i}`} className="flex items-center gap-5 py-4 px-2 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer group" onClick={() => navigate(`/groups/${g.id}`)}>
                                    <img src={g.image || '/uploads/avatars/default.png'} className="w-[52px] h-[52px] rounded-xl object-cover shadow-sm" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <span className="block text-[16px] font-bold text-slate-900 truncate">{g.title}</span>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">{g.subtitle || 'Community'}</span>
                                            <span className="text-[11px] font-medium text-slate-400">{g.member_count || 0} Members</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="text-slate-200" />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            ) : (
                /* RESULTS VIEW */
                <div className="animate-fade-in">
                    <div className="flex items-center gap-6 mb-10 overflow-x-auto no-scrollbar border-b border-slate-100 sticky top-[72px] md:top-[80px] bg-white z-50 px-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-2 py-5 text-[14px] font-bold uppercase tracking-widest transition-all whitespace-nowrap relative ${
                                    activeTab === tab.id 
                                    ? 'text-[#111]' 
                                    : 'text-slate-400 hover:text-[#111]'
                                }`}
                            >
                                {tab.label}
                                {activeTab === tab.id && (
                                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#111] rounded-t-full" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-12">
                        {Object.entries(results).map(([type, items]: [string, any], i) => (
                            <section key={`res-sec-${type}-${i}`}>
                                <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-6 px-4">{type}</h3>
                                <div className="space-y-6">
                                    {type === 'users' && Array.isArray(items) && items.map((u, j) => (
                                        <div key={`res-u-${u.user_id || j}`} className="hover:bg-slate-50 transition-all rounded-2xl p-2 group relative">
                                            <UserCard u={u} />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setActionItem({ ...u, type: 'user' }); }}
                                                    className="p-2 hover:bg-white rounded-full opacity-0 group-hover:opacity-100 transition-all text-slate-400 shadow-sm"
                                                >
                                                    <MoreHorizontal size={22} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {type === 'posts' && Array.isArray(items) && items.map((p, j) => (
                                        <div key={`res-p-${p.post_id || j}`} className="mb-10">
                                            <PostCard key={p.post_id} post={p} onRefresh={() => {}} />
                                        </div>
                                    ))}
                                    {(type === 'groups' || type === 'clubs') && Array.isArray(items) && items.map((g, j) => (
                                        <div key={`res-g-${g.id || j}`} onClick={() => navigate(`/${type}/${g.id}`)} className="flex items-center gap-6 py-4 px-4 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer group">
                                            <img src={g.image || '/uploads/avatars/default.png'} className="w-[60px] h-[60px] rounded-xl object-cover shadow-sm" alt="" />
                                            <div className="flex-1">
                                                <div className="text-[17px] font-bold text-[#111] leading-tight mb-1">{g.title}</div>
                                                <div className="text-[11px] text-blue-600 font-bold uppercase tracking-widest">{g.subtitle || 'Community'}</div>
                                            </div>
                                            <ChevronRight size={20} className="text-slate-200" />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            )}
        </main>
      </div>

      {/* 🚀 BIG ACTION MODAL (Black Edition) 🚀 */}
      <AnimatePresence>
        {actionItem && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionItem(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-[5000] flex items-end sm:items-center justify-center p-0 sm:p-4"
            />
            
            {/* Modal Card */}
            <motion.div 
              initial={{ y: "100%", scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: "100%", scale: 0.95 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              className="fixed bottom-0 sm:bottom-auto sm:relative bg-white w-full sm:max-w-[400px] rounded-t-[40px] sm:rounded-[40px] shadow-2xl z-[5001] overflow-hidden"
            >
              {/* Header / Grabber for Mobile */}
              <div className="h-1.5 w-16 bg-slate-200 rounded-full mx-auto mt-4 mb-2 sm:hidden" />
              
              <div className="p-10">
                {/* Item Info */}
                <div className="flex flex-col items-center mb-10 text-center">
                    {actionItem.type === 'user' ? (
                        <>
                            <div className="relative mb-6">
                                <img src={actionItem.avatar_url || '/uploads/avatars/default.png'} className="w-24 h-24 rounded-[32px] object-cover ring-8 ring-slate-50" alt="" />
                                <div className="absolute -bottom-2 -right-2 bg-black p-2 rounded-2xl text-white shadow-xl">
                                    <User size={20} strokeWidth={2.5} />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">{actionItem.name}</h3>
                            <p className="text-slate-400 font-bold text-[13px] tracking-[0.1em] uppercase mt-2">@{actionItem.username}</p>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-300 mb-6">
                                <Clock size={40} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 leading-tight">Search History</h3>
                            <p className="text-slate-400 font-bold text-[13px] tracking-wide mt-2 italic">"{actionItem.query}"</p>
                        </>
                    )}
                </div>

                {/* Big Action Buttons */}
                <div className="grid grid-cols-1 gap-4">
                    {actionItem.type === 'user' ? (
                        <>
                            <button 
                                onClick={() => { navigate(`/messages?u=${actionItem.username}`); setActionItem(null); }}
                                className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100 rounded-[24px] group transition-all"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="p-3.5 bg-white border-2 border-black rounded-2xl shadow-xl shadow-slate-100 group-hover:scale-110 group-hover:rotate-6 transition-all">
                                        <MessengerIcon />
                                    </div>
                                    <span className="text-[18px] font-black text-slate-800 tracking-tight">Message</span>
                                </div>
                                <ChevronRight size={22} className="text-slate-300 group-hover:text-black transition-colors" />
                            </button>

                            <button 
                                onClick={() => handlePoke(actionItem.user_id || actionItem.id, actionItem.name)}
                                disabled={poking}
                                className="w-full flex items-center justify-between p-6 bg-slate-50/50 hover:bg-slate-100/50 rounded-[24px] group transition-all disabled:opacity-50"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="p-3.5 bg-white border-2 border-black rounded-2xl shadow-xl shadow-slate-50 group-hover:scale-110 group-hover:-rotate-6 transition-all flex items-center justify-center">
                                        <PointingFingerIcon />
                                    </div>
                                    <span className="text-[18px] font-black text-slate-800 tracking-tight">
                                        {poking ? 'Sending Poke...' : 'Send Poke'}
                                    </span>
                                </div>
                                <ChevronRight size={22} className="text-slate-200 group-hover:text-black transition-colors" />
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => deleteHistoryItem(actionItem.id)}
                            className="w-full flex items-center justify-between p-6 bg-rose-50 hover:bg-rose-100 rounded-[24px] group transition-all"
                        >
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-rose-500 rounded-2xl text-white shadow-xl shadow-rose-200 group-hover:scale-110 group-hover:rotate-6 transition-all">
                                    <Trash2 size={28} strokeWidth={2.5} />
                                </div>
                                <span className="text-[18px] font-black text-rose-600 tracking-tight">Delete Query</span>
                            </div>
                            <ChevronRight size={22} className="text-rose-300 group-hover:text-rose-600 transition-colors" />
                        </button>
                    )}
                </div>

                {/* Cancel Button */}
                <button 
                    onClick={() => setActionItem(null)}
                    className="w-full mt-8 py-5 text-[15px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-900 transition-colors"
                >
                    Dismiss
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
