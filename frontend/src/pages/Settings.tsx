import { lockScroll, unlockScroll } from '../components/AppScreen';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import 'axios';
import api, { authApi } from '../api/api';
import { useUserStore } from '../store/userStore';
import { User as UserIcon, Shield, EyeOff, MessageSquare, LogOut, Trash2, CheckCircle2, AlertCircle, Lock, Sparkles, FileText, ShoppingBag, ArrowLeft, ChevronRight, Volume2, Moon, Sun, HardDrive, Download, X, UserCheck } from 'lucide-react';
import { getPublicLegalDocuments } from '../config/legalDocuments';
import '../audio/managers/AudioSessionManager';
import { SettingCardGroup } from '../components/settings/SettingCardGroup';
import { SettingRow } from '../components/settings/SettingRow';
import EditProfileModal from '../components/profile/EditProfileModal';
import { logger } from '../utils/logger';

export default function Settings() {
  const { user, theme, setTheme } = useUserStore();
  const navigate = useNavigate();

  const [ ,  ] = useState(false);
  const [ success,  ] = useState<string | null>(null);
  const [ error,  ] = useState<string | null>(null);

  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);

  // Unified Account Control sheet state
  const [showAccountControl, setShowAccountControl] = useState(false);
  type AcTab = 'menu' | 'hide' | 'terminate' | 'delete';
  const [acTab, setAcTab] = useState<AcTab>('menu');
  const [acPassword, setAcPassword] = useState('');
  const [acReason, setAcReason] = useState('');
  const [acConfirmText, setAcConfirmText] = useState('');
  const [acDataExport, setAcDataExport] = useState(false);
  const [acSubmitting, setAcSubmitting] = useState(false);
  const [acError, setAcError] = useState<string | null>(null);
  const [acSuccess, setAcSuccess] = useState<string | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(!!(user as any)?.is_hidden);

  const openAccountControl = (tab: AcTab = 'menu') => {
    setAcTab(tab);
    // C1 Ghost Mode: the login/2FA payload historically omitted is_hidden —
    // seed from GET /users/me so the toggle shows the true server state.
    api.get('/users/me').then((r) => {
      if (typeof r.data?.is_hidden === 'boolean') setIsHidden(r.data.is_hidden);
      else if (typeof r.data?.is_hidden === 'number') setIsHidden(r.data.is_hidden === 1);
    }).catch(() => { /* keep optimistic seed */ });
    setAcPassword('');
    setAcReason('');
    setAcConfirmText('');
    setAcDataExport(false);
    setAcError(null);
    setAcSuccess(null);
    setShowAccountControl(true);
  };

  // Close account control modal on Escape key and lock body scroll
  useEffect(() => {
    if (!showAccountControl) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAccountControl(false);
    };
    lockScroll();
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unlockScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAccountControl]);

  const [ ,  ] = useState({
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

  

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    api.put('/users/settings', { dark_mode_enabled: nextTheme === 'dark' }).catch(() => {});
  };

  

  const handleToggleHide = async (hidden: boolean) => {
    setAcSubmitting(true);
    setAcError(null);
    try {
      await api.put('/users/account/visibility', { hidden });
      setIsHidden(hidden);
      setAcSuccess(hidden ? 'Your profile is now hidden from discover & search.' : 'Your profile is now visible to others.');
      setTimeout(() => setAcSuccess(null), 3000);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setAcError(e.response?.data?.error || 'Failed to update visibility.');
    } finally {
      setAcSubmitting(false);
    }
  };

  const handleTerminateAccount = async () => {
    if (!acPassword) { setAcError('Password is required.'); return; }
    setAcSubmitting(true);
    setAcError(null);
    try {
      await api.post('/users/account/terminate', { password: acPassword, reason: acReason });
      useUserStore.getState().logout();
      navigate('/login');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setAcError(e.response?.data?.error || 'Termination failed. Check your password.');
    } finally {
      setAcSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (acConfirmText !== 'DELETE') { setAcError('Type DELETE to confirm.'); return; }
    if (!acPassword) { setAcError('Password is required.'); return; }
    setAcSubmitting(true);
    setAcError(null);
    try {
      await api.post('/users/account/delete', {
        password: acPassword,
        reason: acReason,
        requestDataExport: acDataExport,
      });
      useUserStore.getState().logout();
      navigate('/login');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string; message?: string } } };
      setAcError(e.response?.data?.error || e.response?.data?.message || 'Deletion failed. Check your password.');
    } finally {
      setAcSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = useUserStore.getState().refreshToken;
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (err) {
      logger.error('Logout error:', err);
    } finally {
      useUserStore.getState().logout();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-24 transition-colors">

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
            onClick={() => navigate('/settings/accounts')}
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
          <SettingRow
            icon={Volume2}
            title="Audio Diagnostics"
            description="Test your microphone, speakers, and call quality"
            rightElement="chevron"
            onClick={() => navigate('/settings/audio-diagnostics')}
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
          <SettingRow
            icon={UserCheck}
            title="Follow Requests"
            description="Review people waiting to follow your private account"
            rightElement="chevron"
            onClick={() => navigate('/follow-requests')}
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

        {/* GROUP 5: DANGER ZONE */}
        <SettingCardGroup title="Danger Zone">
          <SettingRow
            icon={Trash2}
            title="Account Control"
            description="Hide from users, terminate, or permanently delete your account"
            rightElement="chevron"
            onClick={() => openAccountControl('menu')}
          />
        </SettingCardGroup>
      </main>

      {/* Digital Identity Modal */}
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
      />

      {/* Swipable Side Slide Modal: Account Control */}
      <AnimatePresence>
        {showAccountControl && (
          <div className="fixed inset-0 z-(--z-sheet) overflow-hidden">
            {/* Backdrop */}
            <motion.div
              key="ac-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md cursor-pointer"
              onClick={() => setShowAccountControl(false)}
            />

            {/* Side Drawer Container */}
            <div className="fixed inset-y-0 right-0 z-(--z-sheet) flex max-w-full pointer-events-none">
              <motion.div
                key="ac-drawer"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.05, right: 0.75 }}
                onDragEnd={(_e, info) => {
                  if (info.offset.x > 80 || info.velocity.x > 250) {
                    setShowAccountControl(false);
                  }
                }}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="pointer-events-auto relative w-screen max-w-md h-full bg-white/95 dark:bg-[#121118]/95 backdrop-blur-2xl border-l border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden"
              >
                {/* Visual Left Edge Swipe Grip */}
                <div
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-16 rounded-full bg-slate-300 dark:bg-zinc-700 hover:bg-slate-400 dark:hover:bg-zinc-600 transition-colors pointer-events-none"
                  title="Swipe right to close"
                />

                {/* Top Hint & Close bar */}
                <div className="flex items-center justify-between px-5 pt-3.5 pb-2 text-[11px] text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800/60 select-none">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-zinc-500">
                    <ChevronRight size={14} className="text-[#ff2d87] animate-pulse" />
                    <span>Swipe right to close</span>
                  </div>
                  <button
                    onClick={() => setShowAccountControl(false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800/60">
                  <div className="flex items-center gap-3">
                    {acTab !== 'menu' && (
                      <button
                        onClick={() => { setAcTab('menu'); setAcError(null); setAcSuccess(null); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Back to Account Control"
                      >
                        <ArrowLeft size={18} />
                      </button>
                    )}
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                        {acTab === 'menu' ? 'Account Control' :
                         acTab === 'hide' ? 'Hide from Users' :
                         acTab === 'terminate' ? 'Terminate Account' : 'Delete Account'}
                      </h2>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {acTab === 'menu' ? 'Manage your account visibility and lifecycle' :
                         acTab === 'hide' ? 'Ghost mode — stay active but invisible' :
                         acTab === 'terminate' ? 'Reversible — suspend your profile' : 'Permanent — irreversibly delete data'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Scrollable Body with Animated Subtabs */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  {/* Notifications */}
                  {acSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold"
                    >
                      <CheckCircle2 size={16} className="flex-shrink-0" />
                      <span>{acSuccess}</span>
                    </motion.div>
                  )}
                  {acError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 flex items-center gap-2 p-3.5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium"
                    >
                      <AlertCircle size={16} className="flex-shrink-0" />
                      <span>{acError}</span>
                    </motion.div>
                  )}

                  <AnimatePresence mode="wait">
                    {/* ── MENU TAB ── */}
                    {acTab === 'menu' && (
                      <motion.div
                        key="tab-menu"
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -15 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        {/* Hide from Users */}
                        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 backdrop-blur-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300 flex-shrink-0">
                                <EyeOff size={18} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">Hide from Users</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Ghost mode — stay hidden in search & discover</p>
                              </div>
                            </div>
                            <button
                              id="toggle-hide"
                              onClick={() => handleToggleHide(!isHidden)}
                              disabled={acSubmitting}
                              className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 mt-1 ${isHidden ? 'bg-[#ff2d87]' : 'bg-slate-200 dark:bg-zinc-700'} disabled:opacity-50`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isHidden ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-zinc-400">
                              {isHidden ? '🙈 You are currently hidden' : '👁 Profile is currently visible'}
                            </span>
                            <button
                              onClick={() => { setAcTab('hide'); setAcError(null); }}
                              className="text-[#ff2d87] font-semibold hover:underline"
                            >
                              Learn more
                            </button>
                          </div>
                        </div>

                        {/* Terminate */}
                        <button
                          onClick={() => { setAcTab('terminate'); setAcError(null); }}
                          className="w-full p-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 flex items-center gap-3 text-left hover:bg-amber-100/70 dark:hover:bg-amber-500/20 transition-all active:scale-[0.99]"
                        >
                          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                            <Shield size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Terminate Account</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-0.5">Suspend your account — reversible via support</p>
                          </div>
                          <ChevronRight size={16} className="text-amber-500 flex-shrink-0" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => { setAcTab('delete'); setAcError(null); }}
                          className="w-full p-4 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50/70 dark:bg-red-500/10 flex items-center gap-3 text-left hover:bg-red-100/70 dark:hover:bg-red-500/20 transition-all active:scale-[0.99]"
                        >
                          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-500 dark:text-red-400 flex-shrink-0">
                            <Trash2 size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-red-700 dark:text-red-400">Delete Account</p>
                            <p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5">Permanently erase data — with data download form</p>
                          </div>
                          <ChevronRight size={16} className="text-red-400 flex-shrink-0" />
                        </button>
                      </motion.div>
                    )}

                    {/* ── HIDE TAB ── */}
                    {acTab === 'hide' && (
                      <motion.div
                        key="tab-hide"
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 15 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200 mb-2">What "Hidden" means:</p>
                          <ul className="text-xs text-slate-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside">
                            <li>Your profile won't appear in search, campus feeds, or discover</li>
                            <li>Existing followers can still see your posts</li>
                            <li>You can browse and use Sparkle normally</li>
                            <li>Reversible anytime from this screen with one tap</li>
                          </ul>
                        </div>
                        <button
                          onClick={() => handleToggleHide(!isHidden)}
                          disabled={acSubmitting}
                          className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-98 flex items-center justify-center gap-2 ${
                            isHidden
                              ? 'bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 hover:bg-slate-300 dark:hover:bg-zinc-700'
                              : 'bg-[#ff2d87] hover:bg-[#e02675] text-white shadow-lg shadow-[#ff2d87]/20'
                          } disabled:opacity-50`}
                        >
                          {acSubmitting ? <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" /> : null}
                          {isHidden ? '👁 Make Profile Visible Again' : '🙈 Turn On Ghost Mode (Hide Me)'}
                        </button>
                      </motion.div>
                    )}

                    {/* ── TERMINATE TAB ── */}
                    {acTab === 'terminate' && (
                      <motion.div
                        key="tab-terminate"
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 15 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Temporary Suspension:</p>
                          <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                            <li>You'll be logged out of all devices immediately</li>
                            <li>Your profile will be hidden from everyone</li>
                            <li>Your posts and profile are preserved safely</li>
                            <li>Contact support@sparkle.app whenever you wish to reactivate</li>
                          </ul>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5 block">
                            Reason <span className="font-normal text-slate-400">(optional)</span>
                          </label>
                          <select
                            value={acReason}
                            onChange={e => setAcReason(e.target.value)}
                            className="w-full text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          >
                            <option value="">Select a reason...</option>
                            <option value="taking_break">Taking a break</option>
                            <option value="privacy">Privacy concerns</option>
                            <option value="too_busy">Too busy with studies</option>
                            <option value="other">Other reason</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5 block">
                            Confirm your password
                          </label>
                          <input
                            type="password"
                            value={acPassword}
                            onChange={e => { setAcPassword(e.target.value); setAcError(null); }}
                            placeholder="Your account password"
                            autoComplete="current-password"
                            className="w-full text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </div>
                        <button
                          onClick={handleTerminateAccount}
                          disabled={acSubmitting || !acPassword}
                          className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all active:scale-98 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                        >
                          {acSubmitting ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
                          Suspend / Terminate My Account
                        </button>
                      </motion.div>
                    )}

                    {/* ── DELETE TAB WITH DATA DOWNLOAD FORM ── */}
                    {acTab === 'delete' && (
                      <motion.div
                        key="tab-delete"
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 15 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Permanent Erase:</p>
                          <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 list-disc list-inside">
                            <li>All profile data, stories, moments, and messages will be wiped</li>
                            <li>Followers and connections will be permanently removed</li>
                            <li>This action is irreversible and cannot be recovered</li>
                          </ul>
                        </div>

                        {/* Reason Dropdown */}
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5 block">
                            Why are you leaving? <span className="font-normal text-slate-400">(optional)</span>
                          </label>
                          <select
                            value={acReason}
                            onChange={e => setAcReason(e.target.value)}
                            className="w-full text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                          >
                            <option value="">Select a reason...</option>
                            <option value="privacy">Privacy concerns</option>
                            <option value="not_useful">Not finding campus friends</option>
                            <option value="switching_platform">Switching to another app</option>
                            <option value="graduated">Graduated from campus</option>
                            <option value="other">Other reason</option>
                          </select>
                        </div>

                        {/* Data Download / Export Form Section */}
                        <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 space-y-3">
                          <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={acDataExport}
                              onChange={e => setAcDataExport(e.target.checked)}
                              className="mt-1 w-4 h-4 accent-[#ff2d87] rounded flex-shrink-0 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <Download size={14} className="text-[#ff2d87]" />
                                <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                                  Download my data before deleting
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                We will compile and dispatch your personal data package prior to permanent deletion.
                              </p>
                            </div>
                          </label>

                          {/* Data export details if checked */}
                          {acDataExport && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pt-2 border-t border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs text-slate-600 dark:text-zinc-400"
                            >
                              <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-700/60">
                                <span>Export Format:</span>
                                <span className="font-semibold text-slate-800 dark:text-zinc-200">ZIP Archive (JSON + Media)</span>
                              </div>
                              <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-700/60">
                                <span>Dispatch Email:</span>
                                <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[180px]">
                                  {(user as any)?.email || 'Account registered email'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic">
                                ℹ️ A secure link will be emailed to you with your account history and media assets.
                              </p>
                            </motion.div>
                          )}
                        </div>

                        {/* Password confirmation */}
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5 block">
                            Confirm your password
                          </label>
                          <input
                            type="password"
                            value={acPassword}
                            onChange={e => { setAcPassword(e.target.value); setAcError(null); }}
                            placeholder="Enter password"
                            autoComplete="current-password"
                            className="w-full text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                          />
                        </div>

                        {/* Type DELETE confirmation */}
                        <div>
                          <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5 block">
                            Type <span className="font-mono font-bold text-red-500">DELETE</span> to confirm
                          </label>
                          <input
                            type="text"
                            value={acConfirmText}
                            onChange={e => { setAcConfirmText(e.target.value); setAcError(null); }}
                            placeholder="Type DELETE"
                            className="w-full text-sm font-mono rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                          />
                        </div>

                        <button
                          onClick={handleDeleteAccount}
                          disabled={acSubmitting || acConfirmText !== 'DELETE' || !acPassword}
                          className="w-full py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all active:scale-98 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                        >
                          {acSubmitting ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Trash2 size={16} />}
                          Permanently Delete Account
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Legal & Privacy Policies */}
      {showLegalModal && (
        <div className="fixed inset-0 z-(--z-sheet) flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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
