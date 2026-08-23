import React from 'react';
import { Sparkles, CheckCircle2, ShieldCheck, CreditCard } from 'lucide-react';

interface OfficialAccountBannerProps {
  displayName?: string;
  badge?: string;
  accountType?: 'official' | 'sparkle_pay' | string;
}

export const OfficialAccountBanner: React.FC<OfficialAccountBannerProps> = ({
  displayName,
  badge = 'Verified by Sparkle',
  accountType = 'official',
}) => {
  const isSparklePay = accountType === 'sparkle_pay' || displayName?.toLowerCase().includes('pay');

  if (isSparklePay) {
    return (
      <div className="mx-4 my-4 p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(16,185,129,0.15)] text-slate-100 transition-all duration-300">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-extrabold text-sm tracking-wide text-white">{displayName || 'SparklePay'}</h4>
              <ShieldCheck className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
            </div>
            <p className="text-[11px] font-semibold text-emerald-400">{badge}</p>
          </div>
        </div>

        <div className="space-y-1.5 my-3 pt-2 border-t border-emerald-500/20 text-xs text-slate-300">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">You'll receive:</p>
          <div className="grid grid-cols-2 gap-2 text-xs font-medium">
            <div className="flex items-center gap-1.5 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Wallet top-ups</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Subscription updates</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Payment receipts</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Refund notifications</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Replies aren't available.</span>
          <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">Verified Financial Sender</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 my-4 p-4 rounded-2xl bg-slate-900/60 border border-rose-500/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(244,63,94,0.15)] text-slate-100 transition-all duration-300">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/25 shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="font-extrabold text-sm tracking-wide text-white">{displayName || 'Official Sparkle Account'}</h4>
            <ShieldCheck className="w-4 h-4 text-sky-400 fill-sky-400/20" />
          </div>
          <p className="text-[11px] font-semibold text-rose-400">{badge}</p>
        </div>
      </div>

      <div className="space-y-1.5 my-3 pt-2 border-t border-rose-500/20 text-xs text-slate-300">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">You'll receive:</p>
        <div className="grid grid-cols-2 gap-2 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Security alerts</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Feature updates</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Official communications</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Announcements</span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between text-[11px]">
        <span className="text-slate-400 font-medium">Replies aren't available.</span>
        <span className="text-rose-400 font-bold uppercase tracking-wider text-[10px]">Official Channel</span>
      </div>
    </div>
  );
};
