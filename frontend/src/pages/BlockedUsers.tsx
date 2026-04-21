import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserX, Shield, Search } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

interface BlockedUser {
  user_id: string;
  username: string;
  name: string;
  avatar_url: string;
}

export default function BlockedUsers() {
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/blocks');
      setBlockedUsers(res.data || []);
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (userId: string) => {
    if (window.confirm('Are you sure you want to unblock this user?')) {
      try {
        await api.delete(`/users/block/${userId}`);
        setBlockedUsers(blockedUsers.filter(u => u.user_id !== userId));
      } catch (error) {
        console.error('Failed to unblock user:', error);
      }
    }
  };

  const filteredUsers = blockedUsers.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-0">
      <Navbar />
      
      <div className="max-w-3xl mx-auto pt-20 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Blocked Users</h1>
            <p className="text-slate-500 text-sm mt-1">Manage accounts you have restricted from interacting with you</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search blocked users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 text-sm font-medium">Loading blocked users...</p>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <div key={user.user_id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.avatar_url || '/uploads/avatars/default.png'} 
                      alt={user.username} 
                      className="w-10 h-10 rounded-full object-cover border border-slate-100"
                    />
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{user.name}</h3>
                      <p className="text-slate-500 text-xs">@{user.username}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleUnblock(user.user_id)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 active:scale-95 transition-all"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                <UserX size={32} />
              </div>
              <h3 className="font-bold text-slate-800">No Blocked Users</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-xs">
                {searchQuery ? `No users matching "${searchQuery}" found in your block list.` : "You haven't blocked any users yet. When you block someone, they will appear here."}
              </p>
            </div>
          )}
        </div>

        {/* Security Info */}
        <div className="mt-8 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex gap-3">
          <Shield className="text-indigo-500 shrink-0" size={20} />
          <p className="text-indigo-700 text-xs leading-relaxed">
            <strong>Pro Tip:</strong> Blocking someone prevents them from messaging you, seeing your posts, or finding your profile. They won't be notified that they've been blocked.
          </p>
        </div>
      </div>
    </div>
  );
}
