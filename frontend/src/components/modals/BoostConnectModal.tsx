import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, TrendingUp, AlertCircle, History, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import api from '../../api/api';
import { logger } from '../../utils/logger';
import { useModalA11y } from '../../hooks/useModalA11y';

interface ActiveBoostData {
  boostId: string;
  budgetKes: number;
  durationDays: number;
  boostStrength: number;
  startTime: string;
  endTime: string;
  serverNow: string;
  remainingMs: number;
  daysRemaining: number;
  progressPercent: number;
  status: string;
  paymentId: string;
  projectedTotalReach: number;
}

interface BoostHistoryItem {
  boostId: string;
  budgetKes: number;
  durationDays: number;
  boostStrength: number;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
}

interface BoostConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BoostConnectModal({ isOpen, onClose, onSuccess }: BoostConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'boost' | 'history'>('boost');
  const [ , setLoading ] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Wallet
  const [walletBalanceCents, setWalletBalanceCents] = useState<number | null>(null);
  
  // Active Boost Status
  const [activeBoost, setActiveBoost] = useState<ActiveBoostData | null>(null);
  const [countdownText, setCountdownText] = useState<string>('');
  
  // History
  const [history, setHistory] = useState<BoostHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Form inputs
  const [budgetInput, setBudgetInput] = useState<string>('499');
  const [durationInput, setDurationInput] = useState<number>(7);
  const [customDays, setCustomDays] = useState<string>('');
  const [isCustomDaysActive, setIsCustomDaysActive] = useState(false);
  
  // Live calculation result
  const [calculatedStrength, setCalculatedStrength] = useState<number>(3.98);
  const [projectedReach, setProjectedReach] = useState<number>(43750);
  
  // Status feedback
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const a11yRef = useModalA11y(isOpen, onClose);

  // ── Fetch Wallet & Active Boost Status ────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [walletRes, activeRes] = await Promise.all([
        api.get('/wallet').catch(() => null),
        api.get('/boost/active').catch(() => null),
      ]);

      if (walletRes?.data?.wallet) {
        setWalletBalanceCents(walletRes.data.wallet.available_balance);
      }

      if (activeRes?.data?.activeBoost) {
        setActiveBoost(activeRes.data.activeBoost);
      } else {
        setActiveBoost(null);
      }
    } catch (err: any) {
      logger.error('Failed to load boost status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/boost/history');
      if (res.data?.history) {
        setHistory(res.data.history);
      }
    } catch (err) {
      logger.error('Failed to load boost history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      if (activeTab === 'history') fetchHistory();
    }
  }, [isOpen, activeTab, fetchData, fetchHistory]);

  // ── Real-time Countdown Timer ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeBoost || !activeBoost.endTime) return;

    const updateTimer = () => {
      const target = new Date(activeBoost.endTime).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setCountdownText('Expired');
        fetchData();
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdownText(`${days}d ${hours}h ${mins}m ${secs}s`);
      } else {
        setCountdownText(`${hours}h ${mins}m ${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeBoost, fetchData]);

  // ── Calculate Strength locally in real-time ─────────────────────────────
  const effectiveDays = isCustomDaysActive ? (parseInt(customDays) || 1) : durationInput;
  const budgetNum = parseFloat(budgetInput) || 0;

  useEffect(() => {
    if (budgetNum >= 10 && effectiveDays >= 1) {
      const daily = budgetNum / effectiveDays;
      const raw = 1.0 + Math.sqrt(daily / 8.0);
      const str = Math.min(10.0, Math.max(1.1, raw));
      const strFormatted = parseFloat(str.toFixed(2));
      setCalculatedStrength(strFormatted);

      const projDaily = Math.round(daily * strFormatted * 25);
      setProjectedReach(projDaily * effectiveDays);
    } else {
      setCalculatedStrength(1.0);
      setProjectedReach(0);
    }
  }, [budgetNum, effectiveDays]);

  // ── Shortcut Selection Handlers ──────────────────────────────────────────
  const applyPreset = (budget: number, days: number) => {
    setBudgetInput(String(budget));
    setDurationInput(days);
    setIsCustomDaysActive(false);
    setCustomDays('');
    setErrorMsg('');
  };

  // ── Balance Check ─────────────────────────────────────────────────────────
  const balanceKES = walletBalanceCents !== null ? walletBalanceCents / 100 : 0;
  const isInsufficientBalance = budgetNum > 0 && budgetNum > balanceKES;

  // ── Activate Boost Handler ────────────────────────────────────────────────
  const handleActivate = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (isNaN(budgetNum) || budgetNum < 10) {
      setErrorMsg('Minimum boost budget is KES 10.00');
      return;
    }
    if (effectiveDays < 1 || effectiveDays > 30) {
      setErrorMsg('Boost duration must be between 1 and 30 days');
      return;
    }
    if (isInsufficientBalance) {
      setErrorMsg(`Insufficient wallet balance. Top up KES ${(budgetNum - balanceKES).toFixed(2)} to continue.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/boost/activate', {
        budgetKes: budgetNum,
        durationDays: effectiveDays,
      });

      if (res.data?.success) {
        setSuccessMsg(`⚡ Boost Activated! Your content now has a ${res.data.boost.boostStrength}× reach multiplier.`);
        await fetchData();
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to activate boost. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={a11yRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-(--z-modal) bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#0f1015] border border-white/20 w-full max-w-[750px] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative text-white font-sans"
        >
          {/* Header */}
          <div className="p-5 md:p-6 border-b border-white/10 flex items-center justify-between bg-[#141622]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Zap size={20} className="text-amber-400" fill="currentColor" />
              </div>
              <div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase leading-none text-white drop-shadow-sm">Sparkle Boost Connect</h2>
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest italic mt-1">Algorithmic Reach & Priority Syndication</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Tab Selector */}
              <div className="flex bg-black/60 p-1 rounded-xl border border-white/15">
                <button
                  onClick={() => setActiveTab('boost')}
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider italic transition-all ${
                    activeTab === 'boost' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Boost Engine
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider italic transition-all flex items-center gap-1.5 ${
                    activeTab === 'history' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <History size={12} /> History
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Content Body */}
          <div className="p-5 md:p-6 space-y-6 overflow-y-auto max-h-[80vh]">
            {activeTab === 'boost' ? (
              <>
                {/* ── ACTIVE BOOST CARD ── */}
                {activeBoost ? (
                  <div className="bg-gradient-to-r from-amber-950/60 via-[#181926] to-[#141520] border-2 border-amber-500/40 rounded-2xl p-5 relative overflow-hidden space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/50 rounded-full text-amber-300 text-[10px] font-black uppercase tracking-widest italic animate-pulse mb-2">
                          <Zap size={12} fill="currentColor" /> {activeBoost.boostStrength}× Boost Active
                        </div>
                        <h3 className="text-lg font-black italic uppercase tracking-tight text-white">Active Reach Multiplier</h3>
                      </div>

                      <div className="bg-black/70 border border-white/20 px-4 py-2 rounded-xl text-right">
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic block">Time Remaining</span>
                        <span className="text-base font-black text-amber-400 font-mono italic">{countdownText || 'Calculating...'}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-black text-slate-300 uppercase italic">
                        <span>Campaign Timeline</span>
                        <span className="text-white">{activeBoost.progressPercent}% Completed</span>
                      </div>
                      <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-1000"
                          style={{ width: `${activeBoost.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats summary */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
                      <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                        <span className="text-[8px] font-black text-slate-300 uppercase italic block">Total Budget</span>
                        <span className="text-sm font-black text-white italic">KES {activeBoost.budgetKes}</span>
                      </div>
                      <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                        <span className="text-[8px] font-black text-slate-300 uppercase italic block">Daily Rate</span>
                        <span className="text-sm font-black text-white italic">KES {(activeBoost.budgetKes / activeBoost.durationDays).toFixed(1)}/d</span>
                      </div>
                      <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                        <span className="text-[8px] font-black text-slate-300 uppercase italic block">Est. Impressions</span>
                        <span className="text-sm font-black text-amber-400 italic">~{activeBoost.projectedTotalReach.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* ── QUICK PLAN SHORTCUTS ── */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Quick Plan Shortcuts</span>
                    <span className="text-[9px] font-black text-amber-400 uppercase italic">Fixed Weekly Tiers</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { name: 'Nano', budget: 99, days: 7, mult: '2.3× Reach', desc: 'Standard visibility boost' },
                      { name: 'Viral', budget: 499, days: 7, mult: '4.0× Reach', desc: 'High priority feed placement', popular: true },
                      { name: 'Matrix', budget: 999, days: 7, mult: '5.2× Reach', desc: 'Maximum algorithmic push' },
                    ].map((plan) => {
                      const isSelected = budgetNum === plan.budget && effectiveDays === plan.days && !isCustomDaysActive;
                      return (
                        <div
                          key={plan.name}
                          onClick={() => applyPreset(plan.budget, plan.days)}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg'
                              : 'bg-white/10 border-white/15 hover:border-white/30 text-slate-200'
                          }`}
                        >
                          {plan.popular && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-black px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider italic shadow-md">
                              Most Popular
                            </span>
                          )}

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="text-xs font-black uppercase italic tracking-widest text-white">{plan.name}</h4>
                              <span className="text-[9px] font-black text-amber-400 italic">{plan.mult}</span>
                            </div>
                            <p className="text-2xl font-black italic tracking-tight text-white">KES {plan.budget}</p>
                            <p className="text-[9px] text-slate-300 font-bold uppercase italic mt-0.5">{plan.days} Days Duration</p>
                          </div>

                          <p className="text-[9px] text-slate-400 font-semibold italic mt-3 pt-2 border-t border-white/10">
                            {plan.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── CUSTOM BUDGET & DURATION CONTROLS ── */}
                <div className="bg-white/10 border border-white/15 p-5 rounded-2xl space-y-5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-wider italic text-white">Custom Campaign Parameters</h3>
                    <span className="text-[9px] font-black text-slate-300 uppercase italic">Minimum KES 10.00</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Budget Input */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic block">
                        Total Campaign Budget (KES)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">KES</span>
                        <input
                          type="number"
                          min="10"
                          value={budgetInput}
                          onChange={(e) => {
                            setBudgetInput(e.target.value);
                            setErrorMsg('');
                          }}
                          placeholder="e.g. 500"
                          className="w-full bg-[#181a24] border border-slate-700 rounded-xl py-3 pl-14 pr-4 text-white font-black italic text-lg focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Duration Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic block">
                        Campaign Duration (Days)
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[1, 3, 7, 14, 30].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setDurationInput(d);
                              setIsCustomDaysActive(false);
                            }}
                            className={`py-3 rounded-xl text-xs font-black italic transition-all border ${
                              !isCustomDaysActive && durationInput === d
                                ? 'bg-amber-500 text-black border-amber-500 shadow-md'
                                : 'bg-[#181a24] border-slate-700 text-white hover:border-slate-500'
                            }`}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* LIVE CALCULATION DISPLAY */}
                  <div className="bg-[#141520] border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic block">Calculated Boost Multiplier</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-amber-400 italic tracking-tight">{calculatedStrength}× Multiplier</span>
                          <span className="text-[9px] font-black text-slate-300 uppercase italic">
                            (KES {(budgetNum / (effectiveDays || 1)).toFixed(1)}/day)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic block">Projected Total Impressions</span>
                      <span className="text-lg font-black text-white italic">~{projectedReach.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* ── WALLET BALANCE & ACTION ── */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs font-black italic uppercase">
                    <span className="text-slate-300">Available Creator Wallet Balance:</span>
                    <span className={isInsufficientBalance ? 'text-red-400' : 'text-emerald-400'}>
                      KES {balanceKES.toFixed(2)}
                    </span>
                  </div>

                  {/* HIGH VISIBILITY INSUFFICIENT FUNDS WARNING */}
                  {isInsufficientBalance && (
                    <div className="p-4 bg-red-950/90 border-2 border-red-500/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white shadow-xl">
                      <div className="flex items-center gap-2.5">
                        <AlertCircle size={20} className="text-red-400 shrink-0" />
                        <div>
                          <p className="font-black text-white text-xs uppercase tracking-wide italic">Insufficient Funds</p>
                          <p className="text-[11px] text-red-200 font-bold leading-tight mt-0.5">
                            Your wallet has KES {balanceKES.toFixed(2)}. Need KES {(budgetNum - balanceKES).toFixed(2)} more.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          window.location.href = '/professional-dashboard';
                        }}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest italic transition-all shadow-md shrink-0 border border-red-400"
                      >
                        Top Up Wallet
                      </button>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-red-200 text-xs font-bold flex items-center gap-2">
                      <AlertCircle size={16} className="text-red-400" /> {errorMsg}
                    </div>
                  )}

                  {successMsg && (
                    <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400" /> {successMsg}
                    </div>
                  )}

                  <button
                    disabled={submitting || isInsufficientBalance || budgetNum < 10}
                    onClick={handleActivate}
                    className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest italic shadow-xl transition-all flex items-center justify-center gap-2 ${
                      submitting || isInsufficientBalance || budgetNum < 10
                        ? 'bg-white/10 text-slate-400 cursor-not-allowed border border-white/10'
                        : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20 active:scale-[0.99]'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Activating Boost...
                      </>
                    ) : (
                      <>
                        <Zap size={16} fill="currentColor" /> {activeBoost ? 'Top Up / Extend Boost' : 'Pay & Activate Boost'} (KES {budgetNum || 0})
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* ── HISTORY TAB ── */
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-wider italic text-white">Previous Boost Campaigns</h3>
                  <button
                    onClick={fetchHistory}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                  >
                    <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {historyLoading ? (
                  <div className="text-center py-12 text-slate-300 text-xs font-black uppercase italic animate-pulse">
                    Loading boost history...
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-12 bg-white/10 rounded-2xl border border-white/15 space-y-2">
                    <Zap size={32} className="text-slate-400 mx-auto" />
                    <p className="text-xs font-black text-white uppercase italic">No Boost Campaigns Yet</p>
                    <p className="text-[10px] text-slate-300 font-semibold italic">Activate your first campaign to ignite post reach across Sparkle!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {history.map((item) => {
                      const isActive = item.status === 'active';
                      return (
                        <div
                          key={item.boostId}
                          className="bg-white/10 border border-white/15 p-4 rounded-xl flex items-center justify-between hover:border-white/30 transition-all text-white"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                              isActive ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-white/10 border-white/15 text-slate-300'
                            }`}>
                              <Zap size={16} fill={isActive ? 'currentColor' : 'none'} />
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-white italic">KES {item.budgetKes}</span>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider italic ${
                                  isActive
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-white/15 text-slate-300'
                                }`}>
                                  {item.status} ({item.boostStrength}×)
                                </span>
                              </div>
                              <p className="text-[9px] font-semibold text-slate-300 italic mt-0.5">
                                {item.durationDays} day(s) · Started {new Date(item.startTime).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              applyPreset(item.budgetKes, item.durationDays);
                              setActiveTab('boost');
                            }}
                            className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[9px] font-black uppercase tracking-wider italic transition-all flex items-center gap-1 border border-white/10"
                          >
                            Renew <ArrowRight size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
