import { useState, useEffect } from 'react';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { Shield, Eye, Users, AlertCircle, BarChart3, Clock, MoreVertical, Ban, Trash2, CheckCircle, Activity, Layers, Sparkles, Orbit } from 'lucide-react';

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
      // Re-fetch data
      const response = await api.get(`/admin/${activeTab}`);
      if (activeTab === 'users') setContent(response.data.users || []);
      else if (activeTab === 'reports') setContent(response.data.reports || []);
    } catch {
      alert(`Failed to perform ${action}`);
    }
  };

  const [announcement, setAnnouncement] = useState('');
  const handleSendAnnouncement = async () => {
    if (!announcement.trim()) return;
    try {
      await api.post('/admin/announcements', { message: announcement });
      alert('Announcement broadcasted to all Sparklers!');
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
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-[1400px] mx-auto w-full pt-20 md:pt-32">
        
        <header className="flex flex-col xl:flex-row items-center justify-between gap-16 mb-24 animate-fade-in px-4">
          <div className="max-w-3xl space-y-8 text-center xl:text-left">
            <div className="inline-flex items-center gap-4 px-6 py-2.5 rounded-full bg-white/80 border border-white backdrop-blur-3xl shadow-xl shadow-primary/5 mx-auto xl:mx-0">
              <Shield size={18} strokeWidth={3} className="text-primary" />
              <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">Village Override</span>
            </div>
            <h1 className="text-6xl md:text-9xl font-black text-black tracking-tighter leading-none italic uppercase">
              Admin <span className="text-primary italic">Council.</span>
            </h1>
            <p className="text-xl font-bold text-black opacity-60 leading-relaxed max-w-xl italic border-l-8 border-primary/20 pl-8 mx-auto xl:mx-0">
              Synchronize village metrics, enforce harmony protocols, and broadcast consensus directives.
            </p>
          </div>

          <div className="flex bg-white/60 backdrop-blur-3xl border border-white p-3 rounded-[32px] shadow-2xl shadow-primary/5 w-full xl:w-auto overflow-x-auto no-scrollbar">
            {['overview', 'users', 'reports', 'logs'].map(tab => (
              <button 
                key={tab} 
                className={`flex-1 xl:flex-none px-10 h-16 rounded-[24px] font-black text-[10px] uppercase tracking-[0.3em] transition-all duration-700 flex items-center justify-center gap-4 italic ${activeTab === tab ? 'bg-black text-white shadow-2xl scale-105' : 'text-black opacity-30 hover:opacity-100 hover:bg-white/80'}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'overview' && <BarChart3 size={16} strokeWidth={4} />}
                {tab === 'users' && <Users size={16} strokeWidth={4} />}
                {tab === 'reports' && <AlertCircle size={16} strokeWidth={4} />}
                {tab === 'logs' && <Clock size={16} strokeWidth={4} />}
                <span>{tab}</span>
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="py-64 flex flex-col items-center justify-center animate-fade-in bg-white/40 backdrop-blur-3xl border-4 border-dashed border-white rounded-[80px] shadow-2xl shadow-primary/5 mb-40">
             <Orbit size={80} className="text-primary animate-spin-slow mb-10" strokeWidth={3} />
             <p className="text-[10px] font-black italic text-black/20 uppercase tracking-[0.4em] animate-pulse">Decrypting Village Telemetry...</p>
          </div>
        ) : activeTab === 'overview' ? (
          <div className="space-y-32 animate-fade-in relative z-10 px-4">
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {[
                { label: 'Campus Nodes', value: stats?.users?.total || 0, icon: <Users size={28} strokeWidth={3} /> },
                { label: 'Sparks Emitted', value: stats?.posts?.total || 0, icon: <Eye size={28} strokeWidth={3} /> },
                { label: 'Pending Protocols', value: stats?.reports?.pending || 0, icon: <AlertCircle size={28} strokeWidth={3} />, urgent: true },
                { label: 'Village Capital', value: stats?.marketplace?.total || 0, icon: <BarChart3 size={28} strokeWidth={3} /> }
              ].map(s => (
                <div key={s.label} className={`p-10 rounded-[56px] border-4 transition-all duration-700 bg-white shadow-2xl ${s.urgent ? 'border-primary/20 shadow-primary/10' : 'border-white'} hover:scale-105 group relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] pointer-events-none group-hover:opacity-100 opacity-60 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-10 relative z-10">
                    <span className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] shrink-0 italic">{s.label}</span>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 ${s.urgent ? 'bg-primary text-white shadow-2xl rotate-12' : 'bg-black/5 text-black/20 group-hover:bg-primary group-hover:text-white group-hover:rotate-12'}`}>
                       {s.icon}
                    </div>
                  </div>
                  <div className={`text-6xl md:text-7xl font-black italic tracking-tighter leading-none group-hover:text-primary transition-colors uppercase relative z-10 ${s.urgent ? 'text-primary' : 'text-black'}`}>
                    {s.value > 999 ? `${(s.value / 1000).toFixed(1)}k` : s.value}
                  </div>
                </div>
              ))}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div className="bg-white/80 backdrop-blur-3xl p-12 md:p-16 rounded-[64px] border border-white shadow-2xl shadow-primary/5 overflow-hidden relative group">
                <div className="absolute top-[-50px] right-[-50px] p-20 text-black/[0.02] group-hover:text-primary/[0.05] transition-all duration-[2s] pointer-events-none group-hover:rotate-12 group-hover:scale-150">
                    <Activity size={300} strokeWidth={1} />
                </div>
                <div className="flex items-center gap-6 mb-16 relative z-10">
                   <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary animate-pulse">
                      <Activity size={28} strokeWidth={3} />
                   </div>
                   <h3 className="text-4xl font-black text-black italic uppercase tracking-tighter leading-none">Live Telemetry</h3>
                </div>
                <div className="space-y-8 relative z-10 max-h-[600px] overflow-y-auto no-scrollbar pr-4">
                  {stats?.recentActivity?.map((act, i) => (
                    <div key={i} className="flex items-start gap-8 p-8 bg-black/5 border border-black/5 rounded-[40px] hover:bg-black hover:text-white transition-all group/item duration-700 hover:scale-[1.02] hover:-rotate-1">
                      <div className="w-4 h-4 bg-primary rounded-full mt-2 animate-ping shrink-0 shadow-2xl shadow-primary" />
                      <div className="flex-1">
                         <p className="text-lg font-bold leading-tight italic uppercase tracking-tight opacity-80 group-hover/item:opacity-100">{act.message}</p>
                         <div className="flex justify-between items-center mt-6">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">Sync Protocol OK</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/20 group-hover/item:text-white/40">
                               {act.time}
                            </span>
                         </div>
                      </div>
                    </div>
                  ))}
                  {!stats?.recentActivity?.length && (
                    <div className="py-40 text-center opacity-10 uppercase tracking-[0.5em] font-black text-xs italic">Awaiting Signals...</div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-16">
                <div className="bg-black text-white p-12 md:p-16 rounded-[64px] shadow-[0_64px_140px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                  <div className="absolute -top-10 -right-10 p-12 text-white/5 opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all duration-[3000ms] group-hover:scale-125">
                     <Shield size={300} fill="currentColor" strokeWidth={0} />
                  </div>
                  <h3 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-12 relative z-10">Council Core</h3>
                  <div className="space-y-10 relative z-10">
                    <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 flex justify-between items-center transition-all hover:bg-white/10 group/item">
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/30 italic">Village Latency</span>
                        <span className="text-sm font-black uppercase tracking-[0.2em] italic">Database Connection</span>
                      </div>
                      <span className="px-6 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 group-hover/item:animate-pulse">Active Sync</span>
                    </div>
                    <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 flex justify-between items-center">
                       <span className="text-sm font-black uppercase tracking-[0.4em] italic text-white/30">Sector Uptime</span>
                       <span className="text-4xl md:text-5xl font-black italic tracking-[0.05em] text-primary">99.9%</span>
                    </div>
                    <p className="text-white/20 text-base font-bold italic leading-tight pt-10 border-t border-white/5 pr-12 uppercase tracking-tighter">
                       "Every harmonic synchronized. Every student secure. The village breathes as one."
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-3xl p-12 md:p-16 rounded-[64px] border border-white shadow-2xl shadow-primary/5 group relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 blur-[60px] pointer-events-none group-hover:opacity-100 opacity-60"></div>
                   <div className="flex items-center gap-6 mb-12 relative z-10">
                      <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/30 group-hover:rotate-12 transition-transform">
                         <Sparkles size={28} strokeWidth={3} />
                      </div>
                      <h3 className="text-4xl font-black text-black italic uppercase tracking-tighter leading-none">Council Directive</h3>
                   </div>
                   <div className="space-y-10 relative z-10">
                      <textarea 
                         value={announcement}
                         onChange={e => setAnnouncement(e.target.value)}
                         placeholder="Broadcast consensus to all village nodes..." 
                         className="w-full min-h-[180px] bg-black/5 border-4 border-transparent rounded-[40px] p-10 text-lg font-black text-black placeholder:text-black/10 focus:bg-white focus:border-primary/20 transition-all outline-none italic resize-none shadow-inner"
                      />
                      <button 
                         onClick={handleSendAnnouncement}
                         className="w-full h-24 bg-primary text-white rounded-[32px] font-black text-sm uppercase tracking-[0.5em] shadow-2xl shadow-primary/40 hover:scale-[1.03] hover:shadow-primary/60 transition-all italic active:scale-95"
                      >
                         Initialize Broadcast
                      </button>
                   </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-3xl rounded-[64px] border border-white shadow-2xl shadow-primary/5 overflow-hidden animate-fade-in mb-64 px-4">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/5">
                    <th className="px-12 py-10 text-[10px] font-black uppercase tracking-[0.5em] italic text-black/20">Protocol Subject</th>
                    <th className="px-12 py-10 text-[10px] font-black uppercase tracking-[0.5em] italic text-black/20">Frequency Status</th>
                    <th className="px-12 py-10 text-[10px] font-black uppercase tracking-[0.5em] italic text-black/20">Time Vector</th>
                    <th className="px-12 py-10 text-[10px] font-black uppercase tracking-[0.5em] italic text-black/20 text-right">Overrides</th>
                  </tr>
                </thead>
                <tbody>
                  {content.length > 0 ? content.map((item, i) => (
                    <tr key={i} className="border-b border-black/5 hover:bg-black/[0.01] transition-all group">
                      <td className="px-12 py-12">
                        <div className="flex items-center gap-8">
                          {activeTab === 'users' ? (
                            <>
                              <div className="relative">
                                 <img src={item.avatar_url || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-2xl object-cover border-4 border-white group-hover:scale-110 group-hover:rotate-6 transition-all shadow-2xl" alt="" />
                                 <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white shadow-lg"></div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <span className="text-xl font-black italic uppercase tracking-tighter leading-none group-hover:text-primary transition-colors">{item.name || item.username}</span>
                                <span className="text-[10px] font-black text-black opacity-30 uppercase tracking-widest italic">{item.email}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <span className="text-xl font-black italic uppercase tracking-tighter leading-none group-hover:text-primary transition-colors">{item.title || item.type || item.action || 'Management Directive'}</span>
                              <span className="text-[10px] font-black text-black opacity-30 uppercase tracking-widest truncate max-w-xs italic">{item.details || 'NODE-ID: '+ (item.id || item.listing_id || i).toString().slice(0, 10).toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-12 py-12">
                        <span className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                            item.status?.toLowerCase() === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 
                            item.status?.toLowerCase() === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-lg shadow-amber-500/5' :
                            'bg-black text-white border-black shadow-lg shadow-black/20'}`}>
                          {item.status || 'Verified'}
                        </span>
                      </td>
                      <td className="px-12 py-12 text-[11px] font-black uppercase tracking-widest text-black/20 italic">
                         {new Date(item.created_at || item.timestamp || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                      </td>
                      <td className="px-12 py-12">
                        <div className="flex items-center justify-end gap-5 opacity-40 group-hover:opacity-100 transition-all duration-700">
                          <button onClick={() => handleAdminAction(item.id || item.user_id || '', 'approve')} className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center hover:scale-125 hover:rotate-12 active:scale-95 transition-all shadow-2xl shadow-emerald-500/30" title="Verify Node"><CheckCircle size={18} strokeWidth={4} /></button>
                          <button onClick={() => handleAdminAction(item.id || item.user_id || '', 'restrict')} className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center hover:scale-125 hover:-rotate-12 active:scale-95 transition-all shadow-2xl shadow-amber-500/30" title="Isolate Node"><Ban size={18} strokeWidth={4} /></button>
                          <button onClick={() => handleAdminAction(item.id || item.user_id || '', 'purge')} className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center hover:scale-125 hover:rotate-12 active:scale-95 transition-all shadow-2xl shadow-primary/30" title="Purge Node"><Trash2 size={18} strokeWidth={4} /></button>
                          <button className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center hover:scale-125 hover:-rotate-12 active:scale-95 transition-all shadow-2xl shadow-black/40"><MoreVertical size={18} strokeWidth={4} /></button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="py-64 text-center bg-black/[0.01]">
                        <div className="flex flex-col items-center gap-10">
                           <Layers size={100} strokeWidth={1} className="text-black/5 animate-pulse" />
                           <p className="text-[10px] font-black italic uppercase tracking-[0.5em] text-black/20">Sector Stream Empty</p>
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
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
