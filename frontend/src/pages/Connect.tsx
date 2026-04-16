import { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, TrendingUp, Users, UserCheck } from 'lucide-react';
import Navbar from '../components/Navbar';
import UserCard from '../components/UserCard';
import api from '../api/api';

const FILTERS = ['For You', 'Campus', 'Interests', 'Level'];
const TABS = ['Suggested', 'Trending', 'Similar', 'Following'];

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
}

export default function Connect() {
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Suggested');
  const [activeFilter, setActiveFilter] = useState('For You');
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [activeTab, activeFilter]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { tab: activeTab.toLowerCase() };
      if (searchQuery) params.q = searchQuery;
      if (activeFilter === 'Campus') params.filter = 'campus';
      const res = await api.get('/users/suggestions', { params });
      setUsers(res.data.users || res.data || []);
    } catch (err) {
      console.error('Connect fetch error:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };


  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'Suggested': return <UserPlus size={15} />;
      case 'Trending': return <TrendingUp size={15} />;
      case 'Similar': return <Users size={15} />;
      case 'Following': return <UserCheck size={15} />;
      default: return null;
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="connect-wrapper">
        <div className="connect-sticky-header">
          {/* Search */}
          <div className="connect-search-box">
            <Search size={18} className="connect-search-icon" />
            <input
              type="text"
              placeholder="Search students, majors, campus..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Chips */}
          <div className="connect-filter-chips">
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

          {/* Tabs */}
          <div className="connect-tabs-row">
            {TABS.map(tab => (
              <button
                key={tab}
                className={`connect-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {getTabIcon(tab)} {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="connect-feed">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="connect-skeleton">
                <div className="skel-avatar pulse" />
                <div className="skel-info">
                  <div className="skel-line pulse" style={{ width: '55%', marginBottom: 6 }} />
                  <div className="skel-line pulse" style={{ width: '80%' }} />
                </div>
                <div className="skel-btn pulse" />
              </div>
            ))
          ) : users.length === 0 ? (
            <div className="connect-empty">
              <div className="connect-empty-icon">🧑‍🚀</div>
              <h3>No suggestions found</h3>
              <p>Try switching tabs or adjusting filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
              {users.map(u => (
                <UserCard 
                  key={(u.user_id || u.id) as string}
                  u={u}
                  onRemove={(id) => setUsers(prev => prev.filter(user => (user.user_id || user.id) !== id))}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: #fcfcfd; min-height: 100vh; }
        .connect-wrapper { flex: 1; max-width: 1000px; margin: 0 auto; padding: 0 24px; min-height: 100vh; }

        .connect-sticky-header { 
          position: sticky; 
          top: 0; 
          background: rgba(252, 252, 253, 0.8); 
          backdrop-filter: blur(20px);
          z-index: 900; 
          padding: 24px 0 16px; 
          margin-bottom: 32px; 
        }

        .connect-search-box { 
          display: flex; 
          align-items: center; 
          background: white; 
          border: 1px solid #e2e8f0; 
          border-radius: 20px; 
          padding: 16px 24px; 
          margin-bottom: 24px; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          box-shadow: 0 10px 30px rgba(0,0,0,0.02); 
        }
        .connect-search-box:focus-within { 
          border-color: #FF3D6D; 
          box-shadow: 0 15px 40px rgba(255,61,109,0.08); 
          transform: translateY(-2px);
        }
        .connect-search-icon { color: #94a3b8; margin-right: 14px; flex-shrink: 0; transition: color 0.3s; }
        .connect-search-box:focus-within .connect-search-icon { color: #FF3D6D; }
        .connect-search-box input { border: none; background: transparent; width: 100%; font-size: 16px; color: #1e293b; outline: none; font-weight: 500; }
        .connect-search-box input::placeholder { color: #94a3b8; }

        .connect-filter-chips { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 20px; scrollbar-width: none; }
        .connect-filter-chips::-webkit-scrollbar { display: none; }
        .connect-chip { 
          padding: 10px 24px; 
          border-radius: 100px; 
          font-size: 14px; 
          font-weight: 700; 
          white-space: nowrap; 
          cursor: pointer; 
          border: 1px solid #e2e8f0; 
          background: white; 
          color: #64748b; 
          transition: all 0.3s ease; 
        }
        .connect-chip:hover { border-color: #FF3D6D; color: #FF3D6D; background: rgba(255,61,109,0.02); }
        .connect-chip.active { background: #FF3D6D; color: white; border-color: #FF3D6D; box-shadow: 0 8px 20px rgba(255,61,109,0.25); }

        .connect-tabs-row { display: flex; gap: 32px; border-bottom: 1px solid #f1f5f9; padding: 0 8px; }
        .connect-tab { 
          background: none; 
          border: none; 
          padding: 12px 4px 20px; 
          font-size: 15px; 
          font-weight: 800; 
          color: #94a3b8; 
          cursor: pointer; 
          position: relative; 
          transition: all 0.3s ease; 
          display: flex; 
          align-items: center; 
          gap: 8px; 
        }
        .connect-tab:hover { color: #64748b; }
        .connect-tab.active { color: #1e293b; }
        .connect-tab.active::after { 
          content: ''; 
          position: absolute; 
          bottom: -1px; 
          left: 0; 
          right: 0; 
          height: 3px; 
          background: #FF3D6D; 
          border-radius: 100px; 
        }

        .connect-feed { padding-bottom: 100px; }

        .connect-user-card { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-radius: 14px; background: white; border: 1px solid #f8fafc; transition: 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
        .connect-user-card:hover { background: #fafafa; border-color: #f1f5f9; }
        .connect-card-left { display: flex; align-items: center; gap: 14px; flex: 1; overflow: hidden; cursor: pointer; }
        .connect-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: #f1f5f9; }
        .connect-card-info { overflow: hidden; }
        .connect-card-name { font-weight: 700; font-size: 15px; color: #1e293b; margin-bottom: 2px; display: flex; align-items: center; gap: 4px; }
        .connect-verified { color: var(--primary, #FF3D6D); font-size: 12px; }
        .connect-card-sub { font-size: 13px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .connect-mutuals { font-size: 12px; color: var(--primary, #FF3D6D); margin-top: 2px; font-weight: 600; }
        .connect-follow-btn { background: var(--primary, #FF3D6D); color: white; border: none; padding: 8px 20px; border-radius: 25px; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.2s; flex-shrink: 0; }
        .connect-follow-btn.following { background: #f1f5f9; color: #334155; }
        .connect-follow-btn:hover { opacity: 0.85; }

        .connect-skeleton { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 14px; background: white; border: 1px solid #f8fafc; }
        .skel-avatar { width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; flex-shrink: 0; }
        .skel-info { flex: 1; }
        .skel-line { height: 12px; border-radius: 6px; background: #f1f5f9; }
        .skel-btn { width: 72px; height: 34px; border-radius: 20px; background: #f1f5f9; }
        .pulse { animation: pulseConn 1.5s ease-in-out infinite; }
        @keyframes pulseConn { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .connect-empty { text-align: center; padding: 60px 20px; color: #94a3b8; }
        .connect-empty-icon { font-size: 40px; margin-bottom: 14px; }
        .connect-empty h3 { font-size: 18px; font-weight: 800; color: #334155; margin: 0 0 6px; }
        .connect-empty p { font-size: 14px; }
      `}</style>
    </div>
  );
}
