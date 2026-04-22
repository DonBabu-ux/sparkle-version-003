import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search as SearchIcon, X, Clock, MoreHorizontal,
  ChevronRight, Hash, ChevronLeft, Trash2, 
  RotateCw, User, Zap, Users
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
  const [discovery, setDiscovery] = useState<{ creators: any[], groups: any[], historyUpdates: any[] }>({ 
    creators: [], groups: [], historyUpdates: [] 
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionItem, setActionItem] = useState<any | null>(null);
  const [poking, setPoking] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const fetchInitialData = useCallback(async () => {
    setInitialLoading(true);
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
      } else {
          // Frontend Fallback if discovery fails or is empty
          setDiscovery(prev => ({
              ...prev,
              historyUpdates: [{
                  user_id: 'mock-1',
                  username: 'sparkle_team',
                  name: 'Sparkle Team',
                  avatar_url: '/uploads/avatars/default.png',
                  has_story: 1,
                  updates: ['Welcome to Sparkle!', 'Discovery Active']
              }]
          }));
      }
    } catch (err) {
      console.error('Discovery fetch error:', err);
    } finally {
      setInitialLoading(false);
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
        showToast('Failed to send poke. Try again later.', 'error');
    } finally {
        setPoking(false);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
        await api.delete(`/search/history/${id}`);
        setHistory(prev => prev.filter(item => item.id !== id));
        setActionItem(null);
        showToast('Search query removed.');
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

  // --- SUGGESTIONS DEBOUNCING ---
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

  // --- SEARCH DEBOUNCING ---
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

  // Handle explicit submission (Enter key) to save history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && query.trim()) {
          api.post('/search/history', { q: query.trim() }).catch(() => {});
          fetchInitialData(); // Refresh history UI
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
    <div className="search-root">
      <Navbar />
      
      <div className="search-main">
        
        {/* TOP SEARCH HEADER */}
        <header className="s-header">
          <div className="s-header-inner">
              <button onClick={() => navigate(-1)} className="s-back-btn">
                  <ChevronLeft size={22} strokeWidth={2.5} />
              </button>
              
              <div className="s-searchbar" ref={searchRef}>
                  <SearchIcon size={18} strokeWidth={2.5} className="s-searchbar-icon" />
                  <input 
                      type="text" 
                      placeholder="Search Sparkle"
                      className="s-searchbar-input"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                  />
                  {query && (
                      <button onClick={() => { setQuery(''); setResults({}); setSuggestions([]); setShowSuggestions(false); }} className="s-clear-btn">
                          <X size={16} strokeWidth={3} />
                      </button>
                  )}

                  {/* 💡 SUGGESTIONS DROPDOWN 💡 */}
                  <AnimatePresence>
                      {showSuggestions && suggestions.length > 0 && (
                          <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="s-suggestions-box"
                          >
                              {suggestions.map((s, i) => (
                                  <div 
                                      key={`sug-${i}`} 
                                      className="s-suggestion-item"
                                      onClick={() => {
                                          setQuery(s.value);
                                          setShowSuggestions(false);
                                          handleSearch(s.value, activeTab);
                                      }}
                                  >
                                      {s.image ? (
                                          <img src={s.image} className="s-suggestion-img" alt="" />
                                      ) : (
                                          <div className="s-suggestion-icon">
                                              {s.type === 'hashtag' ? <Hash size={14} /> : <SearchIcon size={14} />}
                                          </div>
                                      )}
                                      <div className="flex-1">
                                          <span className="s-suggestion-label">{s.label}</span>
                                          <span className="s-suggestion-type">{s.type}</span>
                                      </div>
                                  </div>
                              ))}
                          </motion.div>
                      )}
                  </AnimatePresence>
              </div>
          </div>
        </header>

        <main className="s-content">
            
            {!query.trim() ? (
                <div className="s-sections">
                    
                    {/* 🔥 RECENT UPDATES SECTION 🔥 */}
                    {discovery.historyUpdates && discovery.historyUpdates.length > 0 && (
                      <section className="s-card">
                          <div className="s-card-header">
                              <Zap size={18} className="text-amber-500 fill-amber-500" />
                              <h2>Recent Updates</h2>
                          </div>
                          
                          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                              {discovery.historyUpdates.map((u, i) => (
                                   <div 
                                       key={`upd-${u.user_id || i}`} 
                                       className="flex flex-col items-center gap-2 min-w-[100px] cursor-pointer group relative"
                                   >
                                       <div className="relative" onClick={() => navigate(`/profile/${u.username}`)}>
                                           <img src={u.avatar_url || '/uploads/avatars/default.png'} className={`w-16 h-16 rounded-[24px] object-cover ring-2 ring-white shadow-md transition-transform group-hover:scale-105 ${u.has_story ? 'ring-offset-2 ring-blue-500' : ''}`} alt="" />
                                           {u.updates.length > 0 && (
                                               <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm">
                                                   {u.updates.length}
                                               </div>
                                           )}
                                       </div>
                                       
                                       <button 
                                          onClick={(e) => { e.stopPropagation(); setActionItem({ ...u, type: 'user' }); }}
                                          className="absolute top-0 right-0 p-1.5 bg-white/90 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10 hover:bg-white"
                                       >
                                          <MoreHorizontal size={14} className="text-slate-900" />
                                       </button>

                                       <div className="text-center" onClick={() => navigate(`/profile/${u.username}`)}>
                                           <span className="block text-[13px] font-bold text-slate-800 truncate w-20 leading-tight">{u.name.split(' ')[0]}</span>
                                           <span className="block text-[10px] font-black text-blue-600 uppercase tracking-tighter mt-0.5">
                                               {u.updates[0] || 'View Profile'}
                                           </span>
                                       </div>
                                   </div>
                              ))}
                          </div>
                      </section>
                    )}

                    {/* RECENT SEARCHES */}
                    <section className="s-card">
                        <div className="s-card-header">
                            <Clock size={18} className="text-slate-400" />
                            <h2>Recent Searches</h2>
                            <button onClick={() => navigate('/search/history')} className="s-see-all">See all</button>
                        </div>
                        
                        <div className="space-y-1">
                            {Array.isArray(history) && history.slice(0, 5).map((h, i) => (
                                <div key={`hist-${h.id || i}`} className="s-hist-item" onClick={() => setQuery(h.query)}>
                                    <div className="s-hist-icon">
                                        <Clock size={18} strokeWidth={2.5} />
                                    </div>
                                    <span className="s-hist-text">{h.query}</span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActionItem({ ...h, type: 'history' }); }}
                                        className="s-hist-more"
                                    >
                                        <MoreHorizontal size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* TRENDING SECTION */}
                    <section className="s-card">
                        <div className="s-card-header">
                            <Hash size={18} className="text-[#FF3D6D]" />
                            <h2>Trending Now</h2>
                            <RotateCw size={14} className="s-refresh-btn" onClick={fetchInitialData} />
                        </div>
                        <div className="space-y-1">
                            {Array.isArray(trending) && trending.map((tag, i) => (
                                <div key={`tag-${i}`} onClick={() => setQuery(tag.name.replace('#', ''))} className="s-trend-item">
                                    <div className="s-trend-icon">
                                        <Hash size={18} strokeWidth={2.5} />
                                    </div>
                                    <div className="s-trend-text">
                                        <span className="s-trend-name">{tag.name}</span>
                                        <span className="s-trend-count">{tag.count} sparks</span>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-200" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* COMMUNITIES SECTION */}
                    <section className="s-card">
                        <div className="s-card-header">
                            <Users size={18} className="text-indigo-500" />
                            <h2>Suggested Communities</h2>
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
                    <div className="s-tabbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`s-tab ${activeTab === tab.id ? 'active' : ''}`}
                            >
                                {tab.label}
                                {activeTab === tab.id && (
                                    <motion.div layoutId="tab-underline" className="s-tab-line" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="s-results">
                        {loading && (
                            <motion.div 
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                style={{ height: '3px', background: 'linear-gradient(90deg, #FF3D6D, #FF8E53)', transformOrigin: 'left', borderRadius: '2px', marginBottom: '16px' }}
                            />
                        )}
                        {Object.entries(results).map(([type, items]: [string, any], i) => (
                            <section key={`res-sec-${type}-${i}`} className="s-result-section">
                                <h3 className="s-result-label">{type}</h3>
                                <div className="space-y-4">
                                    {type === 'users' && Array.isArray(items) && items.map((u, j) => (
                                        <UserCard key={`res-u-${u.user_id || u.id || j}`} u={u} />
                                    ))}
                                    {type === 'posts' && Array.isArray(items) && items.map((p, j) => (
                                        <PostCard key={`res-p-${p.post_id || p.id || j}`} post={p} />
                                    ))}
                                    {(type === 'groups' || type === 'clubs') && Array.isArray(items) && items.map((g, j) => (
                                        <div key={`res-g-${g.id || j}`} onClick={() => navigate(`/${type}/${g.id}`)} className="flex items-center gap-5 py-3 px-3 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer">
                                            <img src={g.image || '/uploads/avatars/default.png'} className="w-14 h-14 rounded-xl object-cover shadow-sm" alt="" />
                                            <div className="flex-1">
                                                <div className="text-[15px] font-bold text-[#1e293b] leading-tight mb-1">{g.title}</div>
                                                <div className="text-[11px] text-[#FF3D6D] font-bold uppercase tracking-widest">{g.subtitle || 'Community'}</div>
                                            </div>
                                            <ChevronRight size={18} className="text-slate-200" />
                                        </div>
                                    ))}
                                    {type === 'marketplace' && Array.isArray(items) && items.map((item, j) => (
                                        <div key={`res-m-${item.id || j}`} onClick={() => navigate(`/marketplace/listings/${item.id}`)} className="flex items-center gap-5 py-3 px-3 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer">
                                            <img src={item.image || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-xl object-cover shadow-md" alt="" />
                                            <div className="flex-1">
                                                <div className="text-[16px] font-bold text-[#1e293b] leading-tight mb-1">{item.title}</div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[14px] font-black text-emerald-600">{item.subtitle}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marketplace</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-slate-200" />
                                        </div>
                                    ))}
                                    {Array.isArray(items) && items.length === 0 && (
                                        <div className="text-center py-8 text-slate-400 text-sm font-medium">No {type} found</div>
                                    )}
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
              className="s-modal-backdrop"
            />
            
            {/* Modal Card */}
            <motion.div 
              initial={{ y: "100%", scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: "100%", scale: 0.95 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              className="s-modal-card"
            >
              <div className="h-1.5 w-16 bg-slate-200 rounded-full mx-auto mt-4 mb-2 sm:hidden" />
              
              <div className="p-10">
                <div className="flex flex-col items-center mb-8 text-center">
                    {actionItem.type === 'user' ? (
                        <>
                            <div className="relative mb-5">
                                <img src={actionItem.avatar_url || '/uploads/avatars/default.png'} className="w-20 h-20 rounded-[28px] object-cover ring-4 ring-slate-50 shadow-lg" alt="" />
                                <div className="absolute -bottom-1 -right-1 bg-[#FF3D6D] p-1.5 rounded-xl text-white shadow-lg">
                                    <User size={16} strokeWidth={3} />
                                </div>
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">{actionItem.name}</h3>
                            <p className="text-slate-400 font-bold text-[12px] tracking-[0.05em] uppercase mt-1">@{actionItem.username}</p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-[24px] bg-slate-50 flex items-center justify-center text-slate-300 mb-5 shadow-inner">
                                <Clock size={32} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Search History</h3>
                            <p className="text-slate-400 font-bold text-[13px] mt-1 italic">"{actionItem.query}"</p>
                        </>
                    )}
                </div>

                <div className="space-y-1">
                    {actionItem.type === 'user' ? (
                        <>
                            <button 
                                onClick={() => { navigate(`/messages?u=${actionItem.username}`); setActionItem(null); }}
                                className="s-modal-btn"
                            >
                                <div className="s-modal-btn-inner">
                                    <div className="s-modal-btn-icon">
                                        <MessengerIcon />
                                    </div>
                                    <span className="s-modal-btn-text">Message</span>
                                </div>
                                <ChevronRight size={18} className="text-slate-300" />
                            </button>

                            <button 
                                onClick={() => handlePoke(actionItem.user_id || actionItem.id, actionItem.name)}
                                disabled={poking}
                                className="s-modal-btn"
                            >
                                <div className="s-modal-btn-inner">
                                    <div className="s-modal-btn-icon">
                                        <PointingFingerIcon />
                                    </div>
                                    <span className="s-modal-btn-text">
                                        {poking ? 'Sending Poke...' : 'Send Poke'}
                                    </span>
                                </div>
                                <ChevronRight size={18} className="text-slate-300" />
                            </button>

                            <button 
                                onClick={() => navigate(`/profile/${actionItem.username}`)}
                                className="s-modal-btn"
                            >
                                <div className="s-modal-btn-inner">
                                    <div className="s-modal-btn-icon">
                                        <User size={18} strokeWidth={2.5} />
                                    </div>
                                    <span className="s-modal-btn-text">View Profile</span>
                                </div>
                                <ChevronRight size={18} className="text-slate-300" />
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => deleteHistoryItem(actionItem.id)}
                            className="s-modal-btn"
                            style={{ background: 'rgba(255,61,109,0.04)' }}
                        >
                            <div className="s-modal-btn-inner">
                                <div className="s-modal-btn-icon" style={{ color: '#FF3D6D' }}>
                                    <Trash2 size={20} strokeWidth={2.5} />
                                </div>
                                <span className="s-modal-btn-text" style={{ color: '#FF3D6D' }}>Delete Query</span>
                            </div>
                            <ChevronRight size={18} className="text-[#FF3D6D]/40" />
                        </button>
                    )}
                </div>

                <button onClick={() => setActionItem(null)} className="s-modal-dismiss">
                    Dismiss
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

        {/* 🍞 TOAST NOTIFICATION 🍞 */}
        <AnimatePresence>
            {toast && (
                <motion.div 
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className={`s-toast ${toast.type}`}
                >
                    {toast.type === 'success' ? <Zap size={18} className="text-emerald-400" /> : <X size={18} className="text-rose-400" />}
                    {toast.message}
                </motion.div>
            )}
        </AnimatePresence>

      <style>{`
        .search-root { display:flex; min-height:100vh; background:#f7f8fc; font-family:'Outfit','Inter',system-ui,sans-serif; }
        .search-main { flex:1; min-width:0; display:flex; flex-direction:column; }

        .s-header { position:sticky; top:0; z-index:500; background:rgba(247,248,252,0.92); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border-bottom:1px solid rgba(0,0,0,0.06); padding:16px 40px; }
        .s-header-inner { max-width:680px; margin:0 auto; display:flex; align-items:center; gap:12px; }
        .s-back-btn { width:40px; height:40px; border-radius:12px; border:1.5px solid #e8eaf0; background:#fff; color:#64748b; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:all 0.2s; }
        .s-back-btn:hover { background:#FF3D6D; border-color:#FF3D6D; color:#fff; }

        .s-searchbar { flex:1; display:flex; align-items:center; gap:10px; background:#fff; border:1.5px solid #e8eaf0; border-radius:18px; padding:0 18px; height:52px; transition:border-color 0.2s, box-shadow 0.2s; }
        .s-searchbar:focus-within { border-color:#FF3D6D; box-shadow:0 0 0 4px rgba(255,61,109,0.08); }
        .s-searchbar-icon { color:#94a3b8; flex-shrink:0; transition:color 0.2s; }
        .s-searchbar:focus-within .s-searchbar-icon { color:#FF3D6D; }
        .s-searchbar-input { flex:1; border:none; background:transparent; font-size:15px; font-weight:600; color:#1e293b; outline:none; font-family:inherit; }
        .s-searchbar-input::placeholder { color:#94a3b8; font-weight:500; }
        .s-clear-btn { width:32px; height:32px; border-radius:10px; border:none; background:#f1f5f9; color:#94a3b8; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; flex-shrink:0; }
        .s-clear-btn:hover { background:#FF3D6D; color:#fff; }

        .s-content { max-width:680px; margin:0 auto; width:100%; padding:28px 40px 100px; }
        .s-sections { display:flex; flex-direction:column; gap:20px; }

        .s-card { background:#fff; border-radius:24px; padding:24px; border:1px solid #edf0f7; box-shadow:0 2px 12px rgba(0,0,0,0.03); transition:box-shadow 0.3s; }
        .s-card:hover { box-shadow:0 8px 24px rgba(0,0,0,0.06); }
        .s-card-header { display:flex; align-items:center; gap:10px; margin-bottom:20px; }
        .s-card-header h2 { flex:1; font-size:16px; font-weight:800; color:#1e293b; margin:0; letter-spacing:-0.3px; }
        .s-see-all { font-size:13px; font-weight:700; color:#FF3D6D; background:none; border:none; cursor:pointer; padding:4px 8px; border-radius:8px; transition:background 0.2s; }
        .s-see-all:hover { background:rgba(255,61,109,0.06); }
        .s-refresh-btn { color:#94a3b8; cursor:pointer; transition:all 0.5s; }
        .s-refresh-btn:hover { color:#FF3D6D; transform:rotate(180deg); }

        .no-scrollbar::-webkit-scrollbar { display:none; }
        .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
        @keyframes sfadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .animate-fade-in { animation:sfadeIn 0.4s ease-out forwards; }
        .s-tabbar { display:flex; gap:0; overflow-x:auto; scrollbar-width:none; background:#fff; border-radius:18px; border:1px solid #edf0f7; margin-bottom:24px; padding:0 4px; box-shadow:0 2px 8px rgba(0,0,0,0.03); }
        .s-tabbar::-webkit-scrollbar { display:none; }
        .s-tab { display:flex; align-items:center; gap:6px; padding:14px 18px; font-size:13px; font-weight:800; letter-spacing:0.5px; text-transform:uppercase; color:#94a3b8; background:none; border:none; border-bottom:3px solid transparent; cursor:pointer; white-space:nowrap; font-family:inherit; transition:color 0.2s; position:relative; }
        .s-tab:hover { color:#475569; }
        .s-tab.active { color:#FF3D6D; }
        .s-tab-line { position:absolute; bottom:0; left:0; right:0; height:3px; background:#FF3D6D; border-radius:3px 3px 0 0; }

        .s-results { display:flex; flex-direction:column; gap:20px; }
        .s-result-section { background:#fff; border-radius:20px; padding:20px; border:1px solid #edf0f7; }
        .s-result-label { font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:1.2px; margin-bottom:16px; padding-left:4px; }

        .s-modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(8px); z-index:5000; display:flex; align-items:flex-end; justify-content:center; }
        .s-modal-card { position:fixed; bottom:0; background:#fff; width:100%; max-width:420px; border-radius:32px 32px 0 0; box-shadow:0 -20px 60px rgba(0,0,0,0.15); z-index:5001; overflow:hidden; }
        @media (min-width:640px) { .s-modal-card { bottom:auto; border-radius:32px; position:relative; } .s-modal-backdrop { align-items:center; padding:24px; } }

        .s-modal-btn { width:100%; display:flex; align-items:center; justify-content:space-between; padding:18px 24px; background:#f8fafc; border-radius:24px; border:1.5px solid transparent; transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1); cursor:pointer; margin-bottom:12px; }
        .s-modal-btn:hover { background:#fff; border-color:#FF3D6D; transform:translateY(-2px); box-shadow:0 12px 30px rgba(255,61,109,0.12); }
        .s-modal-btn:hover .s-modal-btn-icon { background:#FF3D6D; color:#fff; border-color:#FF3D6D; transform:scale(1.1) rotate(5deg); }
        .s-modal-btn-inner { display:flex; align-items:center; gap:16px; }
        .s-modal-btn-icon { width:46px; height:46px; border-radius:14px; background:#fff; border:1.5px solid #edf2f7; display:flex; align-items:center; justify-content:center; color:#64748b; transition:all 0.3s; box-shadow:0 4px 12px rgba(0,0,0,0.03); }
        .s-modal-btn-text { font-size:16px; font-weight:800; color:#1e293b; letter-spacing:-0.2px; }
        .s-modal-dismiss { width:100%; margin-top:16px; padding:16px; font-size:13px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; background:none; border:none; cursor:pointer; transition:color 0.2s; }
        .s-modal-dismiss:hover { color:#FF3D6D; }

        .s-hist-item { display:flex; align-items:center; gap:14px; padding:12px; border-radius:16px; transition:all 0.2s; cursor:pointer; }
        .s-hist-item:hover { background:#f1f5f9; }
        .s-hist-icon { width:40px; height:40px; border-radius:12px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:#94a3b8; }
        .s-hist-item:hover .s-hist-icon { background:#fff; color:#FF3D6D; }
        .s-hist-text { flex:1; font-size:15px; font-weight:600; color:#334155; }
        .s-hist-more { color:#cbd5e1; padding:8px; border-radius:10px; transition:all 0.2s; }
        .s-hist-more:hover { background:#fff; color:#1e293b; }

        .s-trend-item { display:flex; align-items:center; gap:14px; padding:12px; border-radius:16px; transition:all 0.2s; cursor:pointer; }
        .s-trend-item:hover { background:#fff5f7; }
        .s-trend-icon { width:40px; height:40px; border-radius:12px; background:#fff5f7; display:flex; align-items:center; justify-content:center; color:#FF3D6D; }
        .s-trend-text { flex:1; }
        .s-trend-name { display:block; font-size:15px; font-weight:800; color:#1e293b; letter-spacing:-0.2px; }
        .s-trend-count { font-size:12px; font-weight:600; color:#94a3b8; }

        .s-suggestion-type { font-size:10px; font-weight:800; color:#FF3D6D; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8; }

        .s-suggestions-box { position:absolute; top:calc(100% + 10px); left:0; right:0; background:#fff; border-radius:20px; border:1px solid #edf0f7; box-shadow:0 15px 40px rgba(0,0,0,0.1); padding:8px; z-index:1000; overflow:hidden; }
        .s-suggestion-item { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:14px; cursor:pointer; transition:all 0.2s; }
        .s-suggestion-item:hover { background:#f8fafc; }
        .s-suggestion-img { width:32px; height:32px; border-radius:10px; object-cover:cover; background:#f1f5f9; }
        .s-suggestion-icon { width:32px; height:32px; border-radius:10px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:#94a3b8; }
        .s-suggestion-label { display:block; font-size:14px; font-weight:700; color:#1e293b; line-height:1.2; }
        .s-suggestion-type { font-size:10px; font-weight:800; color:#FF3D6D; text-transform:uppercase; letter-spacing:0.5px; }

        .s-toast { position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:#1e293b; color:#fff; padding:12px 24px; border-radius:16px; font-size:14px; font-weight:700; box-shadow:0 10px 30px rgba(0,0,0,0.2); z-index:9000; display:flex; align-items:center; gap:10px; }
        .s-toast.success { background:#1e293b; border-left:4px solid #10b981; }
        .s-toast.error { background:#1e293b; border-left:4px solid #ef4444; }

        @media (max-width:1024px) {
          .s-header { padding:14px 24px; }
          .s-content { padding:20px 24px 100px; }
          .s-tabbar { border-radius:14px; }
        }
        @media (max-width:640px) {
          .s-header { padding:12px 16px; }
          .s-header-inner { gap:8px; }
          .s-back-btn { width:36px; height:36px; border-radius:10px; }
          .s-searchbar { height:44px; border-radius:14px; padding:0 14px; }
          .s-content { padding:16px 16px 100px; }
          .s-card { border-radius:20px; padding:20px; }
          .s-tabbar { border-radius:12px; margin-bottom:16px; }
          .s-tab { padding:12px 14px; font-size:11px; }
          .s-modal-card { border-radius:24px 24px 0 0; }
          .s-modal-btn { padding:14px 18px; border-radius:20px; }
          .s-modal-btn-icon { width:38px; height:38px; border-radius:10px; }
          .s-modal-btn-text { font-size:14px; }
        }
      `}</style>
    </div>
  );
}
