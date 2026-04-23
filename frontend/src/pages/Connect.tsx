import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, UserPlus, Users, UserCheck, Sparkles, Orbit } from 'lucide-react';
import Navbar from '../components/Navbar';
import UserCard from '../components/UserCard';
import api from '../api/api';

const TABS = [
  { label: 'For You',   icon: Sparkles },
  { label: 'Suggested', icon: UserPlus },
  { label: 'Similar',   icon: Users },
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
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-[1400px] mx-auto w-full pt-20 md:pt-32">
        
        {/* ── Header ── */}
        <header className="mb-20 animate-fade-in px-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
            <div className="max-w-3xl space-y-8">
              <div className="inline-flex items-center gap-4 px-6 py-2.5 rounded-full bg-white/80 border border-white backdrop-blur-3xl shadow-xl shadow-primary/5">
                <Sparkles size={18} strokeWidth={3} className="text-primary" />
                <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">Village Network</span>
              </div>
              <h1 className="text-6xl md:text-9xl font-black text-black tracking-tighter leading-[0.8] italic uppercase">
                Find your <br /><span className="text-primary italic">Frequency.</span>
              </h1>
              <p className="text-xl font-bold text-black opacity-60 leading-relaxed max-w-xl italic">
                Synchronize with neighbors, creators, and professionals across your sector.
              </p>
            </div>
          </div>
        </header>

        {/* ── Search + Tabs Bar ── */}
        <div className="sticky top-24 z-50 mb-20 animate-fade-in">
          <div className="bg-white/80 backdrop-blur-3xl border border-white rounded-[48px] p-4 shadow-2xl shadow-primary/5 flex flex-col xl:flex-row gap-6 items-center">
            <div className="relative flex-1 w-full group">
              <Search className="absolute left-10 top-1/2 -translate-y-1/2 text-black/10 group-focus-within:text-primary transition-colors" size={24} strokeWidth={3} />
              <input
                type="text"
                placeholder="Scan by name, talent, or location..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-20 bg-black/5 hover:bg-white border-2 border-transparent focus:border-primary focus:bg-white rounded-[32px] pl-24 pr-10 text-lg font-black text-black placeholder:text-black/10 transition-all outline-none italic uppercase tracking-wider"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto no-scrollbar py-2 px-2">
              {TABS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => setActiveTab(label)}
                  className={`flex items-center gap-4 h-20 px-10 rounded-[28px] font-black text-[11px] uppercase tracking-[0.3em] transition-all duration-500 whitespace-nowrap italic
                    ${activeTab === label 
                      ? 'bg-primary text-white shadow-2xl shadow-primary/40' 
                      : 'bg-black/5 text-black opacity-20 hover:opacity-100 hover:bg-black/10'}`}
                >
                  <Icon size={18} strokeWidth={3} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content Grid ── */}
        <div className="relative z-10 pb-40 px-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <div key={i} className="bg-white/40 backdrop-blur-3xl border border-white rounded-[56px] p-12 aspect-[4/3] animate-pulse flex flex-col items-center justify-center">
                   <div className="w-28 h-28 bg-black/5 rounded-[40px] mb-8" />
                   <div className="w-1/2 h-6 bg-black/5 rounded-full mb-4" />
                   <div className="w-3/4 h-3 bg-black/5 rounded-full" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-64 flex flex-col items-center gap-12 text-center bg-white/40 backdrop-blur-3xl border-4 border-dashed border-white rounded-[80px] shadow-2xl shadow-primary/5 animate-fade-in">
              <Orbit size={140} strokeWidth={2} className="text-primary/10 animate-spin-slow" />
              <div className="space-y-6">
                <h3 className="text-5xl font-black text-black opacity-5 italic uppercase tracking-tighter">Isolated Node.</h3>
                <p className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] max-w-xs mx-auto italic">No frequencies detected. Try adjusting your transmission or scanning different sectors.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
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
