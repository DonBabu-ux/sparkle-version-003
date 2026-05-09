import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/api';
import type { Group } from '../types/group';
import { Shield, ArrowLeft, Check, X, Users, Sparkles, AlertCircle } from 'lucide-react';
import { getAvatarUrl } from '../utils/imageUtils';
import Spinner from '../components/ui/Spinner';

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
        
        // Use groupRes.data.isAdmin or similar if userRole is not present
        const isAuthorized = groupRes.data.userRole === 'owner' || groupRes.data.userRole === 'admin';
        
        if (!isAuthorized) {
          navigate(`/groups/${id}`);
          return;
        }

        setGroup(groupRes.data.group || groupRes.data);
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
      await api.post(`/groups/requests/${requestId}/${action}`);
      setRequests(prev => prev.filter(r => r.request_id !== requestId));
    } catch (err) {
      console.error(`${action} failed:`, err);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 gap-4">
        <Spinner size="large" color="text-primary" />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Decrypting...</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-black font-sans pb-20">
      <Navbar />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 relative z-10 max-w-2xl mx-auto w-full pt-16 md:pt-24">
        <header className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <Link 
              to={`/groups/${id}`}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 active:scale-90 transition-all"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-white backdrop-blur-xl shadow-sm">
              <Shield size={12} strokeWidth={3} className="text-primary" />
              <span className="text-[8px] font-black text-black uppercase tracking-widest italic">Admin Hub</span>
            </div>
          </div>
          
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter uppercase italic leading-none mb-1">
              Circle <span className="text-primary">Admin.</span>
            </h1>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">
              {group?.name || 'Managing Community'}
            </p>
          </div>
        </header>

        <div className="space-y-6 animate-fade-in">
           <section>
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest italic">
                  <Users size={14} className="text-primary" /> Requests
                </h3>
                <span className="px-2.5 py-1 rounded-lg text-[9px] font-black bg-primary/10 text-primary border border-primary/10 italic">
                  {requests.length} PENDING
                </span>
              </div>
              
              <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
                 {requests.length > 0 ? (
                   <div className="divide-y divide-gray-50">
                      {requests.map(req => (
                        <div key={req.request_id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-all group">
                           <div className="flex items-center gap-3">
                              <img src={getAvatarUrl(req.avatar_url, req.username)} className="w-11 h-11 rounded-xl object-cover border-2 border-white shadow-sm" alt="" />
                              <div>
                                 <h4 className="text-[12px] font-black text-gray-900 uppercase italic leading-tight">{req.name || req.username}</h4>
                                 <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                   {new Date(req.created_at).toLocaleDateString()}
                                 </p>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              <button 
                                onClick={() => handleAction(req.request_id, 'reject')}
                                className="w-9 h-9 rounded-xl bg-gray-50 text-gray-400 hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center border border-gray-100"
                              >
                                <X size={16} strokeWidth={3} />
                              </button>
                              <button
                                onClick={() => handleAction(req.request_id, 'approve')}
                                className="h-9 px-4 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all italic"
                              >
                                <Check size={14} strokeWidth={4} /> Approve
                              </button>
                           </div>
                        </div>
                      ))}
                   </div>
                 ) : (
                   <div className="py-16 text-center">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-200 mx-auto mb-3">
                         <Sparkles size={24} />
                      </div>
                      <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">No pending requests</p>
                   </div>
                 )}
              </div>
           </section>

           <section className="p-6 rounded-[24px] bg-white border border-gray-100 shadow-sm border-dashed">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-8 h-8 bg-primary/5 rounded-lg flex items-center justify-center text-primary">
                    <AlertCircle size={16} />
                 </div>
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Protocols</h3>
              </div>
              <p className="text-[11px] text-gray-400 font-bold italic leading-relaxed uppercase tracking-tight">
                Additional governance tools are currently being synchronized for the modern administrative hub.
              </p>
           </section>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
