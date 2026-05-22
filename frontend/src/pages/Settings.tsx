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
  Globe,
  Sun,
  Moon
} from 'lucide-react';

export default function Settings() {
  const { user, setUser, theme, setTheme } = useUserStore();
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
    { id: 'profile',       icon: UserIcon,      label: 'Profile'       },
    { id: 'security',      icon: Shield,        label: 'Security'      },
    { id: 'privacy',       icon: EyeOff,        label: 'Privacy'       },
    { id: 'messaging',     icon: MessageSquare, label: 'Messaging'     },
    { id: 'appearance',    icon: Palette,       label: 'Appearance'    },
    { id: 'logout',        icon: LogOut,        label: 'Sign Out'      }
  ];

  const handleTabClick = (id: string) => {
    if (id === 'logout') {
      handleLogout();
    } else {
      setActiveTab(id);
    }
  };

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
    <div className="block lg:flex bg-white dark:bg-[#101217] min-h-screen text-black dark:text-white font-sans overflow-x-hidden transition-colors duration-300">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-primary/10 dark:bg-primary/5 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-primary/10 dark:bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 lg:p-12 relative z-10 max-w-5xl mx-auto w-full pt-16 md:pt-20">
        <header className="flex items-center gap-4 mb-8 animate-fade-in px-4">
            <div className="inline-flex items-center gap-3 px-5 py-2 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-full shadow-sm">
               <Activity size={16} className="text-primary animate-pulse" />
               <h1 className="text-sm font-black text-black dark:text-white uppercase tracking-[0.2em] italic">Settings</h1>
            </div>
        </header>

        <div className="flex flex-nowrap gap-2 mb-8 pb-2 overflow-x-auto no-scrollbar px-4 -mx-4 border-b border-black/[0.03] dark:border-white/[0.03]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-2.5 h-10 px-6 rounded-xl font-bold text-[10px] transition-all duration-300 whitespace-nowrap border uppercase tracking-widest ${activeTab === tab.id ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/10 text-black/40 dark:text-white/40 hover:border-primary/20 hover:text-primary'}`}
            >
              <tab.icon size={14} strokeWidth={3} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="animate-fade-in relative z-10 w-full mb-32 px-0">
          <div className="bg-white dark:bg-[#121212] p-6 md:p-12 rounded-[24px] md:rounded-[32px] border border-black/5 dark:border-white/5 shadow-xl group relative overflow-hidden">
            {/* Subtle Decor */}
            <div className="absolute top-0 right-0 p-12 text-primary/5 pointer-events-none group-hover:scale-110 transition-transform duration-[2000ms]">
               <Orbit size={300} strokeWidth={1} />
            </div>

            {success && (
              <div className="mb-10 p-5 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 text-emerald-700 dark:text-emerald-500 rounded-2xl flex items-center gap-4 animate-scale-in">
                <CheckCircle2 size={24} className="shrink-0" />
                <span className="text-sm font-bold">Preferences saved successfully.</span>
              </div>
            )}
            {error && (
              <div className="mb-10 p-5 bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 text-red-700 dark:text-red-500 rounded-2xl flex items-center gap-4 animate-scale-in">
                <AlertCircle size={24} className="shrink-0" />
                <span className="text-sm font-bold">{error}</span>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-12 animate-fade-in relative z-10">
                 <div className="flex flex-col md:flex-row items-center gap-8 pb-10 border-b border-black/5 dark:border-white/5">
                  <div className="relative group cursor-pointer">
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-gradient-to-tr from-primary to-pink-200 overflow-hidden shadow-lg ring-4 ring-white dark:ring-black">
                       <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-full h-full rounded-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center text-white backdrop-blur-sm m-1">
                      <Camera size={24} strokeWidth={2.5} />
                    </div>
                  </div>
                  <div className="text-center md:text-left">
                    <h3 className="text-2xl font-black text-black dark:text-white tracking-tight uppercase italic mb-2">Profile Image</h3>
                    <p className="text-xs font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">Update your digital identity</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitProfile} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-widest ml-4">Display Name</label>
                      <input type="text" name="name" className="sparkle-input" value={formData.name} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-widest ml-4">Username</label>
                      <input type="text" name="username" className="sparkle-input" value={formData.username} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-widest ml-4">Headline</label>
                    <input type="text" name="headline" className="sparkle-input" value={formData.headline} onChange={handleChange} placeholder="Founder @ Startup" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-widest ml-4">Biography</label>
                    <textarea name="bio" className="sparkle-input min-h-[140px] py-4 resize-none" value={formData.bio} onChange={handleChange} placeholder="Tell your story..." />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-widest ml-4">Campus</label>
                      <input type="text" name="campus" className="sparkle-input" value={formData.campus} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-widest ml-4">Major</label>
                      <input type="text" name="major" className="sparkle-input" value={formData.major} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="pt-6">
                    <button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-xl hover:translate-y-[-2px] active:translate-y-0 transition-all flex items-center justify-center gap-3">
                      {loading ? 'Processing...' : 'Sync Profile'}
                      {loading && <Spinner size="small" color="text-white" />}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-12 animate-fade-in relative z-10">
                <header className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm">
                     <ShieldCheck size={28} />
                  </div>
                    <div>
                       <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Security</h3>
                       <p className="text-xs font-bold text-gray-400 dark:text-white/40 uppercase tracking-widest">Fortify your account</p>
                    </div>
                </header>

                 <div className="grid gap-4">
                  <div className="p-6 bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl flex items-center justify-between group/item hover:bg-black/5 dark:hover:bg-white/10 hover:border-primary/20 transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white dark:bg-[#101217] rounded-xl flex items-center justify-center text-primary shadow-sm border border-black/5 dark:border-white/5">
                        <Smartphone size={24} />
                      </div>
                       <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Two-Step Verification</h4>
                        <p className="text-xs text-gray-500 dark:text-white/40 font-medium">Protect your account with extra security</p>
                      </div>
                     </div>
                    <div className={`w-14 h-7 flex items-center p-1 rounded-full cursor-pointer transition-all duration-500 ${formData.two_factor_enabled ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-gray-200 dark:bg-white/10'}`} 
                      onClick={() => {
                        const next = !formData.two_factor_enabled;
                        setFormData({...formData, two_factor_enabled: next});
                        handleUpdateSetting('two_factor_enabled', next);
                      }}>
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-500 ${formData.two_factor_enabled ? 'translate-x-7' : 'translate-x-0'}`}></div>
                    </div>
                  </div>

                   <div className="p-6 bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl flex items-center justify-between group/item hover:bg-black/5 dark:hover:bg-white/10 hover:border-red-100 transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white dark:bg-[#101217] rounded-xl flex items-center justify-center text-red-500 shadow-sm border border-black/5 dark:border-white/5">
                        <Lock size={24} />
                      </div>
                       <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">Active Sessions</h4>
                        <p className="text-xs text-gray-500 dark:text-white/40 font-medium">Clear all other active logins</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleSignOutOthers}
                      disabled={isSigningOutOthers}
                      className="h-10 px-6 bg-gray-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all active:scale-95"
                    >
                      {isSigningOutOthers ? 'Clearing...' : 'Clear Sessions'}
                    </button>
                  </div>
                </div>

                 <form onSubmit={handleUpdatePassword} className="space-y-6 pt-10 border-t border-gray-50 dark:border-white/5">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase italic">Update Password</h3>
                    <p className="text-xs font-bold text-gray-400 dark:text-white/40 uppercase tracking-widest mt-1">Keep your access secure</p>
                  </div>
                   <div className="grid gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-widest ml-4">Current Password</label>
                       <input 
                        type="password" 
                        className="sparkle-input" 
                        placeholder="••••••••••••" 
                        value={passwords.current}
                        onChange={e => setPasswords({...passwords, current: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-widest ml-4">New Password</label>
                        <input 
                          type="password" 
                          className="sparkle-input" 
                          placeholder="••••••••••••" 
                          value={passwords.new}
                          onChange={e => setPasswords({...passwords, new: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-widest ml-4">Confirm Password</label>
                        <input 
                          type="password" 
                          className="sparkle-input" 
                          placeholder="••••••••••••" 
                          value={passwords.confirm}
                          onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={isUpdatingPassword} className="w-full h-14 bg-gray-900 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-primary transition-all active:scale-95 shadow-lg">
                    {isUpdatingPassword ? 'Updating...' : 'Refresh Access'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-12 animate-fade-in relative z-10">
                <header className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-sm">
                     <EyeOff size={28} />
                  </div>
                    <div>
                       <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Privacy</h3>
                       <p className="text-xs font-bold text-gray-400 dark:text-white/40 uppercase tracking-widest">Control your visibility</p>
                    </div>
                </header>

                <div className="grid gap-4">
                  {[
                    { k: 'is_private',        l: 'Private Profile', d: 'Only followers can view your feed', i: Lock, color: 'text-primary' },
                    { k: 'show_contact_info', l: 'Public Contact',  d: 'Allow others to see your email/phone', i: Globe, color: 'text-emerald-500' },
                    { k: 'show_birthday',     l: 'Show Birthday', d: 'Display your birth date on profile', i: Sparkles, color: 'text-amber-500' }
                   ].map(item => (
                    <div key={item.k} className="p-6 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl flex items-center justify-between group/item hover:bg-white dark:hover:bg-white/10 hover:border-gray-200 transition-all duration-300">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 bg-white dark:bg-[#101217] rounded-xl flex items-center justify-center ${item.color} shadow-sm border border-gray-100 dark:border-white/5`}>
                          <item.i size={24} />
                        </div>
                         <div>
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white">{item.l}</h4>
                          <p className="text-xs text-gray-500 dark:text-white/40 font-medium">{item.d}</p>
                        </div>
                       </div>
                      <div className={`w-14 h-7 flex items-center p-1 rounded-full cursor-pointer transition-all duration-500 ${formData[item.k as keyof typeof formData] ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-gray-200 dark:bg-white/10'}`} 
                        onClick={() => {
                          const next = !formData[item.k as keyof typeof formData];
                          setFormData({...formData, [item.k]: next});
                          handleUpdateSetting(item.k, next);
                        }}>
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-500 ${formData[item.k as keyof typeof formData] ? 'translate-x-7' : 'translate-x-0'}`}></div>
                      </div>
                    </div>
                  ))}
                </div>

                 <div className="pt-10 border-t border-red-50 dark:border-red-500/10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-50 dark:bg-red-500/10 rounded-full mb-6">
                       <Trash2 size={14} className="text-red-500" />
                       <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Termination</span>
                    </div>
                    <div className="p-8 bg-red-50/50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
                     <div className="text-center md:text-left">
                       <h4 className="text-xl font-black text-red-600 uppercase italic leading-none mb-2">Delete Account</h4>
                       <p className="text-xs font-medium text-red-400">Permanently erase your data and presence.</p>
                     </div>
                     <button onClick={handleDeleteAccount} className="h-12 px-8 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-600/10 hover:bg-red-700 transition-all w-full md:w-auto">
                       Delete Permanently
                     </button>
                   </div>
                </div>
              </div>
            )}
            
            {activeTab === 'notifications' && (
              <div className="space-y-12 animate-fade-in relative z-10">
                <header className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm">
                     <Bell size={28} />
                  </div>
                    <div>
                       <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Alerts</h3>
                       <p className="text-xs font-bold text-gray-400 dark:text-white/40 uppercase tracking-widest">Manage your stream</p>
                    </div>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Likes & Shares', 'Followers', 'Mentions', 'Nearby', 'System Updates', 'Trending'].map((item) => (
                    <div key={item} className="p-5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl flex items-center justify-between group hover:bg-white dark:hover:bg-white/10 hover:border-primary/10 transition-all duration-300">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white dark:bg-[#101217] rounded-xl flex items-center justify-center text-gray-400 dark:text-white/20 group-hover:text-primary transition-all shadow-sm border border-gray-100 dark:border-white/5">
                          <Bell size={18} />
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{item}</h4>
                      </div>
                      <div className="w-12 h-6 flex items-center p-1 rounded-full cursor-pointer bg-primary shadow-md shadow-primary/10">
                        <div className="w-4 h-4 bg-white rounded-full translate-x-6"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'messaging' && (
              <div className="space-y-12 animate-fade-in relative z-10">
                <header className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-sm">
                     <MessageSquare size={28} />
                  </div>
                    <div>
                       <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Direct Messages</h3>
                       <p className="text-xs font-bold text-gray-400 dark:text-white/40 uppercase tracking-widest">Select your inner circle</p>
                    </div>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['everyone', 'followers', 'none'].map(opt => (
                    <label key={opt} className={`p-8 rounded-3xl border-2 cursor-pointer transition-all duration-500 flex flex-col items-center justify-center text-center gap-6 group/label ${formData.dm_permission === opt ? 'border-primary bg-primary/5 text-primary' : 'border-gray-50 dark:bg-white/5 bg-gray-50 dark:border-white/5 text-gray-400 hover:border-gray-200'}`}>
                      <input
                        type="radio"
                        name="dm_permission"
                        value={opt}
                        className="hidden"
                        checked={formData.dm_permission === opt}
                        onChange={() => {
                          setFormData({...formData, dm_permission: opt as 'everyone' | 'followers' | 'none'});
                          handleUpdateSetting('dm_permission', opt);
                        }}
                      />
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${formData.dm_permission === opt ? 'bg-primary text-white shadow-lg' : 'bg-white dark:bg-[#101217] border border-gray-100 dark:border-white/5 text-gray-300 dark:text-white/10'}`}>
                        {opt === 'everyone' ? <Users size={28} /> : opt === 'followers' ? <Heart size={28} /> : <EyeOff size={28} />}
                      </div>
                       <div className="space-y-1">
                         <span className="font-bold text-sm uppercase tracking-widest">{opt}</span>
                         <div className={`h-1 w-6 mx-auto rounded-full transition-all ${formData.dm_permission === opt ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'}`} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-12 animate-fade-in relative z-10">
                <header className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white shadow-sm">
                     <Palette size={28} />
                  </div>
                    <div>
                       <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase italic tracking-tight">Appearance</h3>
                       <p className="text-[10px] font-black text-gray-400 dark:text-white/40 uppercase tracking-widest">Choose your experience</p>
                    </div>
                </header>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div 
                    onClick={() => setTheme('light')}
                    className={`p-6 rounded-[32px] border-2 cursor-pointer transition-all duration-500 flex flex-col items-center gap-6 group ${theme === 'light' ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/10' : 'border-gray-50 dark:bg-white/5 bg-gray-50 dark:border-white/5 hover:border-gray-200'}`}
                  >
                     <div className="w-full aspect-video rounded-2xl bg-white border border-gray-100 flex items-center justify-center shadow-inner overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 to-white opacity-50" />
                        <Sun size={48} className={`transition-all duration-700 ${theme === 'light' ? 'text-primary scale-110 rotate-12' : 'text-gray-200 group-hover:text-gray-400'}`} />
                     </div>
                      <div className="text-center space-y-1">
                        <span className={`text-lg font-black italic uppercase tracking-widest ${theme === 'light' ? 'text-primary' : 'text-gray-400 dark:text-white/20'}`}>Light Mode</span>
                        <p className="text-[9px] font-bold text-gray-400 dark:text-white/10 uppercase tracking-[0.2em]">Vibrant & Clean</p>
                     </div>
                  </div>

                   <div 
                    onClick={() => setTheme('dark')}
                    className={`p-6 rounded-[32px] border-2 cursor-pointer transition-all duration-500 flex flex-col items-center gap-6 group ${theme === 'dark' ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/10' : 'border-gray-50 dark:bg-white/5 bg-gray-50 dark:border-white/5 hover:border-gray-200'}`}
                  >
                     <div className="w-full aspect-video rounded-2xl bg-black border border-gray-800 flex items-center justify-center shadow-inner overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black opacity-50" />
                        <Moon size={48} className={`transition-all duration-700 ${theme === 'dark' ? 'text-primary scale-110 -rotate-12' : 'text-gray-200 group-hover:text-gray-400'}`} />
                     </div>
                      <div className="text-center space-y-1">
                        <span className={`text-lg font-black italic uppercase tracking-widest ${theme === 'dark' ? 'text-primary' : 'text-gray-400 dark:text-white/20'}`}>Dark Mode</span>
                        <p className="text-[9px] font-bold text-gray-400 dark:text-white/10 uppercase tracking-[0.2em]">Deep & Immersive</p>
                     </div>
                  </div>
                </div>

                 <div className="p-8 bg-gray-50 dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/5 mt-12">
                    <div className="flex items-center gap-4 mb-4">
                       <Sparkles size={20} className="text-primary" />
                       <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Interface Scaling</h4>
                    </div>
                    <p className="text-xs font-bold text-gray-400 dark:text-white/40 uppercase tracking-[0.15em] leading-relaxed max-w-sm mb-6">Adjust the visual density of the Sparkle interface to suit your display and preference.</p>
                    <div className="flex gap-2">
                       {['Compact', 'Default', 'Large'].map(scale => (
                         <button key={scale} className={`px-5 h-10 rounded-xl font-bold text-[10px] uppercase tracking-widest border transition-all ${scale === 'Default' ? 'bg-white dark:bg-[#101217] border-primary text-primary shadow-sm' : 'bg-white dark:bg-[#121212] border-gray-200 dark:border-white/5 text-gray-400 dark:text-white/40 hover:border-gray-300'}`}>
                            {scale}
                         </button>
                       ))}
                    </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      <style>{`
         .sparkle-input {
          width: 100%;
          padding: 12px 20px;
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          color: #121212;
          transition: all 0.3s ease;
          outline: none;
        }
        .dark .sparkle-input {
          background: #0a0a0a;
          border-color: rgba(255,255,255,0.1);
          color: #fff;
        }
        .sparkle-input:focus {
          background: #ffffff;
          border-color: #e11d48;
          box-shadow: 0 0 0 4px rgba(225, 29, 72, 0.1);
        }
        .dark .sparkle-input:focus {
          background: #000;
          border-color: #e11d48;
        }
        .sparkle-input::placeholder {
           color: #9ca3af;
           font-weight: 400;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.4s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
