import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { Users, Plus, Shield, Search, ArrowRight, Sparkles, Globe, Compass, Lock } from 'lucide-react';
import type { Group } from '../types/group';
import { useNavigate } from 'react-router-dom';

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
    <div className="flex min-h-screen font-sans" style={{ background: 'linear-gradient(135deg, #fff0f4 0%, #fff9fa 60%, #fef0f5 100%)' }}>
      <Navbar />

      {/* Decorative blobs */}
      <div className="fixed top-[-80px] right-[-80px] w-[420px] h-[420px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,61,109,0.18) 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-60px] left-[-60px] w-[360px] h-[360px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,100,150,0.14) 0%, transparent 70%)' }} />

      <main className="flex-1 lg:ml-72 px-4 lg:px-10 pb-24 relative z-10 max-w-7xl mx-auto w-full pt-20">

        {/* Header */}
        <header className="mb-10" style={{ animation: 'slideUp 0.6s ease both' }}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5" style={{ background: 'rgba(255,61,109,0.12)', border: '1px solid rgba(255,61,109,0.25)' }}>
                <Sparkles size={13} style={{ color: '#FF3D6D' }} />
                <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', color: '#FF3D6D', textTransform: 'uppercase', fontStyle: 'normal' }}>Sparkle Communities</span>
              </div>
              {/* Heading — inline style bypasses global heading overrides */}
              <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, color: '#1a1a2e', fontStyle: 'normal', textTransform: 'none', fontFamily: 'inherit', marginBottom: '12px' }}>
                Discover{' '}
                <span style={{ color: '#FF3D6D' }}>Circles</span>
              </h1>
              <p style={{ fontSize: '1rem', color: '#64748b', fontWeight: 500, fontStyle: 'normal', textTransform: 'none' }}>
                Connect with like-minded people at{' '}
                <strong style={{ color: '#1a1a2e', textDecoration: 'underline', textDecorationColor: 'rgba(255,61,109,0.4)', textDecorationThickness: '3px', fontStyle: 'normal' }}>
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
                style={{ width: '100%', height: '52px', background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(255,61,109,0.15)', borderRadius: '16px', paddingLeft: '48px', paddingRight: '16px', fontSize: '14px', color: '#1a1a2e', outline: 'none', boxShadow: '0 2px 12px rgba(255,61,109,0.06)', fontStyle: 'normal', textTransform: 'none' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(255,61,109,0.5)'; e.target.style.boxShadow = '0 0 0 4px rgba(255,61,109,0.08)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,61,109,0.15)'; e.target.style.boxShadow = '0 2px 12px rgba(255,61,109,0.06)'; }}
              />
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(255,61,109,0.12)', boxShadow: '0 2px 12px rgba(255,61,109,0.05)' }}>
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
              <div key={i} className="h-64 rounded-3xl animate-pulse" style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,61,109,0.08)' }} />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="py-24 flex flex-col items-center text-center px-6 rounded-[36px]" style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(255,61,109,0.12)', boxShadow: '0 4px 24px rgba(255,61,109,0.06)', animation: 'slideUp 0.5s ease both' }}>
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6" style={{ background: 'rgba(255,61,109,0.08)', border: '2px solid rgba(255,61,109,0.15)' }}>
              <Compass size={36} style={{ color: '#FF3D6D' }} />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a2e', fontStyle: 'normal', textTransform: 'none', marginBottom: '8px' }}>No Circles Found</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '260px', margin: '0 auto 24px', fontStyle: 'normal', textTransform: 'none' }}>
              {query ? `No results for "${query}"` : 'No circles in this category yet.'}
            </p>
            <button
              onClick={() => setFilter('all')}
              style={{ padding: '10px 24px', background: 'rgba(255,61,109,0.1)', color: '#FF3D6D', borderRadius: '12px', fontWeight: 700, fontSize: '13px', border: '1px solid rgba(255,61,109,0.2)', cursor: 'pointer', fontStyle: 'normal', textTransform: 'none' }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-10">
            {filtered.map((group, idx) => (
              <div
                key={group.group_id}
                onClick={() => navigate(`/groups/${group.group_id}`)}
                className="cursor-pointer flex flex-col relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.92)',
                  border: '1.5px solid rgba(255,61,109,0.1)',
                  borderRadius: '28px',
                  padding: '24px',
                  boxShadow: '0 2px 16px rgba(255,61,109,0.05)',
                  transition: 'all 0.35s ease',
                  animation: `slideUp 0.5s ${idx * 0.05}s ease both`,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,61,109,0.35)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(255,61,109,0.14)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,61,109,0.1)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(255,61,109,0.05)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Pink accent top line */}
                <div style={{ position: 'absolute', top: 0, left: '24px', right: '24px', height: '2px', background: 'linear-gradient(90deg, #FF3D6D, transparent)', borderRadius: '0 0 4px 4px', opacity: 0.5 }} />

                {/* Privacy badge */}
                <div style={{ position: 'absolute', top: '18px', right: '18px' }}>
                  {group.is_public === 0 ? (
                    <div style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={11} style={{ color: '#f59e0b' }} />
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', textTransform: 'none', fontStyle: 'normal' }}>Private</span>
                    </div>
                  ) : (
                    <div style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', textTransform: 'none', fontStyle: 'normal' }}>Public</span>
                    </div>
                  )}
                </div>

                {/* Group info */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
                  <img
                    src={group.icon_url || '/uploads/avatars/default.png'}
                    style={{ width: '64px', height: '64px', borderRadius: '18px', objectFit: 'cover', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', flexShrink: 0 }}
                    alt={group.name}
                  />
                  <div style={{ paddingTop: '4px', overflow: 'hidden', flex: 1 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1a1a2e', fontStyle: 'normal', textTransform: 'none', lineHeight: 1.3, marginBottom: '4px', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8', fontSize: '11px', fontWeight: 600, textTransform: 'none', fontStyle: 'normal' }}>
                      <Users size={11} />
                      <span>{group.member_count ?? 0} members</span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, marginBottom: '16px', flex: 1, fontStyle: 'normal', textTransform: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {group.description || 'A community space for members to connect and share.'}
                </p>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '14px', borderTop: '1px solid rgba(255,61,109,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {[1, 2, 3].map(j => (
                      <div key={j} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid white', overflow: 'hidden', marginLeft: j > 1 ? '-8px' : '0', background: '#f1f5f9' }}>
                        <img src={`https://ui-avatars.com/api/?name=U+${j}&background=random&color=fff`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      </div>
                    ))}
                    {(group.member_count || 0) > 3 && (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid white', background: 'rgba(255,61,109,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '-8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#FF3D6D', fontStyle: 'normal' }}>+{group.member_count - 3}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#FF3D6D', fontSize: '12px', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'none', fontStyle: 'normal' }}>
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
