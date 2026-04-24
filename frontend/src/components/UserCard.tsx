import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      className="group relative bg-white/80 backdrop-blur-3xl rounded-[32px] p-6 w-full flex flex-col items-center border border-black/[0.03] shadow-xl shadow-black/[0.02] hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer overflow-hidden text-center"
      onClick={() => navigate(`/profile/${u.username}`)}
    >
      {/* Action Menu */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-black/5 text-black/10 hover:text-black transition-all z-20"
      >
        <MoreHorizontal size={20} strokeWidth={2.5} />
      </button>

      {showModal && (
        <UserActionModal 
            user={u} 
            onClose={() => setShowModal(false)} 
        />
      )}

      {/* Avatar Section */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-[28px] bg-black/[0.02] p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
          <img 
            alt={u.username} 
            className="w-full h-full object-cover rounded-[24px] group-hover:scale-110 transition-transform duration-700" 
            src={u.avatar_url || u.avatar || '/uploads/avatars/default.png'} 
          />
          {!!u.is_online && (
            <span className="absolute bottom-0 right-0 block w-5 h-5 bg-green-500 border-4 border-white rounded-full shadow-lg animate-pulse"></span>
          )}
        </div>
      </div>

      {/* User Info */}
      <div className="flex flex-col items-center w-full mb-6">
        <div className="flex items-center gap-1.5 justify-center w-full mb-1">
          <span className="font-black text-lg text-black italic tracking-tight truncate max-w-[80%]">
            {u.name || u.username}
          </span>
          {!!u.is_verified && (
             <Sparkles size={16} className="text-primary fill-primary shrink-0" />
          )}
        </div>
        
        <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.2em]">
          @{u.username}
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-3 text-[10px] font-black text-black/40 uppercase tracking-widest">
           <div className="flex items-center gap-1.5 px-3 py-1 bg-black/[0.02] rounded-full">
              <GraduationCap size={12} strokeWidth={3} className="text-primary/40" /> {u.major || 'Student'}
           </div>
           <div className="flex items-center gap-1.5 px-3 py-1 bg-black/[0.02] rounded-full">
              <MapPin size={12} strokeWidth={3} className="text-indigo-500/40" /> {u.campus || 'Main'}
           </div>
        </div>
      </div>

      {/* Social Proof */}
      {(u.mutual_followers && u.mutual_followers.length > 0) && (
        <div className="flex items-center gap-2 mb-8 bg-black/[0.02] px-4 py-2 rounded-2xl">
          <div className="flex -space-x-2">
            {u.mutual_followers.slice(0, 3).map((m: any, i: number) => (
              <img
                key={i}
                src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username)}&background=random`}
                className="w-6 h-6 rounded-full border-2 border-white object-cover shadow-sm"
                alt=""
              />
            ))}
          </div>
          <p className="text-[10px] text-black/30 font-black uppercase tracking-widest">
            {u.mutual_followers.length} mutuals
          </p>
        </div>
      )}

      {/* Follow Button */}
      <div className="w-full mt-auto">
        {isFollowed ? (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className="w-full py-4 rounded-[20px] font-black text-[10px] uppercase tracking-widest bg-black text-white hover:bg-black/90 transition-all flex items-center justify-center gap-2 italic"
          >
            <Check size={16} strokeWidth={3} /> Transmitting
          </button>
        ) : requestStatus === 'pending' ? (
          <button 
            disabled
            className="w-full py-4 rounded-[20px] font-black text-[10px] uppercase tracking-widest bg-black/[0.02] text-black/20 border-2 border-dashed border-black/5 flex items-center justify-center gap-2 italic"
          >
            <Clock size={16} strokeWidth={3} /> Syncing
          </button>
        ) : (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className={`w-full py-4 rounded-[20px] font-black text-[10px] uppercase tracking-widest bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 italic ${loading ? 'opacity-50' : ''}`}
          >
            <Plus size={16} strokeWidth={3} /> Establish Link
          </button>
        )}
      </div>
    </motion.div>
  );
}
