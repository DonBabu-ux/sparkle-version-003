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
      const res = await api.post(`/users/${u.user_id}/follow`);
      if (res.data.status === 'requested') {
        setRequestStatus('pending');
      } else {
        setIsFollowed(res.data.is_following);
      }
    } catch (err) {
      console.error('Follow toggle failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="discover-card group relative bg-white rounded-3xl p-6 text-center border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer" 
         onClick={() => navigate(`/profile/${u.username}`)}>
      
      {!isFollowed && onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(u.user_id); }}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
          <X size={14} />
        </button>
      )}

      <div className="relative inline-block mb-4">
        <img src={u.avatar_url || u.avatar || '/uploads/avatars/default.png'}
             alt={u.username} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg group-hover:scale-105 transition-transform" />
        {u.is_online && (
          <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 mb-1">
        <span className="font-extrabold text-[#111]">{u.username}</span>
        {u.is_verified && <Zap size={12} className="fill-[#FF3D6D] text-[#FF3D6D]" />}
        {u.is_new_user && (
          <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider">NEW</span>
        )}
        {u.is_developer && (
            <div title="Sparkle Developer" className="text-indigo-500"><Check size={12} strokeWidth={4} /></div>
        )}
      </div>

      <div className="text-xs font-bold text-slate-400 mb-2">
        {u.major || 'Sparkler'}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500 mb-3">
        <MapPin size={10} className="text-[#FF3D6D]" />
        {u.campus || 'Global'}
      </div>

      {u.mutual_connections > 0 && (
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#FF3D6D] font-black uppercase tracking-wider mb-4 bg-[#FF3D6D]/5 py-1 px-3 rounded-full">
          <Users size={10} /> {u.mutual_connections} mutual connections
        </div>
      )}

      <div className="mt-auto">
        {isFollowed ? (
          <button className={`w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 border-2 border-slate-100 text-slate-500 hover:bg-slate-50 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`} 
                  onClick={toggleFollow} disabled={loading}>
            <Check size={14} strokeWidth={3} /> Following
          </button>
        ) : requestStatus === 'pending' ? (
          <button className="w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 bg-slate-100 text-slate-400 cursor-default" 
                  disabled onClick={(e) => e.stopPropagation()}>
            <Clock size={14} strokeWidth={3} /> Requested
          </button>
        ) : (
          <button className={`w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF3D6D] to-[#FF8E53] text-white shadow-lg shadow-[#FF3D6D]/20 hover:shadow-xl hover:translate-y-[-1px] active:translate-y-0 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`} 
                  onClick={toggleFollow} disabled={loading}>
            <Plus size={14} strokeWidth={3} /> Follow
          </button>
        )}
      </div>
    </div>
  );
}
