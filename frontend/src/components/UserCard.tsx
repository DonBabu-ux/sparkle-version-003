import { useNavigate } from 'react-router-dom';
import { MapPin, Check, Clock, Plus, Sparkles, GraduationCap, MoreHorizontal, Orbit } from 'lucide-react';
import api from '../api/api';
import { useState } from 'react';
import type { User } from '../types/user';
import UserActionModal from './modals/UserActionModal';

interface MutualFollower {
  username: string;
  avatar?: string;
}

interface UserCardProps {
  u: User;
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
      className="group relative bg-white/80 backdrop-blur-3xl rounded-[40px] p-8 w-full flex flex-col items-center border border-white shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-700 ease-out cursor-pointer overflow-hidden text-center animate-fade-in"
      onClick={() => navigate(`/profile/${u.username}`)}
    >
      
      {/* Action Menu */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        className="absolute top-6 right-6 w-11 h-11 rounded-2xl bg-black/5 text-black/20 flex items-center justify-center hover:bg-black hover:text-white transition-all duration-300 z-20 focus:outline-none shadow-sm active:scale-90"
        aria-label="Actions"
      >
        <MoreHorizontal size={20} strokeWidth={3} />
      </button>

      {showModal && (
        <UserActionModal 
            user={u} 
            onClose={() => setShowModal(false)} 
        />
      )}

      {/* Avatar Section */}
      <div className="relative flex justify-center mt-4 mb-8 z-10 scale-110">
        <div className="w-28 h-28 rounded-[38px] p-[2px] bg-gradient-to-tr from-primary to-pink-200 flex items-center justify-center shadow-2xl shadow-primary/20 group-hover:rotate-6 transition-transform duration-700">
          <div className="relative w-full h-full bg-white rounded-[36px] p-[4px] flex items-center justify-center overflow-hidden">
            <img 
              alt={u.username} 
              className="w-full h-full rounded-[30px] object-cover group-hover:scale-110 transition-transform duration-1000" 
              src={u.avatar_url || u.avatar || '/uploads/avatars/default.png'} 
            />
            {u.is_online && (
              <span className="absolute bottom-2 right-2 block w-4 h-4 bg-emerald-500 border-4 border-white rounded-full shadow-lg"></span>
            )}
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="flex flex-col items-center justify-center mb-8 z-10 w-full">
        <div className="flex items-center gap-2 mb-1 justify-center">
          <span className="font-black text-2xl text-black tracking-tighter leading-none italic uppercase">
            {u.username}
          </span>
          {u.is_verified && (
             <Sparkles size={18} className="text-primary fill-primary" />
          )}
        </div>
        
        <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-6 italic">
          {u.name || 'Incognito Signal'}
        </p>

        <div className="flex flex-col gap-2 w-full max-w-[200px]">
           <div className="flex items-center justify-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 border border-primary/10 px-4 py-2.5 rounded-2xl">
              <GraduationCap size={14} strokeWidth={3.5} /> {u.major || 'Global Citizen'}
           </div>
           <div className="flex items-center justify-center gap-2 text-[10px] font-black text-black/40 uppercase tracking-widest bg-black/5 px-4 py-2.5 rounded-2xl border border-black/5">
              <MapPin size={14} strokeWidth={3.5} /> {u.campus || 'Main Frequency'}
           </div>
        </div>
      </div>

      {/* Social Proof */}
      <div className="w-full bg-black/5 rounded-[32px] p-5 flex flex-col gap-4 mb-8 border border-white group-hover:bg-white transition-colors duration-500">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-primary shrink-0 shadow-sm">
             <Orbit size={20} strokeWidth={3} className="animate-spin-slow" />
          </div>
          <div className="flex-1 text-[11px] font-black text-black/30 leading-tight text-left uppercase tracking-tight italic">
            {u.suggestion_reason || 'Matching Energy Signal'}
          </div>
        </div>

        {u.mutual_followers && u.mutual_followers.length > 0 && (
          <div className="flex items-center gap-2 pl-2">
            <div className="flex -space-x-3">
              {u.mutual_followers.slice(0, 3).map((m: MutualFollower, i: number) => (
                <img
                  key={i}
                  src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username)}&background=random`}
                  className="w-8 h-8 rounded-xl border-2 border-white object-cover shadow-sm ring-2 ring-black/5"
                  alt=""
                />
              ))}
            </div>
            <p className="text-[9px] font-black text-black/20 uppercase tracking-widest pl-2">
              <span className="text-black/60">{u.mutual_followers[0].username}</span>
              {u.mutual_followers.length > 1 && ` + ${u.mutual_followers.length - 1} Signals`}
            </p>
          </div>
        )}
      </div>

      {/* Follow Button */}
      <div className="w-full mt-auto">
        {isFollowed ? (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className="w-full py-5 rounded-3xl font-black text-[11px] flex items-center justify-center gap-3 border-4 border-black/5 text-black/20 hover:bg-black/5 hover:border-black/10 transition-all duration-300 uppercase tracking-[0.2em] italic"
          >
            <Check size={18} strokeWidth={4} /> Synchronized
          </button>
        ) : requestStatus === 'pending' ? (
          <button 
            disabled
            className="w-full py-5 rounded-3xl font-black text-[11px] flex items-center justify-center gap-3 bg-black/5 text-black/10 cursor-default border-4 border-dashed border-black/5 uppercase tracking-[0.2em] italic"
          >
            <Clock size={18} strokeWidth={4} /> Pending Sync
          </button>
        ) : (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className={`w-full py-5 rounded-3xl font-black text-[11px] flex items-center justify-center gap-3 bg-primary text-white shadow-2xl shadow-primary/30 hover:scale-[1.03] active:scale-[0.97] transition-all duration-500 uppercase tracking-[0.2em] italic ${loading ? 'opacity-50' : ''}`}
          >
            <Plus size={18} strokeWidth={4} /> Connect Signal
          </button>
        )}
      </div>

      <style>{`
         @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
