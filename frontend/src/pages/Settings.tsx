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
  Palette,
  LogOut,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Lock,
  Sparkles,
  Sliders,
  FileText,
  ShoppingBag,
  ArrowLeft,
  ChevronRight,
  Volume2,
  Moon,
  Sun,
  HardDrive
} from 'lucide-react';
import { getPublicLegalDocuments } from '../config/legalDocuments';
import AudioSessionManager from '../audio/managers/AudioSessionManager';
import { SettingCardGroup } from '../components/settings/SettingCardGroup';
import { SettingRow } from '../components/settings/SettingRow';
import EditProfileModal from '../components/profile/EditProfileModal';

export default function Settings() {
  const { user, setUser, theme, setTheme } = useUserStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);

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
    is_private: user?.is_private || false,
    show_contact_info: user?.show_contact_info || false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    api.put('/users/settings', { dark_mode_enabled: nextTheme === 'dark' }).catch(() => {});
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
        setShowEditProfileModal(false);
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
    if (!passwords.current) return setError('Current password is required.');
    if (!passwords.new || passwords.new.length < 8) return setError('New password must be at least 8 characters.');
    if (passwords.new !== passwords.confirm) return setError('Passwords do not match.');
    
    setIsUpdatingPassword(true);
    try {
      await api.put('/users/password', {
        currentPassword: passwords.current,
        newPassword: passwords.new
      });
      setSuccess('Password updated successfully!');
      setPasswords({ current: '', new: '', confirm: '' });
      setShowPasswordModal(false);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setError(e.response?.data?.error || e.response?.data?.message || 'Password update failed.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-24 transition-colors">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 pt-4 sm:pt-6">
        {/* Navigation Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:scale-105 active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Settings
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Account & Application Preferences
            </p>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* User Card Overview */}
        <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 shadow-sm flex items-center gap-4">
          <img
            src={user?.avatar_url || user?.avatar || '/uploads/avatars/default.png'}
            alt={user?.name || 'User'}
            className="w-14 h-14 rounded-full object-cover border-2 border-pink-500/20 shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 truncate">
              {user?.name || user?.username || 'Sparkle Member'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
              @{user?.username || 'user'} • {user?.email || 'member@sparkle.app'}
            </p>
            <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
              {user?.is_verified ? 'Verified Account' : 'Sparkle Member'}
            </span>
          </div>
        </div>

        {/* GROUP 1: ACCOUNT & IDENTITY */}
        <SettingCardGroup title="Account & Identity">
          <SettingRow
            icon={UserIcon}
            title="Edit Profile"
            description="Name, bio, campus, major, and personal links"
            rightElement="chevron"
            onClick={() => setShowEditProfileModal(true)}
          />
          <SettingRow
            icon={Lock}
            title="Password"
            description="Update your account login password"
            rightElement="chevron"
            onClick={() => navigate('/settings/change-password')}
          />
          <SettingRow
            icon={Shield}
            title="Security Centre"
            description="App PIN, two-factor authentication (2FA), and device logins"
            rightElement="chevron"
            onClick={() => navigate('/settings/security')}
          />
          <SettingRow
            icon={Shield}
            title="Accounts Center"
            description="Manage connected accounts & profile visibility"
            rightElement="chevron"
            onClick={() => navigate('/accounts-center')}
          />
        </SettingCardGroup>

        {/* GROUP 2: APP PREFERENCES */}
        <SettingCardGroup title="App Preferences">
          <SettingRow
            icon={theme === 'dark' ? Moon : Sun}
            title="Theme & Dark Mode"
            description="Toggle between light and dark themes"
            rightElement="toggle"
            toggleValue={theme === 'dark'}
            onToggleChange={handleToggleTheme}
          />
          <SettingRow
            icon={MessageSquare}
            title="Messaging Preferences"
            description="Disappearing messages, read receipts, and sound rules"
            rightElement="chevron"
            onClick={() => navigate('/messages/settings')}
          />
          <SettingRow
            icon={ShoppingBag}
            title="Marketplace Settings"
            description="Seller profile, auto-reply, and payout channels"
            rightElement="chevron"
            onClick={() => navigate('/marketplace/settings')}
          />
        </SettingCardGroup>

        {/* GROUP 3: ADVANCED SETTINGS ENTRY (PROMINENT CONTROL CENTRE CARD) */}
        <SettingCardGroup title="Control Centre">
          <SettingRow
            icon={Sparkles}
            title="Advanced Settings"
            description="Fine-tune how Sparkle behaves, protects your data, and interacts with your account."
            rightElement="chevron"
            badgeText="System Architecture"
            badgeVariant="pink"
            onClick={() => navigate('/settings/advanced')}
          />
        </SettingCardGroup>

        {/* GROUP 4: SYSTEM & LEGAL */}
        <SettingCardGroup title="System & Legal">
          <SettingRow
            icon={HardDrive}
            title="Storage & Data Intelligence"
            description="Cache management and storage breakdown"
            rightElement="chevron"
            onClick={() => navigate('/admin/storage')}
          />
          <SettingRow
            icon={FileText}
            title="Legal & Privacy Policies"
            description="Terms of service, privacy policy, and user rules"
            rightElement="chevron"
            onClick={() => setShowLegalModal(true)}
          />
          <SettingRow
            icon={LogOut}
            title="Sign Out"
            description="Log out of your Sparkle session on this device"
            rightElement="chevron"
            onClick={handleLogout}
          />
        </SettingCardGroup>
      </main>

      {/* Digital Identity Modal */}
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
      />

      {/* MODAL 3: Legal & Privacy Policies */}
      {showLegalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-800 shadow-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-3 text-slate-900 dark:text-zinc-100">Legal & Privacy Policies</h2>
            <div className="space-y-3">
              {getPublicLegalDocuments().map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => {
                    setShowLegalModal(false);
                    navigate(`/legal/${doc.id}`);
                  }}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{doc.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{doc.summary}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4">
              <button
                onClick={() => setShowLegalModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
