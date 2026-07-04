import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { motion, AnimatePresence, useSpring, useMotionValue, animate } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, X, Settings, BadgeCheck,
  DollarSign, Zap, Shield, Plus, HelpCircle,
  Heart, MessageSquare, Share2, TrendingUp, TrendingDown,
  Wallet, ArrowDownCircle, ArrowUpCircle, History,
  Eye, Users, Radio, Video, Clock, Bookmark, ThumbsUp,
  Banknote, Store, Megaphone, BarChart2, Activity,
  RefreshCw, CheckCircle2, XCircle, AlertCircle, Loader2,
  ChevronDown, Building2, Smartphone, CreditCard
} from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import { useUserStore } from '../store/userStore';

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
  <div className={`bg-white/10 animate-pulse rounded-xl ${className}`} />
);

// ─── Mini Sparkline ───────────────────────────────────────────────────────────
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const pts = useMemo(() => {
    if (!data.length) return '';
    const max = Math.max(...data, 1);
    const w = 120, h = 40;
    return data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
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
    Completed: { bg: 'bg-emerald-500/20 border-emerald-500/30', text: 'text-emerald-300', icon: <CheckCircle2 size={10} /> },
    Pending:   { bg: 'bg-amber-500/20 border-amber-500/30',   text: 'text-amber-300',   icon: <AlertCircle size={10} /> },
    Failed:    { bg: 'bg-red-500/20 border-red-500/30',       text: 'text-red-300',     icon: <XCircle size={10} /> },
    Refunded:  { bg: 'bg-sky-500/20 border-sky-500/30',       text: 'text-sky-300',     icon: <RefreshCw size={10} /> },
  };
  const s = map[status] || map.Pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${s.bg} ${s.text}`}>
      {s.icon}{status}
    </span>
  );
};

// ─── Transaction Row ──────────────────────────────────────────────────────────
const TXN_ICONS: Record<string, React.ReactNode> = {
  Deposit:        <ArrowDownCircle size={16} className="text-emerald-400" />,
  Withdrawal:     <ArrowUpCircle size={16} className="text-red-400" />,
  Revenue:        <TrendingUp size={16} className="text-amber-400" />,
  AdRevenue:      <Megaphone size={16} className="text-purple-400" />,
  Tip:            <Heart size={16} className="text-pink-400" />,
  BoostPurchase:  <Zap size={16} className="text-yellow-400" />,
  BoostSpend:     <Zap size={16} className="text-orange-400" />,
  Subscription:   <BadgeCheck size={16} className="text-sky-400" />,
  CreatorPayment: <DollarSign size={16} className="text-violet-400" />,
  Purchase:       <Store size={16} className="text-indigo-400" />,
  Refund:         <RefreshCw size={16} className="text-sky-400" />,
};

const TxnRow = ({ txn }: { txn: Transaction }) => {
  const isCredit = ['Deposit', 'Revenue', 'AdRevenue', 'Tip', 'CreatorPayment', 'Refund'].includes(txn.type);
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 -mx-2 rounded-xl transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          {TXN_ICONS[txn.type] || <Activity size={16} className="text-slate-400" />}
        </div>
        <div>
          <p className="text-[11px] font-black text-white uppercase italic tracking-wide">{txn.type}</p>
          <p className="text-[9px] text-slate-500 font-bold uppercase">{relativeTime(txn.created_at)}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-sm font-black italic ${isCredit ? 'text-emerald-400' : 'text-red-400'}`}>
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

  const amountKES = parseFloat(amount) || 0;
  const amountCents = Math.round(amountKES * 100);

  const handleSubmit = async () => {
    if (amountCents < 10000) { setError('Minimum deposit is KES 100'); return; }
    if (method === 'mpesa' && !phone.trim()) { setError('Enter your M-Pesa phone number'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/wallet/deposit', { amountCents, method, phone: phone || undefined });
      if (res.data.authorizationUrl) {
        window.open(res.data.authorizationUrl, '_blank');
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
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%', scale: 0.95 }} animate={{ y: 0, scale: 1 }}
        exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-[#0f0f1a] border border-white/10 w-full max-w-md rounded-t-[32px] md:rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest italic">
              {step === 1 ? 'Step 1 of 2' : step === 2 ? 'Step 2 of 2' : 'Processing'}
            </p>
            <h2 className="text-xl font-black text-white italic uppercase tracking-tight">Add Funds</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <X size={18} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {step === 3 ? (
            <div className="text-center py-8 space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
                className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </motion.div>
              <p className="text-white font-black text-lg italic uppercase">Payment Initiated</p>
              <p className="text-slate-400 text-xs font-medium">
                {method === 'mpesa'
                  ? 'Check your phone for the M-Pesa prompt and enter your PIN to complete.'
                  : 'Complete your payment in the Paystack window that just opened.'}
              </p>
              <p className="text-slate-500 text-[10px] font-bold uppercase">Your wallet will update automatically once confirmed.</p>
              <button onClick={() => { onClose(); onSuccess(); }}
                className="w-full py-3.5 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-widest italic hover:bg-slate-100 transition-all">
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Amount */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Amount (KES)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">KES</span>
                  <input
                    type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-14 pr-4 text-white font-black text-xl italic focus:outline-none focus:border-[#FF1F6D]/50 transition-colors"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {QUICK_AMOUNTS.map((q) => (
                    <button key={q} onClick={() => setAmount(String(q))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase italic transition-all border ${
                        parseFloat(amount) === q
                          ? 'bg-[#FF1F6D] text-white border-[#FF1F6D]'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'}`}>
                      {q.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAY_METHODS.map((m) => (
                    <button key={m.id} onClick={() => setMethod(m.id)}
                      className={`py-3 rounded-xl border text-[10px] font-black uppercase italic flex flex-col items-center gap-1.5 transition-all ${
                        method === m.id ? 'bg-white/10 border-[#FF1F6D]/50 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                      <span className={method === m.id ? 'text-[#FF1F6D]' : m.color}>{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* M-Pesa Phone */}
              {method === 'mpesa' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">M-Pesa Phone Number</label>
                  <input
                    type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX"
                    className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-bold focus:outline-none focus:border-[#FF1F6D]/50 transition-colors text-sm"
                  />
                </motion.div>
              )}

              {error && (
                <p className="text-red-400 text-[10px] font-bold uppercase bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  ⚠️ {error}
                </p>
              )}

              <button onClick={handleSubmit} disabled={loading || !amount || amountKES <= 0}
                className="w-full py-4 bg-gradient-to-r from-[#FF1F6D] to-[#ff6b35] text-white rounded-xl text-[11px] font-black uppercase tracking-widest italic shadow-lg shadow-[#FF1F6D]/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
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
    if (amountCents < 20000) { setError('Minimum withdrawal is KES 200'); return; }
    if (!wallet || amountCents > wallet.available_balance) { setError('Insufficient balance'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/wallet/withdraw', { amountCents, method, accountName, accountNumber, bankCode, phone });
      setDone(true);
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Withdrawal failed. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-[#0f0f1a] border border-white/10 w-full max-w-md rounded-t-[32px] md:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#0f0f1a]">
          <div>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest italic">Creator Payout</p>
            <h2 className="text-xl font-black text-white italic uppercase tracking-tight">Withdraw</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <X size={18} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {done ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <p className="text-white font-black text-lg italic uppercase">Withdrawal Requested</p>
              <p className="text-slate-400 text-xs font-medium">Your payout is being processed. Funds arrive within 1–2 business days.</p>
              <button onClick={onClose} className="w-full py-3.5 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-widest italic hover:bg-slate-100 transition-all">Done</button>
            </div>
          ) : (
            <>
              {wallet && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest italic">Available Balance</p>
                  <p className="text-2xl font-black text-white italic mt-1">{formatKES(wallet.available_balance)}</p>
                </div>
              )}

              {/* Method Toggle */}
              <div className="grid grid-cols-2 gap-2">
                {(['bank', 'mpesa'] as const).map((m) => (
                  <button key={m} onClick={() => setMethod(m)}
                    className={`py-3 rounded-xl border text-[10px] font-black uppercase italic flex items-center justify-center gap-2 transition-all ${
                      method === m ? 'bg-white/10 border-[#FF1F6D]/50 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                    {m === 'bank' ? <Building2 size={14} /> : <Smartphone size={14} />}
                    {m === 'bank' ? 'Bank' : 'M-Pesa'}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Amount (KES)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-white font-black text-xl italic focus:outline-none focus:border-[#FF1F6D]/50 transition-colors" />
              </div>

              {method === 'bank' ? (
                <>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Bank</label>
                    <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}
                      className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-bold focus:outline-none focus:border-[#FF1F6D]/50 transition-colors text-sm appearance-none">
                      <option value="">Select bank…</option>
                      {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Account Number</label>
                    <div className="flex gap-2 mt-2">
                      <input type="text" value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value); setResolved(null); }}
                        placeholder="Enter account number"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-bold focus:outline-none focus:border-[#FF1F6D]/50 transition-colors text-sm" />
                      <button onClick={resolveAccount} disabled={resolving || !accountNumber || !bankCode}
                        className="px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
                        {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      </button>
                    </div>
                    {resolved && (
                      <p className="text-emerald-400 text-[10px] font-bold mt-1">✓ {resolved}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Account Name</label>
                    <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account holder name"
                      className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-bold focus:outline-none focus:border-[#FF1F6D]/50 transition-colors text-sm" />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">M-Pesa Number</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX"
                    className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-bold focus:outline-none focus:border-[#FF1F6D]/50 transition-colors text-sm" />
                </div>
              )}

              {error && (
                <p className="text-red-400 text-[10px] font-bold uppercase bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">⚠️ {error}</p>
              )}

              <button onClick={submit} disabled={loading || amountCents <= 0}
                className="w-full py-4 bg-gradient-to-r from-[#FF1F6D] to-[#ff6b35] text-white rounded-xl text-[11px] font-black uppercase tracking-widest italic shadow-lg shadow-[#FF1F6D]/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpCircle size={16} />}
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
  const [showSubscription, setShowSubscription] = useState(false);

  // Fetch wallet
  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.get('/wallet');
      if (res.data.wallet) setWallet(res.data.wallet);
      if (res.data.transactions) setTransactions(res.data.transactions);
    } catch (e) {
      console.error('Wallet fetch failed:', e);
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
      console.error('Stats fetch failed:', e);
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

  // Revenue KPI cards (mock growth percentages — replace with real API later)
  const revenueCards = [
    { label: 'Today',    cents: Math.round((wallet?.lifetime_earnings || 0) * 0.003), growth: '+8.2%',  color: '#FF1F6D' },
    { label: 'This Week',cents: Math.round((wallet?.lifetime_earnings || 0) * 0.02),  growth: '+12.5%', color: '#ff6b35' },
    { label: 'This Month',cents: Math.round((wallet?.lifetime_earnings || 0) * 0.08), growth: '+24.1%', color: '#a855f7' },
    { label: 'Lifetime', cents: wallet?.lifetime_earnings || 0,                        growth: '',       color: '#3b82f6' },
  ];

  // Growth metrics
  const growthMetrics = [
    { label: 'Followers',  value: Math.min(100, Math.round(stats.followers / 10)),             color: '#FF1F6D' },
    { label: 'Reach',      value: Math.min(100, Math.round(stats.accountReach / 100)),          color: '#ff6b35' },
    { label: 'Engagement', value: Math.min(100, Math.round((stats.totalSparks / Math.max(stats.followers, 1)) * 20)), color: '#a855f7' },
    { label: 'Revenue',    value: wallet ? Math.min(100, Math.round((wallet.available_balance / Math.max(wallet.lifetime_deposits, 1)) * 100)) : 0, color: '#22c55e' },
  ];

  // Quick actions
  const quickActions = [
    { label: 'Boost Post',     icon: <Zap size={18} />,         color: 'from-amber-500 to-orange-500', onClick: () => setShowSubscription(true) },
    { label: 'Go Live',        icon: <Radio size={18} />,        color: 'from-red-500 to-pink-500',     onClick: () => navigate('/live') },
    { label: 'Upload Video',   icon: <Video size={18} />,        color: 'from-violet-500 to-purple-500', onClick: () => navigate('/upload') },
    { label: 'Create Ad',      icon: <Megaphone size={18} />,    color: 'from-blue-500 to-indigo-500',  onClick: () => navigate('/ads') },
    { label: 'Withdraw',       icon: <Banknote size={18} />,     color: 'from-emerald-500 to-teal-500', onClick: () => setShowWithdraw(true) },
    { label: 'Manage Shop',    icon: <Store size={18} />,        color: 'from-pink-500 to-rose-500',    onClick: () => navigate('/shop') },
    { label: 'Creator Studio', icon: <BarChart2 size={18} />,    color: 'from-cyan-500 to-sky-500',     onClick: () => navigate('/studio') },
    { label: 'View Analytics', icon: <Activity size={18} />,     color: 'from-slate-500 to-slate-600',  onClick: () => navigate('/analytics') },
  ];

  return (
    <div className="min-h-screen bg-[#09090f] text-white font-sans pb-16 overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .font-sans { font-family: 'Inter', -apple-system, sans-serif; }
        .glass { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(20px); }
        .glass-strong { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(24px); }
        .gradient-card { background: linear-gradient(135deg, rgba(255,31,109,0.15) 0%, rgba(30,30,60,0.8) 100%); }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* ── Sticky Header ── */}
      <div className="glass-strong px-4 py-3 sticky top-0 z-50 shadow-xl shadow-black/40">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-white" strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-black text-white tracking-tighter italic uppercase leading-none">Pro Hub.</h1>
              {isBoosted && (
                <span className="text-[8px] font-black bg-[#FF1F6D] text-white px-2 py-0.5 rounded-full uppercase italic tracking-widest animate-pulse">
                  10% Boost Active
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchWallet} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <RefreshCw size={16} className="text-slate-400" />
            </button>
            <button onClick={() => navigate('/settings')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Settings size={18} className="text-slate-400" strokeWidth={2.5} />
            </button>
            <button onClick={() => setShowSubscription(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#FF1F6D] to-[#ff6b35] text-white rounded-full text-[10px] font-black uppercase tracking-widest italic shadow-lg shadow-[#FF1F6D]/30 hover:scale-105 active:scale-95 transition-all">
              Boost Hub
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1100px] mx-auto p-3 md:p-6 space-y-4">

        {/* ── Section 1: Creator Wallet Card ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="relative rounded-3xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #0d0d1a 50%, #1a0820 100%)' }}>
          {/* Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF1F6D] rounded-full blur-[120px] opacity-15 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500 rounded-full blur-[100px] opacity-10 pointer-events-none" />

          <div className="relative p-6 md:p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] italic">Creator Wallet</p>
                <p className="text-[9px] font-bold text-[#FF1F6D] mt-0.5 uppercase italic">{user?.name || 'Creator'} · KES</p>
              </div>
              <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
                <Wallet size={18} className="text-[#FF1F6D]" />
              </div>
            </div>

            {/* Balance */}
            <div className="mb-8">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-2">Available Balance</p>
              {loadingWallet ? (
                <Skeleton className="h-12 w-48 bg-white/5" />
              ) : (
                <div className="flex items-baseline gap-3">
                  <p className="text-4xl md:text-5xl font-black text-white italic tracking-tighter">
                    KES <AnimatedCounter value={wallet?.available_balance || 0} formatter={(v) => (v / 100).toFixed(2)} />
                  </p>
                </div>
              )}
              {!loadingWallet && wallet && wallet.pending_balance > 0 && (
                <p className="text-[10px] text-amber-400 font-bold uppercase italic mt-1">
                  + {formatKES(wallet.pending_balance)} pending
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Add Funds', icon: <Plus size={14} />, primary: true, onClick: () => setShowDeposit(true) },
                { label: 'Withdraw',  icon: <ArrowUpCircle size={14} />, onClick: () => setShowWithdraw(true) },
                { label: 'History',   icon: <History size={14} />,        onClick: () => navigate('/wallet/history') },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest italic transition-all hover:scale-105 active:scale-95 ${
                    btn.primary
                      ? 'bg-gradient-to-r from-[#FF1F6D] to-[#ff6b35] text-white shadow-lg shadow-[#FF1F6D]/30'
                      : 'glass text-white hover:bg-white/10'
                  }`}>
                  {btn.icon}{btn.label}
                </button>
              ))}
            </div>

            {/* Lifetime Stats Row */}
            {!loadingWallet && wallet && (
              <div className="mt-6 pt-5 border-t border-white/5 grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Deposited', value: wallet.lifetime_deposits },
                  { label: 'Total Withdrawn', value: wallet.lifetime_withdrawals },
                  { label: 'Total Earned',    value: wallet.lifetime_earnings },
                ].map((stat, i) => (
                  <div key={i}>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{stat.label}</p>
                    <p className="text-sm font-black text-white italic mt-0.5">{formatKES(stat.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Section 2: Revenue Analytics ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-3">Revenue Analytics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {revenueCards.map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3, scale: 1.02 }}
                className="glass rounded-2xl p-4 cursor-pointer transition-all">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">{card.label}</p>
                {loadingWallet ? (
                  <Skeleton className="h-7 w-24 mt-2 bg-white/5" />
                ) : (
                  <p className="text-lg font-black text-white italic mt-1 truncate" style={{ color: card.color }}>
                    {formatKES(card.cents)}
                  </p>
                )}
                {card.growth && (
                  <p className="text-[9px] font-black text-emerald-400 uppercase italic mt-1 flex items-center gap-1">
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
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-3">Creator Insights</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Profile Visits',   value: stats.profileViews,    icon: <Eye size={16} />,            color: '#FF1F6D' },
              { label: 'Followers Gained', value: stats.followersGrowth || stats.followers, icon: <Users size={16} />,    color: '#a855f7' },
              { label: 'Post Reach',       value: stats.accountReach,    icon: <Radio size={16} />,          color: '#3b82f6' },
              { label: 'Video Views',      value: stats.videoViews,      icon: <Video size={16} />,          color: '#f59e0b' },
              { label: 'Comments',         value: stats.totalComments,   icon: <MessageSquare size={16} />,  color: '#22c55e' },
              { label: 'Shares',           value: stats.totalShares,     icon: <Share2 size={16} />,         color: '#06b6d4' },
            ].map((item, i) => (
              <motion.div key={i} whileHover={{ y: -2 }} className="glass rounded-2xl p-4 cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">{item.label}</p>
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center" style={{ color: item.color }}>
                    {item.icon}
                  </div>
                </div>
                {loadingStats ? (
                  <Skeleton className="h-8 w-20 bg-white/5" />
                ) : (
                  <p className="text-2xl font-black italic" style={{ color: item.color }}>
                    <AnimatedCounter value={item.value} formatter={(v) => v.toLocaleString()} />
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Section 4: Monetization Overview ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500 rounded-full blur-[100px] opacity-10 pointer-events-none" />
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-lg font-black text-white italic uppercase tracking-tight leading-none">Monetization</h2>
              <p className="text-[9px] text-slate-500 font-black italic uppercase mt-1 tracking-widest">Creator Earnings Overview</p>
            </div>
            <div className="w-10 h-10 glass rounded-xl flex items-center justify-center text-[#FF1F6D]">
              <DollarSign size={18} strokeWidth={2.5} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Wallet Balance',      value: wallet?.available_balance || 0, color: '#22c55e' },
              { label: 'Pending Earnings',    value: wallet?.pending_balance || 0,   color: '#f59e0b' },
              { label: 'Available Earnings',  value: wallet?.available_balance || 0, color: '#3b82f6' },
              { label: 'Est. Next Payout',    value: Math.round((wallet?.available_balance || 0) * 0.9), color: '#a855f7' },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{item.label}</p>
                {loadingWallet ? (
                  <Skeleton className="h-6 w-20 mt-1.5 bg-white/5" />
                ) : (
                  <p className="text-sm font-black italic mt-1.5" style={{ color: item.color }}>
                    {formatKES(item.value)}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Withdraw',      onClick: () => setShowWithdraw(true),    color: 'from-emerald-500 to-teal-500' },
              { label: 'Add Funds',     onClick: () => setShowDeposit(true),     color: 'from-[#FF1F6D] to-[#ff6b35]' },
              { label: 'Boost Content', onClick: () => setShowSubscription(true),color: 'from-amber-500 to-orange-500' },
              { label: 'Creator Store', onClick: () => navigate('/shop'),         color: 'from-violet-500 to-purple-500' },
            ].map((btn, i) => (
              <button key={i} onClick={btn.onClick}
                className={`bg-gradient-to-r ${btn.color} text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest italic shadow-lg hover:scale-105 active:scale-95 transition-all`}>
                {btn.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Section 5: Recent Transactions ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass rounded-3xl p-6">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-base font-black text-white italic uppercase tracking-tight">Transactions</h2>
              <p className="text-[9px] text-slate-500 font-black uppercase italic tracking-widest mt-0.5">Recent Activity</p>
            </div>
            <button onClick={fetchWallet} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <RefreshCw size={14} className="text-slate-400" />
            </button>
          </div>

          {loadingWallet ? (
            <div className="space-y-3">
              {[0,1,2].map((i) => <Skeleton key={i} className="h-14 bg-white/5" />)}
            </div>
          ) : transactions.length > 0 ? (
            <div>
              {transactions.slice(0, 8).map((txn) => <TxnRow key={txn.transaction_id} txn={txn} />)}
            </div>
          ) : (
            <div className="text-center py-12">
              <Wallet size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-[11px] font-black text-slate-500 uppercase italic">No transactions yet</p>
              <p className="text-[10px] text-slate-600 font-medium mt-1">Add funds to get started</p>
              <button onClick={() => setShowDeposit(true)}
                className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[#FF1F6D] to-[#ff6b35] text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic shadow-lg shadow-[#FF1F6D]/30 hover:scale-105 transition-all">
                Add Funds
              </button>
            </div>
          )}

          {transactions.length > 0 && (
            <button onClick={() => navigate('/wallet/history')}
              className="mt-4 w-full py-3 glass rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest italic hover:text-white hover:bg-white/5 transition-all">
              View All Transactions
            </button>
          )}
        </motion.div>

        {/* ── Section 6: Growth Bars ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass rounded-3xl p-6">
          <h2 className="text-base font-black text-white italic uppercase tracking-tight mb-5">Growth</h2>
          <div className="space-y-5">
            {growthMetrics.map((m, i) => (
              <div key={i}>
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">{m.label}</span>
                  <span className="text-[10px] font-black italic" style={{ color: m.color }}>{m.value}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
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
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-3">Quick Actions</h2>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {quickActions.map((action, i) => (
              <motion.button key={i} onClick={action.onClick} whileHover={{ y: -3, scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="glass rounded-2xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all hover:border-white/20">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg`}>
                  {action.icon}
                </div>
                <span className="text-[8px] font-black text-slate-400 uppercase italic tracking-wide text-center leading-tight">
                  {action.label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Content Engine (distribution) ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass rounded-3xl p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-black text-white italic uppercase tracking-tight">Content Engine</h2>
            <span className="text-[8px] font-black text-slate-500 uppercase italic px-2 py-1 glass rounded-lg">Distribution Logic</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                <motion.circle
                  cx="50" cy="50" r="40" fill="transparent" stroke="#FF1F6D" strokeWidth="12"
                  strokeDasharray={`${videoPercent * 2.51} 251`} strokeLinecap="round"
                  initial={{ strokeDasharray: '0 251' }}
                  animate={{ strokeDasharray: `${videoPercent * 2.51} 251` }}
                  transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-black italic text-white">{videoPercent}%</div>
            </div>
            <div className="flex-1 space-y-4">
              {[
                { label: 'Videos', pct: videoPercent, color: '#FF1F6D' },
                { label: 'Photos', pct: imagePercent, color: '#a855f7' },
                { label: 'Text',   pct: 100 - videoPercent - imagePercent, color: '#3b82f6' },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span className="font-black text-slate-400 uppercase italic">{item.label}</span>
                    <span className="font-black italic" style={{ color: item.color }}>{item.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
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
            { label: 'Pro Support',    icon: <MessageSquare size={14} />, color: 'text-indigo-400', onClick: () => navigate('/support') },
            { label: 'Security',       icon: <Shield size={14} />,        color: 'text-emerald-400', onClick: () => navigate('/settings') },
            { label: 'Creator Manual', icon: <HelpCircle size={14} />,    color: 'text-amber-400',  onClick: () => navigate('/help') },
            { label: 'Get Verified',   icon: <BadgeCheck size={14} />,    color: 'text-[#FF1F6D]',  onClick: () => navigate('/verified') },
          ].map((item, i) => (
            <motion.button key={i} onClick={item.onClick} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}
              className="glass p-3 rounded-xl flex flex-col items-center gap-1.5 hover:border-white/20 transition-all">
              <div className={`w-8 h-8 rounded-lg bg-white/5 ${item.color} flex items-center justify-center border border-white/5`}>
                {item.icon}
              </div>
              <span className="text-[8px] font-black text-slate-500 uppercase italic tracking-widest text-center">{item.label}</span>
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
      <AnimatePresence>
        {showSubscription && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0d0d1a] border border-white/10 w-full max-w-[800px] rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row relative">
              <button onClick={() => setShowSubscription(false)}
                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors z-10">
                <X size={18} className="text-white" />
              </button>

              <div className="md:w-[35%] p-8 flex flex-col justify-between relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #0d0d1a 100%)' }}>
                <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-[#FF1F6D] rounded-full blur-[80px] opacity-20" />
                <div className="absolute bottom-[-50px] left-[-50px] w-40 h-40 bg-indigo-500 rounded-full blur-[80px] opacity-15" />
                <div className="relative z-10">
                  <h2 className="text-3xl font-black text-white italic leading-none uppercase tracking-tighter mb-2">Power Up.</h2>
                  <p className="text-[10px] font-black text-[#FF1F6D] uppercase tracking-widest italic mb-6">Boost Tier Selection</p>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">Amplify your content with advanced reach optimization and viral sequencing.</p>
                </div>
                <div className="relative z-10 bg-white/5 border border-white/10 p-4 rounded-2xl mt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap size={16} className="text-amber-400" fill="currentColor" />
                    <span className="text-[10px] font-black text-white uppercase italic">Instant Activation</span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase italic">Global reach sync enabled</p>
                </div>
              </div>

              <div className="flex-1 p-8 md:p-10 space-y-8">
                <div>
                  <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2">Select Boost Tier</h3>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Weekly Distribution Plans</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'Nano', price: 'KES 99', perks: ['2× Reach', 'Basic Pulse'], style: 'glass' },
                    { name: 'Viral', price: 'KES 499', perks: ['10× Reach', 'Pro Analytics', 'Signal Priority'], popular: true, style: 'bg-gradient-to-br from-[#FF1F6D] to-[#ff6b35]' },
                    { name: 'Matrix', price: 'KES 999', perks: ['Unlimited Reach', 'Global Sync', '24/7 Support'], style: 'bg-gradient-to-br from-slate-800 to-slate-900' },
                  ].map((plan, i) => (
                    <div key={i} className={`${plan.style} border border-white/10 p-5 rounded-3xl flex flex-col relative hover:scale-[1.03] transition-all shadow-xl`}>
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-[#FF1F6D] px-3 py-1 rounded-full text-[8px] font-black uppercase italic shadow-md">
                          Most Popular
                        </div>
                      )}
                      <h4 className="text-xs font-black text-white uppercase italic tracking-widest mb-1">{plan.name}</h4>
                      <div className="flex items-baseline gap-1 mb-5">
                        <span className="text-2xl font-black text-white italic">{plan.price}</span>
                        <span className="text-[8px] font-bold text-white/60 uppercase">/ Week</span>
                      </div>
                      <div className="flex-1 space-y-3 mb-5">
                        {plan.perks.map((p, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-white/60" />
                            <span className="text-[9px] font-bold text-white/80 uppercase italic">{p}</span>
                          </div>
                        ))}
                      </div>
                      <button className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[9px] font-black uppercase tracking-widest italic shadow-lg active:scale-95 transition-all">
                        Pay Now
                      </button>
                    </div>
                  ))}
                </div>
                <div className="text-center pt-4 border-t border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase italic">Secure via Sparkle Payment Gateway (KES)</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
