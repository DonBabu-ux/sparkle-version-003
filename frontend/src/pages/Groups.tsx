import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { Users, Plus, Shield, Search, ArrowRight, Sparkles, Globe, Compass, Lock, ArrowLeft } from 'lucide-react';
import type { Group } from '../types/group';
import { useNavigate } from 'react-router-dom';
import ModernOfflineState from '../components/ui/ModernOfflineState';

export default function Groups() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [data, setData] = useState<{ initialGroups: Group[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/groups?filter=${filter}`);
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [filter]);

  const filtered = data?.initialGroups?.filter(g =>
    !query || g.name?.toLowerCase().includes(query.toLowerCase())
  ) ?? [];

  return (
    <div className="flex bg-[#fdf2f4] dark:bg-[#101217] min-h-screen text-[#1a1a2e] dark:text-white font-sans">
      <Navbar />

      {/* Decorative blobs */}
      <div className="fixed top-[-80px] right-[-80px] w-[420px] h-[420px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,61,109,0.18) 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-60px] left-[-60px] w-[360px] h-[360px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,100,150,0.14) 0%, transparent 70%)' }} />

      <main className="flex-1 lg:ml-72 px-4 lg:px-10 relative z-10 max-w-7xl mx-auto w-full pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">

        {/* Header */}
        <header className="mb-10" style={{ animation: 'slideUp 0.6s ease both' }}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              {/* Back Button & Badge Row */}
              <div className="flex items-center gap-3 mb-5">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-8 h-8 flex items-center justify-center bg-white dark:bg-white/10 backdrop-blur-md rounded-full shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white hover:text-gray-900 active:scale-95"
                  aria-label="Go to Dashboard"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full" style={{ background: 'rgba(255,61,109,0.12)', border: '1px solid rgba(255,61,109,0.25)' }}>
                  <Sparkles size={13} style={{ color: '#FF3D6D' }} />
                  <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: '#FF3D6D', textTransform: 'uppercase', fontStyle: 'normal' }}>Sparkle Communities</span>
                </div>
              </div>
              {/* Heading — inline style bypasses global heading overrides */}
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 dark:text-white mb-3">
                Discover{' '}
                <span className="text-primary">Circles</span>
              </h1>
              <p className="text-base text-gray-500 dark:text-gray-400 font-medium">
                Connect with like-minded people at{' '}
                <strong className="text-gray-900 dark:text-white underline decoration-primary/40 decoration-[3px]">
                  {user?.campus || 'your campus'}
                </strong>.
              </p>
            </div>

            <button
              onClick={() => navigate('/groups/create')}
              className="flex items-center gap-2.5 whitespace-nowrap active:scale-95 transition-transform"
              style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #FF3D6D 0%, #e01f55 100%)', color: '#fff', borderRadius: '18px', fontWeight: 800, fontSize: '13px', letterSpacing: '0.02em', boxShadow: '0 8px 24px rgba(255,61,109,0.35)', border: 'none', cursor: 'pointer', fontStyle: 'normal', textTransform: 'none' }}
            >
              <Plus size={18} strokeWidth={3} />
              Create Circle
            </button>
          </div>
        </header>

        {/* Search & Filters */}
        <section className="mb-8" style={{ animation: 'slideUp 0.7s 0.1s ease both' }}>
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: '#94a3b8' }} />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name or interest..."
                className="w-full h-[52px] bg-white dark:bg-[#101217] border border-primary/15 dark:border-white/10 rounded-2xl pl-12 pr-4 text-sm text-gray-900 dark:text-white outline-none shadow-sm focus:border-primary/50 dark:focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/80 dark:bg-white/5 border border-primary/10 dark:border-white/10 shadow-sm">
              {[
                { key: 'all', label: 'All', icon: Globe },
                { key: 'my', label: 'Joined', icon: Users },
                { key: 'managed', label: 'Managing', icon: Shield },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '12px',
                    fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer',
                    fontStyle: 'normal', textTransform: 'none', letterSpacing: '0.01em',
                    transition: 'all 0.2s',
                    background: filter === f.key ? 'linear-gradient(135deg, #FF3D6D, #e01f55)' : 'transparent',
                    color: filter === f.key ? '#fff' : '#94a3b8',
                    boxShadow: filter === f.key ? '0 4px 12px rgba(255,61,109,0.3)' : 'none',
                  }}
                >
                  <f.icon size={13} strokeWidth={2.5} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Circles Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 rounded-3xl animate-pulse bg-white/70 dark:bg-white/5 border border-primary/10 dark:border-white/10" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="py-12">
            <ModernOfflineState 
              type="empty"
              title={query ? "Search Blank" : "No Circles Yet"}
              message={query 
                ? `We couldn't find any circles matching "${query}". Try a different frequency!` 
                : "The campus hasn't formed any circles in this category yet. Be the first to spark one!"
              }
              onRetry={() => { setQuery(''); setFilter('all'); }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-10">
            {filtered.map((group, idx) => (
              <div
                key={group.group_id}
                onClick={() => navigate(`/groups/${group.group_id}`)}
                className="cursor-pointer flex flex-col relative overflow-hidden bg-white dark:bg-[#101217] border border-primary/10 dark:border-white/10 rounded-[28px] p-6 shadow-sm hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-300"
                style={{
                  animation: `slideUp 0.5s ${idx * 0.05}s ease both`,
                }}
              >
                {/* Pink accent top line */}
                <div style={{ position: 'absolute', top: 0, left: '24px', right: '24px', height: '2px', background: 'linear-gradient(90deg, #FF3D6D, transparent)', borderRadius: '0 0 4px 4px', opacity: 0.5, zIndex: 10 }} />

                {/* Watermark */}
                <div className="absolute -right-5 -bottom-5 text-black/[0.02] -rotate-12 z-0 pointer-events-none" aria-hidden>
                  <Users size={160} strokeWidth={0.75} />
                </div>

                {/* Privacy badge */}
                <div style={{ position: 'absolute', top: '18px', right: '18px', zIndex: 10 }}>
                  {group.is_public === 0 ? (
                    <div className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-1.5">
                      <Lock size={11} className="text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-500">Private</span>
                    </div>
                  ) : (
                    <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] font-bold text-emerald-500">Public</span>
                    </div>
                  )}
                </div>

                {/* Group info */}
                <div className="flex items-start gap-4 mb-4">
                  <img
                    src={group.icon_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=random&color=fff`}
                    className="w-16 h-16 rounded-[18px] object-cover shadow-lg shrink-0"
                    alt={group.name}
                  />
                  <div className="pt-1 min-w-0 flex-1">
                    <h3 className="text-[16px] font-black text-gray-900 dark:text-white leading-snug mb-1 truncate">
                      {group.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 text-[11px] font-bold">
                      <Users size={11} />
                      <span>{group.member_count ?? 0} members</span>
                    </div>
                  </div>
                </div>

                <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mb-4 line-clamp-2 flex-1">
                  {group.description || 'A community space for members to connect and share.'}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
                  <div className="flex items-center">
                    {[1, 2, 3].map(j => (
                      <div key={j} className="w-7 h-7 rounded-full border-2 border-white dark:border-black overflow-hidden -ml-2 first:ml-0 bg-gray-100 dark:bg-white/5">
                        <img src={`https://ui-avatars.com/api/?name=U+${j}&background=random&color=fff`} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                    {(group.member_count || 0) > 3 && (
                      <div className="w-7 h-7 rounded-full border-2 border-white dark:border-black bg-primary/10 dark:bg-primary/20 flex items-center justify-center -ml-2">
                        <span className="text-[9px] font-black text-primary">+{group.member_count - 3}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-primary text-[12px] font-black uppercase tracking-wider">
                    Join
                    <ArrowRight size={14} strokeWidth={3} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: #94a3b8; font-style: normal; }
      `}</style>
    </div>
  );
}
