import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import { Users, Plus, Shield, Search, ArrowRight, Sparkles, Globe, Lock, ArrowLeft } from 'lucide-react';
import type { Group } from '../types/group';
import { useNavigate } from 'react-router-dom';
import ModernOfflineState from '../components/ui/ModernOfflineState';
import { logger } from '../utils/logger';

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
        logger.error('Failed to fetch groups:', err);
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
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 font-sans">

      <main className="flex-1 px-4 lg:px-10 relative z-10 max-w-7xl mx-auto w-full pb-[calc(6rem+env(safe-area-inset-bottom))]">

        {/* Header */}
        <header className="mb-10" style={{ animation: 'grpSlideUp 0.6s ease both' }}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              {/* Back Button & Badge Row */}
              <div className="flex items-center gap-3 mb-5">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-8 h-8 flex items-center justify-center bg-[#fdf8fa] dark:bg-zinc-800 backdrop-blur-md rounded-full shadow-sm hover:shadow-md transition-all border border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100 active:scale-95"
                  aria-label="Go to Dashboard"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ff1493]/10 border border-[#ff1493]/25">
                  <Sparkles size={13} className="text-[#ff1493]" />
                  <span className="text-xs font-semibold tracking-tight text-[#ff1493]">Sparkle communities</span>
                </div>
              </div>
              {/* Heading — inline style bypasses global heading overrides */}
              <h1 className="text-3xl font-black tracking-tight text-[#18181b] dark:text-zinc-100 mb-3">
                Discover{' '}
                <span className="text-primary">circles</span>
              </h1>
              <p className="text-base text-slate-600 dark:text-zinc-300 font-medium">
                Connect with like-minded people at{' '}
                <strong className="text-[#18181b] dark:text-zinc-100 underline decoration-primary/40 decoration-[3px]">
                  {user?.campus || 'your campus'}
                </strong>.
              </p>
            </div>

            <button
              onClick={() => navigate('/groups/create')}
              className="flex items-center gap-2.5 whitespace-nowrap active:scale-95 transition-transform px-7 h-11 bg-[#ff1493] hover:bg-[#ff2d87] text-white rounded-full shadow-lg shadow-[#ff1493]/30 text-sm font-bold tracking-tight"
            >
              <Plus size={18} strokeWidth={3} />
              Create Circle
            </button>
          </div>
        </header>

        {/* Search & Filters */}
        <section className="mb-8" style={{ animation: 'grpSlideUp 0.7s 0.1s ease both' }}>
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-zinc-300" size={18} />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name or interest..."
                className="w-full h-[52px] bg-[#fdf8fa] dark:bg-zinc-800 border border-primary/15 dark:border-zinc-700 rounded-2xl pl-12 pr-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder-slate-600 dark:placeholder-zinc-400 outline-none shadow-sm focus:border-primary/50 dark:focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm">
              {[
                { key: 'all', label: 'All', icon: Globe },
                { key: 'my', label: 'Joined', icon: Users },
                { key: 'managed', label: 'Managing', icon: Shield },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    filter === f.key
                      ? 'bg-[#ff1493] text-white shadow-md shadow-[#ff1493]/30'
                      : 'bg-transparent text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100'
                  }`}
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
              <div key={i} className="h-64 rounded-3xl animate-pulse bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="py-12">
            <ModernOfflineState 
              type="empty"
              title={query ? "No matches" : "No circles yet"}
              message={query 
                ? `We couldn't find any circles matching "${query}". Try a different interest!` 
                : "The campus hasn't formed any circles in this category yet. Be the first to create one!"
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
                 className="cursor-pointer flex flex-col relative overflow-hidden bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-[#ff1493]/10 hover:border-[#ff1493]/30 transition-all duration-300"
                style={{
                  animation: `grpSlideUp 0.5s ${idx * 0.05}s ease both`,
                }}
              >
                {/* Pink accent top line */}
                <div className="absolute top-0 left-6 right-6 h-0.5 bg-[#ff1493] rounded-b z-10" />

                {/* Watermark */}
                <div className="absolute -right-5 -bottom-5 text-[#18181b]/[0.04] dark:text-zinc-100/[0.04] -rotate-12 z-0 pointer-events-none" aria-hidden>
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
                    <h3 className="text-[16px] font-black text-[#18181b] dark:text-zinc-100 leading-snug mb-1 truncate">
                      {group.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300 text-[11px] font-bold">
                      <Users size={11} />
                      <span>{group.member_count ?? 0} members</span>
                    </div>
                  </div>
                </div>

                <p className="text-[13px] text-slate-600 dark:text-zinc-300 leading-relaxed mb-4 line-clamp-2 flex-1">
                  {group.description || 'A community space for members to connect and share.'}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-[#ede3e9] dark:border-zinc-900">
                  <div className="flex items-center">
                    {[1, 2, 3].map(j => (
                      <div key={j} className="w-7 h-7 rounded-full border-2 border-[#fdf8fa] dark:border-zinc-800 overflow-hidden -ml-2 first:ml-0 bg-[#f6eef3] dark:bg-zinc-900">
                        <img src={`https://ui-avatars.com/api/?name=U+${j}&background=random&color=fff`} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                    {(group.member_count || 0) > 3 && (
                      <div className="w-7 h-7 rounded-full border-2 border-[#fdf8fa] dark:border-zinc-800 bg-primary/10 dark:bg-primary/20 flex items-center justify-center -ml-2">
                        <span className="text-[9px] font-black text-primary">+{group.member_count - 3}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-primary text-xs font-bold tracking-tight">
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
        input::placeholder { color: #475569; font-style: normal; }
        .dark input::placeholder { color: #d4d4d8; }
      `}</style>
    </div>
  );
}



