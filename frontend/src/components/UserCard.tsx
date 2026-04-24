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
      className="group relative bg-white rounded-xl p-4 w-full flex flex-col items-center border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden text-center"
      onClick={() => navigate(`/profile/${u.username}`)}
    >
      {/* Action Menu */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors z-20"
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
      <div className="relative mb-3 pt-2">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
          <img 
            alt={u.username} 
            className="w-full h-full object-cover rounded-full" 
            src={u.avatar_url || u.avatar || '/uploads/avatars/default.png'} 
          />
          {!!u.is_online && (
            <span className="absolute bottom-1 right-1 block w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
          )}
        </div>
      </div>

      {/* User Info */}
      <div className="flex flex-col items-center w-full mb-4">
        <div className="flex items-center gap-1 justify-center w-full">
          <span className="font-bold text-[15px] text-gray-900 truncate max-w-[80%]">
            {u.username}
          </span>
          {!!u.is_verified && (
             <Sparkles size={14} className="text-blue-500 fill-blue-500 shrink-0" />
          )}
        </div>
        
        <p className="text-[13px] font-medium text-gray-500 truncate w-full">
          {u.name || u.username}
        </p>

        <div className="mt-2 text-[11px] text-gray-400 font-semibold space-y-0.5">
           <div className="flex items-center justify-center gap-1">
              <GraduationCap size={12} /> {u.major || 'Student'}
           </div>
           <div className="flex items-center justify-center gap-1">
              <MapPin size={12} /> {u.campus || 'Main'}
           </div>
        </div>
      </div>

      {/* Social Proof (Subtle) */}
      {(u.mutual_followers && u.mutual_followers.length > 0) ? (
        <div className="flex items-center gap-1.5 mb-4">
          <div className="flex -space-x-2">
            {u.mutual_followers.slice(0, 2).map((m: any, i: number) => (
              <img
                key={i}
                src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username)}&background=random`}
                className="w-5 h-5 rounded-full border border-white object-cover shadow-xs"
                alt=""
              />
            ))}
          </div>
          <p className="text-[11px] text-gray-400 font-medium">
            {u.mutual_followers.length} mutuals
          </p>
        </div>
      ) : null}

      {/* Follow Button */}
      <div className="w-full mt-auto">
        {isFollowed ? (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className="w-full py-1.5 rounded-lg font-bold text-[13px] bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
          >
            <Check size={16} /> Following
          </button>
        ) : requestStatus === 'pending' ? (
          <button 
            disabled
            className="w-full py-1.5 rounded-lg font-bold text-[13px] bg-gray-50 text-gray-400 cursor-default border border-dashed border-gray-200 flex items-center justify-center gap-2"
          >
            <Clock size={16} /> Pending
          </button>
        ) : (
          <button 
            onClick={toggleFollow}
            disabled={loading}
            className={`w-full py-1.5 rounded-lg font-bold text-[13px] bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-50' : ''}`}
          >
            <Plus size={16} /> Follow
          </button>
        )}
      </div>
    </div>
  );
}
