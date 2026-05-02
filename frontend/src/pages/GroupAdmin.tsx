import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/api';
import type { Group } from '../types/group';
import { Shield, ArrowLeft, Check, X, Users, Sparkles } from 'lucide-react';

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

  if (loading) return (
    <div className="flex min-h-screen font-sans" style={{ background: 'linear-gradient(135deg, #fff0f4 0%, #fff9fa 60%, #fef0f5 100%)' }}>
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 gap-6">
        <div className="w-16 h-16 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(255,61,109,0.2)', borderTopColor: '#FF3D6D' }} />
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', fontStyle: 'normal' }}>Loading Admin...</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen font-sans" style={{ background: 'linear-gradient(135deg, #fff0f4 0%, #fff9fa 60%, #fef0f5 100%)' }}>
      <Navbar />
      <div className="fixed top-[-80px] right-[-80px] w-[420px] h-[420px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,61,109,0.18) 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-60px] left-[-60px] w-[360px] h-[360px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,100,150,0.14) 0%, transparent 70%)' }} />

      <main className="flex-1 lg:ml-72 p-6 lg:p-10 relative z-10 max-w-4xl mx-auto w-full pt-20">
        <div className="flex items-center justify-between mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Link 
            to={`/groups/${id}`}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:bg-slate-50 transition-all">
              <ArrowLeft size={18} />
            </div>
            <span className="text-sm">Back to Circle</span>
          </Link>
        </div>

        <header className="mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 rounded-[20px] flex items-center justify-center text-white shadow-2xl" style={{ background: 'linear-gradient(135deg, #FF3D6D, #e01f55)' }}>
                <Shield size={32} />
             </div>
             <div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1a1a2e', letterSpacing: '-0.03em', lineHeight: 1.1, fontStyle: 'normal', textTransform: 'none' }}>Circle Admin</h1>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px', fontStyle: 'normal' }}>{group?.name}</p>
             </div>
          </div>
        </header>

        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
           <section>
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="ml-2 flex items-center gap-2" style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', fontStyle: 'normal' }}>
                       <Users size={14} /> Membership Requests
                    </h3>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,61,109,0.1)', color: '#FF3D6D', border: '1px solid rgba(255,61,109,0.2)' }}>{requests.length} PENDING</span>
                 </div>
              
              <div className="rounded-[32px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.92)', border: '1.5px solid rgba(255,61,109,0.12)', boxShadow: '0 4px 24px rgba(255,61,109,0.06)' }}>
                 {requests.length > 0 ? (
                   <div className="divide-y divide-slate-50">
                      {requests.map(req => (
                        <div key={req.request_id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
                           <div className="flex items-center gap-4">
                              <img src={req.avatar_url || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-2xl object-cover shadow-sm bg-slate-100" alt="" />
                              <div>
                                 <h4 className="text-sm font-bold text-slate-800">{req.name || req.username}</h4>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested on {new Date(req.created_at).toLocaleDateString()}</p>
                              </div>
                           </div>
                           <div className="flex gap-3">
                              <button 
                                onClick={() => handleAction(req.request_id, 'reject')}
                                className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center border border-slate-100"
                                title="Decline"
                              >
                                <X size={18} strokeWidth={3} />
                              </button>
                              <button
                                onClick={() => handleAction(req.request_id, 'approve')}
                                className="h-10 px-6 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                style={{ background: 'linear-gradient(135deg, #FF3D6D, #e01f55)', boxShadow: '0 4px 14px rgba(255,61,109,0.35)', border: 'none', cursor: 'pointer' }}
                              >
                                <Check size={16} strokeWidth={3} /> Approve
                              </button>
                           </div>
                        </div>
                      ))}
                   </div>
                 ) : (
                   <div className="py-24 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mx-auto mb-4">
                         <Sparkles size={32} />
                      </div>
                      <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">No pending requests</p>
                   </div>
                 )}
              </div>
           </section>

           <section className="p-8 rounded-[32px] border-dashed" style={{ background: 'rgba(255,61,109,0.03)', border: '1.5px dashed rgba(255,61,109,0.2)' }}>
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                    <Shield size={20} />
                 </div>
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Advanced Controls</h3>
              </div>
              <p className="text-sm text-slate-400 font-medium italic">Additional circle management features coming soon to the modern Sparkle dashboard.</p>
           </section>
        </div>
      </main>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom { from { transform: translateY(20px); } to { transform: translateY(0); } }
        .animate-in { animation-duration: 500ms; animation-fill-mode: both; }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-bottom-4 { animation-name: slide-in-from-bottom; }
        .slide-in-from-bottom-6 { animation-name: slide-in-from-bottom; }
        .slide-in-from-bottom-8 { animation-name: slide-in-from-bottom; }
        .delay-200 { animation-delay: 200ms; }
      `}</style>
    </div>
  );
}
