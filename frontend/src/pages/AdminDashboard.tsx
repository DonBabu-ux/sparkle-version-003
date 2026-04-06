import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function AdminDashboard() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [content, setContent] = useState<any[]>([]);

  useEffect(() => {
    // Basic protection (Backend will enforce)
    // if (user?.user_role !== 'admin') {
    //   navigate('/dashboard');
    //   return;
    // }

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
    fetchStats();
  }, [user, navigate]);

  useEffect(() => {
    const fetchTabData = async () => {
      let endpoint = '';
      if (activeTab === 'users') endpoint = '/admin/users';
      if (activeTab === 'reports') endpoint = '/admin/reports';
      if (activeTab === 'logs') endpoint = '/admin/logs';

      if (!endpoint) return;

      try {
        const response = await api.get(endpoint);
        if (activeTab === 'log') setContent(response.data.logs);
        else if (activeTab === 'users') setContent(response.data.users);
        else if (activeTab === 'reports') setContent(response.data.reports || response.data.reportedItems);
        else setContent(response.data.data || []);
      } catch (err) {
        console.error(`Failed to fetch ${activeTab}:`, err);
      }
    };
    if (activeTab !== 'overview') fetchTabData();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#f1f5f9]">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 pb-20">
        <div className="flex items-center justify-between mb-10">
           <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-rose-600 rounded-2xl shadow-xl shadow-rose-100 flex items-center justify-center text-white text-3xl">🛡️</div>
             <div>
               <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Sanctum</h1>
               <p className="text-xs font-black text-rose-500 uppercase tracking-widest mt-0.5">Control & Oversight</p>
             </div>
           </div>
           
           <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm">
              {['overview', 'users', 'reports', 'logs'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
           </div>
        </div>

        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center">
             <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accessing core metrics...</p>
          </div>
        ) : activeTab === 'overview' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {[
                 { label: 'Total Sparklers', value: stats?.users?.total || 0, icon: '👤', color: 'bg-blue-500' },
                 { label: 'Active Spells', value: stats?.posts?.total || 0, icon: '✨', color: 'bg-indigo-500' },
                 { label: 'Open Disputes', value: stats?.reports?.pending || 0, icon: '⚖️', color: 'bg-rose-500' },
                 { label: 'Market Volume', value: stats?.marketplace?.total || 0, icon: '🛍️', color: 'bg-emerald-500' }
               ].map(stat => (
                 <div key={stat.label} className="premium-card bg-white border-white p-6 shadow-xl shadow-slate-200/50">
                    <div className="flex items-start justify-between mb-4">
                       <span className="text-sm font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                       <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center text-white text-xl shadow-lg`}>{stat.icon}</div>
                    </div>
                    <div className="text-3xl font-black text-slate-900">{stat.value.toLocaleString()}</div>
                 </div>
               ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="premium-card bg-white min-h-[300px]">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Recent Activity Pulse</h3>
                  <div className="space-y-4">
                     {stats?.recentActivity?.map((act: any, i: number) => (
                       <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                          <p className="text-xs font-bold text-slate-600 flex-1">{act.message}</p>
                          <span className="text-[9px] font-black text-slate-300 uppercase">{act.time}</span>
                       </div>
                     ))}
                  </div>
               </div>
               <div className="premium-card bg-rose-900 border-none text-white shadow-2xl shadow-rose-200">
                  <h3 className="text-sm font-black uppercase tracking-widest mb-6 opacity-60">System Integrity</h3>
                  <div className="space-y-6">
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-bold">Database Resonance</span>
                        <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/30">Stable</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-bold">Uptime Cycle</span>
                        <span className="text-[10px] font-black uppercase opacity-60">99.98%</span>
                     </div>
                     <div className="pt-6 border-t border-white/10">
                        <p className="text-xs font-medium text-white/50 leading-relaxed italic">"The light of the campus must never fade. Maintain vigilance over all transmissions."</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="premium-card bg-white p-0 overflow-hidden shadow-2xl shadow-slate-200 border-white">
             <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                   <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr className="border-b border-slate-100">
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 font-black">Subject</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 font-black">Status</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 font-black">Timestamp</th>
                         <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 font-black">Actions</th>
                      </tr>
                   </thead>
                   <tbody>
                      {content.length > 0 ? content.map((item, i) => (
                         <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-5">
                               <div className="flex items-center gap-3">
                                  {activeTab === 'users' ? (
                                    <>
                                      <img src={item.avatar_url || '/uploads/avatars/default.png'} className="w-8 h-8 rounded-lg" alt="" />
                                      <span className="text-xs font-bold text-slate-800">{item.name || item.username}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{item.title || item.type || item.action || 'Event'}</span>
                                  )}
                               </div>
                            </td>
                            <td className="px-8 py-5">
                               <span className="text-[9px] font-black uppercase px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">{item.status || 'Active'}</span>
                            </td>
                            <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                               {new Date(item.created_at || item.timestamp).toLocaleString()}
                            </td>
                            <td className="px-8 py-5">
                               <button className="text-[10px] font-black text-rose-600 hover:text-rose-700 uppercase tracking-widest">Manage</button>
                            </td>
                         </tr>
                      )) : (
                        <tr>
                           <td colSpan={4} className="py-20 text-center">
                              <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">The registry is currently hollow...</p>
                           </td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
