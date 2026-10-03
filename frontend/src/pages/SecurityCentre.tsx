import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  Lock,
  Smartphone,
  Mail,
  MessageSquare,
  Key,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  EyeOff,
  Copy,
  Download,
  Clock,
  Check,
  RotateCcw,
  AtSign,
  KeyRound
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { SettingCardGroup } from '../components/settings/SettingCardGroup';
import { SettingRow } from '../components/settings/SettingRow';
import api from '../api/api';
import { appLockService } from '../services/appLock.service';

// ─── Constants ───────────────────────────────────────────────────────────────

const TIMEOUT_OPTIONS = [
  { val: 0, label: 'Immediately', badge: 'Default', desc: 'Lock as soon as you switch apps or leave Sparkle' },
  { val: 1, label: 'After 1 minute', badge: null, desc: 'Lock after 1 minute in the background' },
  { val: 5, label: 'After 5 minutes', badge: null, desc: 'Lock after 5 minutes in the background' },
  { val: 15, label: 'After 15 minutes', badge: null, desc: 'Lock after 15 minutes in the background' },
  { val: 30, label: 'After 30 minutes', badge: null, desc: 'Lock after 30 minutes in the background' },
  { val: 60, label: 'After 1 hour', badge: null, desc: 'Lock after 1 hour in the background' },
];

function getTimeoutLabel(minutes: number): string {
  const found = TIMEOUT_OPTIONS.find(o => o.val === minutes);
  if (!found) return minutes === 0 ? 'Immediately (Default)' : `After ${minutes} minutes`;
  return found.val === 0 ? 'Immediately (Default)' : found.label;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SecurityStatus {
  two_fa_active: boolean;
  totp_enabled: boolean;
  email_2fa_enabled: boolean;
  email_2fa_verified_at: string | null;
  email_masked: string | null;
  sms_2fa_enabled: boolean;
  sms_2fa_verified_at: string | null;
  phone_masked: string | null;
  phone_configured: boolean;
  backup_codes_remaining: number;
  sms_provider_available: boolean;
  security_recovery_email_masked?: string | null;
  has_password?: boolean;
  password_changed_at?: string | null;
}

interface AvailableFactors {
  has_password: boolean;
  has_email_2fa: boolean;
  email_masked: string | null;
  has_sms_2fa: boolean;
  phone_masked: string | null;
  has_recovery_codes: boolean;
  backup_codes_remaining: number;
  security_recovery_email_masked: string | null;
  requires_2fa_factor_for_removal: boolean;
}

type Modal =
  | 'app-pin-setup'
  | 'app-pin-manage'
  | 'app-pin-timeout'
  | 'email-2fa-setup'
  | 'email-2fa-disable'
  | 'sms-2fa-setup'
  | 'sms-2fa-disable'
  | 'recovery-codes-generate'
  | 'recovery-codes-display'
  | '2fa-disable-all'
  | 'alternate-email-setup'
  | null;

// ─── Helper ───────────────────────────────────────────────────────────────────

const StatusDot: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'}`}
  />
);

const FeedbackBanner: React.FC<{ type: 'success' | 'error'; message: string; onClose: () => void }> = ({
  type, message, onClose
}) => {
  const isTooManyRequests =
    message.toLowerCase().includes('too many') ||
    message.toLowerCase().includes('429') ||
    message.toLowerCase().includes('locked for') ||
    message.toLowerCase().includes('slow down');

  return (
    <div
      className={`mb-4 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold transition-all ${
        type === 'success'
          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          : isTooManyRequests
            ? 'bg-red-500/15 border-2 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-sm shadow-red-500/20'
            : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
      ) : (
        <AlertCircle className={`w-4 h-4 shrink-0 ${isTooManyRequests ? 'text-red-500 animate-pulse' : 'text-red-500'}`} />
      )}
      <span className="flex-1 leading-snug">{message}</span>
      <button onClick={onClose} className="shrink-0 hover:opacity-70 p-0.5" aria-label="Dismiss">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ─── App PIN Setup Modal ──────────────────────────────────────────────────────

interface AppPinSetupModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const AppPinSetupModal: React.FC<AppPinSetupModalProps> = ({ onSuccess, onClose }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [timeout, setTimeoutVal] = useState<number>(0); // Default: 0 (Immediately)
  const [step, setStep] = useState<'enter' | 'confirm' | 'timeout'>('enter');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleNextToConfirm = () => {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }
    setError(null);
    setStep('confirm');
  };

  const handleNextToTimeout = () => {
    if (pin !== confirmPin) {
      setError('PINs do not match. Please try again.');
      return;
    }
    setError(null);
    setStep('timeout');
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await appLockService.setupPin(pin, timeout);
      onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-[#ff1493]" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              {step === 'enter' && 'Choose App PIN'}
              {step === 'confirm' && 'Confirm App PIN'}
              {step === 'timeout' && 'Lock Automatically'}
            </h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-700/60 text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            Your PIN stays on this device only. It protects opening Sparkle and is never sent to servers.
          </div>

          {error && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
              error.toLowerCase().includes('too many')
                ? 'bg-red-500/15 border-2 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-sm shadow-red-500/20'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {step === 'enter' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Choose a 6-digit PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-center text-2xl font-bold tracking-widest text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                autoFocus
              />
              <button
                onClick={handleNextToConfirm}
                disabled={pin.length !== 6}
                className="w-full h-11 rounded-xl bg-[#ff1493] text-white text-sm font-semibold flex items-center justify-center hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Confirm your 6-digit PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-center text-2xl font-bold tracking-widest text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setStep('enter'); setConfirmPin(''); }}
                  className="flex-1 h-11 rounded-xl text-sm font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNextToTimeout}
                  disabled={confirmPin.length !== 6}
                  className="flex-1 h-11 rounded-xl bg-[#ff1493] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 'timeout' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Choose when Sparkle should lock automatically. You can change this anytime.
              </p>
              <div className="space-y-2">
                {TIMEOUT_OPTIONS.map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setTimeoutVal(opt.val)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      timeout === opt.val
                        ? 'bg-pink-500/10 border-[#ff1493] text-slate-900 dark:text-zinc-100'
                        : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/60 text-slate-700 dark:text-zinc-300 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ff1493]/15 text-[#ff1493]">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{opt.desc}</p>
                    </div>
                    {timeout === opt.val && <Check className="w-4 h-4 text-[#ff1493] shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  className="flex-1 h-11 rounded-xl text-sm font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 h-11 rounded-xl bg-[#ff1493] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Enable App PIN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Auto-Lock Timeout Modal ──────────────────────────────────────────────────

interface AutoLockTimeoutModalProps {
  currentTimeout: number;
  onSelect: (minutes: number) => Promise<void>;
  onClose: () => void;
}

const AutoLockTimeoutModal: React.FC<AutoLockTimeoutModalProps> = ({ currentTimeout, onSelect, onClose }) => {
  const [selected, setSelected] = useState(currentTimeout);
  const [saving, setSaving] = useState(false);

  const handleSave = async (minutes: number) => {
    setSelected(minutes);
    setSaving(true);
    try {
      await onSelect(minutes);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#ff1493]" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Lock Automatically</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
            Choose how long after leaving Sparkle the app should lock with your PIN.
          </p>

          {TIMEOUT_OPTIONS.map(opt => (
            <button
              key={opt.val}
              type="button"
              disabled={saving}
              onClick={() => handleSave(opt.val)}
              className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                selected === opt.val
                  ? 'bg-pink-500/10 border-[#ff1493] text-slate-900 dark:text-zinc-100'
                  : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/60 text-slate-700 dark:text-zinc-300 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{opt.label}</span>
                  {opt.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ff1493]/15 text-[#ff1493]">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{opt.desc}</p>
              </div>
              {selected === opt.val && <Check className="w-4 h-4 text-[#ff1493] shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── App PIN Manage Modal ─────────────────────────────────────────────────────

interface AppPinManageModalProps {
  onUpdate: () => void;
  onOpenTimeoutModal: () => void;
  onClose: () => void;
}

const AppPinManageModal: React.FC<AppPinManageModalProps> = ({ onUpdate, onOpenTimeoutModal, onClose }) => {
  const [timeout, setTimeoutVal] = useState<number>(0);
  const [action, setAction] = useState<'menu' | 'change' | 'disable'>('menu');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    appLockService.getLockTimeout().then(setTimeoutVal);
  }, []);

  const handleDisable = async () => {
    if (!currentPin) {
      setError('Please enter your current PIN to turn off App Lock.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await appLockService.disablePin(currentPin);
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Incorrect PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async () => {
    if (!currentPin) {
      setError('Current PIN is required.');
      return;
    }
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setError('New PIN must be exactly 6 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setError('New PINs do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await appLockService.changePin(currentPin, newPin);
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to change PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            {action === 'menu' && 'App PIN Settings'}
            {action === 'change' && 'Change App PIN'}
            {action === 'disable' && 'Turn Off App PIN'}
          </h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
              error.toLowerCase().includes('too many')
                ? 'bg-red-500/15 border-2 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-sm shadow-red-500/20'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {action === 'menu' && (
            <>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Auto-Lock Period</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{getTimeoutLabel(timeout)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTimeoutModal();
                  }}
                  className="text-xs font-semibold text-[#ff1493] hover:underline"
                >
                  Change
                </button>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => { setAction('change'); setError(null); }}
                  className="w-full h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  Change PIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    appLockService.lockNow();
                    onClose();
                  }}
                  className="w-full h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-[#ff1493]" />
                  Lock App Now
                </button>
                <button
                  type="button"
                  onClick={() => { setAction('disable'); setError(null); }}
                  className="w-full h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  Turn Off App PIN
                </button>
              </div>
            </>
          )}

          {action === 'change' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">Current PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-center font-bold tracking-widest text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">New 6-Digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-center font-bold tracking-widest text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">Confirm New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmNewPin}
                  onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-center font-bold tracking-widest text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setAction('menu'); setError(null); }}
                  className="flex-1 h-10 rounded-xl text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleChangePin}
                  disabled={loading || !currentPin || newPin.length < 4}
                  className="flex-1 h-10 rounded-xl bg-[#ff1493] text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Update PIN
                </button>
              </div>
            </div>
          )}

          {action === 'disable' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Enter your current PIN to remove local App PIN protection from this device.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">Current PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-center font-bold tracking-widest text-sm"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setAction('menu'); setError(null); }}
                  className="flex-1 h-10 rounded-xl text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={loading || !currentPin}
                  className="flex-1 h-10 rounded-xl bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Turn Off
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── OTP Input Modal ─────────────────────────────────────────────────────────

interface OTPModalProps {
  title: string;
  description: string;
  destination?: string;
  onRequest: () => Promise<void>;
  onVerify: (code: string) => Promise<void>;
  onClose: () => void;
}

const OTPModal: React.FC<OTPModalProps> = ({
  title, description, destination, onRequest, onVerify, onClose
}) => {
  const [step, setStep] = useState<'send' | 'verify'>('send');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await onRequest();
      setStep('verify');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send verification code.';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      setError('Please enter the 6-digit code from your ' + (destination ? 'email/phone' : 'device') + '.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await onVerify(code.trim());
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Verification failed. Please try again.';
      setError(msg);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-[#ff1493]" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">{description}</p>

          {destination && (
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800 text-xs font-medium text-slate-600 dark:text-zinc-300">
              Sending to: <span className="text-[#ff1493] font-semibold">{destination}</span>
            </div>
          )}

          {error && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
              error.toLowerCase().includes('too many')
                ? 'bg-red-500/15 border-2 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-sm shadow-red-500/20'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {step === 'send' && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full h-11 rounded-xl bg-[#ff1493] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-60"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {sending ? 'Sending…' : 'Send Verification Code'}
            </button>
          )}

          {step === 'verify' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-center text-xl font-bold tracking-widest text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                  autoFocus
                />
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-zinc-500 text-center">
                  Code expires in 10 minutes
                </p>
              </div>
              <button
                onClick={handleVerify}
                disabled={verifying || code.length !== 6}
                className="w-full h-11 rounded-xl bg-[#ff1493] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-60"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {verifying ? 'Verifying…' : 'Confirm'}
              </button>
              <button
                onClick={() => { setStep('send'); setCode(''); setError(null); }}
                className="w-full text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 text-center py-1 transition-colors"
              >
                Resend code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Disable 2FA with Factor Verification Modal ──────────────────────────────
// CRITICAL: Password alone CANNOT turn off 2FA when 2FA is active.
// User must verify with an enrolled factor: Email OTP, SMS OTP, or Recovery Code.

interface Disable2FAModalProps {
  title: string;
  description?: string;
  purpose?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const Disable2FAModal: React.FC<Disable2FAModalProps> = ({ title, description, purpose = '2fa_disable', onSuccess, onClose }) => {
  const [step, setStep] = useState<'choose_factor' | 'enter_code' | 'confirm_disable'>('choose_factor');
  const [factors, setFactors] = useState<AvailableFactors | null>(null);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [selectedFactor, setSelectedFactor] = useState<'email' | 'sms' | 'recovery_code'>('email');
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [destinationMasked, setDestinationMasked] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setLoadingFactors(true);
    try {
      const res = await api.get('/security/available-factors');
      if (res.data?.status === 'success') {
        const data = res.data.data as AvailableFactors;
        setFactors(data);
        // Default to first available enrolled factor
        if (data.has_email_2fa) setSelectedFactor('email');
        else if (data.has_sms_2fa) setSelectedFactor('sms');
        else if (data.has_recovery_codes) setSelectedFactor('recovery_code');
      }
    } catch {
      setError('Unable to load verification options.');
    } finally {
      setLoadingFactors(false);
    }
  };

  const handleInitiate = async (factor: 'email' | 'sms' | 'recovery_code') => {
    setSelectedFactor(factor);
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/security/transaction/initiate', {
        purpose,
        factor_type: factor
      });
      if (res.data?.status === 'success') {
        setActiveTxId(res.data.data.transaction_id);
        setDestinationMasked(res.data.data.destination_masked || null);
        setStep('enter_code');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to initiate verification.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!activeTxId || !code.trim()) {
      setError('Please enter your verification code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/security/transaction/verify', {
        transaction_id: activeTxId,
        code: code.trim(),
        factor_type: selectedFactor
      });
      if (res.data?.status === 'success') {
        setVerificationToken(res.data.data.verification_token);
        setStep('confirm_disable');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Verification failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDisable = async () => {
    if (!verificationToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/security/2fa/disable', {
        verification_token: verificationToken
      });
      if (res.data?.status === 'success') {
        onSuccess();
      } else {
        setError(res.data?.message || 'Failed to disable 2FA.');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to disable 2FA.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isTooManyStyle = (msg: string) =>
    msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('429') || msg.toLowerCase().includes('locked');

  const factorOptions = [
    { key: 'email' as const, available: !!factors?.has_email_2fa, icon: Mail, label: 'Email verification code', desc: factors?.email_masked ? `Send code to ${factors.email_masked}` : 'Send code to your email' },
    { key: 'sms' as const, available: !!factors?.has_sms_2fa, icon: MessageSquare, label: 'SMS verification code', desc: factors?.phone_masked ? `Send code to ${factors.phone_masked}` : 'Send code to your phone' },
    { key: 'recovery_code' as const, available: !!factors?.has_recovery_codes, icon: Key, label: 'Recovery backup code', desc: `${factors?.backup_codes_remaining || 0} codes remaining` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{title}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
              isTooManyStyle(error)
                ? 'bg-red-500/15 border-2 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-sm shadow-red-500/20'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              <AlertCircle className={`w-4 h-4 shrink-0 ${isTooManyStyle(error) ? 'text-red-500 animate-pulse' : 'text-red-500'}`} />
              <span className="flex-1 leading-snug">{error}</span>
            </div>
          )}

          {/* Step 1: Choose verification factor */}
          {step === 'choose_factor' && (
            <>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                {description || 'For your security, verify your identity using one of your enrolled authentication methods to turn off two-factor authentication.'}
              </p>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Your account password alone <strong>cannot</strong> turn off 2FA. This is a security protection.</span>
              </div>

              {loadingFactors ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="space-y-2">
                  {factorOptions.filter(f => f.available).map(f => (
                    <button
                      key={f.key}
                      type="button"
                      disabled={loading}
                      onClick={() => handleInitiate(f.key)}
                      className={`w-full p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all hover:border-[#ff1493]/40 hover:bg-pink-500/5 ${
                        selectedFactor === f.key && loading
                          ? 'border-[#ff1493] bg-pink-500/10'
                          : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/60'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                        <f.icon className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{f.label}</p>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{f.desc}</p>
                      </div>
                      {selectedFactor === f.key && loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#ff1493] shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600 shrink-0" />
                      )}
                    </button>
                  ))}
                  {factorOptions.filter(f => f.available).length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-4">
                      No verification factors are available. Please contact support.
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 rounded-xl text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {/* Step 2: Enter verification code */}
          {step === 'enter_code' && (
            <>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                {selectedFactor === 'recovery_code'
                  ? 'Enter one of your single-use recovery backup codes. This code will be permanently burned after use.'
                  : `A 6-digit verification code has been sent to ${destinationMasked || 'your registered contact'}. Enter it below.`
                }
              </p>

              {destinationMasked && selectedFactor !== 'recovery_code' && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800 text-xs font-medium text-slate-600 dark:text-zinc-300">
                  Sent to: <span className="text-[#ff1493] font-semibold">{destinationMasked}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  {selectedFactor === 'recovery_code' ? 'Recovery Code' : 'Verification Code'}
                </label>
                <input
                  type="text"
                  inputMode={selectedFactor === 'recovery_code' ? 'text' : 'numeric'}
                  maxLength={selectedFactor === 'recovery_code' ? 12 : 6}
                  value={code}
                  onChange={e => setCode(selectedFactor === 'recovery_code' ? e.target.value : e.target.value.replace(/\D/g, ''))}
                  placeholder={selectedFactor === 'recovery_code' ? 'XXXXX-XXXXX' : '000000'}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-center text-xl font-bold tracking-widest text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                  autoFocus
                />
                {selectedFactor !== 'recovery_code' && (
                  <p className="mt-1.5 text-[11px] text-slate-400 dark:text-zinc-500 text-center">
                    Code expires in 10 minutes
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setStep('choose_factor'); setCode(''); setError(null); }}
                  className="flex-1 h-10 rounded-xl text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={loading || !code.trim()}
                  className="flex-1 h-10 rounded-xl bg-[#ff1493] text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {loading ? 'Verifying…' : 'Verify'}
                </button>
              </div>

              {selectedFactor !== 'recovery_code' && (
                <button
                  type="button"
                  onClick={() => handleInitiate(selectedFactor)}
                  disabled={loading}
                  className="w-full text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 text-center py-1 transition-colors"
                >
                  Resend code
                </button>
              )}
            </>
          )}

          {/* Step 3: Confirm disable */}
          {step === 'confirm_disable' && (
            <>
              <div className="flex flex-col items-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 text-center mb-1">Identity verified</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 text-center leading-relaxed max-w-[250px]">
                  You've confirmed your identity. Are you sure you want to turn off two-factor authentication?
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ This will remove extra sign-in protection from your account. You can re-enable it at any time.
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-10 rounded-xl text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Keep 2FA On
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDisable}
                  disabled={loading}
                  className="flex-1 h-10 rounded-xl bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {loading ? 'Disabling…' : 'Turn Off 2FA'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Alternate Email 2FA Setup Modal ──────────────────────────────────────────

interface AlternateEmailModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const AlternateEmailModal: React.FC<AlternateEmailModalProps> = ({ onSuccess, onClose }) => {
  const [step, setStep] = useState<'enter_email' | 'verify_code'>('enter_email');
  const [email, setEmail] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/security/2fa/alternate-email/request', { email: email.trim() });
      if (res.data?.status === 'success') {
        setTxId(res.data.data.transaction_id);
        setStep('verify_code');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send verification code.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!txId || code.trim().length !== 6) {
      setError('Please enter the 6-digit code sent to your email.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/security/2fa/alternate-email/verify', {
        transaction_id: txId,
        code: code.trim()
      });
      if (res.data?.status === 'success') {
        onSuccess();
      } else {
        setError(res.data?.message || 'Verification failed.');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Verification failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isTooManyStyle = (msg: string) =>
    msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('429');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center">
              <AtSign className="w-4 h-4 text-[#ff1493]" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Use Another Email</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
              isTooManyStyle(error)
                ? 'bg-red-500/15 border-2 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-sm shadow-red-500/20'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {step === 'enter_email' && (
            <>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Enter an alternate email address to use for two-factor authentication. A 6-digit verification code will be sent to this email.
              </p>
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/30 text-[11px] text-blue-700 dark:text-blue-300">
                This email is used <strong>only</strong> for security verification codes. It won't change your primary account email or be used for login.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Alternate Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="security@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRequest}
                  disabled={loading || !email.trim()}
                  className="flex-1 h-10 rounded-xl bg-[#ff1493] text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {loading ? 'Sending…' : 'Send Code'}
                </button>
              </div>
            </>
          )}

          {step === 'verify_code' && (
            <>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Enter the 6-digit code sent to <span className="text-[#ff1493] font-semibold">{email}</span>.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-center text-xl font-bold tracking-widest text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                  autoFocus
                />
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-zinc-500 text-center">Code expires in 10 minutes</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setStep('enter_email'); setCode(''); setError(null); }} className="flex-1 h-10 rounded-xl text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors">
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={loading || code.length !== 6}
                  className="flex-1 h-10 rounded-xl bg-[#ff1493] text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {loading ? 'Verifying…' : 'Verify & Enable'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleRequest}
                disabled={loading}
                className="w-full text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 text-center py-1 transition-colors"
              >
                Resend code
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Legacy DisableModal (for non-2FA password-confirmed actions) ──────────────

interface DisableModalProps {
  title: string;
  description?: string;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}

const DisableModal: React.FC<DisableModalProps> = ({ title, description, onConfirm, onClose }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('Password is required.'); return; }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(password);
    } catch (ex: unknown) {
      const msg = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            {description || 'To remove this protection, enter your current account password to confirm.'}
          </p>
          {error && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
              error.toLowerCase().includes('too many')
                ? 'bg-red-500/15 border-2 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-sm shadow-red-500/20'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
              <span className="flex-1">{error}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Account Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl text-sm font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !password} className="flex-1 h-10 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Removing…' : 'Remove Protection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Recovery Codes Generate Modal ────────────────────────────────────────────

interface RecoveryGenerateModalProps {
  onGenerate: (password: string) => Promise<string[]>;
  onClose: () => void;
}

const RecoveryGenerateModal: React.FC<RecoveryGenerateModalProps> = ({ onGenerate, onClose }) => {
  const [step, setStep] = useState<'confirm' | 'display'>('confirm');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('Password is required.'); return; }
    setLoading(true);
    setError(null);
    try {
      const generated = await onGenerate(password);
      setCodes(generated);
      setStep('display');
    } catch (ex: unknown) {
      const msg = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to generate recovery codes.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const content = `Sparkle Recovery Codes\nGenerated: ${new Date().toLocaleString()}\n\nStore these codes somewhere safe. Each code can only be used once.\n\n${codes.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sparkle-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            {step === 'confirm' ? 'Generate Recovery Codes' : 'Your Recovery Codes'}
          </h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'confirm' && (
          <form onSubmit={handleGenerate} className="p-5 space-y-4">
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Recovery codes let you access your account if you lose access to your other verification methods. Each code can only be used once.
            </p>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
              ⚠️ Generating new codes will <strong>invalidate all previous codes</strong>.
            </div>
            {error && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
                error.toLowerCase().includes('too many')
                  ? 'bg-red-500/15 border-2 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-sm shadow-red-500/20'
                  : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
              }`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span className="flex-1">{error}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Confirm with your password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Account password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl text-sm font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors">Cancel</button>
              <button type="submit" disabled={loading || !password} className="flex-1 h-10 rounded-xl text-sm font-semibold bg-[#ff1493] text-white hover:bg-pink-600 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </form>
        )}

        {step === 'display' && (
          <div className="p-5 space-y-4">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
              ⚠️ <strong>Save these codes now.</strong> They will not be shown again. Store them somewhere only you can access.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {codes.map((code, i) => (
                <div key={i} className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 rounded-lg text-xs font-mono text-center text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                  {code}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="flex-1 h-9 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5">
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handleDownload} className="flex-1 h-9 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
            <button onClick={onClose} className="w-full h-10 rounded-xl text-sm font-semibold bg-[#ff1493] text-white hover:bg-pink-600 active:scale-95 transition-all">
              I've saved my codes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Security Centre Page ────────────────────────────────────────────────

export default function SecurityCentre() {
  const navigate = useNavigate();

  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPinConfigured, setIsPinConfigured] = useState(false);
  const [lockTimeout, setLockTimeout] = useState<number>(0); // Default: 0 (Immediately)
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<Modal>(null);
  const [sessions, setSessions] = useState<{ session_id: string; device_name: string; ip_address: string; last_active: string }[]>([]);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/security/status');
      if (res.data?.status === 'success') {
        setStatus(res.data.data);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPinStatus = useCallback(async () => {
    const enabled = await appLockService.isPinEnabled();
    setIsPinConfigured(enabled);
    if (enabled) {
      const timeout = await appLockService.getLockTimeout();
      setLockTimeout(timeout);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/users/sessions');
      const data = Array.isArray(res.data) ? res.data : (res.data?.sessions ?? []);
      setSessions(data);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    checkPinStatus();
    fetchSessions();
  }, [fetchStatus, checkPinStatus, fetchSessions]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 5000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setSuccess(null);
  };

  const closeModal = () => setActiveModal(null);

  // Email 2FA
  const handleEmailOTPRequest = async () => {
    const res = await api.post('/security/2fa/email/request');
    if (res.data?.status !== 'success') throw new Error(res.data?.message);
  };

  const handleEmailOTPVerify = async (code: string) => {
    const res = await api.post('/security/2fa/email/verify', { code });
    if (res.data?.status !== 'success') throw new Error(res.data?.message);
    closeModal();
    showSuccess('Email two-factor authentication enabled.');
    fetchStatus();
  };

  // 2FA Disable via security transaction (factor-verified)
  const handle2FADisableSuccess = () => {
    closeModal();
    showSuccess('Two-factor authentication has been turned off.');
    fetchStatus();
  };

  // Alternate email success handler
  const handleAlternateEmailSuccess = () => {
    closeModal();
    showSuccess('Alternate security email verified and email 2FA enabled.');
    fetchStatus();
  };

  // SMS 2FA
  const handleSMSOTPRequest = async () => {
    const res = await api.post('/security/2fa/sms/request');
    if (res.data?.status !== 'success') throw new Error(res.data?.message);
  };

  const handleSMSOTPVerify = async (code: string) => {
    const res = await api.post('/security/2fa/sms/verify', { code });
    if (res.data?.status !== 'success') throw new Error(res.data?.message);
    closeModal();
    showSuccess('SMS two-factor authentication enabled.');
    fetchStatus();
  };

  // Recovery codes
  const handleGenerateRecoveryCodes = async (password: string): Promise<string[]> => {
    const res = await api.post('/security/recovery-codes/generate', { password });
    if (res.data?.status !== 'success') throw new Error(res.data?.message);
    return res.data.codes as string[];
  };

  const handleRecoveryCodesClose = () => {
    closeModal();
    fetchStatus();
  };

  // Session revoke
  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSession(sessionId);
    try {
      await api.delete(`/users/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      showSuccess('Session revoked.');
    } catch {
      showError('Failed to revoke session.');
    } finally {
      setRevokingSession(null);
    }
  };

  // Timeout update
  const handleUpdateTimeout = async (minutes: number) => {
    await appLockService.setLockTimeout(minutes);
    setLockTimeout(minutes);
    showSuccess(`Sparkle will now lock ${minutes === 0 ? 'immediately' : `after ${minutes} minutes`}.`);
  };

  const is2FAActive = status?.two_fa_active ?? false;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-24 transition-colors">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 pt-4 sm:pt-6">
        {/* Navigation Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/settings')}
            className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:scale-105 active:scale-95 transition-all shadow-sm"
            aria-label="Back to settings"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Security Centre</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Protect Sparkle on this device and across your account</p>
          </div>
        </div>

        {/* Feedback */}
        {success && <FeedbackBanner type="success" message={success} onClose={() => setSuccess(null)} />}
        {error && <FeedbackBanner type="error" message={error} onClose={() => setError(null)} />}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-zinc-900 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* Architectural Distinction Banner */}
            <div className="mb-5 p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 shadow-sm">
              <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Two Layers of Protection</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60">
                  <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center mb-2">
                    <Lock className="w-4 h-4 text-[#ff1493]" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">1. App PIN (Device)</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 leading-snug">
                    Protects Sparkle on this device. Stays on this device and is never sent to servers.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">2. Account 2FA</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 leading-snug">
                    Protects your identity when logging in from any browser or phone anywhere in the world.
                  </p>
                </div>
              </div>
            </div>

            {/* ── DEVICE SECURITY ── */}
            <SettingCardGroup title="Device Security (Local Lock)">
              <SettingRow
                icon={Lock}
                title="App PIN"
                description="Protect Sparkle on this device with a private PIN. Your PIN stays on this device and is not used to verify your identity on Sparkle's servers."
                rightElement="badge"
                badgeText={isPinConfigured ? 'Active' : 'Not configured'}
                badgeVariant={isPinConfigured ? 'green' : 'slate'}
                onClick={() => setActiveModal(isPinConfigured ? 'app-pin-manage' : 'app-pin-setup')}
              />
              {isPinConfigured && (
                <SettingRow
                  icon={Clock}
                  title="Lock Automatically"
                  description="Choose how quickly Sparkle locks when you leave or switch apps"
                  value={getTimeoutLabel(lockTimeout)}
                  rightElement="chevron"
                  onClick={() => setActiveModal('app-pin-timeout')}
                />
              )}
            </SettingCardGroup>

            {/* ── ACCOUNT SECURITY ── */}
            <SettingCardGroup title="Account Two-Factor Authentication">
              {/* Status Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800/80">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Account 2FA Status</h4>
                    <StatusDot active={is2FAActive} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {is2FAActive
                      ? 'Extra sign-in protection is active.'
                      : 'Not enabled. Your account relies only on password.'}
                  </p>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  is2FAActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}>
                  {is2FAActive ? 'Enabled' : 'Off'}
                </span>
              </div>

              {/* Email 2FA */}
              <SettingRow
                icon={Mail}
                title="Email Verification Code"
                description={
                  status?.email_2fa_enabled
                    ? `Active — OTP sent to ${status.security_recovery_email_masked || status.email_masked || 'email'}`
                    : `Receive a 6-digit code at ${status?.email_masked ?? 'your email'} on sign in`
                }
                rightElement="badge"
                badgeText={status?.email_2fa_enabled ? 'Enabled' : 'Configure'}
                badgeVariant={status?.email_2fa_enabled ? 'green' : 'slate'}
                onClick={() => setActiveModal(status?.email_2fa_enabled ? 'email-2fa-disable' : 'email-2fa-setup')}
              />

              {/* Use Another Email for 2FA */}
              <SettingRow
                icon={AtSign}
                title="Use Another Email"
                description={
                  status?.security_recovery_email_masked
                    ? `Security email: ${status.security_recovery_email_masked}`
                    : 'Set up a separate email address for security verification codes'
                }
                rightElement="badge"
                badgeText={status?.security_recovery_email_masked ? 'Configured' : 'Optional'}
                badgeVariant={status?.security_recovery_email_masked ? 'green' : 'slate'}
                onClick={() => setActiveModal('alternate-email-setup')}
              />

              {/* SMS 2FA */}
              <SettingRow
                icon={MessageSquare}
                title="SMS Verification Code"
                description={
                  !status?.sms_provider_available
                    ? 'SMS is not currently available on the server'
                    : status?.sms_2fa_enabled
                      ? `Active — OTP sent to ${status.phone_masked ?? 'phone'}`
                      : status?.phone_configured
                        ? `Receive a 6-digit code via SMS at ${status.phone_masked}`
                        : 'Add a verified mobile number to your profile first'
                }
                rightElement="badge"
                badgeText={
                  !status?.sms_provider_available
                    ? 'Unavailable'
                    : status?.sms_2fa_enabled
                      ? 'Enabled'
                      : 'Configure'
                }
                badgeVariant={
                  !status?.sms_provider_available ? 'slate' : status?.sms_2fa_enabled ? 'green' : 'slate'
                }
                onClick={
                  status?.sms_provider_available
                    ? () => setActiveModal(status?.sms_2fa_enabled ? 'sms-2fa-disable' : 'sms-2fa-setup')
                    : undefined
                }
                disabled={!status?.sms_provider_available}
              />

              {(is2FAActive || (status?.backup_codes_remaining ?? 0) > 0) && (
                <SettingRow
                  icon={RotateCcw}
                  title="Reset & Disable All 2FA"
                  description="Verify your identity to disable all 2FA methods and clear recovery codes"
                  rightElement="chevron"
                  onClick={() => setActiveModal('2fa-disable-all')}
                />
              )}
            </SettingCardGroup>

            {/* ── PASSWORD ── */}
            <SettingCardGroup title="Password">
              <SettingRow
                icon={KeyRound}
                title="Change Password"
                description="Update your account password using verified identity"
                rightElement="chevron"
                onClick={() => navigate('/settings/change-password')}
              />
            </SettingCardGroup>

            {/* ── BACKUP & RECOVERY ── */}
            <SettingCardGroup title="Emergency Recovery">
              <SettingRow
                icon={Key}
                title="Recovery Backup Codes"
                description={
                  status?.backup_codes_remaining
                    ? `${status.backup_codes_remaining} single-use code${status.backup_codes_remaining !== 1 ? 's' : ''} stored`
                    : 'Generate 10 single-use codes to access your account if you lose your phone or email'
                }
                rightElement="chevron"
                onClick={() => setActiveModal('recovery-codes-generate')}
              />
              <div className="px-4 py-3 mx-4 mb-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/30 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
                <Key className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-800 dark:text-zinc-200">How to use recovery codes:</p>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                    If you lose access to your phone or email, tap <strong className="text-[#ff1493] font-semibold">"Lost your device? Use a recovery backup code"</strong> on the sign-in screen. Each backup code is 10 characters, single-use, and is permanently burned after you sign in.
                  </p>
                </div>
              </div>
            </SettingCardGroup>

            {/* ── ACTIVE SESSIONS ── */}
            <SettingCardGroup title="Active Logins">
              {sessions.length > 0 ? (
                sessions.map((s) => (
                  <SettingRow
                    key={s.session_id}
                    icon={Smartphone}
                    title={s.device_name?.slice(0, 45) || 'Active Session'}
                    description={`IP: ${s.ip_address || 'Unknown'} · Last active: ${s.last_active ? new Date(s.last_active).toLocaleDateString() : 'Now'}`}
                    rightElement="custom"
                    customRight={
                      <button
                        onClick={() => handleRevokeSession(s.session_id)}
                        disabled={revokingSession === s.session_id}
                        className="h-7 px-3 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {revokingSession === s.session_id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Revoke
                      </button>
                    }
                  />
                ))
              ) : (
                <div className="px-4 py-4 text-xs text-slate-400 dark:text-zinc-500 text-center">
                  1 active session (this device)
                </div>
              )}

              <SettingRow
                icon={ChevronRight}
                title="Sign out all other sessions"
                description="Invalidate all active logins across other devices"
                rightElement="chevron"
                onClick={async () => {
                  try {
                    await api.post('/users/sessions/logout-all');
                    showSuccess('All other sessions have been signed out.');
                    fetchSessions();
                  } catch {
                    showError('Failed to sign out other sessions.');
                  }
                }}
              />
            </SettingCardGroup>
          </>
        )}
      </main>

      {/* ── Modals ── */}

      {activeModal === 'app-pin-setup' && (
        <AppPinSetupModal
          onSuccess={() => {
            closeModal();
            checkPinStatus();
            showSuccess('App PIN enabled for this device.');
          }}
          onClose={closeModal}
        />
      )}

      {activeModal === 'app-pin-manage' && (
        <AppPinManageModal
          onUpdate={() => {
            checkPinStatus();
            showSuccess('App PIN updated.');
          }}
          onOpenTimeoutModal={() => setActiveModal('app-pin-timeout')}
          onClose={closeModal}
        />
      )}

      {activeModal === 'app-pin-timeout' && (
        <AutoLockTimeoutModal
          currentTimeout={lockTimeout}
          onSelect={handleUpdateTimeout}
          onClose={closeModal}
        />
      )}

      {activeModal === 'email-2fa-setup' && (
        <OTPModal
          title="Enable Email Verification"
          description="We'll send a 6-digit code to your email. Enter it below to add email as a two-factor authentication method."
          destination={status?.email_masked ?? undefined}
          onRequest={handleEmailOTPRequest}
          onVerify={handleEmailOTPVerify}
          onClose={closeModal}
        />
      )}

      {activeModal === 'email-2fa-disable' && (
        <Disable2FAModal
          title="Disable Email Verification"
          description="Verify your identity to turn off email-based two-factor authentication."
          onSuccess={handle2FADisableSuccess}
          onClose={closeModal}
        />
      )}

      {activeModal === 'sms-2fa-setup' && (
        <OTPModal
          title="Enable SMS Verification"
          description="We'll send a 6-digit code to your phone number. Enter it below to add SMS as a two-factor authentication method."
          destination={status?.phone_masked ?? undefined}
          onRequest={handleSMSOTPRequest}
          onVerify={handleSMSOTPVerify}
          onClose={closeModal}
        />
      )}

      {activeModal === 'sms-2fa-disable' && (
        <Disable2FAModal
          title="Disable SMS Verification"
          description="Verify your identity to turn off SMS-based two-factor authentication."
          onSuccess={handle2FADisableSuccess}
          onClose={closeModal}
        />
      )}

      {activeModal === 'alternate-email-setup' && (
        <AlternateEmailModal
          onSuccess={handleAlternateEmailSuccess}
          onClose={closeModal}
        />
      )}

      {activeModal === 'recovery-codes-generate' && (
        <RecoveryGenerateModal
          onGenerate={handleGenerateRecoveryCodes}
          onClose={handleRecoveryCodesClose}
        />
      )}

      {activeModal === '2fa-disable-all' && (
        <Disable2FAModal
          title="Reset & Disable All 2FA"
          description="Verify your identity using an enrolled authentication method to disable all two-factor authentication and permanently invalidate any existing recovery codes."
          onSuccess={() => {
            closeModal();
            showSuccess('All two-factor authentication methods have been turned off.');
            fetchStatus();
          }}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
