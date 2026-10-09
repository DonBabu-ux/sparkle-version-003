import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Calendar, Sliders, ShieldCheck, CheckCircle2, Smartphone, Building2, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../api/api';
import { logger } from '../../utils/logger';
import { useModalA11y } from '../../hooks/useModalA11y';

interface AutoWithdrawalConfig {
  config_id?: string;
  wallet_id?: string;
  is_enabled: boolean | number;
  mode: 'threshold' | 'scheduled' | 'hybrid';
  threshold_cents: number;
  schedule_frequency: 'daily' | 'weekly' | 'monthly';
  method: 'mpesa' | 'bank';
  account_name?: string | null;
  account_number?: string | null;
  bank_code?: string | null;
  phone?: string | null;
  last_executed_at?: string | null;
  next_scheduled_at?: string | null;
}

interface AutoWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialConfig?: AutoWithdrawalConfig | null;
}

export function AutoWithdrawalModal({
  isOpen,
  onClose,
  onSaved,
  initialConfig
}: AutoWithdrawalModalProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [mode, setMode] = useState<'threshold' | 'scheduled' | 'hybrid'>('threshold');
  const [thresholdKES, setThresholdKES] = useState('5000');
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [method, setMethod] = useState<'mpesa' | 'bank'>('mpesa');
  const [phone, setPhone] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const a11yRef = useModalA11y(isOpen, onClose);

  // Fetch current config on open
  useEffect(() => {
    if (!isOpen) return;

    const loadConfig = async () => {
      setFetching(true);
      setError('');
      try {
        const res = await api.get('/wallet/auto-withdrawal');
        if (res.data?.config) {
          const cfg: AutoWithdrawalConfig = res.data.config;
          setIsEnabled(Boolean(cfg.is_enabled));
          setMode(cfg.mode || 'threshold');
          setThresholdKES(String((cfg.threshold_cents || 500000) / 100));
          setScheduleFrequency(cfg.schedule_frequency || 'weekly');
          setMethod(cfg.method || 'mpesa');
          setPhone(cfg.phone || '');
          setAccountName(cfg.account_name || '');
          setAccountNumber(cfg.account_number || '');
          setBankCode(cfg.bank_code || '');
          setConsentConfirmed(Boolean(cfg.is_enabled));
        } else if (initialConfig) {
          setIsEnabled(Boolean(initialConfig.is_enabled));
          setMode(initialConfig.mode || 'threshold');
          setThresholdKES(String((initialConfig.threshold_cents || 500000) / 100));
          setScheduleFrequency(initialConfig.schedule_frequency || 'weekly');
          setMethod(initialConfig.method || 'mpesa');
          setPhone(initialConfig.phone || '');
          setAccountName(initialConfig.account_name || '');
          setAccountNumber(initialConfig.account_number || '');
          setBankCode(initialConfig.bank_code || '');
          setConsentConfirmed(Boolean(initialConfig.is_enabled));
        }
      } catch (err: any) {
        logger.error('Failed to load auto-withdrawal config:', err);
      } finally {
        setFetching(false);
      }
    };

    loadConfig();
  }, [isOpen, initialConfig]);

  const handleSave = async () => {
    setError('');
    setSuccessMsg('');

    if (isEnabled && !consentConfirmed) {
      setError('You must confirm the automatic payout terms & agreement to enable automated withdrawals.');
      return;
    }

    if (isEnabled && method === 'mpesa' && !phone.trim()) {
      setError('Please provide a valid M-Pesa phone number for payouts.');
      return;
    }

    if (isEnabled && method === 'bank' && (!accountNumber.trim() || !bankCode.trim())) {
      setError('Please provide bank account number and bank code.');
      return;
    }

    const thresholdCents = Math.round((parseFloat(thresholdKES) || 0) * 100);

    setLoading(true);
    try {
      await api.post('/wallet/auto-withdrawal', {
        isEnabled,
        mode,
        thresholdCents,
        scheduleFrequency,
        method,
        accountName: accountName.trim() || null,
        accountNumber: accountNumber.trim() || null,
        bankCode: bankCode.trim() || null,
        phone: phone.trim() || null,
        consentConfirmed
      });

      setSuccessMsg('Automated withdrawal settings updated successfully.');
      onSaved();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div ref={a11yRef} role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-white shrink-0 relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                <Zap className="w-5 h-5 text-amber-100" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-white">Automated Payout Engine</h3>
                <p className="text-xs text-amber-100/90 font-medium">Auto-withdraw Professional Dashboard funds securely</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
            {fetching ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <p className="text-xs font-bold uppercase tracking-wider">Loading Configuration...</p>
              </div>
            ) : (
              <>
                {/* Global Toggle */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Enable Auto-Payouts</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Funds will automatically transfer when rules trigger</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEnabled(!isEnabled)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isEnabled ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-5"
                  >
                    {/* Mode Selection */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wide mb-2">
                        Withdrawal Rule / Strategy
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setMode('threshold')}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            mode === 'threshold'
                              ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20 text-slate-900'
                              : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          <Sliders className={`w-4 h-4 mb-1 ${mode === 'threshold' ? 'text-amber-600' : 'text-slate-400'}`} />
                          <div className="text-xs font-black">Threshold</div>
                          <div className="text-[10px] text-slate-500">When balance reaches limit</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMode('scheduled')}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            mode === 'scheduled'
                              ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20 text-slate-900'
                              : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          <Calendar className={`w-4 h-4 mb-1 ${mode === 'scheduled' ? 'text-amber-600' : 'text-slate-400'}`} />
                          <div className="text-xs font-black">Scheduled</div>
                          <div className="text-[10px] text-slate-500">Daily / Weekly / Monthly</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMode('hybrid')}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            mode === 'hybrid'
                              ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20 text-slate-900'
                              : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          <Zap className={`w-4 h-4 mb-1 ${mode === 'hybrid' ? 'text-amber-600' : 'text-slate-400'}`} />
                          <div className="text-xs font-black">Hybrid</div>
                          <div className="text-[10px] text-slate-500">Schedule + Threshold</div>
                        </button>
                      </div>
                    </div>

                    {/* Threshold Input */}
                    {(mode === 'threshold' || mode === 'hybrid') && (
                      <div>
                        <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wide mb-1.5">
                          Minimum Threshold (KES)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                            KES
                          </span>
                          <input
                            type="number"
                            value={thresholdKES}
                            onChange={(e) => setThresholdKES(e.target.value)}
                            placeholder="5000"
                            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">
                          Auto-payout initiates as soon as available balance reaches KES {Number(thresholdKES || 0).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {/* Schedule Frequency Input */}
                    {(mode === 'scheduled' || mode === 'hybrid') && (
                      <div>
                        <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wide mb-1.5">
                          Payout Frequency
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                            <button
                              key={freq}
                              type="button"
                              onClick={() => setScheduleFrequency(freq)}
                              className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                                scheduleFrequency === freq
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {freq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment Method & Details */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wide mb-1.5">
                        Destination Payout Method
                      </label>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setMethod('mpesa')}
                          className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-bold text-xs transition-all ${
                            method === 'mpesa'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Smartphone size={16} className="text-emerald-500" />
                          M-Pesa Express
                        </button>
                        <button
                          type="button"
                          onClick={() => setMethod('bank')}
                          className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-bold text-xs transition-all ${
                            method === 'bank'
                              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Building2 size={16} className="text-blue-500" />
                          Bank Transfer
                        </button>
                      </div>

                      {method === 'mpesa' ? (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            M-Pesa Phone Number
                          </label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="0712345678 or +254712345678"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-500 outline-none"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Account Holder Name
                            </label>
                            <input
                              type="text"
                              value={accountName}
                              onChange={(e) => setAccountName(e.target.value)}
                              placeholder="e.g. John Doe"
                              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Bank Code
                              </label>
                              <input
                                type="text"
                                value={bankCode}
                                onChange={(e) => setBankCode(e.target.value)}
                                placeholder="e.g. 01"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Account Number
                              </label>
                              <input
                                type="text"
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                placeholder="123456789"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Terms Consent */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="autoWithdrawalConsent"
                        checked={consentConfirmed}
                        onChange={(e) => setConsentConfirmed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 shrink-0 cursor-pointer"
                      />
                      <label htmlFor="autoWithdrawalConsent" className="text-[11px] text-slate-600 leading-snug cursor-pointer select-none">
                        <strong className="text-slate-800">Automatic Payout Agreement:</strong> I authorize Sparkle to automatically transfer available Professional Dashboard funds to my specified payment destination whenever the selected withdrawal rules are satisfied.
                      </label>
                    </div>
                  </motion.div>
                )}

                {/* Security Note */}
                <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-100/60 p-3 rounded-xl">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>Atomic balance locking and idempotency protection active on all automated payouts.</span>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-bold text-red-600">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Success Banner */}
                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-600">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || fetching}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-500/25 flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Save Auto-Payout Settings
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
