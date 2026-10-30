import { showInfo, showSuccess, showError } from '../utils/toast';
import { confirmDialog } from '../store/dialogStore';
import { useState, useEffect, type FormEvent } from 'react';
import api, { getAdminSessionExpires, getAdminClockOffset, clearAdminSession } from '../api/api';
import { Shield, Eye, Users, AlertCircle, BarChart3, Clock, Ban, Trash2, CheckCircle, ArrowLeft, Database, Mail, X, Search, Flag, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/ui/Spinner';
import { getMediaUrl } from '../utils/imageUtils';
import { logger } from '../utils/logger';
import { BarSeries, LineSeries } from '../components/admin/AdminCharts';

type AdminApiErr = { response?: { status?: number; data?: { code?: string; message?: string } } };

interface AdminAnalytics {
    rangeDays: number;
    series: Record<string, Array<{ day: string; count: number }>>;
    kpis: {
        totalUsers: number; newUsers7d: number; activeToday: number;
        engagement24h: number; pendingReports: number; pendingAppeals: number; pendingVerifications: number;
    };
}

interface VerificationRequest {
    request_id: string;
    user_id: string;
    username: string;
    user_name: string;
    email: string;
    avatar_url?: string;
    status: string;
    requested_at: string;
    reason?: string;
    document_url?: string;
}

interface AppealItem {
    id: string;
    post_id: string;
    user_id: string;
    username: string;
    user_name: string;
    avatar_url?: string;
    reason: string;
    status: string;
    created_at: string;
    post_excerpt?: string;
}

interface AdminStats {
  users?: { total: number };
  posts?: { total: number };
  reports?: { pending: number };
  marketplace?: { total: number };
  recentActivity?: Array<{ message: string; time: string }>;
}

interface AdminContentItem {
  id?: string;
  user_id?: string;
  username?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  title?: string;
  type?: string;
  action?: string;
  details?: string;
  listing_id?: string;
  status?: string;
  created_at?: string;
  timestamp?: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [content, setContent] = useState<AdminContentItem[]>([]);
  const [listQuery, setListQuery] = useState('');
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [queueBusy, setQueueBusy] = useState<string | null>(null);
  const filteredContent = content.filter(item => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = [item.name, item.username, item.email, item.title, item.type, item.action, item.details]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
  const [announcement, setAnnouncement] = useState('');
  const [stepUp, setStepUp] = useState<{ kind: 'action' | 'announcement'; id?: string; action?: string } | null>(null);
  const [factor, setFactor] = useState<'password' | 'email'>('password');
  const [secret, setSecret] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [stepUpError, setStepUpError] = useState('');
  const [stepUpBusy, setStepUpBusy] = useState(false);
  // Admin access gate — the dashboard itself is behind the second password.
  // 'expired' = the login session itself died (every call 401s) — that is a
  // re-login problem, NOT a missing admin password. Never confuse the two.
  const [gate, setGate] = useState<'loading' | 'expired' | 'error' | 'open'>('loading');
  const [showAdminPwForm, setShowAdminPwForm] = useState(false);
  const [adminPwForm, setAdminPwForm] = useState({ current: '', next: '', confirm: '' });
  const [adminPwError, setAdminPwError] = useState('');
  const [adminPwBusy, setAdminPwBusy] = useState(false);
  // Live countdown for the elevation window (15 min) — auto-locks at zero so
  // an unattended panel never stays open.
  const [sessionLeft, setSessionLeft] = useState<number | null>(null);

  useEffect(() => {
    if (gate !== 'open') { setSessionLeft(null); return; }
    const tick = () => {
      const expires = getAdminSessionExpires();
      if (!expires) { setSessionLeft(null); return; }
      // Countdown against the server's clock: server expiry instant minus
      // (browser now + measured server clock offset).
      const serverNow = Date.now() + getAdminClockOffset();
      const left = Math.max(0, Math.round((expires - serverNow) / 1000));
      setSessionLeft(left);
      if (left <= 0) lockAdminSession();
    };
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);

  // The elevation gate lives at /admin/login now; this component only renders
  // once a valid elevation session exists (AdminLayout guard).
  const enterDashboard = async () => {
    try {
      await fetchStats();
      setGate('open');
    } catch (e: unknown) {
      const err = e as AdminApiErr;
      clearAdminSession();
      // 401 has TWO very different meanings here:
      //   ADMIN_SESSION_REQUIRED → elevation missing/expired → back to the
      //                            admin login gate for the second password
      //   any other 401          → the account session is dead → re-login
      if (err?.response?.status === 401 && err?.response?.data?.code === 'ADMIN_SESSION_REQUIRED') {
        navigate('/admin/login', { replace: true });
      } else if (err?.response?.status === 401) {
        setGate('expired');
      } else {
        // Not an auth failure (network, 5xx, CORS) — surface it as an error
        // instead of silently opening the panel with all-zero counts.
        setGate('error');
      }
    }
  };

  const submitAdminPassword = async (e: FormEvent) => {
    e.preventDefault();
    setAdminPwError('');
    if (adminPwForm.next !== adminPwForm.confirm) {
      setAdminPwError('The new admin passwords do not match.');
      return;
    }
    setAdminPwBusy(true);
    try {
      await api.post('/admin/credentials', {
        current_password: adminPwForm.current,
        new_admin_password: adminPwForm.next
      });
      setAdminPwForm({ current: '', next: '', confirm: '' });
      setShowAdminPwForm(false);
      showSuccess('Admin password updated.');
    } catch (e: unknown) {
      const err = e as AdminApiErr;
      if (err.response?.status === 401) {
        setGate('expired');
        return;
      }
      setAdminPwError(err.response?.data?.message || 'Could not set the admin password.');
    } finally {
      setAdminPwBusy(false);
    }
  };

  const lockAdminSession = async () => {
    try { await api.delete('/admin/session'); } catch { /* best effort */ }
    clearAdminSession();
    setSessionLeft(null);
    navigate('/admin/login', { replace: true });
  };

  /**
   * Mid-session failure mapping: a call that dies while the panel is open
   * (elevation expired, login token died) must land on the right screen
   * instead of leaving tabs to fire failing requests forever.
   * 401 + ADMIN_SESSION_REQUIRED  → elevation gone → admin login gate
   * 401 (anything else)           → account session gone → re-login screen
   */
  const onAdminCallError = (e: unknown) => {
    const err = e as AdminApiErr;
    const status = err?.response?.status;
    const code = err?.response?.data?.code;
    if (status === 401 && code === 'ADMIN_SESSION_REQUIRED') {
      clearAdminSession();
      setSessionLeft(null);
      navigate('/admin/login', { replace: true });
      return true;
    }
    if (status === 401) {
      clearAdminSession();
      setGate('expired');
      return true;
    }
    return false;
  };

  useEffect(() => {
    document.title = 'Admin Panel | Sparkle';
    void enterDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
      // Errors intentionally propagate: enterDashboard's catch classifies them
      // (elevation expired -> admin login gate, account dead -> re-login,
      // anything else -> visible error). Swallowing here is what made real
      // failures render as "0 users, 0 posts" instead of an error.
    } finally {
      setLoading(false);
    }
  };

  const resetStepUp = () => {
    setStepUp(null);
    setFactor('password');
    setSecret('');
    setTxId(null);
    setEmailSent(false);
    setStepUpError('');
    setStepUpBusy(false);
  };

  // ── Analytics + review queues ──────────────────────────────────────────────
  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/admin/analytics');
      setAnalytics(res.data?.data || null);
    } catch (err) {
      if (onAdminCallError(err)) return;
      logger.error('Failed to fetch analytics:', err);
    }
  };

  const fetchQueues = async () => {
    try {
      const [v, a] = await Promise.all([
        api.get('/admin/verifications'),
        api.get('/moderation/appeals/pending'),
      ]);
      setVerifications(v.data?.requests || []);
      setAppeals(a.data?.appeals || []);
    } catch (err) {
      if (onAdminCallError(err)) return;
      logger.error('Failed to fetch review queues:', err);
    }
  };

  const decideVerification = async (requestId: string, decision: 'approved' | 'rejected') => {
    if (!await confirmDialog(decision === 'approved' ? 'Approve this verification request?' : 'Reject this verification request?')) return;
    setQueueBusy(requestId);
    try {
      await api.post(`/admin/verifications/${requestId}`, { status: decision });
      setVerifications(prev => prev.filter(r => r.request_id !== requestId));
      showSuccess(decision === 'approved' ? 'User verified.' : 'Request rejected.');
    } catch (e: unknown) {
      const err = e as AdminApiErr;
      if (err.response?.data?.code === 'admin_password_not_set') { setShowAdminPwForm(true); return; }
      showError(err.response?.data?.message || 'Could not update the request.');
    } finally {
      setQueueBusy(null);
    }
  };

  const decideAppeal = async (appealId: string, decision: 'approve' | 'reject') => {
    if (!await confirmDialog(decision === 'approve' ? 'Approve this appeal? The post will be restored.' : 'Reject this appeal?')) return;
    setQueueBusy(appealId);
    try {
      await api.post(`/moderation/appeals/${appealId}/review`, { decision });
      setAppeals(prev => prev.filter(a => a.id !== appealId));
      showSuccess(decision === 'approve' ? 'Appeal approved.' : 'Appeal rejected.');
    } catch (e: unknown) {
      const err = e as AdminApiErr;
      showError(err.response?.data?.message || 'Could not review this appeal.');
    } finally {
      setQueueBusy(null);
    }
  };

  const exportLogs = async () => {
    try {
      const res = await api.get('/admin/logs/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'admin_logs.json';
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('Log exported.');
    } catch {
      showError('Could not export the log.');
    }
  };

  const handleAdminAction = async (id: string, action: string) => {
    if (!await confirmDialog(`Are you sure you want to ${action} this item?`)) return;
    setSecret('');
    setTxId(null);
    setEmailSent(false);
    setStepUpError('');
    setFactor('password');
    setStepUp({ kind: 'action', id, action });
  };

  const handleSendAnnouncement = () => {
    if (!announcement.trim()) return;
    setSecret('');
    setTxId(null);
    setEmailSent(false);
    setStepUpError('');
    setFactor('password');
    setStepUp({ kind: 'announcement' });
  };

  const requestEmailCode = async () => {
    setStepUpBusy(true);
    setStepUpError('');
    try {
      const res = await api.post('/security/transaction/initiate', {
        purpose: 'admin_step_up',
        factor_type: 'email'
      });
      setTxId(res.data.data.transaction_id);
      setEmailSent(true);
    } catch (e: unknown) {
      const err = e as AdminApiErr;
      setStepUpError(err.response?.data?.message || 'Could not send the email code.');
    } finally {
      setStepUpBusy(false);
    }
  };

  const applyStepUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!stepUp || !secret) return;
    setStepUpBusy(true);
    setStepUpError('');
    try {
      let transactionId = txId;
      if (!transactionId) {
        const init = await api.post('/security/transaction/initiate', {
          purpose: 'admin_step_up',
          factor_type: factor
        });
        transactionId = init.data.data.transaction_id;
        setTxId(transactionId);
      }

      const verified = await api.post('/security/transaction/verify', {
        transaction_id: transactionId,
        code: secret,
        factor_type: factor
      });
      const verificationToken = verified.data.data.verification_token;

      if (stepUp.kind === 'action') {
        await api.post('/admin/actions', {
          id: stepUp.id,
          action: stepUp.action,
          type: activeTab,
          verification_token: verificationToken
        });
        showSuccess(`Action ${stepUp.action} successful`);
        const response = await api.get(`/admin/${activeTab}`);
        if (activeTab === 'users') setContent(response.data.users || []);
        else if (activeTab === 'reports') setContent(response.data.reports || []);
      } else {
        await api.post('/admin/announcements', {
          message: announcement,
          verification_token: verificationToken
        });
        showInfo('Announcement sent.');
        setAnnouncement('');
      }
      resetStepUp();
    } catch (e: unknown) {
      const err = e as AdminApiErr;
      // Fail-closed: the backend refuses admin step-up when no admin password
      // exists yet — route the admin into the change-password form.
      if (err.response?.status === 403 && err.response?.data?.code === 'admin_password_not_set') {
        setStepUp(null);
        setStepUpError('');
        setStepUpBusy(false);
        setShowAdminPwForm(true);
        return;
      }
      // Elevation expired mid-session — the global interceptor already cleared
      // the token; bounce back to the admin login gate.
      if (err.response?.data?.code === 'ADMIN_SESSION_REQUIRED') {
        setStepUp(null);
        setStepUpError('');
        setStepUpBusy(false);
        navigate('/admin/login', { replace: true });
        return;
      }
      setStepUpError(err.response?.data?.message || err.response?.data?.error || 'Verification failed. Please try again.');
      setStepUpBusy(false);
    }
  };

  useEffect(() => {
    const fetchTabData = async () => {
      let endpoint = '';
      if (activeTab === 'users') endpoint = '/admin/users';
      if (activeTab === 'reports') endpoint = '/admin/reports';
      if (activeTab === 'logs') endpoint = '/admin/logs';

      if (!endpoint) return;

      try {
        const response = await api.get(endpoint);
        if (activeTab === 'logs') setContent(response.data.logs || []);
        else if (activeTab === 'users') setContent(response.data.users || []);
        else if (activeTab === 'reports') setContent(response.data.reports || response.data.reportedItems || []);
        else setContent(response.data.data || []);
      } catch (err) {
        if (onAdminCallError(err)) return;
        logger.error(`Failed to fetch ${activeTab}:`, err);
      }
    };
    if (activeTab !== 'overview') fetchTabData();
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'reviews') fetchQueues();
    // Dep-light by design: fetchAnalytics/fetchQueues/onAdminCallError are
    // recreated every render, so listing them would re-fetch on each render.
    // The tab switch is the intentional trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Admin access gate ─────────────────────────────────────────────────────
  // The dashboard is behind the second password: set it once, then unlock
  // each visit with a short-lived elevation session. Nothing admin-related
  // renders until one of those passes.
  if (gate !== 'open') {
    return (
      <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-900 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Shield size={18} />
            </div>
            <div>
              <h1 className="text-base font-black text-[#18181b] dark:text-zinc-100 leading-tight">Admin panel</h1>
              <p className="text-xs text-slate-600 dark:text-zinc-300">Protected by your admin password</p>
            </div>
          </div>

          {gate === 'loading' && (
            <div className="flex justify-center py-8"><Spinner /></div>
          )}

          {gate === 'expired' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                Your session expired. Log in again to continue — your admin password is unaffected.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full h-11 rounded-full bg-primary text-white text-sm font-bold hover:bg-[#ff2d87] transition-colors"
              >
                Log in again
              </button>
              <button
                onClick={() => { setGate('loading'); void enterDashboard(); }}
                className="w-full h-11 rounded-full text-sm font-bold text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {gate === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                The admin panel could not load its data. This is a connection problem, not your password — check that the API server is running, then retry.
              </p>
              <button
                onClick={() => { setGate('loading'); void enterDashboard(); }}
                className="w-full h-11 rounded-full bg-primary text-white text-sm font-bold hover:bg-[#ff2d87] transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full h-11 rounded-full text-sm font-bold text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors"
              >
                Back to dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-white overflow-x-hidden font-sans pb-20">

      <main className="flex-1 p-4 md:p-8 relative z-10 max-w-6xl mx-auto w-full">
        
        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 flex items-center justify-center bg-[#fdf8fa] dark:bg-zinc-800 rounded-full border border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h1 className="text-2xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight">Admin panel</h1>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">Moderation, users and platform activity.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {sessionLeft !== null && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                  sessionLeft <= 120
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  Unlocked · {Math.floor(sessionLeft / 60)} min left
                </span>
              )}
              <button
                onClick={() => setShowAdminPwForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-primary hover:border-primary transition-colors"
              >
                <KeyRound size={13} strokeWidth={2.5} />
                Admin password
              </button>
              <button
                onClick={lockAdminSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-red-500 hover:border-red-500/40 transition-colors"
              >
                Lock
              </button>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'analytics', label: 'Analytics', icon: Activity },
            { key: 'users', label: 'Users', icon: Users },
            { key: 'reports', label: 'Reports', icon: AlertCircle },
            { key: 'reviews', label: 'Reviews', icon: Shield },
            { key: 'logs', label: 'Activity log', icon: Clock },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 h-9 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
                activeTab === tab.key
                  ? 'bg-primary border-primary text-white'
                  : 'bg-[#fdf8fa] dark:bg-zinc-800 border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.key === 'reports' && (stats?.reports?.pending || 0) > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                  {stats.reports.pending}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center bg-[#f6eef3] dark:bg-zinc-800 border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 rounded-3xl mb-8">
             <Spinner size="large" color="text-primary" />
             <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300 mt-3">Loading…</p>
          </div>
        ) : activeTab === 'overview' ? (
          <div className="space-y-5">
            {/* Stats */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total users', value: stats?.users?.total || 0, icon: Users, urgent: false, tab: 'users' },
                { label: 'Posts', value: stats?.posts?.total || 0, icon: Eye, urgent: false, tab: null },
                { label: 'Pending reports', value: stats?.reports?.pending || 0, icon: AlertCircle, urgent: true, tab: 'reports' },
                { label: 'Marketplace listings', value: stats?.marketplace?.total || 0, icon: ShoppingBag, urgent: false, tab: null }
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => s.tab && setActiveTab(s.tab)}
                  className={`text-left p-4 rounded-2xl border bg-[#fdf8fa] dark:bg-zinc-800 transition-colors ${s.urgent ? 'border-primary/30' : 'border-[#e6d8e1] dark:border-zinc-700'} ${s.tab ? 'hover:border-primary cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-600 dark:text-zinc-300">{s.label}</span>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.urgent ? 'bg-primary/10 text-primary' : 'bg-[#f6eef3] dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'}`}>
                      <s.icon size={15} />
                    </div>
                  </div>
                  <div className={`text-2xl font-black leading-none ${s.urgent ? 'text-primary' : 'text-[#18181b] dark:text-zinc-100'}`}>
                    {s.value > 9999 ? `${(s.value / 1000).toFixed(1)}k` : s.value.toLocaleString()}
                  </div>
                </button>
              ))}
            </section>

            {/* Quick links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => navigate('/admin/storage')} className="flex items-center gap-3 p-4 rounded-2xl border border-[#e6d8e1] dark:border-zinc-700 bg-[#fdf8fa] dark:bg-zinc-800 hover:border-primary transition-colors text-left">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Database size={17} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100">Storage & media</p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 truncate">Usage breakdown and cleanup tools</p>
                </div>
              </button>
              <button onClick={() => setActiveTab('reports')} className="flex items-center gap-3 p-4 rounded-2xl border border-[#e6d8e1] dark:border-zinc-700 bg-[#fdf8fa] dark:bg-zinc-800 hover:border-primary transition-colors text-left">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Shield size={17} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100">Moderation queue</p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 truncate">{stats?.reports?.pending || 0} reports waiting for review</p>
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Recent activity */}
              <div className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-4">Recent activity</h2>
                <div className="space-y-2 max-h-[320px] overflow-y-auto no-scrollbar">
                  {(stats?.recentActivity || []).map((act, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#f6eef3] dark:bg-zinc-900">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[#18181b] dark:text-zinc-100 leading-snug">{act.message}</p>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-0.5">{act.time}</p>
                      </div>
                    </div>
                  ))}
                  {(stats?.recentActivity || []).length === 0 && (
                    <p className="text-xs text-slate-600 dark:text-zinc-300 py-6 text-center">No activity recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Announcement composer */}
              <div className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl p-5 flex flex-col">
                <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-1">Announcement</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mb-3">Sent to every user. Confirmed with your admin password.</p>
                <textarea
                  value={announcement}
                  onChange={e => setAnnouncement(e.target.value)}
                  placeholder="Write your announcement…"
                  className="w-full flex-1 min-h-[120px] bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl p-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-300 outline-none focus:border-primary resize-none transition-colors"
                />
                <button
                  onClick={handleSendAnnouncement}
                  disabled={!announcement.trim()}
                  className="mt-3 w-full h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors disabled:opacity-50"
                >
                  Send announcement
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'analytics' ? (
          <div className="space-y-5">
            {/* KPI row */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Active today', value: analytics?.kpis.activeToday ?? 0, hint: 'users with login activity in 24h' },
                { label: 'New users (7d)', value: analytics?.kpis.newUsers7d ?? 0, hint: 'signed up this week' },
                { label: 'Engagement (24h)', value: analytics?.kpis.engagement24h ?? 0, hint: 'sparks + comments' },
                { label: 'Total users', value: analytics?.kpis.totalUsers ?? 0, hint: 'all accounts' },
              ].map(k => (
                <div key={k.label} className="p-4 rounded-2xl border border-[#e6d8e1] dark:border-zinc-700 bg-[#fdf8fa] dark:bg-zinc-800">
                  <p className="text-xs text-slate-600 dark:text-zinc-300">{k.label}</p>
                  <p className="text-2xl font-black text-[#18181b] dark:text-zinc-100 leading-none mt-2">{k.value.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-1">{k.hint}</p>
                </div>
              ))}
            </section>

            {/* Charts */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border border-[#e6d8e1] dark:border-zinc-700 bg-[#fdf8fa] dark:bg-zinc-800">
                <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-1">New users</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mb-4">Daily signups, last {analytics?.rangeDays || 14} days</p>
                <BarSeries data={analytics?.series.signups || []} />
              </div>
              <div className="p-5 rounded-2xl border border-[#e6d8e1] dark:border-zinc-700 bg-[#fdf8fa] dark:bg-zinc-800">
                <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-1">Engagement</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mb-4">Sparks + comments per day</p>
                <LineSeries
                  data={(analytics?.series.sparks || []).map((p, i) => ({
                    day: p.day,
                    count: p.count + ((analytics?.series.comments || [])[i]?.count || 0)
                  }))}
                />
              </div>
              <div className="p-5 rounded-2xl border border-[#e6d8e1] dark:border-zinc-700 bg-[#fdf8fa] dark:bg-zinc-800">
                <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-1">Posts</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mb-4">Published per day</p>
                <BarSeries data={analytics?.series.posts || []} color="#059669" />
              </div>
              <div className="p-5 rounded-2xl border border-[#e6d8e1] dark:border-zinc-700 bg-[#fdf8fa] dark:bg-zinc-800">
                <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-1">Activity mix</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mb-4">Totals across the window</p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Moments', value: sum(analytics?.series.moments) },
                    { label: 'Messages', value: sum(analytics?.series.messages) },
                    { label: 'Listings', value: sum(analytics?.series.listings) },
                    { label: 'Follows', value: sum(analytics?.series.follows) },
                  ].map(row => {
                    const max = Math.max(1, sum(analytics?.series.moments), sum(analytics?.series.messages), sum(analytics?.series.listings), sum(analytics?.series.follows));
                    return (
                      <div key={row.label} className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 dark:text-zinc-300 w-16 shrink-0">{row.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(row.value / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-[#18181b] dark:text-zinc-100 w-10 text-right">{row.value.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Queue summary */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Pending reports', value: analytics?.kpis.pendingReports ?? 0, tab: 'reports' },
                { label: 'Pending appeals', value: analytics?.kpis.pendingAppeals ?? 0, tab: 'reviews' },
                { label: 'Verification requests', value: analytics?.kpis.pendingVerifications ?? 0, tab: 'reviews' },
              ].map(q => (
                <button key={q.label} onClick={() => setActiveTab(q.tab)} className="text-left p-4 rounded-2xl border border-[#e6d8e1] dark:border-zinc-700 bg-[#fdf8fa] dark:bg-zinc-800 hover:border-primary transition-colors">
                  <p className="text-xs text-slate-600 dark:text-zinc-300">{q.label}</p>
                  <p className="text-xl font-black text-[#18181b] dark:text-zinc-100 mt-1">{q.value}</p>
                </button>
              ))}
            </section>
          </div>
        ) : activeTab === 'reviews' ? (
          <div className="space-y-5">
            {/* Appeals */}
            <div className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#ede3e9] dark:border-zinc-900">
                <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100">Appeals</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300">Users contesting moderation decisions on their posts.</p>
              </div>
              <div className="divide-y divide-[#ede3e9] dark:divide-zinc-900">
                {appeals.map(a => (
                  <div key={a.id} className="flex items-start gap-3 p-4">
                    <img src={getAvatarUrl(a.avatar_url, a.username)} className="w-9 h-9 rounded-full object-cover border border-[#e6d8e1] dark:border-zinc-700 shrink-0" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#18181b] dark:text-zinc-100">@{a.username}</p>
                      {a.post_excerpt && <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5 line-clamp-2">“{a.post_excerpt}”</p>}
                      <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">Reason: {a.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => decideAppeal(a.id, 'approve')} disabled={queueBusy === a.id} className="px-3 h-8 rounded-full bg-emerald-500 text-white text-xs font-bold disabled:opacity-50">Restore post</button>
                      <button onClick={() => decideAppeal(a.id, 'reject')} disabled={queueBusy === a.id} className="px-3 h-8 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold disabled:opacity-50">Reject</button>
                    </div>
                  </div>
                ))}
                {appeals.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100">No pending appeals</p>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">Appeals users submit will show up here.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Verification requests */}
            <div className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#ede3e9] dark:border-zinc-900">
                <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100">Verification requests</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300">Approving grants the verified badge.</p>
              </div>
              <div className="divide-y divide-[#ede3e9] dark:divide-zinc-900">
                {verifications.map(v => (
                  <div key={v.request_id} className="flex items-center gap-3 p-4">
                    <img src={getAvatarUrl(v.avatar_url, v.username)} className="w-9 h-9 rounded-full object-cover border border-[#e6d8e1] dark:border-zinc-700 shrink-0" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#18181b] dark:text-zinc-100 truncate">{v.user_name || v.username}</p>
                      <p className="text-xs text-slate-600 dark:text-zinc-300 truncate">{v.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => decideVerification(v.request_id, 'approved')} disabled={queueBusy === v.request_id} className="px-3 h-8 rounded-full bg-emerald-500 text-white text-xs font-bold disabled:opacity-50">Approve</button>
                      <button onClick={() => decideVerification(v.request_id, 'rejected')} disabled={queueBusy === v.request_id} className="px-3 h-8 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold disabled:opacity-50">Reject</button>
                    </div>
                  </div>
                ))}
                {verifications.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100">No pending requests</p>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">Verification requests appear here for review.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
          /* Content list — per-tab actions. Logs are READ-ONLY: an audit
             entry can never be approved or purged from here. */
          {activeTab === 'logs' && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-600 dark:text-zinc-300">Every admin action, including page views.</p>
              <button onClick={exportLogs} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-primary hover:border-primary transition-colors">
                Export JSON
              </button>
            </div>
          )}
          <div className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl overflow-hidden mb-16">
            {(activeTab === 'users' || activeTab === 'reports') && (
              <div className="p-4 border-b border-[#ede3e9] dark:border-zinc-900">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-zinc-300" size={15} />
                  <input
                    value={listQuery}
                    onChange={e => setListQuery(e.target.value)}
                    placeholder={activeTab === 'users' ? 'Search by name, username or email…' : 'Search reports…'}
                    className="w-full h-10 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-full pl-10 pr-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-300 outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
            )}
            <div className="divide-y divide-[#ede3e9] dark:divide-zinc-900">
              {filteredContent.length > 0 ? filteredContent.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 hover:bg-[#f6eef3] dark:hover:bg-zinc-700/40 transition-colors">
                  {activeTab === 'users' ? (
                    <img src={getAvatarUrl(item.avatar_url, item.username)} className="w-10 h-10 rounded-full object-cover border border-[#e6d8e1] dark:border-zinc-700 shrink-0" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#f6eef3] dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 shrink-0">
                      {activeTab === 'reports' ? <Flag size={16} /> : <Clock size={16} />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#18181b] dark:text-zinc-100 truncate">
                      {activeTab === 'users' ? (item.name || item.username) : (item.title || item.type || item.action || 'Entry')}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 truncate mt-0.5">
                      {activeTab === 'users' ? item.email : (item.details || item.action || '')}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                    item.status?.toLowerCase() === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                    item.status?.toLowerCase() === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
                    activeTab === 'logs' ? 'bg-[#f6eef3] dark:bg-zinc-700 border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300' :
                    'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                  }`}>
                    {item.status || (activeTab === 'logs' ? 'Logged' : 'Reported')}
                  </span>
                  {activeTab !== 'logs' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleAdminAction(item.id || item.user_id || item.listing_id || '', 'approve')} title="Approve" className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"><CheckCircle size={15} /></button>
                      <button onClick={() => handleAdminAction(item.id || item.user_id || item.listing_id || '', 'restrict')} title="Restrict" className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"><Ban size={15} /></button>
                      <button onClick={() => handleAdminAction(item.id || item.user_id || item.listing_id || '', 'purge')} title="Purge" className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
              )) : (
                <div className="py-16 flex flex-col items-center text-center px-6">
                  <div className="w-11 h-11 rounded-full bg-[#f6eef3] dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 mb-3">
                    {activeTab === 'users' ? <Users size={20} /> : activeTab === 'reports' ? <Flag size={20} /> : <Clock size={20} />}
                  </div>
                  <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100">
                    {activeTab === 'users' ? 'No users found' : activeTab === 'reports' ? 'No pending reports' : 'No activity logged yet'}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">
                    {activeTab === 'reports' ? 'Reported content shows up here for review.' : 'Nothing to review right now.'}
                  </p>
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </main>

      {stepUp && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-black text-[#18181b] dark:text-zinc-100">Confirm it's you</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">Sensitive admin actions need a fresh identity check.</p>
              </div>
              <button onClick={resetStepUp} className="w-8 h-8 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setFactor('password'); setSecret(''); setTxId(null); setEmailSent(false); setStepUpError(''); }}
                className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border ${factor === 'password' ? 'bg-[#18181b] dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'bg-[#fdf8fa] dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-[#e6d8e1] dark:border-zinc-700'}`}
              >
                <KeyRound size={14} /> Admin password
              </button>
              <button
                type="button"
                onClick={() => { setFactor('email'); setSecret(''); setTxId(null); setEmailSent(false); setStepUpError(''); }}
                className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border ${factor === 'email' ? 'bg-[#18181b] dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'bg-[#fdf8fa] dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-[#e6d8e1] dark:border-zinc-700'}`}
              >
                <Mail size={14} /> Email code
              </button>
            </div>

            {factor === 'email' && !emailSent ? (
              <button
                type="button"
                onClick={requestEmailCode}
                disabled={stepUpBusy}
                className="w-full h-11 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-50"
              >
                {stepUpBusy ? 'Sending...' : 'Send code to my email'}
              </button>
            ) : (
              <form onSubmit={applyStepUp} className="space-y-3">
                {factor === 'password' && (
                  <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                    This is your <span className="font-bold text-[#18181b] dark:text-zinc-100">admin password</span> — a separate credential from your login password.
                  </p>
                )}
                <input
                  autoFocus
                  type={factor === 'password' ? 'password' : 'text'}
                  inputMode={factor === 'password' ? undefined : 'numeric'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={factor === 'password' ? 'Admin password' : 'Email verification code'}
                  className="w-full h-11 rounded-xl bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 px-4 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-primary transition-colors"
                />
                <button
                  type="submit"
                  disabled={stepUpBusy || !secret}
                  className="w-full h-11 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-50"
                >
                  {stepUpBusy ? 'Checking...' : 'Verify and continue'}
                </button>
              </form>
            )}

            {stepUpError && <p className="text-xs font-bold text-rose-600 mt-3">{stepUpError}</p>}
          </div>
        </div>
      )}

      {showAdminPwForm && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-[#18181b] dark:text-zinc-100">
                  {'Change your admin password'}
                </h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 leading-relaxed max-w-xs">
                  Admin actions are protected by a separate credential. It must be different from your login password — your login password can never approve admin actions.
                </p>
              </div>
              <button onClick={() => setShowAdminPwForm(false)} className="w-8 h-8 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 shrink-0" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitAdminPassword} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-300">Current login password</label>
                <input
                  autoFocus
                  type="password"
                  value={adminPwForm.current}
                  onChange={(e) => setAdminPwForm(f => ({ ...f, current: e.target.value }))}
                  className="w-full h-11 rounded-xl bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 px-4 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-primary"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-300">New admin password</label>
                <input
                  type="password"
                  value={adminPwForm.next}
                  onChange={(e) => setAdminPwForm(f => ({ ...f, next: e.target.value }))}
                  placeholder="At least 12 characters"
                  className="w-full h-11 rounded-xl bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 px-4 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-primary"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-300">Confirm new admin password</label>
                <input
                  type="password"
                  value={adminPwForm.confirm}
                  onChange={(e) => setAdminPwForm(f => ({ ...f, confirm: e.target.value }))}
                  className="w-full h-11 rounded-xl bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 px-4 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-primary"
                  required
                />
              </div>

              {adminPwError && <p className="text-xs font-bold text-rose-600">{adminPwError}</p>}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminPwForm(false)}
                  className="flex-1 h-11 rounded-full text-sm font-bold text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminPwBusy}
                  className="flex-[2] h-11 rounded-full bg-primary text-white text-sm font-bold hover:bg-[#ff2d87] transition-colors disabled:opacity-50"
                >
                  {adminPwBusy ? 'Saving...' : 'Update admin password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

const sum = (points?: Array<{ count: number }>) => (points || []).reduce((t, p) => t + p.count, 0);

function getAvatarUrl(url: string | undefined, username: string | undefined) {
  if (url && url.startsWith('http')) return url;
  if (url) return getMediaUrl(url);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'U')}&background=random&color=fff`;
}



