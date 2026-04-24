import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, UserPlus, Users, UserCheck, Sparkles, Orbit } from 'lucide-react';
import Navbar from '../components/Navbar';
import UserCard from '../components/UserCard';
import api from '../api/api';

const TABS = [
  { label: 'For You',   icon: Sparkles },
  { label: 'Suggested', icon: UserPlus },
  { label: 'Following', icon: UserCheck },
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
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Data fetching ── */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { tab: activeTab.toLowerCase() };
      if (searchQuery)             params.q      = searchQuery;
      const res = await api.get('/users/suggestions', { params });
      setUsers(res.data.suggestions || res.data.users || res.data || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => { fetchUsers(); }, [activeTab, fetchUsers]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { fetchUsers(); }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, fetchUsers]);

  const SKELETON_COUNT = 6;

  return (
    <div className="flex bg-[#f0f2f5] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-4 md:p-6 relative z-10 max-w-[1200px] mx-auto w-full pt-20">
        
        {/* ── Header ── */}
        <header className="mb-6 animate-fade-in">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Connect</h1>
            <p className="text-[15px] font-medium text-gray-500">
              Discover people you may know and follow their journey.
            </p>
          </div>
        </header>

        {/* ── Search + Tabs Bar ── */}
        <div className="sticky top-16 z-50 mb-8 animate-fade-in">
          <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search by name or major..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-11 bg-gray-100 focus:bg-white border border-transparent focus:border-blue-500 rounded-lg pl-12 pr-4 text-[15px] font-medium text-gray-900 transition-all outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar px-1">
              {TABS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => setActiveTab(label)}
                  className={`flex items-center gap-2 h-10 px-4 rounded-full font-bold text-[13px] transition-all duration-300 whitespace-nowrap
                    ${activeTab === label 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content Grid ── */}
        <div className="relative z-10 pb-20">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 aspect-square animate-pulse flex flex-col items-center justify-center">
                   <div className="w-16 h-16 bg-gray-100 rounded-full mb-4" />
                   <div className="w-2/3 h-4 bg-gray-100 rounded-full mb-2" />
                   <div className="w-1/2 h-3 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-32 flex flex-col items-center gap-6 text-center bg-white border border-gray-200 rounded-2xl shadow-sm animate-fade-in">
              <Orbit size={80} className="text-gray-200 animate-spin-slow" />
              <div className="space-y-2 px-4">
                <h3 className="text-xl font-bold text-gray-900">No results found</h3>
                <p className="text-[14px] text-gray-500 max-w-xs mx-auto">Try searching for something else or explore different tabs.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {users.map((u, idx) => (
                <div key={(u.user_id || u.id) as string} className="animate-scale-in" style={{ animationDelay: `${idx * 100}ms` }}>
                  <UserCard
                    u={u}
                    onRemove={id => setUsers(prev => prev.filter(user => (user.user_id || user.id) !== id))}
                  />
                </div>
              ))}
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
