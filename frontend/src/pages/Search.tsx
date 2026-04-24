import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search as SearchIcon, X, Clock, MoreHorizontal,
  ChevronRight, Hash, Trash2, 
  RotateCw, User, Zap, Sparkles, Send, ArrowLeft, Hand,
  TrendingUp, Compass
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
      const [historyRes, trendingRes] = await Promise.allSettled([
        api.get('/search/history'),
        api.get('/search/trending')
      ]);
      
      if (historyRes.status === 'fulfilled' && historyRes.value.data.status === 'success') {
          setHistory(historyRes.value.data.data || []);
      }
      if (trendingRes.status === 'fulfilled' && trendingRes.value.data.status === 'success') {
          setTrending(trendingRes.value.data.data || []);
      }
    } catch (err) {
      console.error('Initial fetch error:', err);
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
        showToast('Memory cleared.');
    } catch (err) {
        console.error('Delete history failed:', err);
        showToast('Failed to clear memory.', 'error');
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
    <div className="flex bg-white min-h-screen text-black font-sans overflow-x-hidden selection:bg-primary/10">
      <Navbar />
      
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vw] bg-primary/[0.03] rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[40vw] h-[40vw] bg-indigo-500/[0.02] rounded-full blur-[100px]" />
      </div>

      <main className="flex-1 lg:ml-72 flex flex-col relative z-10">
        
        {/* Sleek Search Header */}
        <header className="sticky top-0 z-[100] bg-white/70 backdrop-blur-3xl border-b border-black/[0.03] px-6 py-8">
          <div className="max-w-3xl mx-auto flex items-center gap-6">
              <button 
                onClick={() => navigate(-1)} 
                className="w-12 h-12 flex items-center justify-center bg-black/5 hover:bg-black hover:text-white rounded-2xl transition-all active:scale-95 group shadow-sm"
              >
                  <ArrowLeft size={18} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>
              
              <div className="flex-1 relative" ref={searchRef}>
                  <SearchIcon size={20} strokeWidth={3} className={`absolute left-6 top-1/2 -translate-y-1/2 transition-all duration-500 ${query ? 'text-primary scale-110' : 'text-black/10'}`} />
                  <input 
                      type="text" 
                      placeholder="Scan the frequency..."
                      className="w-full h-18 bg-black/[0.03] border border-transparent rounded-[24px] px-12 text-center text-sm font-black italic text-black placeholder:text-black/20 focus:bg-white focus:border-black/5 focus:shadow-2xl focus:shadow-black/5 transition-all outline-none"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                  />
                  {query && (
                      <button 
                        onClick={() => { setQuery(''); setResults({}); setSuggestions([]); setShowSuggestions(false); }} 
                        className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/5 rounded-2xl text-black/40 hover:text-black hover:bg-black/10 transition-all"
                      >
                          <X size={18} strokeWidth={3} />
                      </button>
                  )}

                  {/* Glassmorphic Suggestions */}
                  <AnimatePresence>
                      {showSuggestions && suggestions.length > 0 && (
                          <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.98 }}
                              className="absolute top-full left-0 right-0 mt-4 bg-white/95 backdrop-blur-3xl border border-black/5 rounded-3xl shadow-2xl p-3 z-[200] overflow-hidden"
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
                                      <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-black/20 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                          {s.type === 'hashtag' ? <Hash size={18} strokeWidth={2.5} /> : <SearchIcon size={18} strokeWidth={2.5} />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <span className="block text-sm font-bold text-black truncate">{s.label}</span>
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

        <div className="max-w-3xl mx-auto w-full p-6 lg:p-12 pb-40">
            
            {!query.trim() ? (
                <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    
                    {/* Discovery Grid */}
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Trending */}
                        <section>
                            <div className="flex items-center gap-3 mb-6 px-2">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <TrendingUp size={20} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-xl font-black text-black uppercase tracking-tight italic">Trending</h2>
                            </div>
                            <div className="space-y-2">
                                {Array.isArray(trending) && trending.length > 0 ? trending.map((tag, i) => (
                                    <motion.div 
                                      key={`tag-${i}`} 
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.05 }}
                                      onClick={() => setQuery(tag.name.replace('#', ''))} 
                                      className="flex items-center justify-between p-4 rounded-2xl hover:bg-black/[0.03] cursor-pointer transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-black text-black/20 group-hover:text-primary transition-colors italic">0{i + 1}</span>
                                            <span className="text-base font-bold text-black italic">{tag.name}</span>
                                        </div>
                                        <span className="text-[10px] font-black text-black/10 uppercase tracking-widest group-hover:text-black/40">{tag.count} Sparks</span>
                                    </motion.div>
                                )) : (
                                    <p className="text-sm font-bold text-black/10 italic px-4">Nothing trending yet...</p>
                                )}
                            </div>
                        </section>

                        {/* Recent History */}
                        <section>
                            <div className="flex items-center justify-between mb-6 px-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center text-black/20">
                                        <Clock size={20} strokeWidth={2.5} />
                                    </div>
                                    <h2 className="text-xl font-black text-black uppercase tracking-tight italic">Recent</h2>
                                </div>
                                <button onClick={() => navigate('/search/history')} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline opacity-60">History</button>
                            </div>
                            
                            <div className="space-y-2">
                                {Array.isArray(history) && history.length > 0 ? history.slice(0, 5).map((h, i) => (
                                    <motion.div 
                                      key={`hist-${h.id || i}`} 
                                      initial={{ opacity: 0, x: 10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.05 }}
                                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-black/[0.03] cursor-pointer transition-all group" 
                                      onClick={() => setQuery(h.query)}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <span className="block text-base font-bold text-black italic truncate">{h.query}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActionItem({ ...h, type: 'history' }); }}
                                            className="w-8 h-8 flex items-center justify-center text-black/10 hover:text-black hover:bg-black/5 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <MoreHorizontal size={16} strokeWidth={3} />
                                        </button>
                                    </motion.div>
                                )) : (
                                    <p className="text-sm font-bold text-black/10 italic px-4">Your search memory is empty.</p>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Explore Teaser */}
                    <section className="relative overflow-hidden bg-black text-white rounded-[40px] p-10 group cursor-pointer" onClick={() => navigate('/explore')}>
                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                                <Compass size={24} className="text-primary" />
                            </div>
                            <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-none mb-4">Discover the Village</h3>
                            <p className="text-white/40 font-bold text-sm leading-relaxed max-w-sm">Explore trending communities, local markets, and hidden sparks near you.</p>
                        </div>
                        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/20 to-transparent group-hover:scale-110 transition-transform duration-700" />
                        <Sparkles size={120} className="absolute -bottom-10 -right-10 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                    </section>
                </div>
            ) : (
                /* Sleek Results View */
                <div className="animate-in fade-in duration-500 space-y-12">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 sticky top-[108px] z-50 bg-white/80 backdrop-blur-xl py-4 -mx-4 px-4 border-b border-black/[0.03]">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap italic border-2 ${activeTab === tab.id ? 'bg-black border-black text-white shadow-xl shadow-black/10' : 'bg-transparent border-transparent text-black/30 hover:text-black hover:bg-black/5'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-16">
                        {loading && (
                            <div className="h-1 w-full bg-black/[0.03] rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ x: "-100%" }}
                                    animate={{ x: "100%" }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                    className="h-full w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent"
                                />
                            </div>
                        )}
                        
                        {Object.entries(results).map(([type, items]: [string, SearchResult[]], i) => (
                            <section key={`res-sec-${type}-${i}`} className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                                <div className="flex items-center gap-4">
                                   <h3 className="text-xs font-black text-black italic uppercase tracking-[0.2em] opacity-20">{type}</h3>
                                   <div className="flex-1 h-[1px] bg-black/[0.05]" />
                                </div>
                                
                                <div className="grid gap-6">
                                    {type === 'users' && Array.isArray(items) && items.map((u, j) => (
                                        <div key={`res-u-${u.user_id || u.id || j}`} className="hover:scale-[1.02] transition-transform duration-500">
                                            <UserCard u={u} />
                                        </div>
                                    ))}
                                    {type === 'posts' && Array.isArray(items) && items.map((p, j) => (
                                        <PostCard key={`res-p-${p.post_id || p.id || j}`} post={p} />
                                    ))}
                                    {(type === 'groups' || type === 'clubs') && Array.isArray(items) && items.map((g, j) => (
                                        <div 
                                          key={`res-g-${g.id || j}`} 
                                          onClick={() => navigate(`/${type}/${g.id}`)} 
                                          className="flex items-center gap-6 p-6 bg-black/[0.02] hover:bg-black text-black hover:text-white rounded-[32px] transition-all cursor-pointer group active:scale-[0.98] duration-500"
                                        >
                                            <img src={g.image || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-2xl object-cover border border-white/10 shadow-lg group-hover:scale-105 transition-all" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xl font-black leading-none mb-2 italic truncate">{g.title}</div>
                                                <div className="text-[10px] font-black uppercase tracking-widest opacity-40 group-hover:text-primary transition-colors">{g.subtitle || 'Community'}</div>
                                            </div>
                                            <ChevronRight size={20} className="opacity-10 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                                        </div>
                                    ))}
                                    {type === 'marketplace' && Array.isArray(items) && items.map((item, j) => (
                                        <div 
                                          key={`res-m-${item.id || j}`} 
                                          onClick={() => navigate(`/marketplace/listings/${item.id}`)} 
                                          className="flex items-center gap-6 p-6 bg-black/[0.02] hover:bg-black text-black hover:text-white rounded-[32px] transition-all cursor-pointer group active:scale-[0.98] duration-500"
                                        >
                                            <img src={item.image || '/uploads/avatars/default.png'} className="w-20 h-20 rounded-2xl object-cover border border-white/10 shadow-lg group-hover:scale-105 transition-all" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xl font-black leading-none mb-3 italic truncate">{item.title}</div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-lg font-black text-primary tracking-tighter group-hover:text-white transition-colors">KSh {item.subtitle}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-20">Marketplace</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="opacity-10 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                                        </div>
                                    ))}
                                    {Array.isArray(items) && items.length === 0 && (
                                        <div className="text-center py-16 bg-black/[0.01] rounded-[32px] border border-dashed border-black/5">
                                           <p className="text-[10px] font-black text-black/10 uppercase tracking-widest italic">Signal lost in the frequency.</p>
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

      {/* Modern Action Sheet */}
      <AnimatePresence>
        {actionItem && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionItem(null)}
              className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[1001] bg-white rounded-t-[48px] p-10 max-w-2xl mx-auto shadow-2xl"
            >
                <div className="w-12 h-1.5 bg-black/5 rounded-full mx-auto mb-10" />
                
                <div className="flex flex-col items-center mb-12 text-center">
                    {actionItem.type === 'user' ? (
                        <>
                            <div className="relative mb-6">
                                <img src={actionItem.avatar_url || '/uploads/avatars/default.png'} className="w-24 h-24 rounded-[32px] object-cover border-4 border-white shadow-2xl" alt="" />
                                <div className="absolute -bottom-2 -right-2 bg-primary p-2.5 rounded-2xl text-white shadow-xl">
                                    <Sparkles size={18} strokeWidth={3} />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-black italic uppercase leading-none">{actionItem.name}</h3>
                            <p className="text-black/20 font-bold text-[11px] uppercase tracking-widest mt-3">@{actionItem.username}</p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-[24px] bg-black/5 flex items-center justify-center text-black/10 mb-6">
                                <Clock size={32} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-2xl font-black text-black italic uppercase">Signal Memory</h3>
                            <p className="text-primary font-bold text-base mt-3 italic px-4">"{actionItem.query}"</p>
                        </>
                    )}
                </div>

                <div className="grid gap-3">
                    {actionItem.type === 'user' ? (
                        <>
                            <button 
                                onClick={() => { navigate(`/messages?chat=${actionItem.user_id || actionItem.id}`); setActionItem(null); }}
                                className="flex items-center justify-between p-6 bg-black/[0.03] hover:bg-black hover:text-white rounded-[24px] transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <Send size={18} strokeWidth={2.5} className="text-primary group-hover:text-white" />
                                    <span className="font-black text-xs uppercase tracking-widest italic">Transmit Message</span>
                                </div>
                                <ChevronRight size={18} className="opacity-10 group-hover:opacity-40" />
                            </button>

                            <button 
                                onClick={() => handlePoke(actionItem.user_id || actionItem.id, actionItem.name)}
                                disabled={poking}
                                className="flex items-center justify-between p-6 bg-black/[0.03] hover:bg-black hover:text-white rounded-[24px] transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <Hand size={18} strokeWidth={2.5} className="text-primary group-hover:text-white" />
                                    <span className="font-black text-xs uppercase tracking-widest italic">
                                        {poking ? 'TRANSMITTING...' : 'SEND POKE'}
                                    </span>
                                </div>
                                <ChevronRight size={18} className="opacity-10 group-hover:opacity-40" />
                            </button>

                            <button 
                                onClick={() => { navigate(`/profile/${actionItem.username}`); setActionItem(null); }}
                                className="flex items-center justify-between p-6 bg-black/[0.03] hover:bg-black hover:text-white rounded-[24px] transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <User size={18} strokeWidth={2.5} className="text-primary group-hover:text-white" />
                                    <span className="font-black text-xs uppercase tracking-widest italic">View Identity</span>
                                </div>
                                <ChevronRight size={18} className="opacity-10 group-hover:opacity-40" />
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => deleteHistoryItem(actionItem.id)}
                            className="flex items-center justify-between p-6 bg-red-50 hover:bg-red-500 hover:text-white rounded-[24px] transition-all group active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-4">
                                <Trash2 size={18} strokeWidth={2.5} className="text-red-500 group-hover:text-white" />
                                <span className="font-black text-xs uppercase tracking-widest italic">Erase Frequency</span>
                            </div>
                            <ChevronRight size={18} className="opacity-20 group-hover:opacity-40" />
                        </button>
                    )}
                </div>

                <button onClick={() => setActionItem(null)} className="w-full mt-10 py-4 text-[10px] font-black text-black/20 hover:text-black uppercase tracking-[0.3em] transition-all">
                    Dismiss
                </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Minimal Toast */}
      <AnimatePresence>
          {toast && (
              <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 px-8 py-4 rounded-2xl shadow-2xl z-[9999] font-black text-[10px] uppercase tracking-widest ${toast.type === 'success' ? 'bg-black text-white' : 'bg-red-500 text-white'}`}
              >
                  {toast.type === 'success' ? <Sparkles size={16} className="text-primary" strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                  {toast.message}
              </motion.div>
          )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
