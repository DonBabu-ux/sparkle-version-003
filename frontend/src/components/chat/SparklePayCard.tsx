import React, { useState } from 'react';
import { CreditCard, ShieldCheck, Copy, Check } from 'lucide-react';

export type WalletEventType = 'topup' | 'subscription' | 'merchant' | 'refund';

export interface SparklePayCardProps {
  eventType?: WalletEventType;
  title: string;
  subtitle?: string;
  amount: string;
  referenceId: string;
  balance?: string;
  status?: string;
  sentAt?: string;
  payload?: any;
}

export const SparklePayCard: React.FC<SparklePayCardProps> = ({
  eventType = 'topup',
  title,
  subtitle,
  amount,
  referenceId,
  balance,
  status = 'Successful',
  sentAt,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyRef = () => {
    if (referenceId) {
      navigator.clipboard.writeText(referenceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getHeaderIcon = () => {
    return <CreditCard className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <div className="my-2.5 max-w-xl w-full rounded-2xl p-4 bg-slate-900/90 border border-emerald-500/30 backdrop-blur-xl shadow-xl transition-all">
      {/* Header Badge */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            {getHeaderIcon()}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-xs text-white tracking-wide">SparklePay</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] text-white/50 font-medium">Verified Financial Notification</span>
          </div>
        </div>
        {sentAt && (
          <span className="text-[10px] text-white/40 font-mono">
            {new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Main Details */}
      <div className="space-y-2">
        <h4 className="font-extrabold text-sm text-white tracking-tight">{title}</h4>
        {subtitle && <p className="text-xs text-white/75 font-normal leading-relaxed">{subtitle}</p>}

        <div className="my-3 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
          {/* Amount */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60 font-semibold">Amount:</span>
            <span className="text-sm font-black text-emerald-400 tracking-tight">{amount}</span>
          </div>

          {/* Reference ID */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60 font-semibold">Reference:</span>
            <button
              onClick={handleCopyRef}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 transition-all text-xs font-mono font-bold text-white tracking-wider"
              title="Click to copy reference ID"
            >
              <span>{referenceId}</span>
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-white/60" />}
            </button>
          </div>

          {/* Balance (Optional for topup/refund) */}
          {balance && (
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-xs text-white/60 font-semibold">Available Balance:</span>
              <span className="text-xs font-bold text-white">{balance}</span>
            </div>
          )}

          {/* Status */}
          {status && (
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-xs text-white/60 font-semibold">Status:</span>
              <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">{status}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
