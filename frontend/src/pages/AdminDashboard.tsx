import { useState, useEffect } from 'react';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { Shield, Eye, Users, AlertCircle, BarChart3, Clock, MoreVertical, Ban, Trash2, CheckCircle } from 'lucide-react';

interface AdminStats {
  users?: { total: number };
  posts?: { total: number };
  reports?: { pending: number };
  marketplace?: { total: number };
  recentActivity?: Array<{ message: string; time: string }>;
}

interface AdminContentItem {
  id?: string;
  user_id?: string;
  username?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  title?: string;
  type?: string;
  action?: string;
  details?: string;
  listing_id?: string;
  status?: string;
  created_at?: string;
  timestamp?: string;
}

export default function AdminDashboard() {
  
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [content, setContent] = useState<AdminContentItem[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchTabData = async () => {
      let endpoint = '';
      if (activeTab === 'users') endpoint = '/admin/users';
      if (activeTab === 'reports') endpoint = '/admin/reports';
      if (activeTab === 'logs') endpoint = '/admin/logs';

      if (!endpoint) return;

      try {
        const response = await api.get(endpoint);
        if (activeTab === 'logs') setContent(response.data.logs || []);
        else if (activeTab === 'users') setContent(response.data.users || []);
        else if (activeTab === 'reports') setContent(response.data.reports || response.data.reportedItems || []);
        else setContent(response.data.data || []);
      } catch (err) {
        console.error(`Failed to fetch ${activeTab}:`, err);
      }
    };
    if (activeTab !== 'overview') fetchTabData();
  }, [activeTab]);

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="admin-layout">
        <header className="admin-header">
          <div className="header-identity">
            <div className="admin-badge">
              <Shield size={20} />
              <span>CORE OVERSIGHT</span>
            </div>
            <h1>The Sanctum</h1>
            <p>Maintain the light of the campus.</p>
          </div>

          <div className="admin-tabs-nav">
            {['overview', 'users', 'reports', 'logs'].map(tab => (
              <button 
                key={tab} 
                className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'overview' && <BarChart3 size={16} />}
                {tab === 'users' && <Users size={16} />}
                {tab === 'reports' && <AlertCircle size={16} />}
                {tab === 'logs' && <Clock size={16} />}
                <span>{tab}</span>
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="admin-loader">Accessing core metrics...</div>
        ) : activeTab === 'overview' ? (
          <div className="overview-grid">
            <section className="stats-row">
              {[
                { label: 'Sparklers', value: stats?.users?.total || 0, color: '#3b82f6', icon: <Users size={24} /> },
                { label: 'Spells', value: stats?.posts?.total || 0, color: '#6366f1', icon: <Eye size={24} /> },
                { label: 'Disputes', value: stats?.reports?.pending || 0, color: '#ef4444', icon: <AlertCircle size={24} /> },
                { label: 'Market Vol.', value: stats?.marketplace?.total || 0, color: '#10b981', icon: <BarChart3 size={24} /> }
              ].map(s => (
                <div key={s.label} className="stat-box premium-card">
                  <div className="stat-head">
                    <span className="label">{s.label}</span>
                    <div className="icon-wrap" style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
                  </div>
                  <div className="value">{s.value.toLocaleString()}</div>
                </div>
              ))}
            </section>

            <div className="overview-details">
              <div className="activity-feed premium-card">
                <h3>Activity Pulse</h3>
                <div className="feed-list">
                  {stats?.recentActivity?.map((act, i) => (
                    <div key={i} className="feed-item">
                      <div className="dot"></div>
                      <p className="msg">{act.message}</p>
                      <span className="time">{act.time}</span>
                    </div>
                  ))}
                  {!stats?.recentActivity?.length && <div className="empty">Quiet in the sector...</div>}
                </div>
              </div>

              <div className="system-health premium-card">
                <h3>System Integrity</h3>
                <div className="health-metrics">
                  <div className="m-row">
                    <span>Database Resonance</span>
                    <span className="status stable">STABLE</span>
                  </div>
                  <div className="m-row">
                    <span>Uptime Cycle</span>
                    <span className="val">99.98%</span>
                  </div>
                  <blockquote className="m-quote">
                    "The light of the campus must never fade. Maintain vigilance."
                  </blockquote>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-table-container premium-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {content.length > 0 ? content.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <div className="subject-cell">
                        {activeTab === 'users' ? (
                          <>
                            <img src={item.avatar_url || '/uploads/avatars/default.png'} className="sub-img" alt="" />
                            <div className="sub-info">
                              <span className="name">{item.name || item.username}</span>
                              <span className="meta">{item.email}</span>
                            </div>
                          </>
                        ) : (
                          <div className="sub-info">
                            <span className="name">{item.title || item.type || item.action || 'Registry Entry'}</span>
                            <span className="meta">{item.details || 'ID: '+ (item.id || item.listing_id || i)}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status-tag ${item.status?.toLowerCase() || 'active'}`}>
                        {item.status || 'Active'}
                      </span>
                    </td>
                    <td className="time">{new Date(item.created_at || item.timestamp).toLocaleDateString()}</td>
                    <td>
                      <div className="action-row">
                        <button className="act-btn" title="Approve"><CheckCircle size={14} /></button>
                        <button className="act-btn warn" title="Restrict"><Ban size={14} /></button>
                        <button className="act-btn danger" title="Purge"><Trash2 size={14} /></button>
                        <button className="act-btn"><MoreVertical size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="table-empty">
                      The registry is currently hollow...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <style>{`
        .page-wrapper { display: flex; background: #f1f5f9; min-height: 100vh; }
        .admin-layout { flex: 1; padding: 40px 20px 100px; max-width: 1200px; margin: 0 auto; }

        .admin-header { margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; gap: 30px; }
        .admin-badge { display: flex; align-items: center; gap: 8px; background: #be123c; color: white; padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 0.7rem; letter-spacing: 1px; margin-bottom: 12px; width: fit-content; }
        .admin-header h1 { font-size: 2.4rem; font-weight: 900; color: #0f172a; margin: 0 0 6px; letter-spacing: -1px; }
        .admin-header p { color: #64748b; font-size: 1rem; margin: 0; }

        .admin-tabs-nav { display: flex; background: white; padding: 6px; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.05); }
        .admin-tab { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 14px; border: none; background: transparent; color: #94a3b8; font-weight: 800; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; cursor: pointer; transition: 0.2s; }
        .admin-tab:hover { color: #0f172a; }
        .admin-tab.active { background: #0f172a; color: white; box-shadow: 0 10px 20px rgba(15,23,42,0.2); }

        .admin-loader { text-align: center; padding: 100px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }

        .overview-grid { display: flex; flex-direction: column; gap: 30px; }
        .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }
        .stat-box { padding: 24px; }
        .stat-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .stat-head .label { font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .icon-wrap { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
        .stat-box .value { font-size: 2.2rem; font-weight: 950; color: #0f172a; }

        .overview-details { display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; }
        @media (max-width: 900px) { .overview-details { grid-template-columns: 1fr; } }

        .activity-feed h3, .system-health h3 { font-size: 0.8rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; }
        .feed-list { display: flex; flex-direction: column; gap: 12px; }
        .feed-item { display: flex; align-items: center; gap: 14px; padding: 14px; background: #f8fafc; border-radius: 16px; border: 1px solid #f1f5f9; }
        .feed-item .dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }
        .feed-item .msg { flex: 1; font-size: 0.85rem; font-weight: 600; color: #334155; margin: 0; }
        .feed-item .time { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; }

        .health-metrics { display: flex; flex-direction: column; gap: 20px; }
        .system-health { background: #0f172a; color: white; border: none; }
        .system-health h3 { color: #475569; }
        .m-row { display: flex; justify-content: space-between; font-weight: 700; font-size: 0.9rem; }
        .status.stable { color: #10b981; font-weight: 900; }
        .m-quote { margin: 20px 0 0; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); font-style: italic; color: #64748b; font-size: 0.85rem; }

        .admin-table-container { padding: 0; overflow: hidden; }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { background: #f8fafc; text-align: left; padding: 20px 24px; font-size: 0.75rem; font-weight: 850; text-transform: uppercase; color: #94a3b8; border-bottom: 2px solid #f1f5f9; }
        .admin-table td { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; }
        
        .subject-cell { display: flex; align-items: center; gap: 16px; }
        .sub-img { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; }
        .sub-info { display: flex; flex-direction: column; }
        .sub-info .name { font-size: 0.95rem; font-weight: 800; color: #1e293b; }
        .sub-info .meta { font-size: 0.75rem; color: #94a3b8; }

        .status-tag { display: inline-block; padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 900; text-transform: uppercase; background: #f1f5f9; color: #64748b; }
        .status-tag.active { background: #dcfce7; color: #166534; }
        .status-tag.pending { background: #fef3c7; color: #92400e; }
        
        .action-row { display: flex; gap: 6px; }
        .act-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .act-btn:hover { color: #0f172a; border-color: #0f172a; }
        .act-btn.warn:hover { color: #f59e0b; border-color: #f59e0b; }
        .act-btn.danger:hover { color: #ef4444; border-color: #ef4444; }

        .table-empty { padding: 100px; text-align: center; color: #94a3b8; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px; font-style: italic; opacity: 0.4; }
      `}</style>
    </div>
  );
}
