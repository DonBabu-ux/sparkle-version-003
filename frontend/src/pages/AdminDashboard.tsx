import { useState, useEffect } from 'react';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { 
  Shield, Eye, Users, AlertCircle, BarChart3, Clock, MoreVertical, 
  Ban, Trash2, CheckCircle, Activity, Layers, Sparkles, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/ui/Spinner';

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
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [content, setContent] = useState<AdminContentItem[]>([]);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    fetchStats();
    document.title = 'Admin Panel | Sparkle';
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

  const handleAdminAction = async (id: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action} this item?`)) return;
    try {
      await api.post(`/admin/actions`, { id, action, type: activeTab });
      alert(`Action ${action} successful`);
      const response = await api.get(`/admin/${activeTab}`);
      if (activeTab === 'users') setContent(response.data.users || []);
      else if (activeTab === 'reports') setContent(response.data.reports || []);
    } catch {
      alert(`Failed to perform ${action}`);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announcement.trim()) return;
    try {
      await api.post('/admin/announcements', { message: announcement });
      alert('Announcement broadcasted!');
      setAnnouncement('');
    } catch {
      alert('Failed to broadcast announcement');
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
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans pb-20">
      <Navbar />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 relative z-10 max-w-6xl mx-auto w-full pt-16 md:pt-24">
        
        {/* Compact Header */}
        <header className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-100 text-gray-500 active:scale-90 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-white backdrop-blur-xl shadow-sm">
              <Shield size={12} strokeWidth={3} className="text-primary" />
              <span className="text-[8px] font-black text-black uppercase tracking-widest italic">Override</span>
            </div>
          </div>
          
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tighter uppercase italic leading-none mb-2">
              Admin <span className="text-primary">Council.</span>
            </h1>
            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest max-w-md mx-auto md:mx-0">
              Synchronize village metrics & harmony protocols.
            </p>
          </div>
        </header>

        {/* Tab Navigation - Compact Row */}
        <div className="flex bg-white/60 backdrop-blur-xl border border-white p-1 rounded-2xl shadow-sm mb-8 overflow-x-auto no-scrollbar sticky top-16 z-50">
          {['overview', 'users', 'reports', 'logs'].map(tab => (
            <button 
              key={tab} 
              className={`flex-1 min-w-[80px] h-10 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 italic ${
                activeTab === tab ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' && <BarChart3 size={12} strokeWidth={3} />}
              {tab === 'users' && <Users size={12} strokeWidth={3} />}
              {tab === 'reports' && <AlertCircle size={12} strokeWidth={3} />}
              {tab === 'logs' && <Clock size={12} strokeWidth={3} />}
              <span>{tab}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-xl border-2 border-dashed border-white rounded-[40px] shadow-sm mb-12">
             <Spinner size="large" color="text-primary" />
             <p className="text-[9px] font-black italic text-gray-400 uppercase tracking-widest mt-4">Decrypting Telemetry...</p>
          </div>
        ) : activeTab === 'overview' ? (
          <div className="space-y-8 animate-fade-in">
            {/* Stats Grid - High Density */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              {[
                { label: 'Users', value: stats?.users?.total || 0, icon: <Users size={18} strokeWidth={3} /> },
                { label: 'Posts', value: stats?.posts?.total || 0, icon: <Eye size={18} strokeWidth={3} /> },
                { label: 'Reports', value: stats?.reports?.pending || 0, icon: <AlertCircle size={18} strokeWidth={3} />, urgent: true },
                { label: 'Capital', value: stats?.marketplace?.total || 0, icon: <BarChart3 size={18} strokeWidth={3} /> }
              ].map(s => (
                <div key={s.label} className={`p-4 md:p-6 rounded-[24px] border-2 transition-all bg-white shadow-sm hover:shadow-md ${s.urgent ? 'border-primary/10 shadow-primary/5' : 'border-white'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest italic">{s.label}</span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.urgent ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'}`}>
                       {s.icon}
                    </div>
                  </div>
                  <div className={`text-2xl md:text-3xl font-black italic tracking-tighter leading-none uppercase ${s.urgent ? 'text-primary' : 'text-gray-900'}`}>
                    {s.value > 999 ? `${(s.value / 1000).toFixed(1)}k` : s.value}
                  </div>
                </div>
              ))}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Activity Feed - Compact */}
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[32px] border border-white shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <Activity size={16} strokeWidth={3} />
                   </div>
                   <h3 className="text-lg font-black text-gray-900 italic uppercase tracking-tight">Live Signals</h3>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                  {stats?.recentActivity?.map((act, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-white border border-gray-50 rounded-[20px] hover:bg-primary/5 transition-all group">
                      <div className="w-2 h-2 bg-primary rounded-full shrink-0 shadow-[0_0_8px_rgba(255,105,180,0.4)]" />
                      <div className="flex-1 min-w-0">
                         <p className="text-[11px] font-bold text-gray-700 leading-tight truncate uppercase italic">{act.message}</p>
                         <div className="flex justify-between items-center mt-1">
                            <span className="text-[8px] font-black uppercase tracking-widest text-primary italic">Sync Protocol</span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-gray-300">{act.time}</span>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Council Directive - Compact */}
              <div className="bg-white p-6 rounded-[32px] border border-white shadow-sm flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                     <Sparkles size={16} strokeWidth={3} />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 italic uppercase tracking-tight">Directives</h3>
                </div>
                <div className="space-y-4">
                  <textarea 
                     value={announcement}
                     onChange={e => setAnnouncement(e.target.value)}
                     placeholder="Broadcast consensus to village nodes..." 
                     className="w-full min-h-[100px] bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold text-gray-900 placeholder:text-gray-300 focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none italic resize-none"
                  />
                  <button 
                     onClick={handleSendAnnouncement}
                     className="w-full py-3 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg shadow-primary/30 active:scale-95 transition-all italic"
                  >
                     Send Broadcast
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Content Table - Modern & Tight */
          <div className="bg-white rounded-[32px] border border-white shadow-sm overflow-hidden animate-fade-in mb-20">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest italic text-gray-400">Subject</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest italic text-gray-400">Status</th>
                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest italic text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {content.length > 0 ? content.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50/30 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {activeTab === 'users' ? (
                            <>
                              <img src={getAvatarUrl(item.avatar_url, item.username)} className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm" alt="" />
                              <div className="flex flex-col">
                                <span className="text-[12px] font-black italic uppercase tracking-tight text-gray-900 leading-none mb-1">{item.name || item.username}</span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">{item.email}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-[12px] font-black italic uppercase tracking-tight text-gray-900 leading-none mb-1">{item.title || item.type || item.action}</span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[150px] italic">{item.details || 'System Signal'}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                            item.status?.toLowerCase() === 'active' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 
                            item.status?.toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-500 border-amber-100' :
                            'bg-gray-900 text-white border-black'}`}>
                          {item.status || 'Verified'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleAdminAction(item.id || item.user_id || '', 'approve')} className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-sm"><CheckCircle size={14} /></button>
                          <button onClick={() => handleAdminAction(item.id || item.user_id || '', 'restrict')} className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-sm"><Ban size={14} /></button>
                          <button onClick={() => handleAdminAction(item.id || item.user_id || '', 'purge')} className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-sm"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                           <Layers size={32} strokeWidth={1} className="text-gray-100" />
                           <p className="text-[9px] font-black italic uppercase tracking-widest text-gray-300">Stream Empty</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function getAvatarUrl(url: string | undefined, username: string | undefined) {
  if (url && url.startsWith('http')) return url;
  if (url) return `http://localhost:3000${url}`;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'U')}&background=random&color=fff`;
}
