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
      className="group relative bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/10 backdrop-blur-md rounded-[1.5rem] p-4 w-full flex flex-col items-center hover:bg-black/5 dark:hover:bg-white/[0.06] hover:border-black/10 dark:hover:border-white/20 transition-all duration-500 cursor-pointer overflow-hidden text-center shadow-lg dark:shadow-2xl"
      onClick={() => navigate(`/profile/${u.username}`)}
    >
      {/* Action Menu */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        className="absolute top-4 right-4 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-black/20 dark:text-white/20 hover:text-black dark:hover:text-white transition-all z-20"
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
      <div className="relative mb-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-black/5 dark:border-white/10 bg-black/5 dark:bg-black">
          <img 
            alt={u.username} 
            className="w-full h-full object-cover transition-all duration-500" 
            src={u.avatar_url || u.avatar || '/avatar.png'} 
          />
        </div>
        {!!u.is_online && (
          <span className="absolute bottom-1 right-1 block w-4 h-4 bg-emerald-500 border-[3px] border-white dark:border-black rounded-full shadow-sm"></span>
        )}
      </div>

      {/* User Info */}
      <div className="flex flex-col items-center w-full mb-3">
        <div className="flex items-center gap-1.5 justify-center w-full mb-1">
          <span className="font-black text-[15px] text-black dark:text-white tracking-tight truncate max-w-[80%] uppercase italic">
            {u.username}
          </span>
          {!!u.is_verified && (
             <Sparkles size={14} className="text-primary fill-primary shrink-0 drop-shadow-sm" />
          )}
        </div>
        
        <p className="text-[11px] font-bold text-black/40 dark:text-white/30 truncate w-full uppercase tracking-widest">
          {u.name || u.username}
        </p>

        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
           <div className="flex items-center gap-1 px-2.5 py-1 bg-black/5 dark:bg-white/5 rounded-full border border-black/5 dark:border-white/5 text-[9px] text-black/50 dark:text-white/40 font-black uppercase tracking-tighter">
              <GraduationCap size={10} className="text-primary" /> {u.major || 'Explorer'}
           </div>
           <div className="flex items-center gap-1 px-2.5 py-1 bg-black/5 dark:bg-white/5 rounded-full border border-black/5 dark:border-white/5 text-[9px] text-black/50 dark:text-white/40 font-black uppercase tracking-tighter">
              <MapPin size={10} className="text-primary" /> {u.campus || 'Sector'}
           </div>
        </div>
      </div>

      {/* Social Proof */}
      {(u.mutual_followers && u.mutual_followers.length > 0) ? (
        <div className="flex items-center gap-2 mb-4 bg-black/[0.02] dark:bg-white/[0.02] px-3 py-1.5 rounded-xl border border-black/5 dark:border-white/5">
          <div className="flex -space-x-2">
            {u.mutual_followers.slice(0, 2).map((m: any, i: number) => (
              <img
                key={i}
                src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username)}&background=random`}
                className="w-5 h-5 rounded-full border-2 border-white dark:border-black object-cover shadow-sm"
                alt=""
              />
            ))}
          </div>
          <p className="text-[9px] text-black/40 dark:text-white/20 font-black uppercase tracking-widest">
            {u.mutual_followers.length} Connects
          </p>
        </div>
      ) : (
        <div className="h-[28px] mb-4"></div> /* Spacer */
      )}

      {/* Follow Button */}
      <div className="w-full mt-auto">
        {isFollowed ? (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className="w-full py-2 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-all border border-black/10 dark:border-white/10 flex items-center justify-center gap-2"
          >
            <Check size={14} strokeWidth={3} /> Connected
          </button>
        ) : requestStatus === 'pending' ? (
          <button 
            disabled
            className="w-full py-2 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] bg-black/5 dark:bg-black/40 text-black/30 dark:text-white/20 border border-dashed border-black/10 dark:border-white/10 cursor-default flex items-center justify-center gap-2"
          >
            <Clock size={14} strokeWidth={3} /> Pending
          </button>
        ) : (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className={`w-full py-2 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] bg-primary text-white hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2 ${loading ? 'opacity-50' : ''}`}
          >
            <Plus size={14} strokeWidth={3} /> Connect
          </button>
        )}
      </div>
    </div>
  );
}
