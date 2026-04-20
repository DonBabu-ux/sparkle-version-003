import { useNavigate } from 'react-router-dom';
import { X, MapPin, Check, Clock, Plus } from 'lucide-react';
import api from '../api/api';
import { useState } from 'react';
import type { User } from '../types/user';

interface UserCardProps {
  u: User;
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
    <div 
      className="group relative bg-white rounded-[3rem] p-8 w-full flex flex-col items-center border border-slate-100 shadow-[0_20px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_25px_50px_rgba(0,0,0,0.08)] transition-all duration-500 ease-out cursor-pointer overflow-hidden text-center"
      onClick={() => navigate(`/profile/${u.username}`)}
    >
      
      {/* Dismiss button */}
      {(!isFollowed && onRemove) ? (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(u.user_id || u.id); }}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center hover:bg-slate-100 hover:text-slate-500 transition-all duration-300 z-20 focus:outline-none"
          aria-label="Dismiss"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      ) : null}

      {/* Avatar + Status */}
      <div className="relative flex justify-center mt-4 mb-6 z-10">
        <div className="w-[106px] h-[106px] rounded-full p-[3px] bg-gradient-to-tr from-[#FF3D6D] to-[#FF8E53] flex items-center justify-center">
          <div className="relative w-full h-full bg-white rounded-full p-[4px] flex items-center justify-center">
            <img 
              alt={u.username} 
              className="w-full h-full rounded-full object-cover" 
              src={u.avatar_url || u.avatar || '/uploads/avatars/default.png'} 
            />
            {u.is_online ? (
              <span className="absolute bottom-0.5 right-0.5 block w-5 h-5 bg-[#00D084] border-[3.5px] border-white rounded-full shadow-sm"></span>
            ) : null}
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="flex flex-col items-center justify-center mb-6 z-10 w-full">
        <div className="flex items-center gap-2 mb-2 justify-center">
          <span className="font-extrabold text-[1.65rem] text-[#1E293B] tracking-tight leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {u.username}
          </span>
          {u.is_verified ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L14.4 4.8L17.6 5.2L18.4 8.4L21.2 10.4L20 13.6L21.2 16.8L18.4 18.8L17.6 22L14.4 22.4L12 25.2L9.6 22.4L6.4 22L5.6 18.8L2.8 16.8L4 13.6L2.8 10.4L5.6 8.4L6.4 5.2L9.6 4.8L12 2Z" fill="#FF3D6D" fillOpacity="0.15" />
              <path d="M12 21.325L10.375 19.325L7.9 18.9L7.3 16.525L5 15.025L5.9 12.65L5 10.275L7.3 8.775L7.9 6.4L10.375 5.975L12 3.975L13.625 5.975L16.1 6.4L16.7 8.775L19 10.275L18.1 12.65L19 15.025L16.7 16.525L16.1 18.9L13.625 19.325L12 21.325ZM11 15L15.6 10.4L14.2 9L11 12.2L9.4 10.6L8 12L11 15Z" fill="#FF3D6D" />
            </svg>
          ) : null}
        </div>
        
        {(u.name && u.name !== '0' && u.name !== 0) ? (
          <div className="text-[0.95rem] font-bold text-[#94A3B8] bg-[#F1F5F9]/80 px-6 py-1 rounded-full mb-6">
            {u.name}
          </div>
        ) : null}

        {/* Major Pill */}
        <div className="flex items-center gap-2 text-[0.95rem] font-bold text-[#64748B] bg-[#F8FAFC] border border-slate-100/40 px-6 py-2.5 rounded-2xl mb-3">
          <span>💻</span> {u.major || 'Computer Science'}
        </div>

        {/* Campus Pill */}
        <div className="flex items-center gap-2 text-[0.8rem] font-black text-[#FF3D6D] uppercase tracking-wider bg-[#FFF1F2] px-6 py-2.5 rounded-2xl">
           <MapPin size={14} strokeWidth={3.5} /> {u.campus || 'SOUTH CAMPUS'}
        </div>
      </div>

      {/* Mutual Connections Section */}
      <div className="w-full max-w-[95%] bg-[#F9FBFC] rounded-[2rem] p-4 flex items-center gap-4 mb-8 border border-slate-100/50">
        <div className="flex -space-x-2.5 shrink-0">
          {[32, 44, 12].map((img, i) => (
            <div key={i} className="w-10 h-10 rounded-full border-[3px] border-white bg-slate-200 overflow-hidden shadow-sm">
              <img alt="" className="w-full h-full object-cover" src={`https://i.pravatar.cc/100?img=${img}`} />
            </div>
          ))}
          <div className="w-10 h-10 rounded-full border-[3px] border-white bg-[#FFF1F2] flex items-center justify-center text-[0.7rem] font-black text-[#FF3D6D] shadow-sm">
            +2
          </div>
        </div>
        <div className="flex-1 text-[0.78rem] font-extrabold text-[#64748b] leading-[1.3] text-left pr-2">
          {u.mutual_connections || 1} Mutual Friend · 2 more connections
        </div>
      </div>

      {/* Follow Button */}
      <div className="w-full mt-auto">
        {isFollowed ? (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className="w-full py-5 rounded-[1.6rem] font-black text-[1.05rem] flex items-center justify-center gap-3 border-2 border-slate-100 text-slate-400 hover:bg-slate-50 transition-all duration-300"
          >
            <Check size={22} strokeWidth={3} /> Following
          </button>
        ) : requestStatus === 'pending' ? (
          <button 
            disabled
            className="w-full py-5 rounded-[1.6rem] font-black text-[1.05rem] flex items-center justify-center gap-3 bg-slate-50 text-slate-400 cursor-default border-2 border-dashed border-slate-200"
          >
            <Clock size={22} strokeWidth={3} /> Requested
          </button>
        ) : (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className={`w-full py-5 rounded-[1.6rem] font-black text-[1.05rem] flex items-center justify-center gap-3 bg-gradient-to-r from-[#FF3D69] to-[#FF8E53] text-white shadow-[0_12px_24px_rgba(255,61,105,0.3)] hover:shadow-[0_15px_30px_rgba(255,61,105,0.4)] hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 ${loading ? 'opacity-50' : ''}`}
          >
            <Plus size={22} strokeWidth={4} /> Follow Profile
          </button>
        )}
      </div>
    </div>
  );
}
