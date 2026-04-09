import { useState, useEffect } from 'react';
import api from '../../api/api';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'new' | 'group';
  onChatSelected: (chatId: string) => void;
}

export default function NewChatModal({ isOpen, onClose, defaultTab = 'new' }: NewChatModalProps) {
  const [tab, setTab] = useState<'new' | 'group'>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchFriends = async () => {
      try {
        const res = await api.get('/users/active-friends');
        if (res.data?.success) {
          setSearchResults(res.data.friends || []);
        }
      } catch (err) {
        console.error('Failed to load friends', err);
      }
    };
    fetchFriends();
  }, [isOpen]);

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val) return;
    try {
      const res = await api.get(`/users/search?q=${val}`);
      if (res.data?.success) {
        setSearchResults(res.data.data || []);
      }
    } catch (err) {
      console.error('Search failed', err);
    }
  };

  const handleUserClick = async (u: any) => {
    if (tab === 'group') {
      if (!selectedUsers.find(x => x.id === u.id)) {
        setSelectedUsers([...selectedUsers, u]);
      } else {
        setSelectedUsers(selectedUsers.filter(x => x.id !== u.id));
      }
    } else {
      // Create or go to direct chat
      try {
        // You would typically call an API to create/ensure chat exists:
        // const res = await api.post('/messages/chat', { partnerId: u.id });
        // onChatSelected(res.data.chatId);
        onClose();
      } catch (err) {
        console.error('Failed to create chat', err);
      }
    }
  };

  const handleCreateGroup = async () => {
     if (!groupName || selectedUsers.length === 0) return;
     // Add group creation API logic
     try {
       // const res = await api.post('/messages/groups', { name: groupName, members: selectedUsers.map(u => u.id) });
       // onChatSelected(res.data.groupId);
       onClose();
     } catch (err) {
       console.error('Failed to create group', err);
     }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[11000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <div className="text-xl font-extrabold text-[#111]">New Chat</div>
            <div className="text-sm text-gray-500 mt-0.5">Start a direct message or group</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="flex gap-0 mx-5 mt-4 bg-slate-50 rounded-xl p-1">
          <button 
            onClick={() => setTab('new')}
            className={`flex-1 p-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${tab === 'new' ? 'bg-white text-indigo-500 shadow-md' : 'bg-transparent text-slate-400 font-medium hover:text-slate-500'}`}
          >
            <i className="bi bi-chat-dots mr-1.5"></i> New Message
          </button>
          <button 
            onClick={() => setTab('group')}
            className={`flex-1 p-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${tab === 'group' ? 'bg-white text-indigo-500 shadow-md' : 'bg-transparent text-slate-400 font-medium hover:text-slate-500'}`}
          >
            <i className="bi bi-people mr-1.5"></i> Create Group
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {tab === 'group' && (
            <div className="mb-4">
              <div className="relative mb-2.5">
                <i className="bi bi-pencil-fill absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input 
                  type="text" 
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Group name..."
                  className="w-full py-3 pr-3.5 pl-9 border-2 border-slate-200 rounded-xl text-sm font-semibold outline-none text-[#111] focus:border-indigo-500 transition-colors"
                />
              </div>
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedUsers.map(u => (
                    <span key={u.id} className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                      {u.name || u.username}
                      <i className="bi bi-x cursor-pointer" onClick={() => handleUserClick(u)}></i>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2.5 bg-slate-50 rounded-xl p-2.5 mb-3 border-2 border-transparent focus-within:border-indigo-500 transition-colors">
            <i className="bi bi-search text-slate-400 text-sm"></i>
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search people..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-[#111]"
            />
          </div>

          <div className="flex flex-col gap-1">
            {searchResults.map((u, i) => {
              const isSelected = selectedUsers.find(x => x.id === u.id);
              return (
                <div 
                  key={u.id || i}
                  onClick={() => handleUserClick(u)}
                  className={`flex items-center p-2.5 rounded-xl cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-indigo-50' : ''}`}
                >
                  <img src={u.avatar_url || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-full object-cover" alt="" />
                  <div className="ml-3 flex-1">
                    <div className="text-sm font-bold text-[#111]">{u.name || u.username}</div>
                    <div className="text-xs text-slate-500">@{u.username}</div>
                  </div>
                  {tab === 'group' && (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>
                      {isSelected && <i className="bi bi-check text-white text-sm"></i>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {tab === 'group' && (
          <div className="p-4 border-t border-slate-100 flex gap-2.5">
             <button onClick={onClose} className="flex-1 p-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancel</button>
             <button onClick={handleCreateGroup} className="flex-1 p-3 rounded-xl border-none bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm font-bold shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
               <i className="bi bi-people-fill"></i> Create Group
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
