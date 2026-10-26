import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { ArrowLeft, RefreshCw, Megaphone, Plus, Target, Play, Zap } from 'lucide-react';
import { logger } from '../utils/logger';

interface WalletSummary {
  available_balance: number;
}

export default function Ads() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);

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

  return (
    <div className="min-h-dvh bg-[#fdf2f4] text-slate-800 font-sans pb-16 relative">
      <style>{`
        .glass-card { background: #ffffff; border: 1px solid rgba(255, 31, 109, 0.12); }
        .dark .glass-card { background: #1b1b24; border-color: rgba(255, 31, 109, 0.25); }
      `}</style>

      {/* Header */}
      <div className="bg-white dark:bg-[#1b1b24] border-b border-slate-100 px-4 py-3 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-slate-800" strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tighter italic uppercase leading-none">Sparkle AdManager</h1>
              <p className="text-[8px] font-black text-[#FF1F6D] uppercase tracking-widest italic mt-0.5">Campus campaigns in KES</p>
            </div>
          </div>
          <button onClick={fetchWallet} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 dark:text-zinc-300">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Campaigns */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-[#FF1F6D] to-[#ff6b35] rounded-2xl flex items-center justify-center shadow-md">
                <Megaphone size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 italic uppercase leading-none">Ad Campaigns</h2>
                <p className="text-[9px] text-slate-500 dark:text-zinc-400 font-bold uppercase italic tracking-wider mt-0.5">Reach students on Sparkle</p>
              </div>
            </div>

            <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl">
              <p className="text-sm font-black text-amber-900 uppercase italic">Campaigns aren't available yet</p>
              <p className="text-xs text-amber-800 font-medium leading-relaxed mt-1.5">
                You can't create or run ad campaigns right now, and nothing will be charged.
                To reach more students today, boost a post from your profile or list an item on Marketplace.
              </p>
            </div>
          </div>

          {/* Campaigns list */}
          <div className="glass-card rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 italic uppercase">My Campaigns</h3>
            <div className="p-8 text-center bg-slate-50 dark:bg-[#101217] border border-dashed border-slate-200 rounded-2xl">
              <Megaphone size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">No campaigns yet.</p>
              <p className="text-[10px] text-slate-400 font-medium mt-1">Campaign creation isn't available yet.</p>
            </div>
          </div>
        </div>

        {/* Right: Wallet + Info */}
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

          {/* Planned objectives */}
          <div className="glass-card rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 italic uppercase flex items-center gap-2">
              <Target size={16} className="text-[#FF1F6D]" /> Planned Objectives
            </h3>
            <div className="space-y-4">
              {[
                { title: 'Reach', desc: 'Show a post to more students in the explore feed.' },
                { title: 'Clicks', desc: 'Send students to a link or marketplace shop.' },
                { title: 'Followers', desc: 'Help more students find and follow your profile.' },
              ].map((obj, i) => (
                <div key={i} className="space-y-1">
                  <h4 className="text-[10px] font-black text-slate-800 uppercase italic flex items-center gap-1.5">
                    <Play size={10} className="text-[#FF1F6D]" fill="currentColor" /> {obj.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium leading-normal pl-3.5">{obj.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Boost tip */}
          <div className="glass-card rounded-3xl p-5 shadow-sm border-[#FF1F6D]/15" style={{ background: 'linear-gradient(135deg, #fff7f0, #fff)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-amber-500" fill="currentColor" />
              <span className="text-[9px] font-black text-slate-700 dark:text-zinc-200 uppercase italic">Pro Tip</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium leading-relaxed">
              Boost a post from your profile to reach more students right away.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}



