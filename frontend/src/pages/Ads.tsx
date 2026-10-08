import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, RefreshCw, Megaphone, Plus, AlertCircle, Sparkles, CheckCircle2,
  DollarSign, Target, Play, ArrowRight, Zap
} from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import { logger } from '../utils/logger';

interface WalletSummary {
  available_balance: number;
}

interface Campaign {
  id: string;
  name: string;
  objective: string;
  budget: number;
  status: 'Active' | 'Pending' | 'Completed';
  reach: number;
  clicks: number;
  created_at: string;
}

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: '1', name: 'Freshers Welcoming Party Ad', objective: 'Reach', budget: 150000, status: 'Active', reach: 4520, clicks: 320, created_at: '2026-07-01' },
  { id: '2', name: 'Sparkle Shop Promotion', objective: 'Clicks', budget: 200000, status: 'Completed', reach: 6890, clicks: 750, created_at: '2026-06-15' },
];

function DepositPrompt({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-(--z-modal) bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-[#FF1F6D]/20">
        <div className="w-12 h-12 bg-[#FF1F6D]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <DollarSign size={24} className="text-[#FF1F6D]" />
        </div>
        <h3 className="text-lg font-black text-slate-900 italic uppercase text-center mb-2">Add Funds</h3>
        <p className="text-sm text-slate-500 font-medium text-center leading-relaxed mb-6">
          Your wallet balance is too low for this campaign budget. Top up your Creator Wallet to continue.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button onClick={() => { onClose(); navigate('/professional-dashboard'); }}
            className="flex-1 py-3 bg-gradient-to-r from-[#FF1F6D] to-[#ff6b35] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest italic shadow-md hover:scale-105 active:scale-95 transition-all">
            Go to Wallet
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Ads() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);

  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState('Reach');
  const [targetAudience, setTargetAudience] = useState('All Campuses');
  const [budgetKES, setBudgetKES] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [showDepositPrompt, setShowDepositPrompt] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.get('/wallet');
      if (res.data.wallet) setWallet(res.data.wallet);
    } catch (e) {
      logger.error('Failed to load wallet:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const balance = wallet ? wallet.available_balance / 100 : 0;
  const budgetNum = parseFloat(budgetKES) || 0;
  const isInsufficient = budgetNum > 0 && budgetNum > balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!campaignName.trim()) { setErrorMsg('Please enter a campaign name.'); return; }

    const budgetInt = parseFloat(budgetKES);
    if (isNaN(budgetInt) || budgetInt < 100000) { setErrorMsg('Minimum budget is KES 1000.00.'); return; }

    const budgetCents = Math.round(budgetInt * 100);
    if (budgetCents > (wallet?.available_balance || 0)) {
      setShowDepositPrompt(true);
      return;
    }

    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setCampaigns([{
        id: String(campaigns.length + 1),
        name: campaignName, objective,
        budget: budgetCents,
        status: 'Pending',
        reach: 0, clicks: 0,
        created_at: new Date().toISOString().split('T')[0],
      }, ...campaigns]);
      setSuccessMsg('Ad campaign created and queued for review!');
      setCampaignName(''); setBudgetKES('');
      fetchWallet();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit campaign request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#fafafd] text-slate-800 font-sans pb-16 relative">
      <style>{`
        .glass-card { background: #ffffff; border: 1px solid rgba(255, 31, 109, 0.12); }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-slate-800" strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tighter italic uppercase leading-none">Sparkle AdManager</h1>
              <p className="text-[8px] font-black text-[#FF1F6D] uppercase tracking-widest italic mt-0.5">Campus campaign syndication · KES</p>
            </div>
          </div>
          <button onClick={fetchWallet} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Campaign Creator */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-[#FF1F6D] to-[#ff6b35] rounded-2xl flex items-center justify-center shadow-md">
                <Megaphone size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 italic uppercase leading-none">Launch Ad Campaign</h2>
                <p className="text-[9px] text-slate-500 font-bold uppercase italic tracking-wider mt-0.5">Reach students on Sparkle</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic mb-1.5 block">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Campus Store Launch Special"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-[#FF1F6D]/40 text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic mb-1.5 block">Campaign Objective</label>
                  <select value={objective} onChange={(e) => setObjective(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-[#FF1F6D]/40 text-slate-700">
                    <option value="Reach">Reach Expansion</option>
                    <option value="Clicks">Click-through</option>
                    <option value="Followers">Follower Generation</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic mb-1.5 block">Target Audience</label>
                  <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-[#FF1F6D]/40 text-slate-700">
                    <option>All Campuses</option>
                    <option>Main Campus</option>
                    <option>School of Business</option>
                    <option>Tech Hubs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic mb-1.5 block">Ad Budget (KES)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-bold text-sm">KES</div>
                  <input type="number" step="0.01" min="10" placeholder="0.00"
                    value={budgetKES} onChange={(e) => setBudgetKES(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-black focus:outline-none focus:border-[#FF1F6D]/40 text-slate-800 placeholder-slate-400"
                  />
                </div>
                {budgetKES && (
                  <p className={`text-[10px] font-bold mt-1.5 ${isInsufficient ? 'text-red-500' : 'text-emerald-600'}`}>
                    {isInsufficient
                      ? `⚠ Budget exceeds wallet balance (KES ${balance.toFixed(2)} available)`
                      : `✓ KES ${balance.toFixed(2)} available in wallet`}
                  </p>
                )}
              </div>

              {isInsufficient && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-red-600 uppercase italic">Insufficient Funds</p>
                    <p className="text-[9px] text-red-500 font-medium leading-normal mt-0.5">
                      Top up your Sparkle Creator Wallet to run this campaign.
                    </p>
                    <button type="button" onClick={() => setShowDepositPrompt(true)}
                      className="mt-2 text-[9px] font-black text-[#FF1F6D] uppercase italic hover:underline flex items-center gap-1">
                      Top Up Wallet <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} /> {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-600 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={14} /> {successMsg}
                </div>
              )}

              <button type="submit"
                disabled={submitting || isInsufficient || !campaignName || !budgetKES}
                className="w-full py-3.5 bg-gradient-to-r from-[#FF1F6D] to-[#ff6b35] text-white text-[10px] font-black uppercase tracking-widest italic rounded-2xl shadow-lg shadow-[#FF1F6D]/20 flex items-center justify-center gap-2 disabled:opacity-40 hover:scale-105 active:scale-95 transition-all">
                {submitting ? <Spinner size="small" color="text-white" /> : <><Sparkles size={14} /> Launch Campaign</>}
              </button>
            </form>
          </div>

          {/* Active Campaigns */}
          <div className="glass-card rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 italic uppercase">My Campaigns</h3>
            <div className="space-y-3">
              {campaigns.map((c) => (
                <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#FF1F6D]">
                      <Megaphone size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase italic leading-none">{c.name}</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase italic mt-1.5">
                        {c.objective} · KES {(c.budget / 100).toLocaleString()} · {c.created_at}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      c.status === 'Active'     ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                      c.status === 'Pending'    ? 'bg-amber-50 border-amber-200 text-amber-600' :
                                                  'bg-slate-100 border-slate-300 text-slate-600'
                    }`}>{c.status}</span>
                    {(c.status === 'Active' || c.status === 'Completed') && (
                      <span className="text-[9px] font-bold text-slate-400">
                        {c.reach.toLocaleString()} reach · {c.clicks.toLocaleString()} clicks
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Wallet + Objective Info */}
        <div className="space-y-5">
          {/* Wallet panel */}
          <div className="rounded-3xl p-6 shadow-sm relative overflow-hidden border border-[#FF1F6D]/15"
            style={{ background: 'linear-gradient(135deg, #fff0f6 0%, #ffffff 100%)' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF1F6D] rounded-full blur-[60px] opacity-10 pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase italic tracking-widest">Available Balance</span>
                <p className="text-3xl font-black text-slate-900 italic mt-1">
                  KES {loading ? '...' : balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <button onClick={() => navigate('/professional-dashboard')}
                className="w-full py-2.5 bg-gradient-to-r from-[#FF1F6D] to-[#ff6b35] text-white text-[10px] font-black uppercase tracking-widest italic rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                <Plus size={12} /> Add Funds via Wallet
              </button>
            </div>
          </div>

          {/* Objectives info */}
          <div className="glass-card rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 italic uppercase flex items-center gap-2">
              <Target size={16} className="text-[#FF1F6D]" /> Objectives Guide
            </h3>
            <div className="space-y-4">
              {[
                { title: 'Reach', desc: 'Amplify post delivery on the student explore feed.' },
                { title: 'Clicks', desc: 'Drive external link or marketplace shop traffic.' },
                { title: 'Followers', desc: 'Target cohorts to expand your follower base.' },
              ].map((obj, i) => (
                <div key={i} className="space-y-1">
                  <h4 className="text-[10px] font-black text-slate-800 uppercase italic flex items-center gap-1.5">
                    <Play size={10} className="text-[#FF1F6D]" fill="currentColor" /> {obj.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-normal pl-3.5">{obj.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Boost tip */}
          <div className="glass-card rounded-3xl p-5 shadow-sm border-[#FF1F6D]/15" style={{ background: 'linear-gradient(135deg, #fff7f0, #fff)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-amber-500" fill="currentColor" />
              <span className="text-[9px] font-black text-slate-700 uppercase italic">Pro Tip</span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              Combine an Ad Campaign with a Boost Post for maximum viral index amplification across the Sparkle student network.
            </p>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showDepositPrompt && <DepositPrompt onClose={() => setShowDepositPrompt(false)} />}
      </AnimatePresence>
    </div>
  );
}
