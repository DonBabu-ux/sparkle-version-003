import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, Smartphone, Mail, Key, ChevronRight, Plus, ShieldCheck, LogOut, Check
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import Avatar from '../components/Avatar';
import Spinner from '../components/ui/Spinner';

/**
 * zustand persist hydrates from localStorage after the first render. Until it
 * finishes, `accounts` is still the initial `[]` — showing the empty dashboard
 * that window would flash "no accounts" on every cold start.
 */
function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const persistApi = (useUserStore as unknown as { persist?: { hasHydrated?: () => boolean; onFinishHydration?: (cb: () => void) => () => void } }).persist;
    if (!persistApi) { setHydrated(true); return; }
    if (persistApi.hasHydrated?.()) { setHydrated(true); return; }
    const unsub = persistApi.onFinishHydration?.(() => setHydrated(true));
    return () => { unsub?.(); };
  }, []);
  return hydrated;
}

interface Row {
  label: string;
  sub: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number | string; className?: string }>;
  path: string;
}

export default function AccountsCenter() {
  const navigate = useNavigate();
  const { user, accounts, switchAccount } = useUserStore();
  const hydrated = useStoreHydrated();

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'Security',
      rows: [
        { label: 'Password and 2FA', sub: 'Change password, saved logins', icon: Lock, path: '/settings/security' },
        { label: 'Devices', sub: 'Where you are logged in', icon: Smartphone, path: '/settings/security' },
        { label: 'Recovery codes', sub: 'Generate or reset recovery keys', icon: Key, path: '/settings/change-password' }
      ]
    },
    {
      title: 'Profile',
      rows: [
        { label: 'Personal details', sub: 'Name, bio, campus and course', icon: ShieldCheck, path: '/settings' },
        { label: 'Messages settings', sub: 'Chat themes and notifications', icon: Mail, path: '/messages/settings' }
      ]
    }
  ];

  if (!hydrated) {
    return (
      <div className="flex bg-white dark:bg-black min-h-dvh items-center justify-center text-marketplace-text">
        <Spinner size="xl" color="text-primary" />
      </div>
    );
  }

  const accountList = accounts ?? [];

  return (
    <div className="flex bg-white dark:bg-black min-h-dvh text-marketplace-text font-sans overflow-x-hidden pb-[env(safe-area-inset-bottom)]">

      <header className="sticky top-0 z-[1100] bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-marketplace-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-11 h-11 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors"
        >
          <ArrowLeft size={24} strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-[17px] font-black tracking-tight leading-none">Account Center</h1>
          <p className="text-[11px] text-marketplace-muted font-medium mt-0.5">
            {accountList.length} {accountList.length === 1 ? 'account' : 'accounts'} · security and profile
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">

        {/* ── Accounts ─────────────────────────────────────────── */}
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-marketplace-muted mb-3 px-1">
          Your accounts
        </p>
        <div className="flex flex-col gap-2 mb-10">
          {accountList.map((acc) => {
            const isActive = acc.user.user_id === user?.user_id;
            return (
              <div
                key={acc.user.user_id}
                className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-colors ${
                  isActive
                    ? 'bg-marketplace-bg border-marketplace-border'
                    : 'bg-white dark:bg-white/[0.03] border-marketplace-border'
                }`}
              >
                <Avatar
                  src={acc.user.avatar_url}
                  name={acc.user.username}
                  className="w-12 h-12 rounded-xl shrink-0 border border-marketplace-border"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-black dark:text-white tracking-tight truncate">
                    {acc.user.name || acc.user.username}
                  </p>
                  <p className="text-[11px] text-marketplace-muted font-medium truncate">@{acc.user.username}</p>
                </div>
                {isActive ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest shrink-0">
                    <Check size={12} strokeWidth={3} /> Active
                  </span>
                ) : (
                  <button
                    onClick={() => { switchAccount(acc.user.user_id); navigate('/dashboard'); }}
                    className="px-4 py-2 rounded-xl bg-[#FF1F6D] hover:bg-[#ff3d80] text-white text-[11px] font-black uppercase tracking-widest transition-colors active:scale-95 shrink-0"
                  >
                    Switch
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-dashed border-marketplace-border hover:bg-marketplace-bg transition-colors text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-marketplace-bg group-hover:bg-[#FF1F6D] flex items-center justify-center text-marketplace-muted group-hover:text-white transition-colors shrink-0">
              <Plus size={20} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-black dark:text-white tracking-tight">Add account</p>
              <p className="text-[11px] text-marketplace-muted font-medium">Sign in with another Sparkle account</p>
            </div>
          </button>
        </div>

        {/* ── Setting rows ─────────────────────────────────────── */}
        {sections.map((section) => (
          <div key={section.title} className="mb-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-marketplace-muted mb-3 px-1">
              {section.title}
            </p>
            <div className="rounded-2xl bg-white dark:bg-white/[0.03] border border-marketplace-border divide-y divide-marketplace-border overflow-hidden">
              {section.rows.map((row) => (
                <button
                  key={row.label}
                  onClick={() => navigate(row.path)}
                  className="w-full flex items-center gap-3.5 p-3.5 hover:bg-marketplace-bg transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-marketplace-bg flex items-center justify-center text-marketplace-text shrink-0">
                    <row.icon size={18} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-black dark:text-white tracking-tight truncate">{row.label}</p>
                    <p className="text-[11px] text-marketplace-muted font-medium truncate">{row.sub}</p>
                  </div>
                  <ChevronRight size={16} className="text-marketplace-muted shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={() => navigate('/login')}
          className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-marketplace-border text-marketplace-muted hover:text-[#FF1F6D] hover:border-[#FF1F6D]/30 transition-colors text-left"
        >
          <LogOut size={18} strokeWidth={2.2} />
          <span className="text-[13px] font-bold tracking-tight">Sign out of this account</span>
        </button>

        <p className="mt-10 text-center text-[10px] font-black uppercase tracking-[0.3em] text-marketplace-muted/60">
          Sparkle © 2026
        </p>
      </main>
    </div>
  );
}
