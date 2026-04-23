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
    <div className="min-h-screen bg-[#fdf2f4] text-black font-sans pb-20 lg:pb-0 overflow-x-hidden">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />
      
      <div className="max-w-4xl mx-auto pt-32 px-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16 animate-fade-in px-4">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => navigate('/messages')}
              className="w-16 h-16 rounded-3xl bg-white/80 backdrop-blur-3xl flex items-center justify-center text-black shadow-xl border border-white hover:scale-110 active:scale-95 transition-all"
            >
              <ArrowLeft size={28} strokeWidth={3} />
            </button>
            <div>
              <h1 className="text-4xl md:text-6xl font-black text-black tracking-tighter italic uppercase leading-none">Chat <span className="text-primary italic">Pulse</span></h1>
              <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] mt-3 italic">Sync your conversation harmonics</p>
            </div>
          </div>
        </div>

        <div className="space-y-12 animate-fade-in">
          {/* Notifications Section */}
          <section className="bg-white/80 backdrop-blur-3xl rounded-[48px] shadow-2xl shadow-primary/5 border border-white overflow-hidden p-10 md:p-12 hover:shadow-primary/10 transition-shadow">
            <div className="flex items-center gap-6 mb-12 px-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/5 text-primary flex items-center justify-center border border-primary/10 shadow-sm animate-pulse">
                <Bell size={28} strokeWidth={3} />
              </div>
              <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">Alerts</h2>
            </div>

            <div className="p-4 space-y-5">
              <div className="flex items-center justify-between group">
                <div>
                   <h3 className="text-xl font-black text-black uppercase tracking-tighter italic group-hover:text-primary transition-colors">Signal Ping</h3>
                   <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.2em] mt-2 italic leading-none">Notify for incoming harmonics</p>
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
                  <div className="w-20 h-10 bg-black/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-10 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-8 after:w-8 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Privacy Section */}
          <section className="bg-white/80 backdrop-blur-3xl rounded-[48px] shadow-2xl shadow-primary/5 border border-white overflow-hidden p-10 md:p-12 hover:shadow-primary/10 transition-shadow">
            <div className="flex items-center gap-6 mb-12 px-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/5 text-primary flex items-center justify-center border border-primary/10 shadow-sm">
                <Lock size={28} strokeWidth={3} />
              </div>
              <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">Privacy Sync</h2>
            </div>

            <div className="p-4 space-y-12">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                <div>
                  <h3 className="text-xl font-black text-black uppercase tracking-tighter italic group-hover:text-primary transition-colors">Frequency Filter</h3>
                  <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.2em] mt-2 italic">Who can transmit to your node?</p>
                </div>
                <div className="relative">
                  <select 
                    value={messagePrivacy}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMessagePrivacy(val);
                      updateSetting('message_privacy', val);
                    }}
                    className="appearance-none bg-black/5 hover:bg-white border-2 border-transparent focus:border-primary text-black text-xs font-black uppercase tracking-widest rounded-[22px] px-10 py-5 pr-14 focus:outline-none transition-all cursor-pointer italic"
                  >
                    <option value="everyone">Open Signal</option>
                    <option value="followers">Neighbors Only</option>
                    <option value="no_one">Muted Orbit</option>
                  </select>
                  <ChevronDown size={18} strokeWidth={4} className="absolute right-5 top-1/2 -translate-y-1/2 text-black/10 pointer-events-none group-hover:text-primary transition-colors" />
                </div>
              </div>

              <div className="w-full h-px bg-black/[0.03]"></div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                <div>
                  <h3 className="text-xl font-black text-black uppercase tracking-tighter italic group-hover:text-primary transition-colors">Last Sync Aura</h3>
                  <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.2em] mt-2 italic">Visibility of your last broadcast</p>
                </div>
                <div className="relative">
                  <select 
                    value={lastSeenPrivacy}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLastSeenPrivacy(val);
                      updateSetting('last_seen_privacy', val);
                    }}
                    className="appearance-none bg-black/5 hover:bg-white border-2 border-transparent focus:border-primary text-black text-xs font-black uppercase tracking-widest rounded-[22px] px-10 py-5 pr-14 focus:outline-none transition-all cursor-pointer italic"
                  >
                    <option value="everyone">Universal</option>
                    <option value="followers">Synced Only</option>
                    <option value="no_one">Hidden Node</option>
                  </select>
                  <ChevronDown size={18} strokeWidth={4} className="absolute right-5 top-1/2 -translate-y-1/2 text-black/10 pointer-events-none group-hover:text-primary transition-colors" />
                </div>
              </div>

              <div className="w-full h-px bg-black/[0.03]"></div>

              <button 
                onClick={() => navigate('/settings/blocked')}
                className="w-full flex items-center justify-between group py-4 px-2"
              >
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-black/10 group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all shadow-sm border border-black/5">
                    <UserX size={24} strokeWidth={3} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-black text-black uppercase tracking-tighter italic group-hover:text-primary transition-colors">Blacklist</h3>
                    <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.2em] mt-1 italic">Manage isolated nodes</p>
                  </div>
                </div>
                <ArrowLeft size={24} strokeWidth={4} className="text-black/10 rotate-180 group-hover:text-primary group-hover:translate-x-2 transition-all" />
              </button>
            </div>
          </section>

          {/* Theme & Aesthetics Section */}
          <section className="bg-white/80 backdrop-blur-3xl rounded-[48px] shadow-2xl shadow-primary/5 border border-white overflow-hidden p-10 md:p-12 hover:shadow-primary/10 transition-shadow">
            <div className="flex items-center gap-6 mb-12 px-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/5 text-primary flex items-center justify-center border border-primary/10 shadow-sm">
                <Orbit size={28} strokeWidth={3} />
              </div>
              <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">Aesthetics</h2>
            </div>

            <div className="p-4 space-y-12">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                <div>
                  <h3 className="text-xl font-black text-black uppercase tracking-tighter italic group-hover:text-primary transition-colors">Chat Background</h3>
                  <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.2em] mt-2 italic">Set the mood of your private space</p>
                </div>
                <div className="relative flex gap-3">
                  <button onClick={() => {setChatTheme('default'); updateSetting('chat_theme', 'default')}} className={`w-12 h-12 rounded-full border-4 transition-all ${chatTheme === 'default' ? 'border-primary scale-110' : 'border-transparent hover:scale-105'} bg-gray-100`}></button>
                  <button onClick={() => {setChatTheme('dark'); updateSetting('chat_theme', 'dark')}} className={`w-12 h-12 rounded-full border-4 transition-all ${chatTheme === 'dark' ? 'border-primary scale-110' : 'border-transparent hover:scale-105'} bg-zinc-900`}></button>
                  <button onClick={() => {setChatTheme('pink'); updateSetting('chat_theme', 'pink')}} className={`w-12 h-12 rounded-full border-4 transition-all ${chatTheme === 'pink' ? 'border-primary scale-110' : 'border-transparent hover:scale-105'} bg-pink-100`}></button>
                  <button onClick={() => {setChatTheme('blue'); updateSetting('chat_theme', 'blue')}} className={`w-12 h-12 rounded-full border-4 transition-all ${chatTheme === 'blue' ? 'border-primary scale-110' : 'border-transparent hover:scale-105'} bg-blue-100`}></button>
                </div>
              </div>
            </div>
          </section>

          {/* Security Section */}
          <section className="bg-white/80 backdrop-blur-3xl rounded-[48px] shadow-2xl shadow-primary/5 border border-white overflow-hidden p-10 md:p-12 hover:shadow-primary/10 transition-shadow">
            <div className="flex items-center gap-6 mb-12 px-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/5 text-primary flex items-center justify-center border border-primary/10 shadow-sm">
                <Lock size={28} strokeWidth={3} />
              </div>
              <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">Vault Security</h2>
            </div>

            <div className="p-4 space-y-12">
              <div className="flex items-center justify-between group">
                <div>
                   <h3 className="text-xl font-black text-black uppercase tracking-tighter italic group-hover:text-primary transition-colors">Access PIN Code</h3>
                   <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.2em] mt-2 italic leading-none">Require a passcode to view direct messages</p>
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
                          }
                      } else {
                          setSecurityPinEnabled(false);
                          updateSetting('chat_pin', '');
                      }
                    }} 
                  />
                  <div className="w-20 h-10 bg-black/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-10 peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-8 after:w-8 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Chat Settings Section */}
          <section className="bg-white/80 backdrop-blur-3xl rounded-[48px] shadow-2xl shadow-primary/5 border border-white overflow-hidden p-10 md:p-12 hover:shadow-primary/10 transition-shadow">
            <div className="flex items-center gap-6 mb-12 px-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/5 text-primary flex items-center justify-center border border-primary/10 shadow-sm">
                <MessageCircle size={28} strokeWidth={3} />
              </div>
              <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">Harmonic Maintenance</h2>
            </div>
            
            <div className="p-4">
              <button 
                onClick={() => {
                  if (window.confirm('Wipe all conversation history? This action is irreversible.')) {
                    // Implement delete all conversations logic if needed
                    console.log('Purge protocol initiated');
                  }
                }}
                className="w-full flex items-center justify-between group p-8 bg-red-500/5 hover:bg-red-500/10 border-2 border-dashed border-red-500/20 rounded-[32px] transition-all"
              >
                <div className="flex items-center gap-8">
                  <div className="w-14 h-14 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-500/30 group-hover:scale-110 transition-transform">
                    <Trash2 size={28} strokeWidth={3} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-black text-red-500 uppercase tracking-tighter italic leading-none">Purge Frequency</h3>
                    <p className="text-[10px] font-black text-red-500/30 uppercase tracking-[0.3em] mt-3 italic leading-none">Wipe all village signal history</p>
                  </div>
                </div>
                <ArrowLeft size={24} strokeWidth={4} className="text-red-500/20 rotate-180 group-hover:translate-x-2 transition-all" />
              </button>
            </div>
          </section>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-8 right-8 bg-white/80 backdrop-blur-3xl px-8 py-4 rounded-[28px] shadow-2xl border border-white flex items-center gap-4 animate-bounce z-[100]">
           <Orbit size={20} strokeWidth={4} className="text-primary animate-spin-slow" />
           <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic leading-none">Transmitting...</span>
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
