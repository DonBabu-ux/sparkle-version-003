import { useState, useEffect } from 'react';
import { X, Search, Check, Loader2, UserPlus } from 'lucide-react';
import api from '../../api/api';

interface GroupInviteModalProps {
  groupId: string;
  groupName: string;
  onClose: () => void;
}

interface Friend {
  user_id: string;
  username: string;
  name: string;
  avatar_url: string;
}

export default function GroupInviteModal({ groupId, groupName, onClose }: GroupInviteModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        // Assuming there's an endpoint to get friends/connections
        const res = await api.get('/users/active-friends');
        setFriends(res.data.friends || res.data || []);
      } catch (err) {
        console.error('Failed to fetch friends:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, []);

  const toggleSelect = (id: string) => {
    if (invitedIds.includes(id)) return;
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleInvite = async () => {
    if (selectedIds.length === 0) return;
    setSending(true);
    try {
      await api.post(`/groups/${groupId}/invite`, { userIds: selectedIds });
      setInvitedIds(prev => [...prev, ...selectedIds]);
      setSelectedIds([]);
      // Maybe show a success state or close after a delay
    } catch (err) {
      console.error('Invite failed:', err);
    } finally {
      setSending(false);
    }
  };

  const filteredFriends = friends.filter(f =>
    f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase italic">Invite Friends</h2>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">To {groupName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search friends..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-primary" size={24} />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fetching your squad...</p>
            </div>
          ) : filteredFriends.length > 0 ? (
            <div className="space-y-1">
              {filteredFriends.map(friend => {
                const isSelected = selectedIds.includes(friend.user_id);
                const isInvited = invitedIds.includes(friend.user_id);
                return (
                  <div key={friend.user_id} className="contents">
                    <button
                      onClick={() => toggleSelect(friend.user_id)}
                      disabled={isInvited}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                        isSelected ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-gray-50'
                      } ${isInvited ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={friend.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.name || friend.username)}&background=random&color=fff`}
                          className="w-10 h-10 rounded-xl object-cover border border-gray-100 shadow-sm"
                          alt=""
                        />
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center border-2 border-white">
                            <Check size={8} className="text-white" strokeWidth={4} />
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-900 leading-tight">{friend.name || friend.username}</p>
                        <p className="text-[11px] font-semibold text-gray-400">@{friend.username}</p>
                      </div>
                    </div>
                    {isInvited ? (
                      <span className="text-[10px] font-black text-primary uppercase tracking-wider italic">Invited</span>
                    ) : (
                      <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                        isSelected ? 'bg-primary border-primary' : 'border-gray-200'
                      }`}>
                        {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                      </div>
                    )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mx-auto mb-4">
                <UserPlus size={32} />
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No friends found</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-white">
          <button
            onClick={handleInvite}
            disabled={selectedIds.length === 0 || sending}
            className="w-full py-4 bg-primary hover:bg-primary/90 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-2xl font-black text-[14px] uppercase tracking-wider transition-all shadow-xl shadow-primary/40 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {sending ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Invite {selectedIds.length > 0 ? `${selectedIds.length} Friends` : 'Circle'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
