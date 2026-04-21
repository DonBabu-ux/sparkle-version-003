import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Lock, Eye, Trash2, Shield, UserX, MessageCircle, ChevronDown } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

export default function MessagesSettings() {
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.push_notifications !== 0);
  const [messagePrivacy, setMessagePrivacy] = useState(user?.message_privacy || 'followers');
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState(user?.last_seen_privacy || 'everyone');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setNotificationsEnabled(user.push_notifications !== 0);
      setMessagePrivacy(user.message_privacy || 'followers');
      setLastSeenPrivacy(user.last_seen_privacy || 'everyone');
    }
  }, [user]);

  const updateSetting = async (key: string, value: any) => {
    try {
      setLoading(true);
      await api.put('/users/settings', { [key]: value });
      if (user) {
        setUser({ ...user, [key]: value });
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-0">
      <Navbar />
      
      <div className="max-w-3xl mx-auto pt-20 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/messages')}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Message Settings</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your chat preferences and privacy</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Notifications Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <Bell className="text-indigo-500" size={20} />
              <h2 className="font-bold text-slate-800">Notifications</h2>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Push Notifications</h3>
                  <p className="text-slate-500 text-xs mt-1">Receive alerts for new messages</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notificationsEnabled} 
                    onChange={(e) => {
                      const val = e.target.checked;
                      setNotificationsEnabled(val);
                      updateSetting('push_notifications', val ? 1 : 0);
                    }} 
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Privacy Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <Lock className="text-rose-500" size={20} />
              <h2 className="font-bold text-slate-800">Privacy & Safety</h2>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Who can message you?</h3>
                  <p className="text-slate-500 text-xs mt-1">Control who can start new conversations with you</p>
                </div>
                <div className="relative">
                  <select 
                    value={messagePrivacy}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMessagePrivacy(val);
                      updateSetting('message_privacy', val);
                    }}
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all cursor-pointer"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers</option>
                    <option value="no_one">No One</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="w-full h-px bg-slate-100"></div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Last Seen Visibility</h3>
                  <p className="text-slate-500 text-xs mt-1">Choose who can see when you were last online</p>
                </div>
                <div className="relative">
                  <select 
                    value={lastSeenPrivacy}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLastSeenPrivacy(val);
                      updateSetting('last_seen_privacy', val);
                    }}
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all cursor-pointer"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers</option>
                    <option value="no_one">No One</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="w-full h-px bg-slate-100"></div>

              <button 
                onClick={() => navigate('/settings/blocked')}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 transition-colors">
                    <UserX size={16} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-800 text-sm">Blocked Users</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Manage accounts you've blocked</p>
                  </div>
                </div>
                <ArrowLeft size={16} className="text-slate-400 rotate-180" />
              </button>
            </div>
          </section>

          {/* Chat Settings Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <MessageCircle className="text-emerald-500" size={20} />
              <h2 className="font-bold text-slate-800">Chat Settings</h2>
            </div>
            <div className="p-5 space-y-5">
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete all conversations? This cannot be undone.')) {
                    // Implement delete all conversations logic if needed
                    console.log('Delete all conversations');
                  }
                }}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-100 transition-colors">
                    <Trash2 size={16} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-800 text-sm text-rose-600">Delete All Conversations</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Permanently remove all chat history</p>
                  </div>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 bg-white px-4 py-2 rounded-full shadow-lg border border-slate-100 flex items-center gap-2 animate-bounce">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-bold text-slate-600">Syncing...</span>
        </div>
      )}
    </div>
  );
}
