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
    <div className="min-h-dvh bg-[#f8e7ed] text-[#18181b] dark:bg-zinc-900 dark:text-zinc-100 font-sans pb-16 relative">
      <style>{`
        .glass-card { background: #fdf8fa; border: 1px solid #e6d8e1; }
        .dark .glass-card { background: #27272a; border-color: #3f3f46; }
        .glass-card--pink { border-color: rgba(255, 20, 147, 0.25); }
        .dark .glass-card--pink { border-color: rgba(255, 20, 147, 0.3); }
      `}</style>

      {/* Header */}
      <div className="bg-[#fdf8fa] dark:bg-zinc-800 border-b border-[#e6d8e1] dark:border-zinc-700 px-4 py-3 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-[#18181b] dark:text-zinc-100" strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-black text-[#18181b] dark:text-zinc-100 tracking-tighter italic uppercase leading-none">Sparkle AdManager</h1>
              <p className="text-[8px] font-black text-[#ff1493] uppercase tracking-widest italic mt-0.5">Campus campaigns in KES</p>
            </div>
          </div>
          <button onClick={fetchWallet} className="p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-full transition-colors text-slate-600 dark:text-zinc-300">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Campaigns */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-[#ff1493] rounded-2xl flex items-center justify-center shadow-md">
                <Megaphone size={16} className="text-white" />
              </div>
              <div>
                  <h2 className="text-base font-black text-[#18181b] dark:text-zinc-100 italic uppercase leading-none">Ad Campaigns</h2>
                  <p className="text-[9px] text-slate-600 dark:text-zinc-300 font-bold uppercase italic tracking-wider mt-0.5">Reach students on Sparkle</p>
              </div>
            </div>

              <div className="p-5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl">
                <p className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase italic">Campaigns aren't available yet</p>
                <p className="text-xs text-amber-800 dark:text-amber-300/80 font-medium leading-relaxed mt-1.5">
                You can't create or run ad campaigns right now, and nothing will be charged.
                To reach more students today, boost a post from your profile or list an item on Marketplace.
              </p>
            </div>
          </div>

          {/* Campaigns list */}
          <div className="glass-card rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-[#18181b] dark:text-zinc-100 italic uppercase">My Campaigns</h3>
            <div className="p-8 text-center bg-[#f6eef3] dark:bg-zinc-900 border border-dashed border-[#e6d8e1] dark:border-zinc-700 rounded-2xl">
              <Megaphone size={28} className="text-slate-600 dark:text-zinc-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-zinc-300">No campaigns yet.</p>
              <p className="text-[10px] text-slate-600 dark:text-zinc-300 font-medium mt-1">Campaign creation isn't available yet.</p>
            </div>
          </div>
        </div>

        {/* Right: Wallet + Info */}
        <div className="space-y-5">
          {/* Wallet panel */}
          <div className="glass-card glass-card--pink rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div>
                <span className="text-[9px] font-black text-slate-600 dark:text-zinc-300 uppercase italic tracking-widest">Available Balance</span>
                <p className="text-3xl font-black text-[#18181b] dark:text-zinc-100 italic mt-1">
                  KES {loading ? '...' : balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <button onClick={() => navigate('/professional-dashboard')}
                className="w-full py-2.5 bg-[#ff1493] hover:bg-[#e0127f] text-white text-[10px] font-black uppercase tracking-widest italic rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                <Plus size={12} /> Add Funds via Wallet
              </button>
            </div>
          </div>

          {/* Planned objectives */}
          <div className="glass-card rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#18181b] dark:text-zinc-100 italic uppercase flex items-center gap-2">
              <Target size={16} className="text-[#ff1493]" /> Planned Objectives
            </h3>
            <div className="space-y-4">
              {[
                { title: 'Reach', desc: 'Show a post to more students in the explore feed.' },
                { title: 'Clicks', desc: 'Send students to a link or marketplace shop.' },
                { title: 'Followers', desc: 'Help more students find and follow your profile.' },
              ].map((obj, i) => (
                <div key={i} className="space-y-1">
                  <h4 className="text-[10px] font-black text-[#18181b] dark:text-zinc-100 uppercase italic flex items-center gap-1.5">
                    <Play size={10} className="text-[#ff1493]" fill="currentColor" /> {obj.title}
                  </h4>
                  <p className="text-[10px] text-slate-600 dark:text-zinc-300 font-medium leading-normal pl-3.5">{obj.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Boost tip */}
          <div className="glass-card glass-card--pink rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-amber-500" fill="currentColor" />
              <span className="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase italic">Pro Tip</span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-zinc-300 font-medium leading-relaxed">
              Boost a post from your profile to reach more students right away.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}



