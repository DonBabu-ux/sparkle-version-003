import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api, { authApi } from '../api/api';
import Navbar from '../components/Navbar';
import { useUserStore } from '../store/userStore';
import type { User } from '../types/user';
import { 
  User as UserIcon, 
  Shield, 
  EyeOff, 
  MessageSquare, 
  Bell, 
  Palette, 
  LogOut, 
  Camera, 
  Trash2, 
  CheckCircle2,
  AlertCircle,
  Users,
  Heart,
  Smartphone,
  Lock,
  Sparkles,
  Orbit,
  Activity,
  ShieldCheck,
  Globe
} from 'lucide-react';

export default function Settings() {
  const { user, setUser } = useUserStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    headline: user?.headline || '',
    bio: user?.bio || '',
    campus: user?.campus || '',
    major: user?.major || '',
    website: user?.website || '',
    phone_number: user?.phone_number || '',
    birthday: user?.birthday ? new Date(user.birthday).toISOString().substring(0, 10) : '',
    two_factor_enabled: user?.two_factor_enabled || false,
    is_private: user?.is_private || false,
    show_contact_info: user?.show_contact_info || false,
    show_birthday: user?.show_birthday || false,
    dm_permission: user?.dm_permission || 'everyone',
    theme: user?.theme || 'soft_pink',
  });

  const tabs = [
    { id: 'profile',       icon: UserIcon,     label: 'Profile'       },
    { id: 'security',      icon: Shield,        label: 'Security'      },
    { id: 'privacy',       icon: EyeOff,        label: 'Privacy'       },
    { id: 'messaging',     icon: MessageSquare, label: 'Messaging'     },
    { id: 'notifications', icon: Bell,          label: 'Notifications' },
    { id: 'appearance',    icon: Palette,       label: 'Appearance'    }
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleUpdateSetting = async (key: string, value: string | boolean) => {
    try {
      await api.put('/users/settings', { [key]: value });
      if (user) {
        setUser({ ...user, [key]: value } as unknown as User);
      }
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const response = await api.put('/users/profile', formData);
      if (response.data.success || response.status === 200) {
        setSuccess('Profile updated successfully!');
        if (user) {
          setUser({ ...user, ...formData } as User);
        }
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Update failed. Please try again.');
      } else {
        setError((err as Error).message || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = useUserStore.getState().refreshToken;
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      useUserStore.getState().logout();
      navigate('/login');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!passwords.current) return showError('Current password is required.');
    if (!passwords.new || passwords.new.length < 8) return showError('New password must be at least 8 characters.');
    if (passwords.new !== passwords.confirm) return showError('Passwords do not match.');
    
    setIsUpdatingPassword(true);
    try {
      await api.put('/users/password', {
        currentPassword: passwords.current,
        newPassword: passwords.new
      });
      setSuccess('Password updated successfully!');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setError(e.response?.data?.error || e.response?.data?.message || 'Password update failed.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    setSuccess(null);
    setError(null);
    try {
      await api.post('/users/logout-all');
      setSuccess('Signed out of all other devices.');
    } catch {
      setError('Sign out failed. Please try again.');
    } finally {
      setIsSigningOutOthers(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you sure? This action is permanent and cannot be undone. All your data will be deleted."
    );
    
    if (!confirmDelete) return;

    const password = window.prompt('Enter your password to confirm:');
    if (!password) return;

    setLoading(true);
    try {
      await api.delete('/users/me', { data: { password } });
      localStorage.removeItem('sparkleToken');
      navigate('/login');
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setError(e.response?.data?.error || e.response?.data?.message || 'Account deletion failed.');
    } finally {
      setLoading(false);
    }
  };

  const showError = (msg: string) => { setError(msg); setSuccess(null); };

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-5xl mx-auto w-full pt-20 md:pt-32">
        <header className="flex flex-col xl:flex-row items-center justify-between gap-16 mb-24 animate-fade-in px-4 text-center xl:text-left">
          <div className="max-w-xl space-y-8">
            <div className="inline-flex items-center gap-4 px-6 py-2.5 bg-white/80 backdrop-blur-3xl border border-white rounded-full shadow-xl shadow-primary/5 mx-auto xl:mx-0">
               <Activity size={18} strokeWidth={3} className="text-primary" />
               <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">System Preferences</span>
            </div>
            <h1 className="text-6xl md:text-9xl font-black text-black tracking-tighter leading-none italic uppercase">
               Village <span className="text-primary italic">Signature.</span>
            </h1>
            <p className="text-xl font-bold text-black opacity-60 leading-relaxed italic border-l-8 border-primary/20 pl-8 mx-auto xl:mx-0 uppercase tracking-tighter">
               Synchronize your node identity, stealth protocols, and harmonic visualization.
            </p>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-6 h-20 px-12 bg-black text-white hover:bg-red-600 transition-all rounded-[28px] font-black text-sm uppercase tracking-[0.4em] italic shadow-2xl active:scale-95 group"
          >
            <LogOut size={24} strokeWidth={4} className="group-hover:rotate-12 transition-transform" /> 
            Wipe Connection
          </button>
        </header>

        <div className="flex flex-wrap gap-4 mb-20 pb-8 overflow-x-auto no-scrollbar justify-center xl:justify-start px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-4 h-16 px-10 rounded-[24px] font-black text-[11px] transition-all duration-700 whitespace-nowrap shadow-2xl border uppercase tracking-[0.3em] italic ${activeTab === tab.id ? 'bg-white border-white text-primary scale-105 shadow-primary/10' : 'bg-white/40 border-white text-black opacity-30 hover:opacity-100 hover:bg-white'}`}
            >
              <tab.icon size={20} strokeWidth={activeTab === tab.id ? 4 : 3} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="animate-fade-in relative z-10 w-full mb-64 px-4">
          <div className="bg-white/80 backdrop-blur-3xl p-10 md:p-20 rounded-[64px] border border-white shadow-2xl shadow-primary/5 group relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 p-20 text-primary opacity-[0.01] pointer-events-none group-hover:opacity-[0.05] transition-all duration-[3000ms] group-hover:scale-150">
               <Orbit size={400} strokeWidth={1} />
            </div>

            {success && (
              <div className="mb-16 p-10 bg-emerald-500 text-white rounded-[40px] flex items-center gap-8 animate-scale-in shadow-2xl shadow-emerald-500/20 border border-white/20">
                <CheckCircle2 size={40} strokeWidth={4} />
                <span className="text-lg font-black uppercase tracking-[0.2em] italic">Protocol Synchronized Successfully</span>
              </div>
            )}
            {error && (
              <div className="mb-16 p-10 bg-red-500 text-white rounded-[40px] flex items-center gap-8 animate-scale-in shadow-2xl shadow-red-500/20 border border-white/20">
                <AlertCircle size={40} strokeWidth={4} />
                <span className="text-lg font-black uppercase tracking-[0.2em] italic">{error}</span>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-24 animate-fade-in relative z-10">
                <div className="flex flex-col md:flex-row items-center gap-20 pb-20 border-b border-black/[0.03]">
                  <div className="relative group cursor-pointer">
                    <div className="w-56 h-56 rounded-[64px] p-2 bg-gradient-to-tr from-primary to-pink-200 overflow-hidden shadow-2xl ring-8 ring-white">
                       <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-full h-full rounded-[56px] object-cover transition-all duration-1000 group-hover:scale-110 group-hover:rotate-3" alt="" />
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-[64px] opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center text-white backdrop-blur-md border-4 border-white/20 m-2">
                      <Camera size={48} strokeWidth={4} />
                    </div>
                  </div>
                  <div className="text-center md:text-left flex-1">
                    <h3 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-none mb-6">Visual Node</h3>
                    <p className="text-[12px] font-black text-black opacity-20 uppercase tracking-[0.5em] italic">Update your collective presence signature</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitProfile} className="space-y-16">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Village Designation</label>
                      <input type="text" name="name" className="pink-settings-input" value={formData.name} onChange={handleChange} />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Signal Frequency Key (@)</label>
                      <input type="text" name="username" className="pink-settings-input" value={formData.username} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Harmonic Headline</label>
                    <input type="text" name="headline" className="pink-settings-input" value={formData.headline} onChange={handleChange} placeholder="Transmit your current state..." />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">The Core Script (Bio)</label>
                    <textarea name="bio" className="pink-settings-input min-h-[220px] py-10 resize-none" value={formData.bio} onChange={handleChange} placeholder="Tell the village your story..." />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Base Satellite (Campus)</label>
                      <input type="text" name="campus" className="pink-settings-input" value={formData.campus} onChange={handleChange} />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Logic Specialization (Major)</label>
                      <input type="text" name="major" className="pink-settings-input" value={formData.major} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="pt-12">
                    <button type="submit" disabled={loading} className="w-full h-24 bg-primary text-white rounded-[32px] font-black text-sm uppercase tracking-[0.4em] shadow-2xl shadow-primary/40 hover:scale-[1.03] active:scale-95 transition-all italic flex items-center justify-center gap-6">
                      {loading ? 'Transmitting...' : 'Full System Sync'}
                      <Orbit size={24} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-24 animate-fade-in relative z-10">
                <header className="flex items-center gap-8 mb-20">
                  <div className="w-18 h-18 bg-primary rounded-3xl flex items-center justify-center text-white shadow-2xl group-hover:rotate-12 transition-transform">
                     <ShieldCheck size={32} strokeWidth={4} />
                  </div>
                   <div>
                      <h3 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Security Loop</h3>
                      <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.4em] mt-4 italic">Enforce village guard protocols</p>
                   </div>
                </header>

                <div className="space-y-10">
                  <div className="p-10 bg-black/5 border-2 border-transparent rounded-[48px] flex flex-col sm:flex-row items-center justify-between gap-10 group/item hover:bg-white hover:border-primary/10 hover:shadow-2xl transition-all duration-700">
                    <div className="flex items-center gap-8 text-center sm:text-left">
                      <div className="w-20 h-20 bg-white rounded-[28px] flex items-center justify-center text-primary shadow-xl group-hover/item:scale-110 transition-all border border-black/5">
                        <Smartphone size={36} strokeWidth={4} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-black uppercase tracking-tight italic">Bi-Phase Verification</h4>
                        <p className="text-[10px] font-black text-black opacity-30 uppercase tracking-[0.4em] mt-2 italic">Add layer of signal confirmation</p>
                      </div>
                    </div>
                    <div className={`w-20 h-10 flex items-center p-2 rounded-full cursor-pointer transition-all duration-700 shadow-inner ${formData.two_factor_enabled ? 'bg-primary shadow-primary/20' : 'bg-black/10'}`} 
                      onClick={() => {
                        const next = !formData.two_factor_enabled;
                        setFormData({...formData, two_factor_enabled: next});
                        handleUpdateSetting('two_factor_enabled', next);
                      }}>
                      <div className={`w-6 h-6 bg-white rounded-full shadow-2xl transition-transform duration-700 ${formData.two_factor_enabled ? 'translate-x-10' : 'translate-x-0'}`}></div>
                    </div>
                  </div>

                  <div className="p-10 bg-black/5 border-2 border-transparent rounded-[48px] flex flex-col sm:flex-row items-center justify-between gap-10 group/item hover:bg-white hover:border-primary/10 hover:shadow-2xl transition-all duration-700">
                    <div className="flex items-center gap-8 text-center sm:text-left">
                      <div className="w-20 h-20 bg-white rounded-[28px] flex items-center justify-center text-red-500 shadow-xl group-hover/item:scale-110 transition-all border border-black/5">
                        <Lock size={36} strokeWidth={4} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-black uppercase tracking-tight italic">Active Mirror Flush</h4>
                        <p className="text-[10px] font-black text-black opacity-30 uppercase tracking-[0.4em] mt-2 italic">Disconnect all other satellite echoes</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleSignOutOthers}
                      disabled={isSigningOutOthers}
                      className="w-full sm:w-auto h-16 px-12 bg-black text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.4em] hover:bg-red-600 transition-all active:scale-95 shadow-2xl italic"
                    >
                      {isSigningOutOthers ? 'Flushing...' : 'Execute Wipe'}
                    </button>
                  </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-16 pt-24 border-t border-black/[0.03]">
                  <header>
                    <h3 className="text-4xl font-black text-black tracking-tighter uppercase italic">Shift Access Logic</h3>
                    <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.4em] mt-2 italic">Modify your private village portal code</p>
                  </header>
                  <div className="space-y-10">
                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Active Entry Pass</label>
                       <input 
                        type="password" 
                        className="pink-settings-input italic text-2xl tracking-widest" 
                        placeholder="••••••••••••" 
                        value={passwords.current}
                        onChange={e => setPasswords({...passwords, current: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Future Access Code</label>
                        <input 
                          type="password" 
                          className="pink-settings-input italic text-2xl tracking-widest" 
                          placeholder="••••••••••••" 
                          value={passwords.new}
                          onChange={e => setPasswords({...passwords, new: e.target.value})}
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Harmonic Confirmation</label>
                        <input 
                          type="password" 
                          className="pink-settings-input italic text-2xl tracking-widest" 
                          placeholder="••••••••••••" 
                          value={passwords.confirm}
                          onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={isUpdatingPassword} className="w-full h-24 bg-black text-white rounded-[32px] font-black text-sm uppercase tracking-[0.4em] shadow-2xl shadow-black/40 hover:bg-primary transition-all active:scale-95 italic">
                    {isUpdatingPassword ? 'Confirming...' : 'Flash New Protocol'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-24 animate-fade-in relative z-10">
                <header className="flex items-center gap-8 mb-20">
                  <div className="w-18 h-18 bg-black text-white rounded-3xl flex items-center justify-center shadow-2xl">
                     <EyeOff size={32} strokeWidth={4} />
                  </div>
                   <div>
                      <h3 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Stealth Orbit</h3>
                      <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.4em] mt-4 italic">Configure your visibility in the collective</p>
                   </div>
                </header>

                <div className="space-y-10">
                  {[
                    { k: 'is_private',        l: 'Dark Frequency', d: 'Only confirmed neighbors can intercept your stream', i: Lock, color: 'text-primary' },
                    { k: 'show_contact_info', l: 'Open Transmission',  d: 'Broadcast contact methods to the village nodes', i: Globe, color: 'text-emerald-500' },
                    { k: 'show_birthday',     l: 'Lifecycle Beacon', d: 'Show your entrance date (Birthday) to peers', i: Sparkles, color: 'text-amber-500' }
                  ].map(item => (
                    <div key={item.k} className="p-12 bg-black/[0.02] border-2 border-transparent rounded-[56px] flex flex-col sm:flex-row items-center justify-between gap-10 group/item hover:bg-white hover:border-black/5 hover:shadow-2xl transition-all duration-1000">
                      <div className="flex items-center gap-10 text-center sm:text-left">
                        <div className={`w-24 h-24 bg-white rounded-[32px] flex items-center justify-center ${item.color} shadow-2xl group-hover/item:rotate-12 transition-all border border-black/5`}>
                          <item.i size={40} strokeWidth={4} />
                        </div>
                        <div>
                          <h4 className="text-3xl font-black text-black uppercase tracking-tighter italic">{item.l}</h4>
                          <p className="text-[11px] font-black text-black opacity-30 uppercase tracking-[0.4em] mt-2 italic">{item.d}</p>
                        </div>
                      </div>
                      <div className={`w-20 h-10 flex items-center p-2 rounded-full cursor-pointer transition-all duration-700 shadow-inner ${formData[item.k as keyof typeof formData] ? 'bg-primary shadow-primary/20' : 'bg-black/10'}`} 
                        onClick={() => {
                          const next = !formData[item.k as keyof typeof formData];
                          setFormData({...formData, [item.k]: next});
                          handleUpdateSetting(item.k, next);
                        }}>
                        <div className={`w-6 h-6 bg-white rounded-full shadow-2xl transition-transform duration-700 ${formData[item.k as keyof typeof formData] ? 'translate-x-10' : 'translate-x-0'}`}></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-24 border-t border-red-500/10">
                   <div className="inline-flex items-center gap-4 px-6 py-2 bg-red-500/10 rounded-full mb-12">
                      <Trash2 size={16} className="text-red-500" strokeWidth={4} />
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em] italic">Critical Termination Protocol</span>
                   </div>
                   <div className="p-16 bg-red-500/5 rounded-[64px] border-4 border-dashed border-red-500/10 flex flex-col xl:flex-row items-center justify-between gap-16 group/wipe">
                     <div className="text-center xl:text-left max-w-xl">
                       <h4 className="text-5xl font-black text-red-600 uppercase italic tracking-tighter leading-none mb-6">Full Frequency Wipe</h4>
                       <p className="text-sm font-black text-red-400 mt-2 uppercase tracking-[0.1em] italic leading-relaxed opacity-60">
                         Permanent erasure of all village signals, harmonics, and node identity. This operation is irreversible and will purge your existence from the collective database.
                       </p>
                     </div>
                     <button onClick={handleDeleteAccount} className="h-24 px-16 bg-red-600 text-white rounded-[32px] font-black text-sm uppercase tracking-[0.4em] shadow-2xl shadow-red-600/30 hover:scale-105 active:scale-95 transition-all italic whitespace-nowrap">
                       Confirm Total Purge
                     </button>
                   </div>
                </div>
              </div>
            )}
            
            {activeTab === 'notifications' && (
              <div className="space-y-24 animate-fade-in relative z-10">
                <header className="flex items-center gap-8 mb-20 text-center xl:text-left">
                  <div className="w-18 h-18 bg-primary/10 rounded-3xl flex items-center justify-center text-primary shadow-2xl animate-pulse ring-4 ring-primary/5">
                     <Bell size={32} strokeWidth={4} />
                  </div>
                   <div>
                      <h3 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Sensor Suite</h3>
                      <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.4em] mt-4 italic">Filter village impulses to your core</p>
                   </div>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {['Sparks & Echoes', 'Direct Syncs', 'Satellite Mentions', 'Neighbor Energy', 'Village Directives', 'Harmonic Signals'].map((item) => (
                    <div key={item} className="p-10 bg-black/[0.02] border-2 border-transparent rounded-[48px] flex items-center justify-between group hover:bg-white hover:border-black/5 hover:shadow-2xl transition-all duration-700">
                      <div className="flex items-center gap-8">
                        <div className="w-20 h-20 bg-white rounded-[28px] flex items-center justify-center text-black/5 group-hover:text-primary transition-all shadow-xl group-hover:rotate-6 border border-black/5">
                          <Bell size={32} strokeWidth={4} />
                        </div>
                        <h4 className="text-2xl font-black text-black uppercase tracking-tighter italic">{item}</h4>
                      </div>
                      <div className="w-16 h-8 flex items-center p-1.5 rounded-full cursor-pointer bg-primary shadow-inner shadow-primary/20">
                        <div className="w-5 h-5 bg-white rounded-full translate-x-9 shadow-2xl"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'messaging' && (
              <div className="space-y-24 animate-fade-in relative z-10">
                <header className="flex items-center gap-8 mb-20">
                  <div className="w-18 h-18 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shadow-2xl">
                     <MessageSquare size={32} strokeWidth={4} />
                  </div>
                   <div>
                      <h3 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Sync Grid</h3>
                      <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.4em] mt-4 italic">Determine who can initiate direct harmonics</p>
                   </div>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  {['everyone', 'neighbors', 'off'].map(opt => (
                    <label key={opt} className={`p-16 rounded-[64px] border-4 cursor-pointer transition-all duration-1000 flex flex-col items-center justify-center text-center gap-12 group/label ${formData.dm_permission === (opt === 'neighbors' ? 'followers' : opt === 'off' ? 'none' : opt) ? 'border-primary bg-primary/5 text-primary shadow-2xl scale-[1.03]' : 'border-white bg-white text-black opacity-20 hover:border-black/5 hover:opacity-60'}`}>
                      <input
                        type="radio"
                        name="dm_permission"
                        value={opt}
                        className="hidden"
                        checked={formData.dm_permission === (opt === 'neighbors' ? 'followers' : opt === 'off' ? 'none' : opt)}
                        onChange={() => {
                           const mapped = opt === 'neighbors' ? 'followers' : opt === 'off' ? 'none' : opt;
                          setFormData({...formData, dm_permission: mapped as 'everyone' | 'followers' | 'none'});
                          handleUpdateSetting('dm_permission', mapped);
                        }}
                      />
                      <div className={`w-32 h-32 rounded-[40px] flex items-center justify-center transition-all duration-1000 ${formData.dm_permission === (opt === 'neighbors' ? 'followers' : opt === 'off' ? 'none' : opt) ? 'bg-primary text-white shadow-2xl ring-8 ring-primary/10 group-hover/label:rotate-12' : 'bg-black/5 text-black/10'}`}>
                        {opt === 'everyone' ? <Users size={56} strokeWidth={4} /> : opt === 'neighbors' ? <Heart size={56} strokeWidth={4} /> : <EyeOff size={56} strokeWidth={4} />}
                      </div>
                      <div className="space-y-3">
                         <span className="font-black text-2xl uppercase tracking-tighter italic">{opt} Spectrum</span>
                         <div className={`h-1.5 w-12 mx-auto rounded-full transition-all ${formData.dm_permission === (opt === 'neighbors' ? 'followers' : opt === 'off' ? 'none' : opt) ? 'bg-primary' : 'bg-black/5'}`} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-24 animate-fade-in relative z-10">
                <header className="flex items-center gap-8 mb-20 text-center xl:text-left">
                  <div className="w-18 h-18 bg-primary rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-primary/30">
                     <Palette size={32} strokeWidth={4} />
                  </div>
                   <div>
                      <h3 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-none">The Aura</h3>
                      <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.4em] mt-4 italic">Select your primary village visualization</p>
                   </div>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {['Pink Soft', 'High Contrast', 'Deep Signal', 'Amber Pulse'].map((t, i) => (
                    <div key={t} className={`p-10 rounded-[64px] bg-white border-4 flex flex-col items-center gap-12 cursor-pointer transition-all duration-1000 group ${i === 0 ? 'border-primary bg-primary/5 shadow-2xl scale-[1.02]' : 'border-white opacity-20 hover:opacity-100 hover:bg-black/5 hover:border-black/5'}`}>
                       <div className={`w-full aspect-[21/9] rounded-[40px] shadow-2xl relative overflow-hidden transition-all duration-1000 group-hover:scale-105 ${i === 0 ? 'bg-[#fdf2f4] ring-8 ring-white' : 'bg-black/5'}`}>
                           {i === 0 && <div className="absolute inset-0 bg-primary/10 blur-[80px] animate-pulse"></div>}
                           <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-40 transition-opacity">
                              <Sparkles size={80} strokeWidth={1} />
                           </div>
                       </div>
                       <div className="flex flex-col items-center gap-4">
                          <span className={`font-black text-2xl italic uppercase tracking-widest ${i === 0 ? 'text-primary' : 'text-black/30'}`}>{t}</span>
                          {i === 0 && <span className="px-6 py-2 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-xl shadow-primary/30">Active System</span>}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      <style>{`
        .pink-settings-input {
          width: 100%;
          padding: 28px 40px;
          background: rgba(0, 0, 0, 0.05);
          border: 4px solid transparent;
          border-radius: 32px;
          font-weight: 900;
          font-size: 18px;
          color: black;
          transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
          font-style: italic;
          text-transform: uppercase;
          letter-spacing: -0.05em;
        }
        .pink-settings-input:focus {
          border-color: #e11d4820;
          background: white;
          box-shadow: 0 32px 64px rgba(225, 29, 72, 0.1);
          transform: translateY(-6px);
        }
        .pink-settings-input::placeholder {
           color: rgba(0,0,0,0.05);
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 30s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
