import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, UserPlus, TrendingUp, Users, UserCheck, Sparkles, SlidersHorizontal } from 'lucide-react';
import Navbar from '../components/Navbar';
import UserCard from '../components/UserCard';
import api from '../api/api';

const FILTERS = ['For You', 'Campus', 'Interests', 'Level'] as const;
const TABS = [
  { label: 'Suggested', icon: UserPlus },
  { label: 'Trending',  icon: TrendingUp },
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
  const [activeTab, setActiveTab]       = useState<string>('Suggested');
  const [activeFilter, setActiveFilter] = useState<string>('For You');
  const [searchQuery, setSearchQuery]   = useState('');
  const [showFilters, setShowFilters]   = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Data fetching ── */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { tab: activeTab.toLowerCase() };
      if (searchQuery)             params.q      = searchQuery;
      if (activeFilter === 'Campus') params.filter = 'campus';
      const res = await api.get('/users/suggestions', { params });
      setUsers(res.data.users || res.data || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeFilter, searchQuery]);

  useEffect(() => { fetchUsers(); }, [activeTab, activeFilter, fetchUsers]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { fetchUsers(); }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery, fetchUsers]);

  /* ── Skeleton count ── */
  const SKELETON_COUNT = 6;

  return (
    <div className="connect-root">
      <Navbar />

      <div className="connect-main">

        {/* ── Hero strip ── */}
        <div className="connect-hero">
          <div className="connect-hero-inner">
            <div className="connect-hero-badge">
              <Sparkles size={13} />
              Discover People
            </div>
            <h1 className="connect-hero-title">Find Your Tribe</h1>
            <p className="connect-hero-sub">Connect with students, creators, and professionals on your campus.</p>
          </div>
          <div className="connect-hero-blob" aria-hidden />
        </div>

        {/* ── Sticky controls ── */}
        <div className="connect-controls">

          {/* Search */}
          <div className="connect-searchbar">
            <Search size={17} className="connect-searchbar-icon" />
            <input
              type="search"
              placeholder="Search by name, major, campus…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="connect-searchbar-input"
            />
            <button
              className={`connect-filter-toggle ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(v => !v)}
              title="Filters"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {/* Filter chips (collapsible) */}
          {showFilters && (
            <div className="connect-chips animate-fade-in">
              {FILTERS.map(f => (
                <button
                  key={f}
                  className={`connect-chip ${activeFilter === f ? 'active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {/* Tab bar */}
          <div className="connect-tabbar" role="tablist">
            {TABS.map(({ label, icon: Icon }) => (
              <button
                key={label}
                role="tab"
                aria-selected={activeTab === label}
                className={`connect-tab ${activeTab === label ? 'active' : ''}`}
                onClick={() => setActiveTab(label)}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="connect-grid-wrapper">
          {loading ? (
            <div className="connect-grid">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <div key={i} className="connect-skeleton">
                  <div className="sk-avatar sk-pulse" />
                  <div className="sk-line sk-pulse" style={{ width: '55%' }} />
                  <div className="sk-line sk-pulse" style={{ width: '80%', height: 10 }} />
                  <div className="sk-line sk-pulse" style={{ width: '65%', height: 10 }} />
                  <div className="sk-btn sk-pulse" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="connect-empty">
              <div className="connect-empty-icon">🧑‍🚀</div>
              <h3>No suggestions found</h3>
              <p>Try switching tabs or adjusting your filters.</p>
            </div>
          ) : (
            <div className="connect-grid">
              {users.map(u => (
                <UserCard
                  key={(u.user_id || u.id) as string}
                  u={u}
                  onRemove={id => setUsers(prev => prev.filter(user => (user.user_id || user.id) !== id))}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* ─── Root Layout ─────────────────────── */
        .connect-root {
          display: flex;
          min-height: 100vh;
          background: #f7f8fc;
          font-family: 'Outfit', 'Inter', system-ui, sans-serif;
        }

        .connect-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        /* ─── Hero ────────────────────────────── */
        .connect-hero {
          position: relative;
          background: linear-gradient(135deg, #1e0a3c 0%, #2d1b69 50%, #4a1942 100%);
          padding: 48px 40px 64px;
          overflow: hidden;
        }
        .connect-hero-inner { position: relative; z-index: 1; max-width: 560px; }
        .connect-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,61,109,0.18);
          border: 1px solid rgba(255,61,109,0.35);
          color: #ff7da0;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          padding: 5px 14px;
          border-radius: 100px;
          margin-bottom: 18px;
        }
        .connect-hero-title {
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 900;
          color: #fff;
          line-height: 1.1;
          margin: 0 0 12px;
          letter-spacing: -1px;
        }
        .connect-hero-sub {
          font-size: 15px;
          color: rgba(255,255,255,0.55);
          font-weight: 500;
          margin: 0;
          max-width: 400px;
        }
        .connect-hero-blob {
          position: absolute;
          top: -80px;
          right: -80px;
          width: 380px;
          height: 380px;
          background: radial-gradient(circle, rgba(255,61,109,0.22) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }

        /* ─── Controls ────────────────────────── */
        .connect-controls {
          position: sticky;
          top: 0;
          z-index: 500;
          background: rgba(247, 248, 252, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          padding: 20px 40px 0;
        }

        /* Search bar */
        .connect-searchbar {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff;
          border: 1.5px solid #e8eaf0;
          border-radius: 18px;
          padding: 0 18px;
          height: 52px;
          margin-bottom: 16px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .connect-searchbar:focus-within {
          border-color: #FF3D6D;
          box-shadow: 0 0 0 4px rgba(255,61,109,0.08);
        }
        .connect-searchbar-icon {
          color: #94a3b8;
          flex-shrink: 0;
          transition: color 0.2s;
        }
        .connect-searchbar:focus-within .connect-searchbar-icon { color: #FF3D6D; }
        .connect-searchbar-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 15px;
          font-weight: 500;
          color: #1e293b;
          outline: none;
          font-family: inherit;
        }
        .connect-searchbar-input::placeholder { color: #94a3b8; }
        .connect-filter-toggle {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1.5px solid #e8eaf0;
          background: transparent;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .connect-filter-toggle:hover,
        .connect-filter-toggle.active {
          background: #FF3D6D;
          border-color: #FF3D6D;
          color: #fff;
        }

        /* Filter chips */
        .connect-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .connect-chip {
          padding: 7px 18px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 700;
          border: 1.5px solid #e8eaf0;
          background: #fff;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .connect-chip:hover { border-color: #FF3D6D; color: #FF3D6D; }
        .connect-chip.active {
          background: #FF3D6D;
          border-color: #FF3D6D;
          color: #fff;
          box-shadow: 0 4px 12px rgba(255,61,109,0.25);
        }

        /* Tab bar */
        .connect-tabbar {
          display: flex;
          gap: 0;
          overflow-x: auto;
          scrollbar-width: none;
          border-top: 1px solid #edf0f7;
        }
        .connect-tabbar::-webkit-scrollbar { display: none; }
        .connect-tab {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 14px 22px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.3px;
          color: #94a3b8;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
          transition: color 0.2s, border-color 0.2s;
          margin-bottom: -1px;
        }
        .connect-tab:hover { color: #475569; }
        .connect-tab.active {
          color: #FF3D6D;
          border-bottom-color: #FF3D6D;
        }

        /* ─── Grid ────────────────────────────── */
        .connect-grid-wrapper {
          flex: 1;
          padding: 36px 40px 80px;
        }
        .connect-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
          align-items: start;
        }

        /* ─── Skeleton ────────────────────────── */
        .connect-skeleton {
          background: #fff;
          border-radius: 2rem;
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          border: 1px solid #f1f5f9;
        }
        .sk-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #f1f5f9;
          margin-bottom: 8px;
        }
        .sk-line {
          height: 14px;
          border-radius: 8px;
          background: #f1f5f9;
          width: 100%;
        }
        .sk-btn {
          width: 100%;
          height: 48px;
          border-radius: 1.2rem;
          background: #f1f5f9;
          margin-top: 12px;
        }
        .sk-pulse {
          animation: skPulse 1.5s ease-in-out infinite;
        }
        @keyframes skPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        /* ─── Empty state ─────────────────────── */
        .connect-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 80px 24px;
          color: #94a3b8;
        }
        .connect-empty-icon { font-size: 52px; margin-bottom: 16px; }
        .connect-empty h3 {
          font-size: 20px;
          font-weight: 800;
          color: #334155;
          margin: 0 0 6px;
        }
        .connect-empty p { font-size: 14px; margin: 0; }

        /* ─── Animations ──────────────────────── */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }

        /* ─── Responsive ──────────────────────── */
        @media (max-width: 1024px) {
          .connect-controls { padding: 16px 24px 0; }
          .connect-grid-wrapper { padding: 24px 24px 80px; }
          .connect-hero { padding: 36px 24px 52px; }
        }
        @media (max-width: 640px) {
          .connect-hero { padding: 28px 16px 44px; }
          .connect-controls { padding: 14px 16px 0; }
          .connect-grid-wrapper { padding: 20px 16px 80px; }
          .connect-grid { grid-template-columns: 1fr; gap: 16px; }
          .connect-tabbar { gap: 0; }
          .connect-tab { padding: 12px 14px; font-size: 12px; }
        }
      `}</style>
    </div>
  );
}
