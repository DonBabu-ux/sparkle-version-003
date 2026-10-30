import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { ArrowLeft, X, Settings, BadgeCheck, DollarSign, Zap, Shield, Plus, HelpCircle, Heart, MessageSquare, Share2, TrendingUp, Wallet, ArrowDownCircle, ArrowUpCircle, History, Eye, Users, Radio, Video, Banknote, Store, Megaphone, BarChart2, Activity, RefreshCw, CheckCircle2, XCircle, AlertCircle, Building2, Smartphone, CreditCard } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import '../components/ui/Spinner';
import { useUserStore } from '../store/userStore';
import { AutoWithdrawalModal } from '../components/modals/AutoWithdrawalModal';
import BoostConnectModal from '../components/modals/BoostConnectModal';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WalletSummary {
  wallet_id: string;
  currency: string;
  available_balance: number; // integer cents
  pending_balance: number;
  lifetime_deposits: number;
  lifetime_withdrawals: number;
  lifetime_earnings: number;
}

interface Transaction {
  transaction_id: string;
  reference: string;
  type: string;
  status: 'Pending' | 'Completed' | 'Failed' | 'Refunded';
  amount: number; // cents
  currency: string;
  payment_provider: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatKES = (cents: number) =>
  `KES ${(cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const normalizeKenyanPhone = (num: string) => {
  if (!num) return '';
  let cleaned = num.trim().replace(/[\s-()]/g, '');
  if (cleaned.startsWith('+254')) return cleaned;
  if (cleaned.startsWith('254')) return '+' + cleaned;
  if (cleaned.startsWith('07') || cleaned.startsWith('01')) return '+254' + cleaned.slice(1);
  if ((cleaned.startsWith('7') || cleaned.startsWith('1')) && cleaned.length === 9) return '+254' + cleaned;
  return cleaned;
};

const relativeTime = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ value, formatter = String }: { value: number; formatter?: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = formatter(Math.round(v));
      },
    });
    return controls.stop;
  }, [value]);

  return <span ref={ref}>{formatter(0)}</span>;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`bg-[#ede3e9] dark:bg-zinc-700 animate-pulse rounded-xl ${className}`} />
);

// ─── Mini Sparkline ───────────────────────────────────────────────────────────
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const pts = useMemo(() => {
    if (!data.length) return '';
    const max = Math.max(...data, 1);
    const w = 120, h = 40;
    return data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  }, [data]);

  return (
    <svg viewBox="0 0 120 40" className="w-full h-8 overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    Completed: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', icon: <CheckCircle2 size={10} /> },
    Pending:   { bg: 'bg-amber-500/10 border-amber-500/20',     text: 'text-amber-600 dark:text-amber-400',   icon: <AlertCircle size={10} /> },
    Failed:    { bg: 'bg-red-500/10 border-red-500/20',         text: 'text-red-600 dark:text-red-400',       icon: <XCircle size={10} /> },
    Refunded:  { bg: 'bg-sky-500/10 border-sky-500/20',         text: 'text-sky-600 dark:text-sky-400',       icon: <RefreshCw size={10} /> },
  };
  const s = map[status] || map.Pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text}`}>
      {s.icon}{status}
    </span>
  );
};

// ─── Transaction Row ──────────────────────────────────────────────────────────
const TXN_ICONS: Record<string, React.ReactNode> = {
  Deposit:        <ArrowDownCircle size={16} className="text-emerald-500" />,
  Withdrawal:     <ArrowUpCircle size={16} className="text-red-500" />,
  Revenue:        <TrendingUp size={16} className="text-amber-500" />,
  AdRevenue:      <Megaphone size={16} className="text-purple-500" />,
  Tip:            <Heart size={16} className="text-pink-500" />,
  BoostPurchase:  <Zap size={16} className="text-yellow-500" />,
  BoostSpend:     <Zap size={16} className="text-orange-500" />,
  Subscription:   <BadgeCheck size={16} className="text-sky-500" />,
  CreatorPayment: <DollarSign size={16} className="text-violet-500" />,
  Purchase:       <Store size={16} className="text-indigo-500" />,
  Refund:         <RefreshCw size={16} className="text-sky-500" />,
};

const TxnRow = ({ txn }: { txn: Transaction }) => {
  const isCredit = ['Deposit', 'Revenue', 'AdRevenue', 'Tip', 'CreatorPayment', 'Refund'].includes(txn.type);
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#ede3e9] dark:border-zinc-900 last:border-0 hover:bg-[#f6eef3] dark:hover:bg-zinc-900 px-2 -mx-2 rounded-2xl transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 flex items-center justify-center shrink-0">
          {TXN_ICONS[txn.type] || <Activity size={16} className="text-slate-600 dark:text-zinc-300" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#18181b] dark:text-zinc-100">{txn.type}</p>
          <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium">{relativeTime(txn.created_at)}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-sm font-bold ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {isCredit ? '+' : '−'}{formatKES(txn.amount)}
        </span>
        <StatusBadge status={txn.status} />
      </div>
    </div>
  );
};

// ─── Deposit Modal ────────────────────────────────────────────────────────────
const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];
const PAY_METHODS = [
  { id: 'mpesa', label: 'M-Pesa', icon: <Smartphone size={16} />, color: 'text-green-400' },
  { id: 'card',  label: 'Card',   icon: <CreditCard size={16} />, color: 'text-blue-400' },
  { id: 'bank',  label: 'Bank',   icon: <Building2 size={16} />,  color: 'text-amber-400' },
];

function DepositModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('mpesa');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txnRef, setTxnRef] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  const amountKES = parseFloat(amount) || 0;
  const amountCents = Math.round(amountKES * 100);

  useEffect(() => {
    if (step !== 3 || !txnRef) return;

    setVerificationStatus('pending');
    let intervalId = setInterval(async () => {
      try {
        const res = await api.post('/wallet/verify', { reference: txnRef });
        if (res.data.status === 'completed' || res.data.status === 'already_processed') {
          setVerificationStatus('success');
          clearInterval(intervalId);
        } else if (res.data.status === 'payment_failed') {
          setVerificationStatus('failed');
          clearInterval(intervalId);
        }
      } catch (e) {
        // continue polling on network errors
      }
    }, 2000);

    // Timeout polling after 3 minutes
    let timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      setVerificationStatus('failed');
    }, 180000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [step, txnRef]);

  const handleSubmit = async () => {
    const normalizedPhone = method === 'mpesa' ? normalizeKenyanPhone(phone) : '';
    if (amountCents < 100) { setError('Minimum deposit is KES 1.00 (1 bob)'); return; }
    if (method === 'mpesa' && (!normalizedPhone || normalizedPhone.length < 12)) {
      setError('Enter a valid phone number (e.g. +254..., 07..., or 01...)');
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await api.post('/wallet/deposit', { amountCents, method, phone: normalizedPhone || undefined });
      if (res.data.reference) {
        setTxnRef(res.data.reference);
      }
      if (res.data.authorizationUrl) {
        window.open(res.data.authorizationUrl, '_blank', 'noopener,noreferrer');
        setStep(3);
      } else if (method === 'mpesa') {
        setStep(3);
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to initialize payment. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-(--z-modal) bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%', scale: 0.95 }} animate={{ y: 0, scale: 1 }}
        exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 w-full max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden shadow-xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#ede3e9] dark:border-zinc-900 flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
              {step === 1 ? 'Step 1 of 2' : step === 2 ? 'Step 2 of 2' : 'Processing'}
            </p>
            <h2 className="text-xl font-bold text-[#18181b] dark:text-zinc-100 tracking-tight">Add funds</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 flex items-center justify-center hover:bg-[#ede3e9] dark:hover:bg-zinc-600 transition-colors text-[#18181b] dark:text-zinc-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {step === 3 ? (
            <div className="text-center py-8 space-y-4">
              {verificationStatus === 'pending' ? (
                <>
                  <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                    <Spinner size="large" className="text-amber-500" />
                  </div>
                  <p className="text-[#18181b] dark:text-zinc-100 font-bold text-lg">Verifying your payment...</p>
                  <p className="text-slate-600 dark:text-zinc-300 text-sm">
                    {method === 'mpesa'
                      ? 'Check your phone for the M-Pesa prompt and enter your PIN to complete.'
                      : 'Please complete your payment in the Paystack window.'}
                  </p>
                  <p className="text-[#ff1493] text-xs font-semibold">Checking the status now...</p>
                </>
              ) : verificationStatus === 'success' ? (
                <>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                    className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                  </motion.div>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">Payment confirmed</p>
                  <p className="text-slate-600 dark:text-zinc-300 text-sm">
                    KES {(amountCents / 100).toFixed(2)} has been successfully credited to your wallet.
                  </p>
                  <button onClick={() => { onClose(); onSuccess(); }}
                    className="w-full py-3 bg-[#ff1493] text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors">
                    Done
                  </button>
                </>
              ) : (
                <>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                    className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                    <XCircle size={32} className="text-red-500" />
                  </motion.div>
                  <p className="text-red-600 dark:text-red-400 font-bold text-lg">Payment failed</p>
                  <p className="text-slate-600 dark:text-zinc-300 text-sm">
                    The payment request was cancelled, timed out, or failed.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => { setStep(1); setVerificationStatus('pending'); }}
                      className="flex-1 py-3 bg-[#f0e5ec] dark:bg-zinc-700 text-[#18181b] dark:text-zinc-100 rounded-full text-sm font-bold hover:bg-[#ede3e9] dark:hover:bg-zinc-600 transition-colors">
                      Try again
                    </button>
                    <button onClick={onClose}
                      className="flex-1 py-3 bg-[#ff1493] text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors">
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Amount */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 flex justify-between">
                  <span>Amount (KES)</span>
                  <span className="text-[#ff1493] font-semibold">min 1 bob (KES 1.00)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-zinc-300 font-semibold text-sm">KES</span>
                  <input
                    type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1.00"
                    className="w-full bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-full py-3.5 pl-14 pr-4 text-[#18181b] dark:text-zinc-100 font-bold text-xl focus:outline-none focus:border-[#ff1493] transition-colors"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {QUICK_AMOUNTS.map((q) => (
                    <button key={q} onClick={() => setAmount(String(q))}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                        parseFloat(amount) === q
                          ? 'bg-[#ff1493] text-white border-[#ff1493]'
                          : 'bg-[#f0e5ec] dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border-[#e6d8e1] dark:border-zinc-700 hover:border-[#ff1493]/40'}`}>
                      {q.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Payment method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAY_METHODS.map((m) => (
                    <button key={m.id} onClick={() => setMethod(m.id)}
                      className={`py-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${
                        method === m.id ? 'bg-[#ff1493]/10 border-[#ff1493]/40 text-[#ff1493]' : 'bg-[#f6eef3] dark:bg-zinc-900 border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300'}`}>
                      <span className={method === m.id ? 'text-[#ff1493]' : m.color}>{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* M-Pesa Phone */}
              {method === 'mpesa' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">M-Pesa phone number</label>
                  <input
                    type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX or 07..."
                    className="mt-2 w-full bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-full py-3 px-4 text-[#18181b] dark:text-zinc-100 font-semibold focus:outline-none focus:border-[#ff1493] transition-colors text-sm"
                  />
                </motion.div>
              )}

              {error && (
                <p className="text-red-600 dark:text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 rounded-full px-4 py-2">
                  {error}
                </p>
              )}

              <button onClick={handleSubmit} disabled={loading || !amount || amountKES <= 0}
                className="w-full py-4 bg-[#ff1493] text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <Spinner size="small" /> : <DollarSign size={16} />}
                {loading ? 'Initializing…' : `Pay ${amountCents > 0 ? formatKES(amountCents) : ''}`.trim()}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Withdraw Modal ───────────────────────────────────────────────────────────
function WithdrawModal({ wallet, onClose, onSuccess }: { wallet: WalletSummary | null; onClose: () => void; onSuccess: () => void }) {
  const [method, setMethod] = useState<'bank' | 'mpesa'>('bank');
  const [amount, setAmount] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [phone, setPhone] = useState('');
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/wallet/banks').then((r) => setBanks(r.data.banks || [])).catch(() => {});
  }, []);

  const amountCents = Math.round((parseFloat(amount) || 0) * 100);

  const resolveAccount = async () => {
    if (!accountNumber || !bankCode) return;
    setResolving(true);
    try {
      const r = await api.post('/wallet/resolve-account', { accountNumber, bankCode });
      setResolved(r.data.accountDetails?.account_name || null);
      if (r.data.accountDetails?.account_name) setAccountName(r.data.accountDetails.account_name);
    } catch { setResolved(null); }
    setResolving(false);
  };

  const submit = async () => {
    const normalizedPhone = method === 'mpesa' ? normalizeKenyanPhone(phone) : '';
    if (amountCents < 100) { setError('Minimum withdrawal is KES 1.00 (1 bob)'); return; }
    if (method === 'mpesa' && (!normalizedPhone || normalizedPhone.length < 12)) {
      setError('Enter a valid M-Pesa phone number (e.g. +254..., 07..., or 01...)');
      return;
    }
    if (!wallet || amountCents > wallet.available_balance) { setError('Insufficient balance'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/wallet/withdraw', { amountCents, method, accountName, accountNumber, bankCode, phone: normalizedPhone || undefined });
      setDone(true);
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Withdrawal failed. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-(--z-modal) bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 w-full max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#ede3e9] dark:border-zinc-900 flex justify-between items-center sticky top-0 bg-[#fdf8fa] dark:bg-zinc-800">
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Creator payout</p>
            <h2 className="text-xl font-bold text-[#18181b] dark:text-zinc-100 tracking-tight">Withdraw</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 flex items-center justify-center hover:bg-[#ede3e9] dark:hover:bg-zinc-600 transition-colors text-[#18181b] dark:text-zinc-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {done ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <p className="text-[#18181b] dark:text-zinc-100 font-bold text-lg">Withdrawal requested</p>
              <p className="text-slate-600 dark:text-zinc-300 text-sm">Your payout is being processed. Funds arrive within 1–2 business days.</p>
              <button onClick={onClose} className="w-full py-3 bg-[#ff1493] text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors">Done</button>
            </div>
          ) : (
            <>
              {wallet && (
                <div className="bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-[#ff1493]">Available balance</p>
                  <p className="text-2xl font-bold text-[#18181b] dark:text-zinc-100 mt-1">{formatKES(wallet.available_balance)}</p>
                </div>
              )}

              {/* Method Toggle */}
              <div className="grid grid-cols-2 gap-2">
                {(['bank', 'mpesa'] as const).map((m) => (
                  <button key={m} onClick={() => setMethod(m)}
                    className={`py-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                      method === m ? 'bg-[#ff1493]/10 border-[#ff1493]/40 text-[#ff1493]' : 'bg-[#f6eef3] dark:bg-zinc-900 border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300'}`}>
                    {m === 'bank' ? <Building2 size={14} /> : <Smartphone size={14} />}
                    {m === 'bank' ? 'Bank' : 'M-Pesa'}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 flex justify-between">
                  <span>Amount (KES)</span>
                  <span className="text-[#ff1493] font-semibold">min 1 bob (KES 1.00)</span>
                </label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1.00"
                  className="mt-2 w-full bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-full py-3.5 px-4 text-[#18181b] dark:text-zinc-100 font-bold text-xl focus:outline-none focus:border-[#ff1493] transition-colors" />
              </div>

              {method === 'bank' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Bank</label>
                    <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}
                      className="mt-2 w-full bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-full py-3 px-4 text-[#18181b] dark:text-zinc-100 font-semibold focus:outline-none focus:border-[#ff1493] transition-colors text-sm appearance-none">
                      <option value="">Select bank…</option>
                      {banks.map((b, i) => <option key={`${i}-${b.code}`} value={b.code}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Account number</label>
                    <div className="flex gap-2 mt-2">
                      <input type="text" value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value); setResolved(null); }}
                        placeholder="Enter account number"
                        className="flex-1 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-full py-3 px-4 text-[#18181b] dark:text-zinc-100 font-semibold focus:outline-none focus:border-[#ff1493] transition-colors text-sm" />
                      <button onClick={resolveAccount} disabled={resolving || !accountNumber || !bankCode}
                        className="px-4 py-3 bg-[#f0e5ec] dark:bg-zinc-700 border border-[#e6d8e1] dark:border-zinc-700 rounded-full text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors disabled:opacity-50">
                        {resolving ? <Spinner size="small" /> : <CheckCircle2 size={14} />}
                      </button>
                    </div>
                    {resolved && (
                      <p className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold mt-1">✓ {resolved}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Account name</label>
                    <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account holder name"
                      className="mt-2 w-full bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-full py-3 px-4 text-[#18181b] dark:text-zinc-100 font-semibold focus:outline-none focus:border-[#ff1493] transition-colors text-sm" />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">M-Pesa number</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX or 07..."
                    className="mt-2 w-full bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-full py-3 px-4 text-[#18181b] dark:text-zinc-100 font-semibold focus:outline-none focus:border-[#ff1493] transition-colors text-sm" />
                </div>
              )}

              {error && (
                <p className="text-red-600 dark:text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 rounded-full px-4 py-2">{error}</p>
              )}

              <button onClick={submit} disabled={loading || amountCents <= 0}
                className="w-full py-4 bg-[#ff1493] text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <Spinner size="small" /> : <ArrowUpCircle size={16} />}
                {loading ? 'Submitting…' : `Withdraw ${amountCents > 0 ? formatKES(amountCents) : ''}`.trim()}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function ProfessionalDashboard() {
  const navigate = useNavigate();
  const { user } = useUserStore();

  // Loading states
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  // Data
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({
    profileViews: 0, followersGrowth: 0, accountReach: 0,
    followers: 0, totalSparks: 0, totalComments: 0, totalShares: 0,
    videoViews: 0, watchTime: 0, saves: 0,
  });
  const [series, setSeries] = useState({ sparks: [0,0,0,0,0,0,0], follows: [0,0,0,0,0,0,0], engagement: [0,0,0,0,0,0,0] });
  const [distribution, setDistribution] = useState({ video: 0, image: 0, text: 0 });
  const [isBoosted, setIsBoosted] = useState(false);

  // UI state
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAutoWithdraw, setShowAutoWithdraw] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  // Fetch wallet
  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.get('/wallet');
      if (res.data.wallet) setWallet(res.data.wallet);
      if (res.data.transactions) setTransactions(res.data.transactions);
    } catch (e) {
      logger.error('Wallet fetch failed:', e);
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  // Fetch analytics
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/analytics/creator');
      const d = res.data;
      setStats({
        profileViews:    d.profileViews    || 0,
        followersGrowth: d.followersGrowth || 0,
        accountReach:    d.accountReach    || 0,
        followers:       d.followers       || 0,
        totalSparks:     d.totalSparks     || 0,
        totalComments:   d.totalComments   || 0,
        totalShares:     d.totalShares     || 0,
        videoViews:      d.videoViews      || 0,
        watchTime:       d.watchTime       || 0,
        saves:           d.saves           || 0,
      });
      if (d.series) setSeries(d.series);
      setIsBoosted(d.isBoosted || false);
      setDistribution(d.distribution || { video: 0, image: 0, text: 0 });
    } catch (e) {
      logger.error('Stats fetch failed:', e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
    fetchStats();
    document.title = 'Pro Hub | Sparkle';
  }, []);

  const totalPosts = (distribution.video || 0) + (distribution.image || 0) + (distribution.text || 0) || 1;
  const videoPercent = Math.round(((distribution.video || 0) / totalPosts) * 100);
  const imagePercent = Math.round(((distribution.image || 0) / totalPosts) * 100);

  // Authoritative dynamic balance/revenue calculations from account ledger
  const REVENUE_TYPES = useMemo(() => ['Deposit', 'Revenue', 'AdRevenue', 'Tip', 'CreatorPayment', 'Subscription', 'BoostPurchase'], []);

  const todayCents = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return transactions
      .filter(t => t.status === 'Completed' && REVENUE_TYPES.includes(t.type) && new Date(t.created_at).getTime() >= startOfDay)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions, REVENUE_TYPES]);

  const weekCents = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    return transactions
      .filter(t => t.status === 'Completed' && REVENUE_TYPES.includes(t.type) && new Date(t.created_at).getTime() >= startOfWeek)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions, REVENUE_TYPES]);

  const monthCents = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return transactions
      .filter(t => t.status === 'Completed' && REVENUE_TYPES.includes(t.type) && new Date(t.created_at).getTime() >= startOfMonth)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions, REVENUE_TYPES]);

  // Revenue KPI cards derived directly from account ledger
  const revenueCards = [
    { label: 'Today',    cents: todayCents, growth: '', color: '#ff1493' },
    { label: 'This week',cents: weekCents,  growth: '', color: '#ec4899' },
    { label: 'This month',cents: monthCents, growth: '', color: '#db2777' },
    { label: 'Lifetime', cents: wallet?.lifetime_earnings || wallet?.available_balance || 0, growth: '', color: '#a855f7' },
  ];

  // Growth metrics
  const growthMetrics = [
    { label: 'Followers',  value: Math.min(100, Math.round(stats.followers / 10)),             color: '#ff1493' },
    { label: 'Reach',      value: Math.min(100, Math.round(stats.accountReach / 100)),          color: '#ec4899' },
    { label: 'Engagement', value: Math.min(100, Math.round((stats.totalSparks / Math.max(stats.followers, 1)) * 20)), color: '#a855f7' },
    { label: 'Revenue',    value: wallet ? Math.min(100, Math.round((wallet.available_balance / Math.max(wallet.lifetime_deposits, 1)) * 100)) : 0, color: '#f43f5e' },
  ];

  // Quick actions
  const quickActions = [
    { label: 'Boost post',     icon: <Zap size={18} />,         color: 'text-[#ff1493]', onClick: () => setShowSubscription(true) },
    { label: 'Go live',        icon: <Radio size={18} />,        color: 'text-[#ff1493]', onClick: () => navigate('/streams') },
    { label: 'Upload video',   icon: <Video size={18} />,        color: 'text-[#ff1493]', onClick: () => navigate('/moments/create') },
    { label: 'Create ad',      icon: <Megaphone size={18} />,    color: 'text-[#ff1493]', onClick: () => navigate('/ads') },
    { label: 'Withdraw',       icon: <Banknote size={18} />,     color: 'text-[#ff1493]', onClick: () => setShowWithdraw(true) },
    { label: 'Manage shop',    icon: <Store size={18} />,        color: 'text-[#ff1493]', onClick: () => navigate('/marketplace/my-shop') },
    { label: 'Creator studio', icon: <BarChart2 size={18} />,    color: 'text-[#ff1493]', onClick: () => navigate('/studio') },
    { label: 'View analytics', icon: <Activity size={18} />,     color: 'text-[#ff1493]', onClick: () => navigate('/analytics') },
  ];

  return (
    <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-900 text-[#18181b] dark:text-zinc-100 font-sans pb-16 overflow-x-hidden relative">
      <style>{`
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #e6d8e1; border-radius: 2px; }
        .dark ::-webkit-scrollbar-thumb { background: #3f3f46; }
      `}</style>

      {/* ── Sticky Header ── */}
      <div className="bg-[#fdf8fa] dark:bg-zinc-800 border-b border-[#e6d8e1] dark:border-zinc-700 px-4 py-3 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-[#18181b] dark:text-zinc-100" strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#18181b] dark:text-zinc-100 tracking-tight leading-none">Pro Hub</h1>
              {isBoosted && (
                <span className="text-xs font-semibold bg-[#ff1493] text-white px-2 py-0.5 rounded-full">
                  10% boost active
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchWallet} className="p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-full transition-colors">
              <RefreshCw size={16} className="text-slate-600 dark:text-zinc-300" />
            </button>
            <button onClick={() => navigate('/settings')} className="p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-full transition-colors">
              <Settings size={18} className="text-slate-600 dark:text-zinc-300" strokeWidth={2.5} />
            </button>
            <button onClick={() => setShowSubscription(true)}
              className="px-4 h-9 bg-[#ff1493] text-white rounded-full text-xs font-bold hover:bg-[#ff2d87] transition-colors">
              Boost
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1100px] mx-auto p-3 md:p-6 space-y-4">

        {/* ── Section 1: Creator Wallet Card ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="relative rounded-3xl overflow-hidden border border-[#e6d8e1] dark:border-zinc-700 shadow-sm bg-[#fdf8fa] dark:bg-zinc-800">

          <div className="relative p-6 md:p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Creator Wallet</p>
                <p className="text-xs font-semibold text-[#ff1493] mt-0.5">{user?.name || 'Creator'} · KES</p>
              </div>
              <div className="text-[#ff1493]">
                <Wallet size={18} />
              </div>
            </div>

            {/* Balance */}
            <div className="mb-8">
              <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-2">Available Balance</p>
              {loadingWallet ? (
                <Skeleton className="h-12 w-48" />
              ) : (
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl md:text-4xl font-bold text-[#18181b] dark:text-zinc-100 tracking-tight">
                    KES <AnimatedCounter value={wallet?.available_balance || 0} formatter={(v) => (v / 100).toFixed(2)} />
                  </p>
                </div>
              )}
              {!loadingWallet && wallet && wallet.pending_balance > 0 && (
                <p className="text-amber-600 dark:text-amber-400 text-xs font-semibold mt-1">
                  + {formatKES(wallet.pending_balance)} pending
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Add funds',    icon: <Plus size={14} />, primary: true, onClick: () => setShowDeposit(true) },
                { label: 'Withdraw',     icon: <ArrowUpCircle size={14} />, onClick: () => setShowWithdraw(true) },
                { label: 'Auto-payouts', icon: <Zap size={14} className="text-[#ff1493]" />, onClick: () => setShowAutoWithdraw(true) },
                { label: 'History',      icon: <History size={14} />,        onClick: () => navigate('/wallet/history') },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick}
                  className={`flex items-center gap-1.5 px-4 h-10 rounded-full text-xs font-bold transition-colors ${
                    btn.primary
                      ? 'bg-[#ff1493] text-white hover:bg-[#ff2d87]'
                      : 'bg-[#f0e5ec] dark:bg-zinc-700 text-[#18181b] dark:text-zinc-100 hover:bg-[#ede3e9] dark:hover:bg-zinc-600'
                  }`}>
                  {btn.icon}{btn.label}
                </button>
              ))}
            </div>

            {/* Lifetime Stats Row */}
            {!loadingWallet && wallet && (
              <div className="mt-6 pt-5 border-t border-[#ede3e9] dark:border-zinc-900 grid grid-cols-3 gap-4">
                {[
                  { label: 'Total deposited', value: wallet.lifetime_deposits },
                  { label: 'Total withdrawn', value: wallet.lifetime_withdrawals },
                  { label: 'Total earned',    value: wallet.lifetime_earnings },
                ].map((stat, i) => (
                  <div key={i}>
                    <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{stat.label}</p>
                    <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mt-0.5">{formatKES(stat.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Section 2: Revenue Analytics ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-3">Revenue</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {revenueCards.map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3, scale: 1.02 }}
                className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-2xl p-4 cursor-pointer transition-shadow border border-[#e6d8e1] dark:border-zinc-700 shadow-sm hover:border-[#ff1493]/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">{card.label}</p>
                {loadingWallet ? (
                  <Skeleton className="h-7 w-24 mt-2" />
                ) : (
                  <p className="text-3xl font-bold text-[#18181b] dark:text-zinc-100 mt-1 truncate">
                    {formatKES(card.cents)}
                  </p>
                )}
                {card.growth && (
                  <p className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold mt-1 flex items-center gap-1">
                    <TrendingUp size={10} />{card.growth}
                  </p>
                )}
                <div className="mt-3">
                  <Sparkline data={series.engagement} color={card.color} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Section 3: Creator Insights ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-3">Insights</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Profile visits',   value: stats.profileViews,    icon: <Eye size={16} /> },
              { label: 'Followers gained', value: stats.followersGrowth || stats.followers, icon: <Users size={16} /> },
              { label: 'Post reach',       value: stats.accountReach,    icon: <Radio size={16} /> },
              { label: 'Video views',      value: stats.videoViews,      icon: <Video size={16} /> },
              { label: 'Comments',         value: stats.totalComments,   icon: <MessageSquare size={16} /> },
              { label: 'Shares',           value: stats.totalShares,     icon: <Share2 size={16} /> },
            ].map((item, i) => (
              <motion.div key={i} whileHover={{ y: -2 }} className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-2xl p-4 cursor-pointer shadow-sm border border-[#e6d8e1] dark:border-zinc-700 hover:border-[#ff1493]/40">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">{item.label}</p>
                  <span className="text-[#ff1493]">{item.icon}</span>
                </div>
                {loadingStats ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-3xl font-bold text-[#18181b] dark:text-zinc-100">
                    <AnimatedCounter value={item.value} formatter={(v) => v.toLocaleString()} />
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Section 4: Monetization Overview ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-6 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-lg font-bold text-[#18181b] dark:text-zinc-100 tracking-tight leading-none">Monetization</h2>
              <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">Earnings overview</p>
            </div>
            <div className="text-[#ff1493]">
              <DollarSign size={18} strokeWidth={2.5} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Wallet balance',      value: wallet?.available_balance || 0 },
              { label: 'Pending earnings',    value: wallet?.pending_balance || 0,   },
              { label: 'Available earnings',  value: wallet?.available_balance || 0 },
              { label: 'Est. next payout',    value: Math.round((wallet?.available_balance || 0) * 0.9) },
            ].map((item, i) => (
              <div key={i} className="bg-[#f6eef3] dark:bg-zinc-900 rounded-2xl p-3 border border-[#e6d8e1] dark:border-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">{item.label}</p>
                {loadingWallet ? (
                  <Skeleton className="h-6 w-20 mt-1.5" />
                ) : (
                  <p className="text-base font-bold text-[#18181b] dark:text-zinc-100 mt-1.5">
                    {formatKES(item.value)}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Withdraw',      onClick: () => setShowWithdraw(true),           primary: false },
              { label: 'Add funds',     onClick: () => setShowDeposit(true),             primary: true },
              { label: 'Boost content', onClick: () => setShowSubscription(true),        primary: false },
              { label: 'Creator store', onClick: () => navigate('/marketplace/my-shop'), primary: false },
            ].map((btn, i) => (
              <button key={i} onClick={btn.onClick}
                className={`px-4 h-10 rounded-full text-xs font-bold transition-colors ${btn.primary ? 'bg-[#ff1493] text-white hover:bg-[#ff2d87]' : 'bg-[#f0e5ec] dark:bg-zinc-700 text-[#18181b] dark:text-zinc-100 hover:bg-[#ede3e9] dark:hover:bg-zinc-600 border border-[#e6d8e1] dark:border-zinc-700'}`}>
                {btn.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Section 5: Recent Transactions ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-6 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-base font-bold text-[#18181b] dark:text-zinc-100 tracking-tight">Transactions</h2>
              <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">Recent activity</p>
            </div>
            <button onClick={fetchWallet} className="p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-xl transition-colors">
              <RefreshCw size={14} className="text-slate-600 dark:text-zinc-300" />
            </button>
          </div>

          {loadingWallet ? (
            <div className="space-y-3">
              {[0,1,2].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : transactions.length > 0 ? (
            <div>
              {transactions.slice(0, 8).map((txn) => <TxnRow key={txn.transaction_id} txn={txn} />)}
            </div>
          ) : (
            <div className="text-center py-12">
              <Wallet size={32} className="text-slate-600 dark:text-zinc-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100">No transactions yet</p>
              <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">Add funds to get started</p>
              <button onClick={() => setShowDeposit(true)}
                className="mt-4 px-6 h-10 bg-[#ff1493] text-white rounded-full text-xs font-bold hover:bg-[#ff2d87] transition-colors">
                Add funds
              </button>
            </div>
          )}

          {transactions.length > 0 && (
            <button onClick={() => navigate('/wallet/history')}
              className="mt-4 w-full py-3 bg-[#f6eef3] dark:bg-zinc-900 rounded-full text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-[#ff1493] transition-colors border border-[#e6d8e1] dark:border-zinc-700 hover:border-[#ff1493]/40">
              View all transactions
            </button>
          )}
        </motion.div>

        {/* ── Section 6: Growth Bars ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-6 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm">
          <h2 className="text-base font-bold text-[#18181b] dark:text-zinc-100 tracking-tight mb-5">Growth</h2>
          <div className="space-y-5">
            {growthMetrics.map((m, i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{m.label}</span>
                  <span className="text-xs font-bold text-[#18181b] dark:text-zinc-100">{m.value}%</span>
                </div>
                <div className="h-2 bg-[#ede3e9] dark:bg-zinc-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${m.value}%` }}
                    transition={{ duration: 1.2, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${m.color}80, ${m.color})` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Section 7: Quick Actions ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-3">Quick actions</h2>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {quickActions.map((action, i) => (
              <motion.button key={i} onClick={action.onClick} whileHover={{ y: -3, scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-2xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-shadow border border-[#e6d8e1] dark:border-zinc-700 hover:border-[#ff1493]/40 shadow-sm">
                <span className={`${action.color} flex items-center justify-center`}>
                  {action.icon}
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300 text-center leading-tight">
                  {action.label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Content Performance (distribution) ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-6 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-bold text-[#18181b] dark:text-zinc-100 tracking-tight">Content performance</h2>
            <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300 px-2.5 py-1 bg-[#f0e5ec] dark:bg-zinc-700 rounded-full">Content mix</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full -rotate-90 text-[#ede3e9] dark:text-zinc-700" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="12" />
                <motion.circle
                  cx="50" cy="50" r="40" fill="transparent" stroke="#ff1493" strokeWidth="12"
                  strokeDasharray={`${videoPercent * 2.51} 251`} strokeLinecap="round"
                  initial={{ strokeDasharray: '0 251' }}
                  animate={{ strokeDasharray: `${videoPercent * 2.51} 251` }}
                  transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#18181b] dark:text-zinc-100">{videoPercent}%</div>
            </div>
            <div className="flex-1 space-y-4">
              {[
                { label: 'Videos', pct: videoPercent, color: '#ff1493' },
                { label: 'Photos', pct: imagePercent, color: '#ec4899' },
                { label: 'Text',   pct: 100 - videoPercent - imagePercent, color: '#a855f7' },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-600 dark:text-zinc-300">{item.label}</span>
                    <span className="font-bold text-[#18181b] dark:text-zinc-100">{item.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#ede3e9] dark:bg-zinc-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: item.color }}
                      initial={{ width: 0 }} animate={{ width: `${item.pct}%` }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Footer Utilities ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Pro support',    icon: <MessageSquare size={14} />, color: 'text-[#ff1493]', onClick: () => navigate('/support') },
            { label: 'Security',       icon: <Shield size={14} />,        color: 'text-[#ff1493]', onClick: () => navigate('/settings') },
            { label: 'Creator manual', icon: <HelpCircle size={14} />,    color: 'text-[#ff1493]', onClick: () => navigate('/help') },
            { label: 'Get verified',   icon: <BadgeCheck size={14} />,    color: 'text-[#ff1493]', onClick: () => navigate('/verified') },
          ].map((item, i) => (
            <motion.button key={i} onClick={item.onClick} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}
              className="bg-[#fdf8fa] dark:bg-zinc-800 p-3 rounded-2xl flex flex-col items-center gap-1.5 hover:border-[#ff1493]/40 transition-shadow border border-[#e6d8e1] dark:border-zinc-700 shadow-sm">
              <div className={`${item.color} flex items-center justify-center`}>
                {item.icon}
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300 text-center">{item.label}</span>
            </motion.button>
          ))}
        </div>

      </main>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showDeposit && (
          <DepositModal
            onClose={() => setShowDeposit(false)}
            onSuccess={() => { setShowDeposit(false); setTimeout(fetchWallet, 2000); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWithdraw && (
          <WithdrawModal
            wallet={wallet}
            onClose={() => setShowWithdraw(false)}
            onSuccess={() => setTimeout(fetchWallet, 1500)}
          />
        )}
      </AnimatePresence>

      {/* ── Boost Hub Modal ── */}
      <BoostConnectModal
        isOpen={showSubscription}
        onClose={() => setShowSubscription(false)}
        onSuccess={() => {
          fetchStats();
          fetchWallet();
        }}
      />

      {/* Auto Withdrawal Settings Modal */}
      <AutoWithdrawalModal
        isOpen={showAutoWithdraw}
        onClose={() => setShowAutoWithdraw(false)}
        onSaved={fetchWallet}
      />
    </div>
  );
}


