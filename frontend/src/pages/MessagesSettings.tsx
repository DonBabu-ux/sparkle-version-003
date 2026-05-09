import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Lock, Trash2, UserX, MessageCircle, ChevronDown, Orbit } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

export default function MessagesSettings() {
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.push_notifications !== 0);
  const [messagePrivacy, setMessagePrivacy] = useState(user?.message_privacy || 'followers');
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState(user?.last_seen_privacy || 'everyone');
  const [chatTheme, setChatTheme] = useState(user?.chat_theme || 'default');
  const [securityPinEnabled, setSecurityPinEnabled] = useState(!!user?.chat_pin);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setNotificationsEnabled(user.push_notifications !== 0);
      setMessagePrivacy(user.message_privacy || 'followers');
      setLastSeenPrivacy(user.last_seen_privacy || 'everyone');
      setChatTheme(user.chat_theme || 'default');
      setSecurityPinEnabled(!!user.chat_pin);
    }
  }, [user]);

  const updateSetting = async (key: string, value: string | number) => {
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
    <div className="min-h-screen bg-[#fdf2f4] text-black font-sans pb-20 lg:pb-0 overflow-x-hidden pt-12 md:pt-20">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[300px] md:w-[700px] h-[300px] md:h-[700px] bg-red-200/20 rounded-full blur-[80px] md:blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[250px] md:w-[500px] h-[250px] md:h-[500px] bg-pink-200/20 rounded-full blur-[60px] md:blur-[120px] pointer-events-none z-0" />
      
      {/* Brand Watermark */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black/[0.015] pointer-events-none z-0" aria-hidden>
        <Orbit size={600} strokeWidth={0.5} className="animate-spin-slow" />
      </div>

      <div className="max-w-4xl mx-auto pt-10 md:pt-16 px-4 md:px-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 mb-10 md:mb-12 animate-fade-in">
          <div className="flex items-center gap-5 md:gap-8">
            <button 
              onClick={() => navigate('/messages')}
              className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-white/80 backdrop-blur-3xl flex items-center justify-center text-black shadow-lg border border-white hover:scale-105 active:scale-95 transition-all"
            >
              <ArrowLeft size={22} md:size={28} strokeWidth={3} />
            </button>
            <div>
              <h1 className="text-2xl md:text-4xl font-black text-black tracking-tight italic leading-none">Message Settings</h1>
              <p className="text-sm md:text-base font-medium text-black/40 mt-2">Manage your message notifications, privacy, and security settings.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8 animate-fade-in pb-20">
          {/* Notifications Section */}
          <section className="bg-white/70 backdrop-blur-3xl rounded-[24px] md:rounded-[32px] shadow-2xl shadow-black/5 border border-white/60 overflow-hidden p-6 md:p-10 transition-all hover:bg-white/80">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10 shadow-sm">
                <Bell size={20} md:size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-black tracking-tight">Notifications</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between group">
                <div className="max-w-[75%]">
                   <h3 className="text-base md:text-lg font-bold text-black group-hover:text-primary transition-colors">Message notifications</h3>
                   <p className="text-sm md:text-base text-black/40 mt-1 leading-snug">Get notified when you receive a new message.</p>
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
                  <div className="w-14 h-8 bg-black/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Privacy Section */}
          <section className="bg-white/70 backdrop-blur-3xl rounded-[24px] md:rounded-[32px] shadow-2xl shadow-black/5 border border-white/60 overflow-hidden p-6 md:p-10 transition-all hover:bg-white/80">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10 shadow-sm">
                <Lock size={20} md:size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-black tracking-tight">Privacy settings</h2>
            </div>

            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                <div className="md:max-w-[60%]">
                  <h3 className="text-base md:text-lg font-bold text-black group-hover:text-primary transition-colors">Who can message you</h3>
                  <p className="text-sm md:text-base text-black/40 mt-1 leading-snug">Choose who is allowed to send you direct messages.</p>
                </div>
                <div className="relative w-full md:w-48">
                  <select 
                    value={messagePrivacy}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMessagePrivacy(val);
                      updateSetting('message_privacy', val);
                    }}
                    className="w-full appearance-none bg-black/5 hover:bg-black/10 border border-black/5 text-black text-sm font-semibold rounded-xl px-5 py-3 pr-10 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers only</option>
                    <option value="no_one">No one</option>
                  </select>
                  <ChevronDown size={16} strokeWidth={3} className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
                </div>
              </div>

              <div className="w-full h-px bg-black/[0.06]"></div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                <div className="md:max-w-[60%]">
                  <h3 className="text-base md:text-lg font-bold text-black group-hover:text-primary transition-colors">Last seen status</h3>
                  <p className="text-sm md:text-base text-black/40 mt-1 leading-snug">Control who can see when you were last online.</p>
                </div>
                <div className="relative w-full md:w-48">
                  <select 
                    value={lastSeenPrivacy}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLastSeenPrivacy(val);
                      updateSetting('last_seen_privacy', val);
                    }}
                    className="w-full appearance-none bg-black/5 hover:bg-black/10 border border-black/5 text-black text-sm font-semibold rounded-xl px-5 py-3 pr-10 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers only</option>
                    <option value="no_one">Private</option>
                  </select>
                  <ChevronDown size={16} strokeWidth={3} className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none" />
                </div>
              </div>

              <div className="w-full h-px bg-black/[0.06]"></div>

              <button 
                onClick={() => navigate('/settings/blocked')}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black/30 group-hover:bg-primary group-hover:text-white transition-all">
                    <UserX size={18} strokeWidth={2.5} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base md:text-lg font-bold text-black group-hover:text-primary transition-colors">Blocked users</h3>
                    <p className="text-sm text-black/40 leading-snug">Manage users you have blocked from messaging you.</p>
                  </div>
                </div>
                <ArrowLeft size={18} strokeWidth={3} className="text-black/20 rotate-180 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </section>

          {/* Theme Section */}
          <section className="bg-white/70 backdrop-blur-3xl rounded-[24px] md:rounded-[32px] shadow-2xl shadow-black/5 border border-white/60 overflow-hidden p-6 md:p-10 transition-all hover:bg-white/80">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10 shadow-sm">
                <Orbit size={20} md:size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-black tracking-tight">Appearance</h2>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 group">
              <div className="md:max-w-[60%]">
                <h3 className="text-base md:text-lg font-bold text-black group-hover:text-primary transition-colors">Chat theme</h3>
                <p className="text-sm md:text-base text-black/40 mt-1 leading-snug">Choose a background color for your conversations.</p>
              </div>
              <div className="flex gap-3">
                {[
                  { key: 'default', color: 'bg-gray-100' },
                  { key: 'dark', color: 'bg-zinc-900' },
                  { key: 'pink', color: 'bg-pink-200' },
                  { key: 'blue', color: 'bg-blue-200' }
                ].map((theme) => (
                  <button 
                    key={theme.key}
                    onClick={() => {setChatTheme(theme.key); updateSetting('chat_theme', theme.key)}} 
                    className={`w-10 h-10 rounded-full border-2 transition-all ${chatTheme === theme.key ? 'border-primary scale-110 shadow-md' : 'border-white hover:scale-105 shadow-sm'} ${theme.color}`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Security Section */}
          <section className="bg-white/70 backdrop-blur-3xl rounded-[24px] md:rounded-[32px] shadow-2xl shadow-black/5 border border-white/60 overflow-hidden p-6 md:p-10 transition-all hover:bg-white/80">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10 shadow-sm">
                <Lock size={20} md:size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-black tracking-tight">Security</h2>
            </div>

            <div className="flex items-center justify-between group">
              <div className="max-w-[75%]">
                 <h3 className="text-base md:text-lg font-bold text-black group-hover:text-primary transition-colors">Chat lock (PIN)</h3>
                 <p className="text-sm md:text-base text-black/40 mt-1 leading-snug">Protect your messages with a 4-digit security PIN.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={securityPinEnabled} 
                  onChange={(e) => {
                    const val = e.target.checked;
                    if(val) {
                        const pin = prompt("Enter a 4-digit PIN for your messages:");
                        if (pin && pin.length >= 4) {
                            setSecurityPinEnabled(true);
                            updateSetting('chat_pin', pin);
                        } else {
                            e.target.checked = false;
                        }
                    } else {
                        setSecurityPinEnabled(false);
                        updateSetting('chat_pin', '');
                    }
                  }} 
                />
                <div className="w-14 h-8 bg-black/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </section>

          {/* Maintenance Section */}
          <section className="bg-white/70 backdrop-blur-3xl rounded-[24px] md:rounded-[32px] shadow-2xl shadow-black/5 border border-white/60 overflow-hidden p-6 md:p-10 transition-all hover:bg-white/80">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10 shadow-sm">
                <MessageCircle size={20} md:size={24} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-black tracking-tight">Account history</h2>
            </div>
            
            <button 
              onClick={() => {
                if (window.confirm('Delete all your message history? This cannot be undone.')) {
                  console.log('Purge protocol initiated');
                }
              }}
              className="w-full flex items-center justify-between group p-6 bg-red-500/5 hover:bg-red-500/10 border border-dashed border-red-500/30 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:scale-105 transition-transform">
                  <Trash2 size={20} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <h3 className="text-base md:text-lg font-bold text-red-500">Clear all messages</h3>
                  <p className="text-sm text-red-500/60 mt-0.5">Permanently delete all your conversations and chat history.</p>
                </div>
              </div>
              <ArrowLeft size={18} strokeWidth={3} className="text-red-500/30 rotate-180 group-hover:translate-x-1 transition-all" />
            </button>
          </section>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-white/90 backdrop-blur-3xl px-6 md:px-8 py-3 md:py-4 rounded-2xl md:rounded-[28px] shadow-2xl border border-white flex items-center gap-3 md:gap-4 animate-bounce z-[100]">
           <Orbit size={18} md:size={20} strokeWidth={4} className="text-primary animate-spin-slow" />
           <span className="text-xs font-bold text-black italic leading-none">Transmitting...</span>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>

  );
}
