import { useNavigate } from 'react-router-dom';
import { X, MapPin, Users, Check, Clock, Plus, Zap } from 'lucide-react';
import api from '../api/api';
import { useState } from 'react';

interface UserCardProps {
  u: any;
  onRemove?: (id: string) => void;
}

export default function UserCard({ u, onRemove }: UserCardProps) {
  const navigate = useNavigate();
  const [isFollowed, setIsFollowed] = useState(u.is_followed);
  const [requestStatus, setRequestStatus] = useState(u.request_status);
  const [loading, setLoading] = useState(false);

  const toggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const targetId = u.user_id || u.id;
      const res = await api.post(`/users/${targetId}/follow`);
      const { status } = res.data;
      
      if (status === 'requested') {
        setRequestStatus('pending');
        setIsFollowed(false);
      } else if (status === 'following') {
        setIsFollowed(true);
        setRequestStatus(null);
      } else if (status === 'unfollowed') {
        setIsFollowed(false);
        setRequestStatus(null);
      }
    } catch (err) {
      console.error('Follow toggle failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="discover-card group relative bg-white rounded-[2.5rem] p-8 min-h-[420px] flex flex-col items-center border border-[#f1f5f9] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(255,61,109,0.12)] hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden" 
         onClick={() => navigate(`/profile/${u.username}`)}>
      
      {/* Decorative Background Element */}
      <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-[#FF3D6D]/5 to-[#FF8E53]/5 -z-0"></div>

      {!isFollowed && onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(u.user_id); }}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/80 backdrop-blur-md text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all shadow-sm z-10">
          <X size={16} />
        </button>
      )}

      <div className="relative inline-block mb-6 mt-4 z-10">
        <div className="p-1 rounded-full bg-gradient-to-tr from-[#FF3D6D] to-[#FF8E53] group-hover:rotate-6 transition-transform duration-500">
          <img src={u.avatar_url || u.avatar || '/uploads/avatars/default.png'}
               alt={u.username} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md group-hover:scale-105 transition-transform duration-500" />
        </div>
        {u.is_online && (
          <div className="absolute bottom-2 right-2 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full shadow-sm"></div>
        )}
      </div>

      <div className="flex flex-col items-center justify-center mb-2 z-10 text-center">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="font-black text-xl text-slate-900 tracking-tight">{u.username}</span>
          {u.is_verified ? (
            <div className="bg-[#FF3D6D]/10 p-1 rounded-full">
              <Zap size={14} className="fill-[#FF3D6D] text-[#FF3D6D]" />
            </div>
          ) : null}
        </div>
        
        {(u.name && u.name !== '0' && u.name !== 0) ? (
          <div className="text-sm font-semibold text-slate-500">{u.name}</div>
        ) : null}

        {u.is_new_user ? (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-widest">New Star</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-3 w-full mt-4 mb-2 z-10">
        <div className="text-xs font-bold text-slate-400 px-4 line-clamp-1 bg-slate-50 py-1.5 rounded-lg border border-slate-100/50">
          {u.major || 'Sparkler'}
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-[#FF3D6D] uppercase tracking-wider">
          <MapPin size={12} strokeWidth={3} />
          {u.campus || 'Global'}
        </div>
      </div>

      <div className="mt-auto w-full z-10">
        {(u.mutual_connections && Number(u.mutual_connections) > 0) ? (
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">
            <div className="flex -space-x-2">
               {[...Array(3)].map((_, i) => (
                 <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${(u.user_id?.charCodeAt(0) || 0) + i}`} alt="" className="w-full h-full object-cover" />
                 </div>
               ))}
            </div>
            <span>{u.mutual_connections} Mutual Friends</span>
          </div>
        ) : null}

        <div className="flex justify-center w-full">
          {isFollowed ? (
            <button className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border-2 border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all duration-300 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`} 
                    onClick={toggleFollow} disabled={loading}>
              <Check size={18} strokeWidth={3} /> Following
            </button>
          ) : requestStatus === 'pending' ? (
            <button className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-slate-50 text-slate-400 cursor-default border-2 border-dashed border-slate-200" 
                    disabled onClick={(e) => e.stopPropagation()}>
              <Clock size={18} strokeWidth={3} /> Requested
            </button>
          ) : (
            <button className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF3D6D] to-[#FF8E53] text-white shadow-[0_10px_25px_rgba(255,61,109,0.3)] hover:shadow-[0_15px_30px_rgba(255,61,109,0.4)] hover:translate-y-[-2px] active:translate-y-0 transition-all duration-300 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`} 
                    onClick={toggleFollow} disabled={loading}>
              <Plus size={18} strokeWidth={3} /> Follow
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
