import { useNavigate } from 'react-router-dom';
import { MapPin, Check, Clock, Plus, Sparkles, GraduationCap, MoreHorizontal } from 'lucide-react';
import api from '../api/api';
import { useState } from 'react';
import type { User } from '../types/user';
import UserActionModal from './modals/UserActionModal';

interface UserCardProps {
  u: User;
  onRemove?: (id: string) => void;
}

export default function UserCard({ u }: UserCardProps) {
  const navigate = useNavigate();
  const [isFollowed, setIsFollowed] = useState(u.is_followed);
  const [requestStatus, setRequestStatus] = useState(u.request_status);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
      className="group relative bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-[2rem] p-5 w-full flex flex-col items-center hover:bg-white/[0.06] hover:border-white/20 transition-all duration-500 cursor-pointer overflow-hidden text-center shadow-2xl"
      onClick={() => navigate(`/profile/${u.username}`)}
    >
      {/* Action Menu */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 text-white/20 hover:text-white transition-all z-20"
      >
        <MoreHorizontal size={18} />
      </button>

      {showModal && (
        <UserActionModal 
            user={u} 
            onClose={() => setShowModal(false)} 
        />
      )}

      {/* Avatar Section */}
      <div className="relative mb-5 pt-2">
        <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-[#ff1493] to-purple-600 shadow-[0_0_20px_rgba(255,20,147,0.2)]">
          <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden shrink-0 border-2 border-black">
            <img 
              alt={u.username} 
              className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500" 
              src={u.avatar_url || u.avatar || '/uploads/avatars/default.png'} 
            />
          </div>
        </div>
        {!!u.is_online && (
          <span className="absolute bottom-1 right-1 block w-4 h-4 bg-emerald-500 border-[3px] border-black rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]"></span>
        )}
      </div>

      {/* User Info */}
      <div className="flex flex-col items-center w-full mb-6">
        <div className="flex items-center gap-1.5 justify-center w-full mb-1">
          <span className="font-black text-[15px] text-white tracking-tight truncate max-w-[80%] uppercase italic">
            {u.username}
          </span>
          {!!u.is_verified && (
             <Sparkles size={14} className="text-[#ff1493] fill-[#ff1493] shrink-0 drop-shadow-[0_0_5px_rgba(255,20,147,0.5)]" />
          )}
        </div>
        
        <p className="text-[11px] font-bold text-white/30 truncate w-full uppercase tracking-widest">
          {u.name || u.username}
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
           <div className="flex items-center gap-1 px-2.5 py-1 bg-white/5 rounded-full border border-white/5 text-[9px] text-white/40 font-black uppercase tracking-tighter">
              <GraduationCap size={10} className="text-[#ff1493]" /> {u.major || 'Explorer'}
           </div>
           <div className="flex items-center gap-1 px-2.5 py-1 bg-white/5 rounded-full border border-white/5 text-[9px] text-white/40 font-black uppercase tracking-tighter">
              <MapPin size={10} className="text-[#ff1493]" /> {u.campus || 'Sector'}
           </div>
        </div>
      </div>

      {/* Social Proof */}
      {(u.mutual_followers && u.mutual_followers.length > 0) ? (
        <div className="flex items-center gap-2 mb-6 bg-white/[0.02] px-3 py-1.5 rounded-2xl border border-white/5">
          <div className="flex -space-x-2">
            {u.mutual_followers.slice(0, 2).map((m: any, i: number) => (
              <img
                key={i}
                src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username)}&background=random`}
                className="w-5 h-5 rounded-full border-2 border-black object-cover shadow-2xl"
                alt=""
              />
            ))}
          </div>
          <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">
            {u.mutual_followers.length} Connects
          </p>
        </div>
      ) : (
        <div className="h-[34px] mb-6"></div> /* Spacer */
      )}

      {/* Follow Button */}
      <div className="w-full mt-auto">
        {isFollowed ? (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className="w-full py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all border border-white/10 flex items-center justify-center gap-2"
          >
            <Check size={14} strokeWidth={3} /> Connected
          </button>
        ) : requestStatus === 'pending' ? (
          <button 
            disabled
            className="w-full py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] bg-black/40 text-white/20 border border-dashed border-white/10 cursor-default flex items-center justify-center gap-2"
          >
            <Clock size={14} strokeWidth={3} /> Pending
          </button>
        ) : (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className={`w-full py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] bg-[#ff1493] text-white hover:scale-[1.02] active:scale-95 transition-all shadow-[0_5px_20px_rgba(255,20,147,0.3)] flex items-center justify-center gap-2 ${loading ? 'opacity-50' : ''}`}
          >
            <Plus size={14} strokeWidth={3} /> Connect
          </button>
        )}
      </div>
    </div>
  );
}
