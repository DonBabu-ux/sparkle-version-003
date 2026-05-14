import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, UserPlus, Users, UserCheck, Sparkles, Orbit, Compass, Zap, CheckCircle2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import UserCard from '../components/UserCard';
import api from '../api/api';
import Spinner from '../components/ui/Spinner';

const TABS = [
  { label: 'Discovery', icon: Compass },
  { label: 'Suggested', icon: Sparkles },
  { label: 'Network', icon: Users },
] as const;

interface DiscoverUser {
  user_id?: string;
  id?: string;
  username: string;
  name?: string;
  major?: string;
  campus?: string;
  avatar_url?: string;
  is_followed?: boolean;
  is_developer?: boolean;
  mutual_connections?: number;
  is_online?: boolean;
  is_verified?: boolean;
  request_status?: string | null;
}

export default function Connect() {
  const [users, setUsers]               = useState<DiscoverUser[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<string>('For You');
  const [searchQuery, setSearchQuery]   = useState('');
  const [offset, setOffset]             = useState(0);
  const [hasMore, setHasMore]           = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  const lastUserRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setOffset(prev => prev + 20);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  /* ── Data fetching ── */
  const fetchUsers = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    try {
      const params: Record<string, string | number> = { 
        tab: activeTab.toLowerCase(),
        offset: isLoadMore ? offset : 0,
        limit: 20
      };
      if (searchQuery) params.q = searchQuery;
      const res = await api.get('/users/suggestions', { params });
      const newUsers = res.data.suggestions || res.data.users || res.data || [];
      
      if (isLoadMore) {
        setUsers(prev => {
          const existingIds = new Set(prev.map(u => u.user_id || u.id));
          const filteredNew = newUsers.filter(u => !existingIds.has(u.user_id || u.id));
          return [...prev, ...filteredNew];
        });
      } else {
        setUsers(newUsers);
      }
      setHasMore(newUsers.length === 20);
    } catch {
      if (!isLoadMore) setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, offset]);

  // Reset and fetch on tab/search change
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchUsers(false);
  }, [activeTab]);

  // Load more when offset changes (if > 0)
  useEffect(() => {
    if (offset > 0) {
      fetchUsers(true);
    }
  }, [offset]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setOffset(0);
      setHasMore(true);
      fetchUsers(false);
    }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  const SKELETON_COUNT = 6;

  return (
    <div className="flex bg-[#000000] min-h-screen text-white overflow-x-hidden font-sans selection:bg-[#ff1493]/30">
      <Navbar />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 relative z-10 max-w-[1400px] mx-auto w-full pt-12">
        
        {/* ── Header ── */}
        <header className="mb-10 animate-fade-in flex items-end justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#ff1493] rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(255,20,147,0.4)]">
                <Orbit className="text-white" size={22} />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Discovery Hub</h1>
            </div>
            <p className="text-[13px] font-bold text-white/40 uppercase tracking-[0.2em] ml-13">
              Expanding your sparkle matrix
            </p>
          </div>
        </header>

        {/* ── Search + Tabs Bar ── */}
        <div className="sticky top-6 z-50 mb-12 animate-fade-in">
          <div className="bg-white/[0.03] border border-white/10 backdrop-blur-3xl rounded-[2rem] p-2 flex flex-col md:flex-row gap-2 items-center shadow-2xl">
            <div className="relative flex-1 w-full group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#ff1493] transition-all duration-500 z-10" size={20} />
              <input
                type="text"
                placeholder="Search by name, major, or campus..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-14 bg-transparent border-none rounded-2xl px-16 text-base font-bold text-white placeholder:text-white/10 transition-all outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-[1.5rem] border border-white/5">
              {TABS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => setActiveTab(label)}
                  className={`flex items-center gap-2.5 h-11 px-6 rounded-2xl font-black text-[12px] uppercase tracking-wider transition-all duration-500 whitespace-nowrap
                    ${activeTab === label 
                      ? 'bg-[#ff1493] text-white shadow-[0_0_25px_rgba(255,20,147,0.3)] scale-105' 
                      : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}
                >
                  <Icon size={16} strokeWidth={2.5} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content Grid ── */}
        <div className="relative z-10 pb-20">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/5 rounded-3xl p-6 aspect-[4/5] animate-pulse flex flex-col items-center justify-center">
                   <div className="w-20 h-20 bg-white/10 rounded-full mb-6" />
                   <div className="w-2/3 h-5 bg-white/10 rounded-full mb-3" />
                   <div className="w-1/2 h-4 bg-white/10 rounded-full" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-32 flex flex-col items-center gap-8 text-center bg-white/[0.02] border border-white/10 rounded-[3rem] backdrop-blur-xl animate-fade-in">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center">
                <Search size={40} className="text-white/10" />
              </div>
              <div className="space-y-3 px-4">
                <h3 className="text-2xl font-black text-white italic italic">NO RESULTS FOUND</h3>
                <p className="text-[13px] font-bold text-white/30 uppercase tracking-widest max-w-xs mx-auto">Try refining your search or exploring other sectors.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {users.map((u, idx) => (
                <div 
                  key={(u.user_id || u.id) as string} 
                  ref={idx === users.length - 1 ? lastUserRef : null}
                  className="animate-scale-in" 
                  style={{ animationDelay: `${(idx % 20) * 30}ms` }}
                >
                  <UserCard
                    u={u}
                    onRemove={id => setUsers(prev => prev.filter(user => (user.user_id || user.id) !== id))}
                  />
                </div>
              ))}
              
              {/* Load More Skeleton */}
              {offset > 0 && loading && (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={`load-more-${i}`} className="bg-white border border-gray-200 rounded-xl p-6 aspect-square animate-pulse flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full mb-4" />
                    <div className="w-2/3 h-4 bg-gray-100 rounded-full mb-2" />
                    <div className="w-1/2 h-3 bg-gray-100 rounded-full" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
