import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import api, { setAdminSession, setAdminSessionExpires, setAdminClockOffset, hasAdminSession, clearAdminSession } from '../../api/api';
import { useUserStore } from '../../store/userStore';
import Spinner from '../../components/ui/Spinner';
import { showSuccess } from '../../utils/toast';

type Mode = 'loading' | 'unlock' | 'set-password' | 'expired';

export default function AdminUnlock() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useUserStore((s) => !!s.token);
  const from = (location.state as { from?: string } | null)?.from || '/admin';

  const [mode, setMode] = useState<Mode>('loading');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });

  // Already elevated? Go straight through — this page is only the gate.
  useEffect(() => {
    if (hasAdminSession()) navigate(from, { replace: true });
  }, [navigate, from]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/admin/credentials/status');
        if (cancelled) return;
        const has = !!res.data?.data?.hasAdminPassword;
        setMode(has ? 'unlock' : 'set-password');
      } catch {
        if (cancelled) return;
        // Only a definitive 200 tells us the credential state. Anything else
        // (401 = dead account session, 5xx, network) goes to re-login.
        setMode('expired');
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/admin/session', { admin_password: adminPassword });
      setAdminSession(res.data.data.admin_session_token);
      // The SERVER decides when the session dies: anchor the countdown to the
      // expiry instant it minted (epoch ms) and measure its clock offset, so a
      // wrong browser clock or a moved DB server can't skew the window.
      const expiresAtMs = Number(res.data.data.expires_at_epoch_ms);
      const serverTimeMs = Number(res.data.data.server_time_epoch_ms);
      const mins = Number(res.data.data.expires_in_minutes) || 15;
      if (Number.isFinite(expiresAtMs) && expiresAtMs > 0) {
        setAdminSessionExpires(expiresAtMs);
      } else {
        setAdminSessionExpires(Date.now() + mins * 60000);
      }
      if (Number.isFinite(serverTimeMs) && serverTimeMs > 0) setAdminClockOffset(serverTimeMs);
      setAdminPassword('');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { code?: string; message?: string } } };
      const code = apiErr.response?.data?.code;
      if (code === 'admin_password_not_set') { setMode('set-password'); return; }
      if (apiErr.response?.status === 401 && code !== 'admin_password_invalid') {
        // Not the admin password — the account session itself is dead.
        clearAdminSession();
        setMode('expired');
        return;
      }
      setError(err.response?.data?.message || 'That admin password is incorrect.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (pwForm.next !== pwForm.confirm) {
      setError('The new admin passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/admin/credentials', {
        current_password: pwForm.current,
        new_admin_password: pwForm.next
      });
      setPwForm({ current: '', next: '', confirm: '' });
      showSuccess('Admin password set. Unlock the panel with it.');
      setMode('unlock');
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (apiErr.response?.status === 401) { setMode('expired'); return; }
      setError(apiErr.response?.data?.message || 'Could not set the admin password.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <GateShell>
        <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
          Log in with your account first — the admin password is a second, separate check.
        </p>
        <button
          onClick={() => navigate('/login', { state: { from } })}
          className="w-full h-11 rounded-full bg-primary text-white text-sm font-bold hover:bg-[#ff2d87] transition-colors"
        >
          Log in
        </button>
      </GateShell>
    );
  }

  return (
    <GateShell>
      {mode === 'loading' && (
        <div className="flex justify-center py-8"><Spinner /></div>
      )}

      {mode === 'expired' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
            Your login session expired. Log in again to continue — your admin password is unaffected.
          </p>
          <button
            onClick={() => navigate('/login', { state: { from } })}
            className="w-full h-11 rounded-full bg-primary text-white text-sm font-bold hover:bg-[#ff2d87] transition-colors"
          >
            Log in again
          </button>
        </div>
      )}

      {mode === 'unlock' && (
        <form onSubmit={handleUnlock} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-zinc-300">Admin password</label>
            <input
              autoFocus
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter your admin password"
              className="w-full h-11 rounded-xl bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 px-4 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-primary"
              required
            />
          </div>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-full bg-primary text-white text-sm font-bold hover:bg-[#ff2d87] transition-colors disabled:opacity-50"
          >
            {busy ? 'Checking...' : 'Unlock panel'}
          </button>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 text-center leading-relaxed">
            This is your admin password — not your login password. Access stays open for 15 minutes, then locks again.
          </p>
        </form>
      )}

      {mode === 'set-password' && (
        <form onSubmit={handleSetPassword} className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            This account has no admin password yet. Set one now — it must be different from your login password, and your login password can never open this panel.
          </p>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-zinc-300">Current login password</label>
            <input
              autoFocus
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm(f => ({ ...f, current: e.target.value }))}
              className="w-full h-11 rounded-xl bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 px-4 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-primary"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-zinc-300">New admin password</label>
            <input
              type="password"
              value={pwForm.next}
              onChange={(e) => setPwForm(f => ({ ...f, next: e.target.value }))}
              placeholder="At least 12 characters"
              className="w-full h-11 rounded-xl bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 px-4 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-primary"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-zinc-300">Confirm new admin password</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              className="w-full h-11 rounded-xl bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 px-4 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-primary"
              required
            />
          </div>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-full bg-primary text-white text-sm font-bold hover:bg-[#ff2d87] transition-colors disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Set admin password'}
          </button>
        </form>
      )}
    </GateShell>
  );
}

function GateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Shield size={18} />
          </div>
          <div>
            <h1 className="text-base font-black text-[#18181b] dark:text-zinc-100 leading-tight">Admin access</h1>
            <p className="text-xs text-slate-600 dark:text-zinc-300">Protected by your admin password</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
