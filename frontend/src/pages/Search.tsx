import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import debounce from 'lodash.debounce';

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
        showToast('Search deleted.');
    } catch (err) {
        console.error('Delete history failed:', err);
        showToast('Failed to delete.', 'error');
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

  const debouncedSearch = useMemo(
    () => debounce((q: string, type: TabType) => {
        handleSearch(q, type);
    }, 450),
    [handleSearch]
  );

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!query.trim()) {
        setResults({});
        return;
    }
    debouncedSearch(query, activeTab);
  }, [query, activeTab, debouncedSearch]);

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
    <div className="block lg:flex bg-white dark:bg-black min-h-screen text-black dark:text-white font-sans overflow-x-hidden selection:bg-primary/10">
      <Navbar />
      
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vw] bg-primary/[0.03] rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[40vw] h-[40vw] bg-indigo-500/[0.02] rounded-full blur-[100px]" />
      </div>

      <main className="flex-1 lg:ml-72 flex flex-col relative z-10">
        
        {/* Sleek Search Header */}
        <header className="sticky top-0 z-[100] bg-white/95 dark:bg-black/95 backdrop-blur-3xl border-b border-black/5 dark:border-white/10 px-4 py-4 md:py-6">
          <div className="max-w-3xl mx-auto flex items-center gap-4">
                <button 
                  onClick={() => navigate(-1)} 
                  className="w-10 h-10 shrink-0 flex items-center justify-center bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/10 text-gray-900 dark:text-white hover:text-primary hover:border-primary/20 rounded-xl transition-all active:scale-95 group shadow-sm"
                >
                  <ArrowLeft size={18} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>
              
              <div className="flex-1 relative" ref={searchRef}>
                  <SearchIcon size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-500 ${query ? 'text-primary' : 'text-gray-300'}`} />
                  <input 
                      type="text" 
                      placeholder="Search Sparkle..."
                      className="sparkle-input pl-12 h-12 md:h-14 !rounded-2xl"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                  />
                  {query && (
                      <button 
                        onClick={() => { setQuery(''); setResults({}); }} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-all"
                      >
                          <X size={14} strokeWidth={3} />
                      </button>
                  )}
              </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto w-full px-4 md:px-12 py-6 md:py-12 pb-40">
            
            {!query.trim() ? (
                <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    
                    {/* Discovery Grid */}
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Trending */}
                        <section>
                            <div className="flex items-center gap-3 mb-6 px-2">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <TrendingUp size={20} />
                                </div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Trending</h2>
                            </div>
                            <div className="space-y-1">
                                {Array.isArray(trending) && trending.length > 0 ? trending.map((tag, i) => (
                                    <motion.div 
                                      key={`tag-${i}`} 
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.05 }}
                                      onClick={() => setQuery(tag.name.replace('#', ''))} 
                                      className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-transparent hover:border-black/5 dark:hover:border-white/10 hover:shadow-sm cursor-pointer transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-black text-gray-300 group-hover:text-primary transition-colors italic">0{i + 1}</span>
                                            <span className="text-base font-bold text-gray-900 italic">{tag.name}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tag.count} Sparks</span>
                                    </motion.div>
                                )) : (
                                    <p className="text-sm font-bold text-gray-300 italic px-4">Nothing trending yet...</p>
                                )}
                            </div>
                        </section>

                        {/* Recent History */}
                        <section>
                            <div className="flex items-center justify-between mb-6 px-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                                        <Clock size={20} />
                                    </div>
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Recent</h2>
                                </div>
                                <button onClick={() => navigate('/search/history')} className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline opacity-80">Full History</button>
                            </div>
                            
                            <div className="space-y-1">
                                {Array.isArray(history) && history.length > 0 ? history.slice(0, 5).map((h, i) => (
                                    <motion.div 
                                      key={`hist-${h.id || i}`} 
                                      initial={{ opacity: 0, x: 10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: i * 0.05 }}
                                      className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-white/5 border border-transparent hover:border-black/5 dark:hover:border-white/10 hover:shadow-sm cursor-pointer transition-all group" 
                                      onClick={() => setQuery(h.query)}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <span className="block text-base font-bold text-gray-900 italic truncate">{h.query}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActionItem({ ...h, type: 'history' }); }}
                                            className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-primary hover:bg-primary/5 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <MoreHorizontal size={16} strokeWidth={3} />
                                        </button>
                                    </motion.div>
                                )) : (
                                    <p className="text-sm font-bold text-gray-300 italic px-4">Your history is clear.</p>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Explore Teaser */}
                    <section className="relative overflow-hidden bg-gray-900 text-white rounded-[32px] p-8 md:p-12 group cursor-pointer shadow-xl" onClick={() => navigate('/explore')}>
                        <div className="relative z-10 max-w-md">
                            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-primary/20">
                                <Compass size={24} className="text-white" />
                            </div>
                            <h3 className="text-3xl md:text-4xl font-black italic tracking-tight uppercase leading-none mb-4">Discover More</h3>
                            <p className="text-gray-400 font-medium text-sm leading-relaxed">
                                Explore trending groups, active marketplaces, and popular moments from across the Sparkle community.
                            </p>
                        </div>
                        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent group-hover:scale-110 transition-transform duration-700" />
                        <Sparkles size={120} className="absolute -bottom-10 -right-10 text-white/[0.03] rotate-12 group-hover:scale-110 transition-transform duration-700" />
                    </section>
                </div>
            ) : (
                <div className="animate-in fade-in duration-500 space-y-8 md:space-y-12">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 sticky top-[81px] md:top-[105px] z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl py-4 -mx-4 px-4 border-b border-black/[0.03] dark:border-white/[0.03]">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all whitespace-nowrap border ${activeTab === tab.id ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-primary/30 hover:text-primary'}`}
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
                            <section key={`res-sec-${type}-${i}`} className="space-y-6 animate-fade-in">
                                <div className="flex items-center gap-4">
                                   <h3 className="text-[10px] font-black text-gray-400 dark:text-white/40 italic uppercase tracking-widest">{type}</h3>
                                   <div className="flex-1 h-[1px] bg-gray-200/50" />
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
                                    {(type === 'groups' || type === 'clubs' || type === 'hashtags') && Array.isArray(items) && items.map((g, j) => (
                                        <div 
                                          key={`res-g-${g.id || j}`} 
                                          onClick={() => navigate(type === 'hashtags' ? `/hashtag/${g.title?.replace('#', '')}` : `/${type}/${g.id}`)} 
                                          className="flex items-center gap-4 p-5 bg-white dark:bg-black border border-black/5 dark:border-white/10 hover:border-primary/20 rounded-2xl transition-all cursor-pointer group active:scale-[0.98] duration-300 shadow-sm"
                                        >
                                            {type === 'hashtags' ? (
                                                <div className="w-14 h-14 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 shrink-0 transition-all">
                                                    <Hash size={24} className="text-primary" />
                                                </div>
                                            ) : (
                                                <img src={g.image || '/uploads/avatars/default.png'} className="w-14 h-14 rounded-xl object-cover border border-gray-100 group-hover:scale-105 transition-all shrink-0" alt="" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-lg font-bold text-gray-900 leading-none mb-1 italic uppercase tracking-tight truncate">{g.title}</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-primary transition-colors">
                                                    {type === 'hashtags' ? 'Hashtag' : g.subtitle || 'Community'}
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                                        </div>
                                    ))}
                                    {type === 'marketplace' && Array.isArray(items) && items.map((item, j) => (
                                        <div 
                                          key={`res-m-${item.id || j}`} 
                                          onClick={() => navigate(`/marketplace/listings/${item.id}`)} 
                                          className="flex items-center gap-4 p-5 bg-white dark:bg-black border border-black/5 dark:border-white/10 hover:border-primary/20 rounded-2xl transition-all cursor-pointer group active:scale-[0.98] duration-300 shadow-sm"
                                        >
                                            <img src={item.image || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-xl object-cover border border-gray-100 group-hover:scale-105 transition-all shrink-0" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-lg font-bold text-gray-900 leading-none mb-2 italic uppercase tracking-tight truncate">{item.title}</div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg font-black text-primary tracking-tighter">KSh {item.subtitle}</span>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Market</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                                        </div>
                                    ))}
                                    {Array.isArray(items) && items.length === 0 && (
                                        <div className="text-center py-8 md:py-16 bg-black/[0.01] rounded-[24px] md:rounded-[32px] border border-dashed border-black/5 px-6 mx-2">
                                            <p className="text-[10px] md:text-xs font-black text-black/20 uppercase tracking-widest italic leading-relaxed">No results found matching your search.</p>
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
                             <h3 className="text-2xl font-black text-black dark:text-white italic uppercase">Search History</h3>
                            <p className="text-primary font-bold text-base mt-3 italic px-4">"{actionItem.query}"</p>
                        </>
                    )}
                </div>

                <div className="grid gap-3">
                    {actionItem.type === 'user' ? (
                        <>
                            <button 
                                onClick={() => { navigate(`/messages?chat=${actionItem.user_id || actionItem.id}`); setActionItem(null); }}
                                className="flex items-center justify-between p-6 bg-black/[0.03] dark:bg-white/5 hover:bg-black dark:hover:bg-white/10 hover:text-white rounded-[24px] transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <Send size={18} strokeWidth={2.5} className="text-primary group-hover:text-white" />
                                     <span className="font-black text-xs uppercase tracking-widest italic">Send a message</span>
                                </div>
                                <ChevronRight size={18} className="opacity-10 group-hover:opacity-40" />
                            </button>

                            <button 
                                onClick={() => handlePoke(actionItem.user_id || actionItem.id, actionItem.name)}
                                disabled={poking}
                                className="flex items-center justify-between p-6 bg-black/[0.03] dark:bg-white/5 hover:bg-black dark:hover:bg-white/10 hover:text-white rounded-[24px] transition-all group active:scale-[0.98]"
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
                                className="flex items-center justify-between p-6 bg-black/[0.03] dark:bg-white/5 hover:bg-black dark:hover:bg-white/10 hover:text-white rounded-[24px] transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <User size={18} strokeWidth={2.5} className="text-primary group-hover:text-white" />
                                    <span className="font-black text-xs uppercase tracking-widest italic">View Profile</span>
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
                                 <span className="font-black text-xs uppercase tracking-widest italic">Delete from history</span>
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
