import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search as SearchIcon, X, Clock, MoreHorizontal,
  ChevronRight, Hash, Trash2, 
  RotateCw, User, Zap, Users, Sparkles, Send, ArrowLeft, Hand
} from 'lucide-react';
import api from '../api/api';
import Navbar from '../components/Navbar';
import UserCard from '../components/UserCard';
import PostCard from '../components/PostCard';
import { useUserStore } from '../store/userStore';

type TabType = 'all' | 'users' | 'posts' | 'groups' | 'marketplace' | 'clubs';

interface SearchResult {
  id?: string;
  user_id?: string;
  post_id?: string;
  username?: string;
  name?: string;
  title?: string;
  content?: string;
  avatar_url?: string;
  image?: string;
  subtitle?: string;
  type?: string;
  label?: string;
  value?: string;
  member_count?: number;
  spark_count?: number;
  comment_count?: number;
  has_story?: boolean;
  updates: string[];
}

export default function Search() {
  const navigate = useNavigate();
  const { user: currentUser } = useUserStore();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [results, setResults] = useState<Record<string, SearchResult[]>>({});
  const [history, setHistory] = useState<SearchResult[]>([]);
  const [trending, setTrending] = useState<{ name: string; count: number }[]>([]);
  const [discovery, setDiscovery] = useState<{ creators: SearchResult[], groups: SearchResult[], historyUpdates: SearchResult[] }>({ 
    creators: [], groups: [], historyUpdates: [] 
  });
  const [loading, setLoading] = useState(false);
  const [actionItem, setActionItem] = useState<SearchResult | null>(null);
  const [poking, setPoking] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const fetchInitialData = useCallback(async () => {
    try {
      const [historyRes, trendingRes, discoveryRes] = await Promise.allSettled([
        api.get('/search/history'),
        api.get('/search/trending'),
        api.get('/search/discovery')
      ]);
      
      if (historyRes.status === 'fulfilled' && historyRes.value.data.status === 'success') {
          setHistory(historyRes.value.data.data || []);
      }
      if (trendingRes.status === 'fulfilled' && trendingRes.value.data.status === 'success') {
          setTrending(trendingRes.value.data.data || []);
      }
      
      if (discoveryRes.status === 'fulfilled' && discoveryRes.value.data.status === 'success') {
          setDiscovery(discoveryRes.value.data.data);
      }
    } catch (err) {
      console.error('Discovery fetch error:', err);
    }
  }, []);

  const handlePoke = async (userId: string, name: string) => {
    if (poking) return;
    setPoking(true);
    try {
        await api.post(`/users/${userId}/poke`);
        showToast(`You poked ${name}! 👋`);
        setActionItem(null);
    } catch (err) {
        console.error('Poke failed:', err);
        showToast('Failed to send poke.', 'error');
    } finally {
        setPoking(false);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
        await api.delete(`/search/history/${id}`);
        setHistory(prev => prev.filter(item => item.id !== id));
        setActionItem(null);
        showToast('Query removed.');
    } catch (err) {
        console.error('Delete history failed:', err);
        showToast('Failed to remove query.', 'error');
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
            setResults({ [type]: response.data.data.results?.[type] || [] });
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.campus]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (query.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
    }
    const delay = setTimeout(async () => {
        try {
            const res = await api.get('/search/suggestions', { params: { q: query } });
            if (res.data.status === 'success') {
                setSuggestions(res.data.data || []);
                setShowSuggestions(true);
            }
        } catch (err) { console.error('Suggestions error:', err); }
    }, 200);
    return () => clearTimeout(delay);
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
        setResults({});
        return;
    }
    const delayDebounce = setTimeout(() => {
      handleSearch(query, activeTab);
      setShowSuggestions(false);
    }, 450); 
    return () => clearTimeout(delayDebounce);
  }, [query, activeTab, handleSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && query.trim()) {
          api.post('/search/history', { q: query.trim() }).catch(() => {});
          fetchInitialData();
      }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'users', label: 'People' },
    { id: 'posts', label: 'Posts' },
    { id: 'groups', label: 'Groups' },
    { id: 'marketplace', label: 'Market' },
    { id: 'clubs', label: 'Clubs' },
  ];

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />
      
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-red-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 flex flex-col relative z-10">
        
        {/* Search Header */}
        <header className="sticky top-0 z-[100] bg-white/60 backdrop-blur-3xl border-b border-white p-6 lg:p-8">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-3 bg-white border border-black/5 rounded-2xl text-black/40 hover:text-primary transition-all shadow-sm">
                  <ArrowLeft size={20} strokeWidth={3} />
              </button>
              
              <div className="flex-1 relative" ref={searchRef}>
                  <SearchIcon size={18} strokeWidth={3} className="absolute left-6 top-1/2 -translate-y-1/2 text-black/20" />
                  <input 
                      type="text" 
                      placeholder="Search the village..."
                      className="w-full h-14 bg-white/80 border border-white rounded-[20px] pl-16 pr-12 text-base font-bold text-black placeholder:text-black/10 focus:bg-white focus:border-primary transition-all outline-none shadow-sm italic"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                  />
                  {query && (
                      <button onClick={() => { setQuery(''); setResults({}); setSuggestions([]); setShowSuggestions(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/5 rounded-xl text-black/20 hover:text-black transition-all">
                          <X size={14} strokeWidth={4} />
                      </button>
                  )}

                  {/* Suggestions */}
                  <AnimatePresence>
                      {showSuggestions && suggestions.length > 0 && (
                          <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute top-full left-0 right-0 mt-4 bg-white/95 backdrop-blur-3xl border border-white rounded-[32px] shadow-2xl p-4 z-[200] overflow-hidden"
                          >
                              {suggestions.map((s, i) => (
                                  <div 
                                      key={`sug-${i}`} 
                                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-black/5 cursor-pointer transition-all group"
                                      onClick={() => {
                                          setQuery(s.value);
                                          setShowSuggestions(false);
                                          handleSearch(s.value, activeTab);
                                      }}
                                  >
                                      {s.image ? (
                                          <img src={s.image} className="w-10 h-10 rounded-xl object-cover shadow-sm" alt="" />
                                      ) : (
                                          <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-black/20 group-hover:text-primary transition-colors">
                                              {s.type === 'hashtag' ? <Hash size={18} strokeWidth={3} /> : <SearchIcon size={18} strokeWidth={3} />}
                                          </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                          <span className="block text-sm font-bold text-black truncate italic">{s.label}</span>
                                          <span className="block text-[10px] font-bold text-black/20 uppercase tracking-widest">{s.type}</span>
                                      </div>
                                  </div>
                              ))}
                          </motion.div>
                      )}
                  </AnimatePresence>
              </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto w-full p-6 lg:p-12 pb-40 animate-fade-in">
            
            {!query.trim() ? (
                <div className="space-y-10">
                    
                    {/* Recent Updates */}
                    {discovery.historyUpdates && discovery.historyUpdates.length > 0 && (
                      <section className="bg-white/80 backdrop-blur-3xl rounded-[40px] border border-white/65 p-8 shadow-xl shadow-primary/5">
                          <div className="flex items-center gap-3 mb-8 px-2">
                              <Zap size={20} className="text-primary fill-primary" />
                              <h2 className="text-2xl font-black text-black italic">Village Pulse</h2>
                          </div>
                          
                          <div className="flex gap-6 overflow-x-auto no-scrollbar pb-2">
                              {discovery.historyUpdates.map((u, i) => (
                                   <div 
                                       key={`upd-${u.user_id || i}`} 
                                       className="flex flex-col items-center gap-3 min-w-[100px] cursor-pointer group relative"
                                   >
                                       <div className="relative" onClick={() => navigate(`/profile/${u.username}`)}>
                                           <img src={u.avatar_url || '/uploads/avatars/default.png'} className={`w-20 h-20 rounded-[28px] object-cover border-2 shadow-lg transition-all group-hover:scale-105 ${u.has_story ? 'border-primary ring-4 ring-primary/10' : 'border-white'}`} alt="" />
                                           {u.updates.length > 0 && (
                                               <div className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg">
                                                   {u.updates.length}
                                               </div>
                                           )}
                                       </div>
                                       
                                       <button 
                                          onClick={(e) => { e.stopPropagation(); setActionItem({ ...u, type: 'user' }); }}
                                          className="absolute top-1 right-1 p-2 bg-white/90 backdrop-blur-sm rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10 hover:bg-primary hover:text-white"
                                       >
                                          <MoreHorizontal size={14} strokeWidth={3} />
                                       </button>

                                       <div className="text-center" onClick={() => navigate(`/profile/${u.username}`)}>
                                           <span className="block text-sm font-black text-black truncate w-24 leading-none italic">{u.name.split(' ')[0]}</span>
                                           <span className="block text-[9px] font-bold text-primary uppercase tracking-widest mt-1.5 opacity-60">
                                               {u.updates[0] || 'View Link'}
                                           </span>
                                       </div>
                                   </div>
                              ))}
                          </div>
                      </section>
                    )}

                    {/* Recent Search history */}
                    <section className="bg-white/80 backdrop-blur-3xl rounded-[40px] border border-white/65 p-8 shadow-xl shadow-primary/5">
                        <div className="flex items-center justify-between mb-8 px-2">
                            <div className="flex items-center gap-3">
                                <Clock size={20} className="text-black/20" strokeWidth={3} />
                                <h2 className="text-2xl font-black text-black italic">Recent Signals</h2>
                            </div>
                            <button onClick={() => navigate('/search/history')} className="text-[11px] font-bold text-primary uppercase tracking-widest hover:underline">View All</button>
                        </div>
                        
                        <div className="space-y-2">
                            {Array.isArray(history) && history.slice(0, 5).map((h, i) => (
                                <div key={`hist-${h.id || i}`} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-black/5 cursor-pointer transition-all group" onClick={() => setQuery(h.query)}>
                                    <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-black/20 group-hover:text-primary transition-colors">
                                        <Clock size={18} strokeWidth={3} />
                                    </div>
                                    <span className="flex-1 text-base font-bold text-black italic">{h.query}</span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActionItem({ ...h, type: 'history' }); }}
                                        className="p-2 text-black/5 hover:text-black transition-all"
                                    >
                                        <MoreHorizontal size={20} strokeWidth={3} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Trending */}
                    <section className="bg-white/80 backdrop-blur-3xl rounded-[40px] border border-white/65 p-8 shadow-xl shadow-primary/5">
                        <div className="flex items-center justify-between mb-8 px-2">
                            <div className="flex items-center gap-3">
                                <Hash size={20} className="text-primary" strokeWidth={3} />
                                <h2 className="text-2xl font-black text-black italic">Channel Trends</h2>
                            </div>
                            <RotateCw size={18} strokeWidth={3} className="text-black/10 cursor-pointer hover:text-primary transition-all hover:rotate-180" onClick={fetchInitialData} />
                        </div>
                        <div className="space-y-2">
                            {Array.isArray(trending) && trending.map((tag, i) => (
                                <div key={`tag-${i}`} onClick={() => setQuery(tag.name.replace('#', ''))} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/5 cursor-pointer transition-all group">
                                    <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                                        <Hash size={18} strokeWidth={3} />
                                    </div>
                                    <div className="flex-1">
                                        <span className="block text-base font-black text-black italic leading-none">{tag.name}</span>
                                        <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest mt-1.5 inline-block">{tag.count} sparks in orbit</span>
                                    </div>
                                    <ChevronRight size={20} className="text-black/5 group-hover:text-primary transition-all group-hover:translate-x-1" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Communities */}
                    <section className="bg-white/80 backdrop-blur-3xl rounded-[40px] border border-white/65 p-8 shadow-xl shadow-primary/5">
                        <div className="flex items-center gap-3 mb-8 px-2">
                            <Users size={20} className="text-indigo-500" strokeWidth={3} />
                            <h2 className="text-2xl font-black text-black italic">Suggested Tribes</h2>
                        </div>
                        <div className="grid gap-4">
                            {Array.isArray(discovery.groups) && discovery.groups.map((g, i) => (
                                <div key={`g-${g.id || i}`} className="flex items-center gap-6 p-4 rounded-3xl hover:bg-black/5 transition-all cursor-pointer group" onClick={() => navigate(`/groups/${g.id}`)}>
                                    <img src={g.image || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-2xl object-cover border border-white shadow-md group-hover:scale-105 transition-all" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <span className="block text-lg font-black text-black truncate italic leading-none">{g.title}</span>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{g.subtitle || 'Community'}</span>
                                            <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest">{g.member_count || 0} Members</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className="text-black/5 group-hover:text-primary transition-all group-hover:translate-x-1" />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            ) : (
                /* Results View */
                <div className="animate-fade-in space-y-10">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap italic border ${activeTab === tab.id ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white/40 border-white text-black/30 hover:bg-white'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-12">
                        {loading && (
                            <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden mb-8">
                                <motion.div 
                                    initial={{ x: "-100%" }}
                                    animate={{ x: "100%" }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="h-full w-1/3 bg-primary rounded-full shadow-sm shadow-primary/20"
                                />
                            </div>
                        )}
                        {Object.entries(results).map(([type, items]: [string, SearchResult[]], i) => (
                            <section key={`res-sec-${type}-${i}`} className="space-y-6">
                                <div className="flex items-center gap-3 px-2">
                                   <div className="w-1 h-6 bg-primary rounded-full" />
                                   <h3 className="text-xl font-black text-black italic uppercase tracking-tight">{type}</h3>
                                </div>
                                
                                <div className="grid gap-5">
                                    {type === 'users' && Array.isArray(items) && items.map((u, j) => (
                                        <UserCard key={`res-u-${u.user_id || u.id || j}`} u={u} />
                                    ))}
                                    {type === 'posts' && Array.isArray(items) && items.map((p, j) => (
                                        <PostCard key={`res-p-${p.post_id || p.id || j}`} post={p} />
                                    ))}
                                    {(type === 'groups' || type === 'clubs') && Array.isArray(items) && items.map((g, j) => (
                                        <div key={`res-g-${g.id || j}`} onClick={() => navigate(`/${type}/${g.id}`)} className="flex items-center gap-6 p-6 bg-white/80 backdrop-blur-3xl border border-white/65 rounded-[32px] shadow-xl shadow-primary/5 hover:scale-[1.01] transition-all cursor-pointer group">
                                            <img src={g.image || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-2xl object-cover border border-white shadow-md group-hover:scale-105 transition-all" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xl font-black text-black leading-none mb-2 italic truncate">{g.title}</div>
                                                <div className="text-[11px] text-primary font-bold uppercase tracking-widest">{g.subtitle || 'Community'}</div>
                                            </div>
                                            <ChevronRight size={20} className="text-black/5 group-hover:text-primary transition-all group-hover:translate-x-1" />
                                        </div>
                                    ))}
                                    {type === 'marketplace' && Array.isArray(items) && items.map((item, j) => (
                                        <div key={`res-m-${item.id || j}`} onClick={() => navigate(`/marketplace/listings/${item.id}`)} className="flex items-center gap-6 p-6 bg-white/80 backdrop-blur-3xl border border-white/65 rounded-[32px] shadow-xl shadow-primary/5 hover:scale-[1.01] transition-all cursor-pointer group">
                                            <img src={item.image || '/uploads/avatars/default.png'} className="w-20 h-20 rounded-2xl object-cover border border-white shadow-md group-hover:scale-105 transition-all" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xl font-black text-black leading-none mb-3 italic truncate">{item.title}</div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-lg font-black text-primary tracking-tighter">KSh {item.subtitle}</span>
                                                    <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest">Village Marketplace</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="text-black/5 group-hover:text-primary transition-all group-hover:translate-x-1" />
                                        </div>
                                    ))}
                                    {Array.isArray(items) && items.length === 0 && (
                                        <div className="text-center py-12 bg-white/40 border border-white/60 rounded-[32px] shadow-inner">
                                           <p className="text-[11px] font-bold text-black/10 uppercase tracking-widest italic">No signals found in this frequency.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </main>

      {/* Action Modal */}
      <AnimatePresence>
        {actionItem && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionItem(null)}
              className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm bg-white/95 backdrop-blur-3xl rounded-[48px] border border-white shadow-2xl z-[1001] p-10 overflow-hidden"
            >
                <div className="flex flex-col items-center mb-10 text-center">
                    {actionItem.type === 'user' ? (
                        <>
                            <div className="relative mb-6">
                                <img src={actionItem.avatar_url || '/uploads/avatars/default.png'} className="w-24 h-24 rounded-[32px] object-cover border-4 border-white shadow-xl" alt="" />
                                <div className="absolute -bottom-2 -right-2 bg-primary p-2.5 rounded-2xl text-white shadow-lg border-2 border-white">
                                    <Sparkles size={18} strokeWidth={3} />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-black tracking-tight italic uppercase leading-none">{actionItem.name}</h3>
                            <p className="text-black/20 font-bold text-[11px] uppercase tracking-widest mt-2">@{actionItem.username}</p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-[24px] bg-black/5 flex items-center justify-center text-black/10 mb-6 shadow-inner">
                                <Clock size={32} strokeWidth={3} />
                            </div>
                            <h3 className="text-2xl font-black text-black tracking-tight italic uppercase">Signal Memory</h3>
                            <p className="text-primary font-bold text-[13px] mt-2 italic px-4">"{actionItem.query}"</p>
                        </>
                    )}
                </div>

                <div className="space-y-3">
                    {actionItem.type === 'user' ? (
                        <>
                            <button 
                                onClick={() => { navigate(`/messages?chat=${actionItem.user_id || actionItem.id}`); setActionItem(null); }}
                                className="w-full flex items-center justify-between p-5 bg-black/5 hover:bg-primary hover:text-white rounded-[24px] transition-all group active:scale-95 shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <Send size={18} strokeWidth={3} className="text-primary group-hover:text-white" />
                                    <span className="font-bold text-sm uppercase tracking-wider italic">Transmit Message</span>
                                </div>
                                <ChevronRight size={18} className="text-black/10 group-hover:text-white/40" />
                            </button>

                            <button 
                                onClick={() => handlePoke(actionItem.user_id || actionItem.id, actionItem.name)}
                                disabled={poking}
                                className="w-full flex items-center justify-between p-5 bg-black/5 hover:bg-primary hover:text-white rounded-[24px] transition-all group active:scale-95 shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <Hand size={18} strokeWidth={3} className="text-primary group-hover:text-white" />
                                    <span className="font-bold text-sm uppercase tracking-wider italic">
                                        {poking ? 'Poking...' : 'Send Poke'}
                                    </span>
                                </div>
                                <ChevronRight size={18} className="text-black/10 group-hover:text-white/40" />
                            </button>

                            <button 
                                onClick={() => { navigate(`/profile/${actionItem.username}`); setActionItem(null); }}
                                className="w-full flex items-center justify-between p-5 bg-black/5 hover:bg-black hover:text-white rounded-[24px] transition-all group active:scale-95 shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <User size={18} strokeWidth={3} className="text-primary group-hover:text-white" />
                                    <span className="font-bold text-sm uppercase tracking-wider italic">View Connection</span>
                                </div>
                                <ChevronRight size={18} className="text-black/10 group-hover:text-white/40" />
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => deleteHistoryItem(actionItem.id)}
                            className="w-full flex items-center justify-between p-5 bg-red-50 hover:bg-red-500 hover:text-white rounded-[24px] transition-all group active:scale-95 shadow-sm border border-red-100"
                        >
                            <div className="flex items-center gap-4">
                                <Trash2 size={18} strokeWidth={3} className="text-red-500 group-hover:text-white" />
                                <span className="font-bold text-sm uppercase tracking-wider italic">Erase Query</span>
                            </div>
                            <ChevronRight size={18} className="text-red-200 group-hover:text-white/40" />
                        </button>
                    )}
                </div>

                <button onClick={() => setActionItem(null)} className="w-full mt-6 py-4 text-[11px] font-bold text-black/20 hover:text-black uppercase tracking-widest transition-all">
                    Dismiss
                </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
            {toast && (
                <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className={`fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-8 py-4 rounded-2xl shadow-2xl z-[9999] font-bold text-sm ${toast.type === 'success' ? 'bg-black text-white' : 'bg-red-500 text-white'}`}
                >
                    {toast.type === 'success' ? <Sparkles size={18} className="text-primary" strokeWidth={3} /> : <X size={18} strokeWidth={3} />}
                    {toast.message}
                </motion.div>
            )}
        </AnimatePresence>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
