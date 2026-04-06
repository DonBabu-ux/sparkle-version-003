import { useState, useEffect } from 'react';
import { X, Check, UserX, User } from 'lucide-react';
import api from '../api/api';

interface FollowRequest {
  request_id: string;
  user_id: string;
  username: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

interface FollowRequestsOverlayProps {
  onClose: () => void;
}

export default function FollowRequestsOverlay({ onClose }: FollowRequestsOverlayProps) {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await api.get('/users/follow-requests');
        if (response.data.success) {
          setRequests(response.data.requests);
        }
      } catch (err) {
        console.error('Failed to fetch follow requests:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const handleAction = async (requestId: string, action: 'accept' | 'reject') => {
    // Optimistic Update
    const originalRequests = [...requests];
    setRequests(prev => prev.filter(r => r.request_id !== requestId));

    try {
      await api.post(`/users/follow-requests/${requestId}/${action}`);
    } catch (err) {
      setRequests(originalRequests);
      console.error(`Failed to ${action} request:`, err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="premium-card w-full max-w-md bg-white p-0 shadow-2xl overflow-hidden scale-in-center">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Pending Auras</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incoming Follow Requests</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-10 text-center animate-pulse">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">In Sync...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <User size={32} />
              </div>
              <p className="text-slate-400 font-bold text-sm italic">No pending connections found in the ether.</p>
            </div>
          ) : (
            requests.map(request => (
              <div key={request.request_id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all">
                <div className="flex items-center gap-3">
                  <img 
                    src={request.avatar_url || '/uploads/avatars/default.png'} 
                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-indigo-50 shadow-md"
                    alt={request.username}
                  />
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{request.name}</h4>
                    <p className="text-[10px] text-indigo-500 font-black uppercase tracking-tight">@{request.username}</p>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleAction(request.request_id, 'accept')}
                    className="w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center hover:bg-indigo-700 active:scale-95"
                  >
                    <Check size={18} />
                  </button>
                  <button 
                    onClick={() => handleAction(request.request_id, 'reject')}
                    className="w-10 h-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-300 active:scale-95"
                  >
                    <UserX size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 text-center">
           <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Sparkle Network Governance</span>
        </div>
      </div>
    </div>
  );
}
