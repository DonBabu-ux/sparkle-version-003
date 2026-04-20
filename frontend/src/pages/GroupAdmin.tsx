import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/api';
import type { Group } from '../types/group';

interface GroupRequest {
  request_id: string;
  avatar_url?: string;
  name?: string;
  username: string;
  created_at: string;
}

export default function GroupAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<GroupRequest[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [groupRes, requestsRes] = await Promise.all([
          api.get(`/groups/${id}`),
          api.get(`/groups/${id}/requests`)
        ]);
        
        if (!groupRes.data.userRole || groupRes.data.userRole !== 'owner') {
          navigate(`/groups/${id}`);
          return;
        }

        setGroup(groupRes.data.group);
        setRequests(requestsRes.data || []);
      } catch (err) {
        console.error('Admin load failed:', err);
        navigate(`/groups/${id}`);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, [id, navigate]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const res = await api.post(`/groups/requests/${requestId}/${action}`);
      if (res.data.success) {
        setRequests(prev => prev.filter(r => r.request_id !== requestId));
      }
    } catch (err) {
      console.error(`${action} failed:`, err);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 py-20">
         <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl">🛡️</div>
               <div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">Founder Panel</h1>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group?.name}</p>
               </div>
            </div>
            <Link to={`/groups/${id}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 border border-slate-200 px-6 py-2 rounded-xl transition-all">Back to Fleet</Link>
         </div>

         <div className="space-y-10">
            <section>
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 ml-2">Pendings Resonance</h3>
               <div className="premium-card bg-white p-0 overflow-hidden shadow-2xl shadow-slate-200 border-white">
                  {requests.length > 0 ? (
                    <div className="divide-y divide-slate-50">
                       {requests.map(req => (
                         <div key={req.request_id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                               <img src={req.avatar_url || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-xl object-cover shadow-sm bg-slate-100" />
                               <div>
                                  <h4 className="text-sm font-black text-slate-800">{req.name || req.username}</h4>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Signal Latency: {new Date(req.created_at).toLocaleDateString()}</p>
                               </div>
                            </div>
                            <div className="flex gap-2">
                               <button 
                                 onClick={() => handleAction(req.request_id, 'reject')}
                                 className="px-5 py-2 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-md shadow-rose-100"
                               >
                                 Deny
                               </button>
                               <button 
                                 onClick={() => handleAction(req.request_id, 'approve')}
                                 className="px-5 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100"
                               >
                                 Harmonize
                               </button>
                            </div>
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center">
                       <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">All signals are currently synchronized.</p>
                    </div>
                  )}
               </div>
            </section>

            <section className="opacity-40 pointer-events-none">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 ml-2">Collective Configuration</h3>
                <div className="premium-card bg-white p-8 space-y-6">
                   <div className="h-4 bg-slate-100 rounded-full w-3/4"></div>
                   <div className="h-4 bg-slate-100 rounded-full w-1/2"></div>
                </div>
            </section>
         </div>
      </main>
    </div>
  );
}
