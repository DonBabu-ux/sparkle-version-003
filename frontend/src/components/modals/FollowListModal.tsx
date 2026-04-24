import React, { useState, useEffect } from 'react';
import { X, Search, Orbit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { useUserStore } from '../../store/userStore';

interface FollowUser {
  id: string;
  username: string;
  name: string;
  profile_picture: string;
  is_followed_by_me: boolean;
  has_story?: boolean;
}

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: 'Followers' | 'Following';
  profileId: string;
}

export default function FollowListModal({ isOpen, onClose, title, profileId }: FollowListModalProps) {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { user: currentUser } = useUserStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, title, profileId]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const endpoint = title === 'Followers' ? `/users/${profileId}/followers` : `/users/${profileId}/following`;
      const res = await api.get(endpoint);
      setUsers(res.data);
    } catch (err) {
      console.error(`Failed to fetch ${title.toLowerCase()}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetId: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await api.delete(`/users/follow/${targetId}`);
        setUsers(users.map(u => u.id === targetId ? { ...u, is_followed_by_me: false } : u));
      } else {
        await api.post(`/users/follow/${targetId}`);
        setUsers(users.map(u => u.id === targetId ? { ...u, is_followed_by_me: true } : u));
      }
    } catch (err) {
      console.error('Follow toggle failed:', err);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isOwnProfile = currentUser?.id === profileId || currentUser?.user_id === profileId;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative bg-[#262626] rounded-xl w-full max-w-[400px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-center p-4 border-b border-white/10 relative">
          <h2 className="text-white font-bold text-base">{title}</h2>
          <button 
            onClick={onClose}
            className="absolute right-4 text-white/70 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={16} />
            <input 
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#363636] text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none placeholder:text-white/50 focus:bg-[#404040] transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Orbit className="animate-spin-slow text-white/50" size={24} />
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((u) => {
              const showFollowInline = !u.is_followed_by_me && u.id !== currentUser?.user_id && u.id !== currentUser?.id;
              
              return (
                <div key={u.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer group">
                  <div 
                    className="flex items-center gap-3 flex-1 overflow-hidden"
                    onClick={() => {
                      onClose();
                      navigate(`/profile/${u.username}`);
                    }}
                  >
                    <div className={`w-12 h-12 rounded-full shrink-0 ${u.has_story ? 'p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500' : ''}`}>
                      <div className={`w-full h-full rounded-full ${u.has_story ? 'p-[2px] bg-[#262626]' : ''}`}>
                        <img 
                          src={u.profile_picture || '/uploads/avatars/default.png'} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover" 
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col flex-1 overflow-hidden min-w-0 pr-4">
                      <div className="flex items-center gap-1 w-full text-[14px]">
                        <span className="font-semibold text-white truncate max-w-[120px]">{u.username}</span>
                        {showFollowInline && (
                          <span 
                            className="text-blue-500 font-semibold cursor-pointer shrink-0 hover:text-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFollowToggle(u.id, u.is_followed_by_me);
                            }}
                          >
                            · Follow
                          </span>
                        )}
                      </div>
                      <span className="text-white/50 text-[13px] truncate font-medium">{u.name || u.username}</span>
                    </div>
                  </div>

                  {/* Right Button */}
                  <div className="shrink-0">
                    {u.id !== currentUser?.user_id && u.id !== currentUser?.id && (
                      isOwnProfile && title === 'Followers' ? (
                        <button 
                          className="px-4 py-1.5 bg-[#363636] hover:bg-[#404040] text-white text-sm font-semibold rounded-lg transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            // If it's a true remove, we'd need a remove follower API endpoint.
                            // For now, we simulate by hiding or if not supported, we just do a visual placeholder.
                            setUsers(users.filter(user => user.id !== u.id));
                          }}
                        >
                          Remove
                        </button>
                      ) : (
                        <button 
                          className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                            u.is_followed_by_me 
                              ? 'bg-[#363636] hover:bg-[#404040] text-white'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowToggle(u.id, u.is_followed_by_me);
                          }}
                        >
                          {u.is_followed_by_me ? 'Following' : 'Follow'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-white/50 text-sm p-8">
              No users found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
