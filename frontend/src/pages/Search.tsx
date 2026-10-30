import { showError, showSuccess } from '../utils/toast';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, X, Clock, MoreHorizontal, ChevronRight, Hash, Trash2, User, Sparkles, Send, ArrowLeft, Hand, TrendingUp, Check, Plus } from 'lucide-react';
import api from '../api/api';
import UserCard from '../components/UserCard';
import PostCard from '../components/PostCard';
import type { Post as PostCardPost } from '../components/PostCard';
import ListingCard from '../components/marketplace/ListingCard';
import { useUserStore } from '../store/userStore';
import '../utils/identityManager';
import '../components/common/VerifiedBadge';
import debounce from 'lodash.debounce';
import { logger } from '../utils/logger';

type TabType = 'all' | 'users' | 'posts' | 'groups' | 'marketplace' | 'clubs';

interface Suggestion {
  type: 'user' | 'group' | 'hashtag';
  value: string;
  label: string;
  image?: string;
}

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
  query?: string;
  member_count?: number;
  spark_count?: number;
  comment_count?: number;
  has_story?: boolean;
  // Post-shape fields (backend search returns post rows for the posts tab)
  post_type?: string;
  created_at?: string;
  reshare_count?: number;
  is_sparked?: boolean;
  is_saved?: boolean;
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
  const searchRef = useRef<HTMLDivElement>(null);
  const searchSeqRef = useRef(0);
  const suggestSeqRef = useRef(0);

  // Typeahead (Facebook-style instant suggestions before you hit Enter)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(-1);

  const [suggested, setSuggested] = useState<SearchResult[]>([]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [historyRes, trendingRes, suggestedRes] = await Promise.allSettled([
        api.get('/search/history'),
        api.get('/search/trending'),
        api.get('/users/suggestions', { params: { tab: 'for_you', limit: 6 } })
      ]);

      if (historyRes.status === 'fulfilled' && historyRes.value.data.status === 'success') {
          setHistory(historyRes.value.data.data || []);
      }
      if (trendingRes.status === 'fulfilled' && trendingRes.value.data.status === 'success') {
          setTrending(trendingRes.value.data.data || []);
      }
      if (suggestedRes.status === 'fulfilled' && suggestedRes.value.data.status === 'success') {
          setSuggested(suggestedRes.value.data.suggestions || suggestedRes.value.data.data || []);
      }
    } catch (err) {
      logger.error('Initial fetch error:', err);
    }
  }, []);

  const handlePoke = async (userId: string, name: string) => {
    if (poking) return;
    setPoking(true);
    try {
        await api.post(`/users/${userId}/poke`);
        showSuccess(`You poked ${name}! 👋`);
        setActionItem(null);
    } catch (err) {
        logger.error('Poke failed:', err);
        showError('Failed to send poke.');
    } finally {
        setPoking(false);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
        await api.delete(`/search/history/${id}`);
        setHistory(prev => prev.filter(item => item.id !== id));
        setActionItem(null);
        showSuccess('Search deleted.');
    } catch (err) {
        logger.error('Delete history failed:', err);
        showError('Failed to delete.');
    }
  };

  const handleSearch = useCallback(async (q: string, type: TabType) => {
    if (!q.trim()) {
        setResults({});
        return;
    }
    const seq = ++searchSeqRef.current;
    setLoading(true);
    try {
      const response = await api.get('/search', {
        params: { q, type, campus: currentUser?.campus }
      });
      if (seq !== searchSeqRef.current) return;
      if (response.data.status === 'success') {
        if (type === 'all') {
            setResults(response.data.data.results || {});
        } else {
            setResults({ [type]: response.data.data.results?.[type] || [] });
        }
      }
    } catch (err) {
      if (seq !== searchSeqRef.current) return;
      logger.error('Search failed:', err);
      showError('Search failed. Please try again.');
    } finally {
      if (seq === searchSeqRef.current) setLoading(false);
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
    return () => debouncedSearch.cancel();
  }, [debouncedSearch]);

  useEffect(() => {
    if (!query.trim()) {
        setResults({});
        return;
    }
    debouncedSearch(query, activeTab);
  }, [query, activeTab, debouncedSearch]);

  const handleSuggestedFollow = async (targetId: string) => {
      try {
          await api.post(`/users/${targetId}/follow`);
          setSuggested(prev => prev.map(u =>
              (u.user_id || u.id) === targetId ? { ...u, is_followed: true } : u
          ));
      } catch (err) {
          logger.error('Suggested follow failed:', err);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (suggestOpen && suggestions.length > 0) {
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSuggestIndex(i => (i + 1) % suggestions.length);
              return;
          }
          if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSuggestIndex(i => (i <= 0 ? suggestions.length - 1 : i - 1));
              return;
          }
          if (e.key === 'Enter' && suggestIndex >= 0) {
              e.preventDefault();
              openSuggestion(suggestions[suggestIndex]);
              return;
          }
          if (e.key === 'Escape') {
              setSuggestOpen(false);
              setSuggestIndex(-1);
              return;
          }
      }
      if (e.key === 'Enter' && query.trim()) {
          setSuggestOpen(false);
          setSuggestIndex(-1);
          api.post('/search/history', { q: query.trim() }).catch(() => {});
          fetchInitialData();
      }
  };

  const openSuggestion = (s: Suggestion) => {
      setSuggestOpen(false);
      setSuggestIndex(-1);
      if (s.type === 'user') {
          navigate(`/profile/${s.value}`);
      } else if (s.type === 'group') {
          navigate(`/groups/${s.value}`);
      } else {
          navigate(`/hashtag/${s.value.replace('#', '')}`);
      }
  };

  const debouncedSuggest = useMemo(
      () => debounce((q: string) => {
          const seq = ++suggestSeqRef.current;
          api.get('/search/suggestions', { params: { q } })
              .then(res => {
                  if (seq !== suggestSeqRef.current) return;
                  const list: Suggestion[] = res.data?.status === 'success' ? (res.data.data || []) : [];
                  setSuggestions(list);
                  setSuggestOpen(list.length > 0);
                  setSuggestIndex(-1);
              })
              .catch(() => { /* typeahead is best-effort; full search still works */ });
      }, 300),
      []
  );

  useEffect(() => {
      if (!query.trim() || query.trim().length < 2) {
          setSuggestions([]);
          setSuggestOpen(false);
          return;
      }
      debouncedSuggest(query.trim());
  }, [query, debouncedSuggest]);

  // Close the typeahead when clicking outside the header.
  useEffect(() => {
      if (!suggestOpen) return;
      const onDocClick = (e: MouseEvent) => {
          if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
              setSuggestOpen(false);
              setSuggestIndex(-1);
          }
      };
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
  }, [suggestOpen]);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'users', label: 'People' },
    { id: 'posts', label: 'Posts' },
    { id: 'groups', label: 'Groups' },
    { id: 'marketplace', label: 'Market' },
    { id: 'clubs', label: 'Clubs' },
  ];

  return (
    <div className="block lg:flex bg-[#f8e7ed] dark:bg-zinc-800 min-h-dvh text-[#18181b] dark:text-white font-sans overflow-x-hidden selection:bg-primary/10">
      
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vw] bg-primary/[0.03] rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[40vw] h-[40vw] bg-indigo-500/[0.02] rounded-full blur-[100px]" />
      </div>

      <main className="flex-1 flex flex-col relative z-10">
        
        {/* Sleek Search Header */}
        <header className="sticky top-0 z-[100] bg-white/95 dark:bg-zinc-800/95 backdrop-blur-3xl border-b border-black/5 dark:border-white/10 px-4 py-4 md:py-6">
          <div className="max-w-3xl mx-auto flex items-center gap-4">
                <button 
                  onClick={() => navigate(-1)} 
                  className="w-10 h-10 shrink-0 flex items-center justify-center bg-black/[0.04] dark:bg-white/5 border border-black/5 dark:border-white/10 text-[#18181b] dark:text-zinc-100 hover:text-primary hover:border-primary/20 rounded-xl transition-all active:scale-95 group shadow-sm"
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
                        onClick={() => { setQuery(''); setResults({}); setSuggestOpen(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/[0.05] dark:bg-zinc-800 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-gray-900 transition-all"
                      >
                          <X size={14} strokeWidth={3} />
                      </button>
                  )}

                  {/* Instant suggestions */}
                  {suggestOpen && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-[120] overflow-hidden rounded-2xl border border-black/5 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-800">
                          {suggestions.map((s, i) => (
                              <button
                                key={`${s.type}-${s.value}-${i}`}
                                onClick={() => openSuggestion(s)}
                                onMouseEnter={() => setSuggestIndex(i)}
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${i === suggestIndex ? 'bg-primary/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/5'}`}
                              >
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-700">
                                      {s.type === 'hashtag' ? (
                                          <Hash size={16} className="text-primary" strokeWidth={2.5} />
                                      ) : s.image ? (
                                          <img src={s.image} alt="" className="h-full w-full object-cover" />
                                      ) : (
                                          <User size={16} className="text-slate-600 dark:text-zinc-400" strokeWidth={2.5} />
                                      )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-bold italic tracking-tight text-[#18181b] dark:text-white">{s.label}</p>
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 dark:text-zinc-400">
                                          {s.type === 'user' ? 'Person' : s.type === 'group' ? 'Group' : 'Hashtag'}
                                      </p>
                                  </div>
                              </button>
                          ))}
                      </div>
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
                                <h2 className="text-xl font-black text-[#18181b] dark:text-zinc-100 uppercase italic tracking-tight">Trending</h2>
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
                                            <span className="text-sm font-black text-slate-600 dark:text-zinc-400 group-hover:text-primary transition-colors italic">0{i + 1}</span>
                                            <span className="text-base font-bold text-[#18181b] dark:text-zinc-100 italic">{tag.name}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest">{tag.count} Sparks</span>
                                    </motion.div>
                                )) : (
                                    <p className="text-sm font-bold text-slate-600 dark:text-zinc-400 italic px-4">Nothing trending yet...</p>
                                )}
                            </div>
                        </section>

                        {/* Recent History */}
                        <section>
                            <div className="flex items-center justify-between mb-6 px-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-black/[0.05] dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-400">
                                        <Clock size={20} />
                                    </div>
                                    <h2 className="text-xl font-black text-[#18181b] dark:text-zinc-100 uppercase italic tracking-tight">Recent</h2>
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
                                            <span className="block text-base font-bold text-[#18181b] dark:text-zinc-100 italic truncate">{h.query}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActionItem({ ...h, type: 'history' }); }}
                                            className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <MoreHorizontal size={16} strokeWidth={3} />
                                        </button>
                                    </motion.div>
                                )) : (
                                    <p className="text-sm font-bold text-slate-600 dark:text-zinc-400 italic px-4">Your history is clear.</p>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Suggested for you */}
                    {suggested.length > 0 && (
                        <section>
                            <div className="flex items-center gap-3 mb-6 px-2">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <Sparkles size={20} />
                                </div>
                                <h2 className="text-xl font-black text-[#18181b] dark:text-zinc-100 uppercase italic tracking-tight">Suggested for you</h2>
                            </div>
                            <div className="space-y-1">
                                {suggested.map((u, i) => (
                                    <motion.div
                                      key={`sugg-${u.user_id || u.id || i}`}
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: i * 0.05 }}
                                      onClick={() => navigate(`/profile/${u.username}`)}
                                      className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-white/5 border border-transparent hover:border-black/5 dark:hover:border-white/10 hover:shadow-sm cursor-pointer transition-all group"
                                    >
                                        <img
                                          src={u.avatar_url || '/uploads/avatars/no-profile.png'}
                                          alt=""
                                          className="w-12 h-12 rounded-full object-cover border-2 border-primary/20 shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-[#18181b] dark:text-zinc-100 italic uppercase tracking-tight truncate">
                                                {u.name || u.username}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-zinc-400 truncate">
                                                {u.suggestion_reason || (u.mutual_connections ? `${u.mutual_connections} mutual` : `@${u.username}`)}
                                            </p>
                                        </div>
                                        {u.is_followed ? (
                                            <span className="shrink-0 px-4 h-9 inline-flex items-center gap-1.5 rounded-xl bg-black/[0.04] dark:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-400">
                                                <Check size={14} strokeWidth={3} /> Following
                                            </span>
                                        ) : (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleSuggestedFollow((u.user_id || u.id) as string); }}
                                              className="shrink-0 px-5 h-9 inline-flex items-center gap-1.5 rounded-xl bg-primary text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-primary/30 hover:scale-[1.03] active:scale-95 transition-all"
                                            >
                                                <Plus size={13} strokeWidth={3} /> Follow
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            ) : (
                <div className="animate-in fade-in duration-500 space-y-8 md:space-y-12">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 sticky top-[81px] md:top-[105px] z-50 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xl py-4 -mx-4 px-4 border-b border-black/[0.03] dark:border-white/[0.03]">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all whitespace-nowrap border ${activeTab === tab.id ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/10 text-gray-500 dark:text-slate-600 dark:text-zinc-400 hover:border-primary/30 hover:text-primary'}`}
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
                        
                        {Object.entries(results).map(([type, items]: [string, SearchResult[]], i) => {
                            const visible = activeTab === 'all' && Array.isArray(items) ? items.slice(0, 3) : items;
                            return (
                            <section key={`res-sec-${type}-${i}`} className="space-y-6 animate-fade-in">
                                <div className="flex items-center gap-4">
                                   <h3 className="text-[10px] font-black text-slate-600 dark:text-zinc-400 italic uppercase tracking-widest">
                                       {type} {Array.isArray(items) && items.length > 0 && <span className="text-primary">({items.length})</span>}
                                   </h3>
                                   <div className="flex-1 h-[1px] bg-gray-200/50" />
                                   {activeTab === 'all' && type !== 'hashtags' && items.length > 3 && (
                                       <button
                                           onClick={() => setActiveTab(type as TabType)}
                                           className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline"
                                       >
                                           See all
                                       </button>
                                   )}
                                </div>

                                <div className="grid gap-6">
                                    {type === 'users' && Array.isArray(visible) && visible.map((u, j) => (
                                        <div key={`res-u-${u.user_id || u.id || j}`} className="hover:scale-[1.02] transition-transform duration-500">
                                            <UserCard u={u} />
                                        </div>
                                    ))}
                                    {type === 'posts' && Array.isArray(visible) && visible.map((p, j) => (
                                        <PostCard key={`res-p-${p.post_id || p.id || j}`} post={p as unknown as PostCardPost} />
                                    ))}
                                    {(type === 'groups' || type === 'clubs' || type === 'hashtags') && Array.isArray(visible) && visible.map((g, j) => (
                                        <div 
                                          key={`res-g-${g.id || j}`} 
                                          onClick={() => navigate(type === 'hashtags' ? `/hashtag/${g.title?.replace('#', '')}` : `/${type}/${g.id}`)} 
                                          className="flex items-center gap-4 p-5 bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 hover:border-primary/20 rounded-2xl transition-all cursor-pointer group active:scale-[0.98] duration-300 shadow-sm"
                                        >
                                            {type === 'hashtags' ? (
                                                <div className="w-14 h-14 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 shrink-0 transition-all">
                                                    <Hash size={24} className="text-primary" />
                                                </div>
                                            ) : (
                                                <img src={g.image || '/uploads/groups/default.png'} className="w-14 h-14 rounded-xl object-cover border border-gray-100 dark:border-white/10 group-hover:scale-105 transition-all shrink-0" alt="" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-lg font-bold text-[#18181b] dark:text-zinc-100 leading-none mb-1 italic uppercase tracking-tight truncate">{g.title}</div>
                                                <div className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest group-hover:text-primary transition-colors">
                                                    {type === 'hashtags' ? 'Hashtag' : g.subtitle || 'Community'}
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-slate-600 dark:text-zinc-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                                        </div>
                                    ))}
                                    {type === 'marketplace' && Array.isArray(visible) && visible.map((item, j) => (
                                        <ListingCard
                                          key={`res-m-${item.id || j}`}
                                          variant="compact"
                                          listing={item}
                                          onClick={() => navigate(`/marketplace/listings/${item.id}`)}
                                        />
                                    ))}
                                    {Array.isArray(visible) && visible.length === 0 && (
                                        <div className="text-center py-8 md:py-16 bg-black/[0.01] rounded-[24px] md:rounded-[32px] border border-dashed border-black/5 dark:border-white/5 px-6 mx-2">
                                            <p className="text-[10px] md:text-xs font-black text-slate-600 dark:text-zinc-400 uppercase tracking-widest italic leading-relaxed">No results found matching your search.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                            );
                        })}
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
              className="fixed inset-0 z-(--z-chrome) bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[1001] bg-white dark:bg-zinc-800 rounded-t-[48px] p-10 max-w-2xl mx-auto shadow-2xl"
            >
                <div className="w-12 h-1.5 bg-black/5 rounded-full mx-auto mb-10" />
                
                <div className="flex flex-col items-center mb-12 text-center">
                    {actionItem.type === 'user' ? (
                        <>
                            <div className="relative mb-6">
                                <img src={actionItem.avatar_url || '/uploads/avatars/no-profile.png'} className="w-24 h-24 rounded-[32px] object-cover border-4 border-white shadow-2xl" alt="" />
                                <div className="absolute -bottom-2 -right-2 bg-primary p-2.5 rounded-2xl text-white shadow-xl">
                                    <Sparkles size={18} strokeWidth={3} />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-[#18181b] dark:text-white italic uppercase leading-none">{actionItem.name}</h3>
                            <p className="text-slate-600 dark:text-zinc-300 font-bold text-[11px] uppercase tracking-widest mt-3">@{actionItem.username}</p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-[24px] bg-black/5 flex items-center justify-center text-slate-600 dark:text-zinc-400 mb-6">
                                <Clock size={32} strokeWidth={2.5} />
                            </div>
                             <h3 className="text-2xl font-black text-[#18181b] dark:text-white italic uppercase">Search History</h3>
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
      <AnimatePresence>      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}


