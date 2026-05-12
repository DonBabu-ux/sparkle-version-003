import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api, { authApi } from '../api/api';
import Navbar from '../components/Navbar';
import { useUserStore } from '../store/userStore';
import Spinner from '../components/ui/Spinner';
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
    <div className="block lg:flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 lg:p-12 relative z-10 max-w-5xl mx-auto w-full pt-20 md:pt-32">
        <header className="flex flex-col xl:flex-row items-center justify-between gap-8 md:gap-16 mb-12 md:mb-24 animate-fade-in px-2 md:px-4 text-center xl:text-left">
          <div className="max-w-xl space-y-6 md:space-y-8">
            <div className="inline-flex items-center gap-2 md:gap-4 px-4 md:px-6 py-2 md:py-2.5 bg-white/80 backdrop-blur-3xl border border-white rounded-full shadow-xl shadow-primary/5 mx-auto xl:mx-0">
               <Activity size={14} md:size={18} strokeWidth={3} className="text-primary" />
               <span className="text-[9px] md:text-[10px] font-black text-black uppercase tracking-[0.4em] italic">Settings</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-9xl font-black text-black tracking-tighter leading-none italic uppercase">
               Your <span className="text-primary italic">Profile.</span>
            </h1>
            <p className="text-sm md:text-xl font-bold text-black opacity-60 leading-relaxed italic border-l-4 md:border-l-8 border-primary/20 pl-4 md:pl-8 mx-auto xl:mx-0 uppercase tracking-tight md:tracking-tighter">
               Update your profile, security settings, and app preferences.
            </p>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 md:gap-6 h-14 md:h-20 px-8 md:px-12 bg-black text-white hover:bg-red-600 transition-all rounded-2xl md:rounded-[28px] font-black text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.4em] italic shadow-2xl active:scale-95 group"
          >
            <LogOut size={20} md:size={24} strokeWidth={4} className="group-hover:rotate-12 transition-transform" /> 
            Log Out
          </button>
        </header>

        <div className="flex flex-nowrap md:flex-wrap gap-2 md:gap-4 mb-12 md:mb-20 pb-4 md:pb-8 overflow-x-auto no-scrollbar justify-start xl:justify-start px-2 md:px-4 -mx-4 md:mx-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 md:gap-4 h-12 md:h-16 px-6 md:px-10 rounded-xl md:rounded-[24px] font-black text-[9px] md:text-[11px] transition-all duration-700 whitespace-nowrap shadow-2xl border uppercase tracking-[0.2em] md:tracking-[0.3em] italic shrink-0 ${activeTab === tab.id ? 'bg-white border-white text-primary scale-105 shadow-primary/10' : 'bg-white/40 border-white text-black opacity-30 hover:opacity-100 hover:bg-white'}`}
            >
              <tab.icon size={16} md:size={20} strokeWidth={activeTab === tab.id ? 4 : 3} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="animate-fade-in relative z-10 w-full mb-32 md:mb-64 px-0 md:px-4">
          <div className="bg-white/80 backdrop-blur-3xl p-6 md:p-20 rounded-[32px] md:rounded-[64px] border border-white shadow-2xl shadow-primary/5 group relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 p-10 md:p-20 text-primary opacity-[0.01] pointer-events-none group-hover:opacity-[0.05] transition-all duration-[3000ms] group-hover:scale-150">
               <Orbit size={200} md:size={400} strokeWidth={1} />
            </div>

            {success && (
              <div className="mb-8 md:mb-16 p-6 md:p-10 bg-emerald-500 text-white rounded-2xl md:rounded-[40px] flex items-center gap-4 md:gap-8 animate-scale-in shadow-2xl shadow-emerald-500/20 border border-white/20">
                <CheckCircle2 size={24} md:size={40} strokeWidth={4} />
                <span className="text-sm md:text-lg font-black uppercase tracking-[0.1em] md:tracking-[0.2em] italic">Settings Updated</span>
              </div>
            )}
            {error && (
              <div className="mb-8 md:mb-16 p-6 md:p-10 bg-red-500 text-white rounded-2xl md:rounded-[40px] flex items-center gap-4 md:gap-8 animate-scale-in shadow-2xl shadow-red-500/20 border border-white/20">
                <AlertCircle size={24} md:size={40} strokeWidth={4} />
                <span className="text-sm md:text-lg font-black uppercase tracking-[0.1em] md:tracking-[0.2em] italic">{error}</span>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-12 md:space-y-24 animate-fade-in relative z-10">
                <div className="flex flex-col md:flex-row items-center gap-8 md:gap-20 pb-12 md:pb-20 border-b border-black/[0.03]">
                  <div className="relative group cursor-pointer">
                    <div className="w-32 h-32 md:w-56 md:h-56 rounded-[32px] md:rounded-[64px] p-2 bg-gradient-to-tr from-primary to-pink-200 overflow-hidden shadow-2xl ring-4 md:ring-8 ring-white">
                       <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-full h-full rounded-[24px] md:rounded-[56px] object-cover transition-all duration-1000 group-hover:scale-110 group-hover:rotate-3" alt="" />
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-[32px] md:rounded-[64px] opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center text-white backdrop-blur-md border-2 md:border-4 border-white/20 m-1 md:m-2">
                      <Camera size={32} md:size={48} strokeWidth={4} />
                    </div>
                  </div>
                  <div className="text-center md:text-left flex-1">
                    <h3 className="text-3xl md:text-5xl font-black text-black tracking-tighter uppercase italic leading-none mb-3 md:mb-6">Profile Picture</h3>
                    <p className="text-[10px] md:text-[12px] font-black text-black opacity-20 uppercase tracking-[0.3em] md:tracking-[0.5em] italic">Update your profile photo</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitProfile} className="space-y-8 md:space-y-16">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                    <div className="space-y-2 md:space-y-4">
                      <label className="text-[9px] md:text-[10px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] ml-6 md:ml-10 italic">Display Name</label>
                      <input type="text" name="name" className="pink-settings-input" value={formData.name} onChange={handleChange} />
                    </div>
                    <div className="space-y-2 md:space-y-4">
                      <label className="text-[9px] md:text-[10px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] ml-6 md:ml-10 italic">Username (@)</label>
                      <input type="text" name="username" className="pink-settings-input" value={formData.username} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="space-y-2 md:space-y-4">
                    <label className="text-[9px] md:text-[10px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] ml-6 md:ml-10 italic">Headline</label>
                    <input type="text" name="headline" className="pink-settings-input" value={formData.headline} onChange={handleChange} placeholder="What's on your mind?" />
                  </div>

                  <div className="space-y-2 md:space-y-4">
                    <label className="text-[9px] md:text-[10px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] ml-6 md:ml-10 italic">Bio</label>
                    <textarea name="bio" className="pink-settings-input min-h-[160px] md:min-h-[220px] py-6 md:py-10 resize-none" value={formData.bio} onChange={handleChange} placeholder="Tell us about yourself..." />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                    <div className="space-y-2 md:space-y-4">
                      <label className="text-[9px] md:text-[10px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] ml-6 md:ml-10 italic">Campus</label>
                      <input type="text" name="campus" className="pink-settings-input" value={formData.campus} onChange={handleChange} />
                    </div>
                    <div className="space-y-2 md:space-y-4">
                      <label className="text-[9px] md:text-[10px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] ml-6 md:ml-10 italic">Major</label>
                      <input type="text" name="major" className="pink-settings-input" value={formData.major} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="pt-8 md:pt-12">
                    <button type="submit" disabled={loading} className="w-full h-16 md:h-24 bg-primary text-white rounded-2xl md:rounded-[32px] font-black text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.4em] shadow-2xl shadow-primary/40 hover:scale-[1.03] active:scale-95 transition-all italic flex items-center justify-center gap-4 md:gap-6">
                      {loading ? 'Saving...' : 'Save Changes'}
                      <Spinner size="small" color="text-white" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-12 md:space-y-24 animate-fade-in relative z-10">
                <header className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6 md:gap-8 mb-12 md:mb-20">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-primary rounded-[24px] md:rounded-[32px] flex items-center justify-center text-white shadow-2xl group-hover:rotate-12 transition-transform shrink-0">
                     <ShieldCheck size={28} md:size={32} strokeWidth={4} />
                  </div>
                   <div>
                      <h3 className="text-3xl md:text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Security Settings</h3>
                      <p className="text-[10px] md:text-[11px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] mt-2 md:mt-4 italic">Manage your account security</p>
                   </div>
                </header>

                <div className="space-y-6 md:space-y-10">
                  <div className="p-6 md:p-10 bg-black/5 border-2 border-transparent rounded-[32px] md:rounded-[48px] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 group/item hover:bg-white hover:border-primary/10 hover:shadow-2xl transition-all duration-700">
                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-center md:text-left">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-[20px] md:rounded-[28px] flex items-center justify-center text-primary shadow-xl group-hover/item:scale-110 transition-all border border-black/5 shrink-0">
                        <Smartphone size={28} md:size={36} strokeWidth={4} />
                      </div>
                      <div>
                        <h4 className="text-xl md:text-2xl font-black text-black uppercase tracking-tight italic">Two-Step Verification</h4>
                        <p className="text-[9px] md:text-[10px] font-black text-black opacity-30 uppercase tracking-[0.2em] md:tracking-[0.4em] mt-1 md:mt-2 italic">Add an extra layer of security</p>
                      </div>
                    </div>
                    <div className={`w-16 h-8 md:w-20 md:h-10 flex items-center p-1.5 md:p-2 rounded-full cursor-pointer transition-all duration-700 shadow-inner shrink-0 ${formData.two_factor_enabled ? 'bg-primary shadow-primary/20' : 'bg-black/10'}`} 
                      onClick={() => {
                        const next = !formData.two_factor_enabled;
                        setFormData({...formData, two_factor_enabled: next});
                        handleUpdateSetting('two_factor_enabled', next);
                      }}>
                      <div className={`w-5 h-5 md:w-6 md:h-6 bg-white rounded-full shadow-2xl transition-transform duration-700 ${formData.two_factor_enabled ? 'translate-x-8 md:translate-x-10' : 'translate-x-0'}`}></div>
                    </div>
                  </div>

                  <div className="p-6 md:p-10 bg-black/5 border-2 border-transparent rounded-[32px] md:rounded-[48px] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 group/item hover:bg-white hover:border-primary/10 hover:shadow-2xl transition-all duration-700">
                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-center md:text-left">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-[20px] md:rounded-[28px] flex items-center justify-center text-red-500 shadow-xl group-hover/item:scale-110 transition-all border border-black/5 shrink-0">
                        <Lock size={28} md:size={36} strokeWidth={4} />
                      </div>
                      <div>
                        <h4 className="text-xl md:text-2xl font-black text-black uppercase tracking-tight italic">Log out of other devices</h4>
                        <p className="text-[9px] md:text-[10px] font-black text-black opacity-30 uppercase tracking-[0.2em] md:tracking-[0.4em] mt-1 md:mt-2 italic">Sign out of all other active sessions</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleSignOutOthers}
                      disabled={isSigningOutOthers}
                      className="w-full md:w-auto h-12 md:h-16 px-8 md:px-12 bg-black text-white rounded-[20px] md:rounded-[24px] font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.4em] hover:bg-red-600 transition-all active:scale-95 shadow-2xl italic"
                    >
                      {isSigningOutOthers ? 'Logging out...' : 'Sign Out'}
                    </button>
                  </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-8 md:space-y-16 pt-12 md:pt-24 border-t border-black/[0.03]">
                  <header className="text-center md:text-left">
                    <h3 className="text-3xl md:text-4xl font-black text-black tracking-tighter uppercase italic">Update Password</h3>
                    <p className="text-[9px] md:text-[11px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] mt-2 italic">Change your account password</p>
                  </header>
                  <div className="space-y-6 md:space-y-10">
                    <div className="space-y-2 md:space-y-4">
                       <label className="text-[9px] md:text-[10px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] ml-6 md:ml-10 italic">Current Password</label>
                       <input 
                        type="password" 
                        className="pink-settings-input" 
                        placeholder="••••••••••••" 
                        value={passwords.current}
                        onChange={e => setPasswords({...passwords, current: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
                      <div className="space-y-2 md:space-y-4">
                        <label className="text-[9px] md:text-[10px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] ml-6 md:ml-10 italic">New Password</label>
                        <input 
                          type="password" 
                          className="pink-settings-input" 
                          placeholder="••••••••••••" 
                          value={passwords.new}
                          onChange={e => setPasswords({...passwords, new: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2 md:space-y-4">
                        <label className="text-[9px] md:text-[10px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] ml-6 md:ml-10 italic">Confirm New Password</label>
                        <input 
                          type="password" 
                          className="pink-settings-input" 
                          placeholder="••••••••••••" 
                          value={passwords.confirm}
                          onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={isUpdatingPassword} className="w-full h-16 md:h-24 bg-black text-white rounded-2xl md:rounded-[32px] font-black text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.4em] shadow-2xl shadow-black/40 hover:bg-primary transition-all active:scale-95 italic">
                    {isUpdatingPassword ? 'Updating...' : 'Save Password'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-12 md:space-y-24 animate-fade-in relative z-10">
                <header className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6 md:gap-8 mb-12 md:mb-20">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-black text-white rounded-[24px] md:rounded-[32px] flex items-center justify-center shadow-2xl shrink-0">
                     <EyeOff size={28} md:size={32} strokeWidth={4} />
                  </div>
                   <div>
                      <h3 className="text-3xl md:text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Privacy Settings</h3>
                      <p className="text-[10px] md:text-[11px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] mt-2 md:mt-4 italic">Manage who can see your profile and activity</p>
                   </div>
                </header>

                <div className="space-y-6 md:space-y-10">
                  {[
                    { k: 'is_private',        l: 'Private Profile', d: 'Only people you follow can see your posts', i: Lock, color: 'text-primary' },
                    { k: 'show_contact_info', l: 'Public Contact Details',  d: 'Allow others to see your contact info', i: Globe, color: 'text-emerald-500' },
                    { k: 'show_birthday',     l: 'Show Birthday', d: 'Display your birthday on your profile', i: Sparkles, color: 'text-amber-500' }
                  ].map(item => (
                    <div key={item.k} className="p-6 md:p-12 bg-black/[0.02] border-2 border-transparent rounded-[32px] md:rounded-[56px] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 group/item hover:bg-white hover:border-black/5 hover:shadow-2xl transition-all duration-1000">
                      <div className="flex flex-col md:flex-row items-center gap-4 md:gap-10 text-center md:text-left">
                        <div className={`w-16 h-16 md:w-24 md:h-24 bg-white rounded-[20px] md:rounded-[32px] flex items-center justify-center ${item.color} shadow-2xl group-hover/item:rotate-12 transition-all border border-black/5 shrink-0`}>
                          <item.i size={28} md:size={40} strokeWidth={4} />
                        </div>
                        <div>
                          <h4 className="text-xl md:text-3xl font-black text-black uppercase tracking-tighter italic">{item.l}</h4>
                          <p className="text-[9px] md:text-[11px] font-black text-black opacity-30 uppercase tracking-[0.2em] md:tracking-[0.4em] mt-1 md:mt-2 italic">{item.d}</p>
                        </div>
                      </div>
                      <div className={`w-16 h-8 md:w-20 md:h-10 flex items-center p-1.5 md:p-2 rounded-full cursor-pointer transition-all duration-700 shadow-inner shrink-0 ${formData[item.k as keyof typeof formData] ? 'bg-primary shadow-primary/20' : 'bg-black/10'}`} 
                        onClick={() => {
                          const next = !formData[item.k as keyof typeof formData];
                          setFormData({...formData, [item.k]: next});
                          handleUpdateSetting(item.k, next);
                        }}>
                        <div className={`w-5 h-5 md:w-6 md:h-6 bg-white rounded-full shadow-2xl transition-transform duration-700 ${formData[item.k as keyof typeof formData] ? 'translate-x-8 md:translate-x-10' : 'translate-x-0'}`}></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-12 md:pt-24 border-t border-red-500/10">
                   <div className="inline-flex items-center gap-2 md:gap-4 px-4 md:px-6 py-2 bg-red-500/10 rounded-full mb-8 md:mb-12">
                      <Trash2 size={14} md:size={16} className="text-red-500" strokeWidth={4} />
                      <span className="text-[9px] md:text-[10px] font-black text-red-500 uppercase tracking-[0.2em] md:tracking-[0.4em] italic">Danger Zone</span>
                   </div>
                   <div className="p-8 md:p-16 bg-red-500/5 rounded-[32px] md:rounded-[64px] border-4 border-dashed border-red-500/10 flex flex-col xl:flex-row items-center justify-between gap-8 md:gap-16 group/wipe">
                     <div className="text-center xl:text-left max-w-xl">
                       <h4 className="text-3xl md:text-5xl font-black text-red-600 uppercase italic tracking-tighter leading-none mb-3 md:mb-6">Delete My Account</h4>
                       <p className="text-xs md:text-sm font-black text-red-400 mt-2 uppercase tracking-[0.1em] italic leading-relaxed opacity-60">
                         This will permanently delete your account and all your data. This cannot be undone.
                       </p>
                     </div>
                     <button onClick={handleDeleteAccount} className="h-16 md:h-24 px-8 md:px-16 bg-red-600 text-white rounded-2xl md:rounded-[32px] font-black text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.4em] shadow-2xl shadow-red-600/30 hover:scale-105 active:scale-95 transition-all italic w-full md:w-auto">
                       Delete Account
                     </button>
                   </div>
                </div>
              </div>
            )}
            
            {activeTab === 'notifications' && (
              <div className="space-y-12 md:space-y-24 animate-fade-in relative z-10">
                <header className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6 md:gap-8 mb-12 md:mb-20">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-[24px] md:rounded-[32px] flex items-center justify-center text-primary shadow-2xl animate-pulse ring-4 ring-primary/5 shrink-0">
                     <Bell size={28} md:size={32} strokeWidth={4} />
                  </div>
                   <div>
                      <h3 className="text-3xl md:text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Notifications</h3>
                      <p className="text-[10px] md:text-[11px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] mt-2 md:mt-4 italic">Manage your alerts and notifications</p>
                   </div>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                  {['Likes & Shares', 'New Followers', 'Mentions', 'Nearby Activity', 'App Updates', 'Trending Content'].map((item) => (
                    <div key={item} className="p-6 md:p-10 bg-black/[0.02] border-2 border-transparent rounded-[32px] md:rounded-[48px] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 group hover:bg-white hover:border-black/5 hover:shadow-2xl transition-all duration-700">
                      <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-center md:text-left">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-[20px] md:rounded-[28px] flex items-center justify-center text-black/5 group-hover:text-primary transition-all shadow-xl group-hover:rotate-6 border border-black/5 shrink-0">
                          <Bell size={28} md:size={32} strokeWidth={4} />
                        </div>
                        <h4 className="text-xl md:text-2xl font-black text-black uppercase tracking-tighter italic">{item}</h4>
                      </div>
                      <div className="w-16 h-8 flex items-center p-1.5 rounded-full cursor-pointer bg-primary shadow-inner shadow-primary/20 shrink-0">
                        <div className="w-5 h-5 bg-white rounded-full translate-x-8 shadow-2xl"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'messaging' && (
              <div className="space-y-12 md:space-y-24 animate-fade-in relative z-10">
                <header className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6 md:gap-8 mb-12 md:mb-20">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500 rounded-[24px] md:rounded-[32px] flex items-center justify-center text-white shadow-2xl shrink-0">
                     <MessageSquare size={28} md:size={32} strokeWidth={4} />
                  </div>
                   <div>
                      <h3 className="text-3xl md:text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Messaging Preferences</h3>
                      <p className="text-[10px] md:text-[11px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] mt-2 md:mt-4 italic">Choose who can message you directly</p>
                   </div>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
                  {['everyone', 'neighbors', 'off'].map(opt => (
                    <label key={opt} className={`p-8 md:p-16 rounded-[32px] md:rounded-[64px] border-4 cursor-pointer transition-all duration-1000 flex flex-col items-center justify-center text-center gap-6 md:gap-12 group/label ${formData.dm_permission === (opt === 'neighbors' ? 'followers' : opt === 'off' ? 'none' : opt) ? 'border-primary bg-primary/5 text-primary shadow-2xl scale-[1.03]' : 'border-white bg-white text-black opacity-20 hover:border-black/5 hover:opacity-60'}`}>
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
                      <div className={`w-20 h-20 md:w-32 md:h-32 rounded-[24px] md:rounded-[40px] flex items-center justify-center transition-all duration-1000 shrink-0 ${formData.dm_permission === (opt === 'neighbors' ? 'followers' : opt === 'off' ? 'none' : opt) ? 'bg-primary text-white shadow-2xl ring-4 md:ring-8 ring-primary/10 group-hover/label:rotate-12' : 'bg-black/5 text-black/10'}`}>
                        {opt === 'everyone' ? <Users size={36} md:size={56} strokeWidth={4} /> : opt === 'neighbors' ? <Heart size={36} md:size={56} strokeWidth={4} /> : <EyeOff size={36} md:size={56} strokeWidth={4} />}
                      </div>
                      <div className="space-y-2 md:space-y-3">
                         <span className="font-black text-xl md:text-2xl uppercase tracking-tighter italic">{opt === 'neighbors' ? 'Followers' : opt}</span>
                         <div className={`h-1 md:h-1.5 w-8 md:w-12 mx-auto rounded-full transition-all ${formData.dm_permission === (opt === 'neighbors' ? 'followers' : opt === 'off' ? 'none' : opt) ? 'bg-primary' : 'bg-black/5'}`} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-12 md:space-y-24 animate-fade-in relative z-10">
                <header className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6 md:gap-8 mb-12 md:mb-20">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-primary rounded-[24px] md:rounded-[32px] flex items-center justify-center text-white shadow-2xl shadow-primary/30 shrink-0">
                     <Palette size={28} md:size={32} strokeWidth={4} />
                  </div>
                   <div>
                      <h3 className="text-3xl md:text-5xl font-black text-black tracking-tighter uppercase italic leading-none">App Appearance</h3>
                      <p className="text-[10px] md:text-[11px] font-black text-black/20 uppercase tracking-[0.3em] md:tracking-[0.4em] mt-2 md:mt-4 italic">Choose your preferred theme</p>
                   </div>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
                  {['Pink Soft', 'High Contrast', 'Deep Signal', 'Amber Pulse'].map((t, i) => (
                    <div key={t} className={`p-6 md:p-10 rounded-[32px] md:rounded-[64px] bg-white border-4 flex flex-col items-center gap-6 md:gap-12 cursor-pointer transition-all duration-1000 group ${i === 0 ? 'border-primary bg-primary/5 shadow-2xl scale-[1.02]' : 'border-white opacity-20 hover:opacity-100 hover:bg-black/5 hover:border-black/5'}`}>
                       <div className={`w-full aspect-[21/9] rounded-[24px] md:rounded-[40px] shadow-2xl relative overflow-hidden transition-all duration-1000 group-hover:scale-105 ${i === 0 ? 'bg-[#fdf2f4] ring-4 md:ring-8 ring-white' : 'bg-black/5'}`}>
                           {i === 0 && <div className="absolute inset-0 bg-primary/10 blur-[40px] md:blur-[80px] animate-pulse"></div>}
                           <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-40 transition-opacity">
                              <Sparkles size={40} md:size={80} strokeWidth={1} />
                           </div>
                       </div>
                       <div className="flex flex-col items-center gap-2 md:gap-4">
                          <span className={`font-black text-xl md:text-2xl italic uppercase tracking-widest ${i === 0 ? 'text-primary' : 'text-black/30'}`}>{t}</span>
                          {i === 0 && <span className="px-4 md:px-6 py-1 md:py-2 bg-primary text-white text-[8px] md:text-[9px] font-black uppercase tracking-widest rounded-full shadow-xl shadow-primary/30">Current Theme</span>}
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
          padding: 18px 24px;
          background: rgba(0, 0, 0, 0.05);
          border: 2px solid transparent;
          border-radius: 20px;
          font-weight: 800;
          font-size: 14px;
          color: black;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
          font-style: italic;
          text-transform: uppercase;
          letter-spacing: -0.02em;
        }
        @media (min-width: 768px) {
          .pink-settings-input {
            padding: 28px 40px;
            border: 4px solid transparent;
            border-radius: 32px;
            font-weight: 900;
            font-size: 18px;
            letter-spacing: -0.05em;
          }
        }
        .pink-settings-input:focus {
          border-color: #e11d4820;
          background: white;
          box-shadow: 0 16px 32px rgba(225, 29, 72, 0.1);
          transform: translateY(-4px);
        }
        @media (min-width: 768px) {
          .pink-settings-input:focus {
            box-shadow: 0 32px 64px rgba(225, 29, 72, 0.1);
            transform: translateY(-6px);
          }
        }
        .pink-settings-input::placeholder {
           color: rgba(0,0,0,0.2);
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
