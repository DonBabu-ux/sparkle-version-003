import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, AlertCircle, Shield, X, Check, Loader2, ArrowLeft } from 'lucide-react';
import { appLockService } from '../../services/appLock.service';
import api from '../../api/api';

interface AvailableFactors {
  has_password: boolean;
  has_email_2fa: boolean;
  email_masked: string | null;
  has_sms_2fa: boolean;
  phone_masked: string | null;
  has_recovery_codes: boolean;
  backup_codes_remaining: number;
  requires_2fa_factor_for_removal: boolean;
}

export const AppLockOverlay: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  // Forgot PIN Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState<'explain' | 'factors' | 'verify' | 'new-pin' | 'confirm-pin'>('explain');
  const [factors, setFactors] = useState<AvailableFactors | null>(null);
  const [loadingFactors, setLoadingFactors] = useState(false);
  const [selectedFactor, setSelectedFactor] = useState<'email' | 'sms' | 'recovery_code' | 'password'>('email');
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [factorCode, setFactorCode] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const checkLockState = useCallback(async () => {
    const enabled = await appLockService.isPinEnabled();
    if (!enabled) {
      setIsLocked(false);
      return;
    }
    const unlocked = appLockService.isCurrentlyUnlocked();
    setIsLocked(!unlocked);
  }, []);

  useEffect(() => {
    checkLockState();
    const unsubscribe = appLockService.subscribe((locked) => {
      setIsLocked(locked);
      if (locked) {
        setPin('');
        setError(null);
      }
    });
    return () => unsubscribe();
  }, [checkLockState]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  const handleDigit = async (digit: string) => {
    if (lockoutRemaining > 0 || isChecking) return;
    if (pin.length >= 6) return;

    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    // Auto-verify ONLY when exactly 6 digits are entered
    if (nextPin.length === 6) {
      setIsChecking(true);
      const res = await appLockService.verifyPin(nextPin);
      setIsChecking(false);
      if (res.success) {
        setPin('');
        setError(null);
      } else {
        setPin('');
        setError(res.error || 'Incorrect PIN');
        if (res.lockoutRemaining) {
          setLockoutRemaining(res.lockoutRemaining);
        }
      }
    }
  };

  const handleDelete = () => {
    if (lockoutRemaining > 0 || isChecking) return;
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleOpenReset = async () => {
    setShowResetModal(true);
    setResetStep('explain');
    setResetError(null);
    setFactorCode('');
    setNewPin('');
    setConfirmPin('');
    setLoadingFactors(true);

    try {
      const res = await api.get('/security/available-factors');
      if (res.data?.status === 'success') {
        setFactors(res.data.data);
        // Default to strongest available factor
        if (res.data.data.has_email_2fa) {
          setSelectedFactor('email');
        } else if (res.data.data.has_sms_2fa) {
          setSelectedFactor('sms');
        } else if (res.data.data.has_recovery_codes) {
          setSelectedFactor('recovery_code');
        } else {
          setSelectedFactor('password');
        }
      }
    } catch {
      // Offline or network error
      setResetError('Unable to connect to security server. Please check your internet connection.');
    } finally {
      setLoadingFactors(false);
    }
  };

  const handleInitiateFactor = async (factor: 'email' | 'sms' | 'recovery_code' | 'password') => {
    setIsSubmitting(true);
    setResetError(null);
    try {
      const res = await api.post('/security/transaction/initiate', {
        purpose: 'pin_reset',
        factor_type: factor
      });
      if (res.data?.status === 'success') {
        setActiveTxId(res.data.data.transaction_id);
        setSelectedFactor(factor);
        setResetStep('verify');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setResetError(e.response?.data?.message || 'Failed to start verification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyFactor = async () => {
    if (!activeTxId || !factorCode) {
      setResetError('Please enter your verification code or password.');
      return;
    }

    setIsSubmitting(true);
    setResetError(null);
    try {
      const res = await api.post('/security/transaction/verify', {
        transaction_id: activeTxId,
        code: factorCode,
        factor_type: selectedFactor
      });

      if (res.data?.status === 'success') {
        const token = res.data.data.verification_token;
        setVerifiedToken(token);
        // Request single-use PIN reset authorization token
        await api.post('/security/pin/reset-token', { verification_token: token });
        setResetStep('new-pin');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setResetError(e.response?.data?.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishReset = async () => {
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setResetError('New PIN must be exactly 6 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setResetError('PINs do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    setResetError(null);
    try {
      await appLockService.resetPinWithToken(newPin);
      setShowResetModal(false);
      setIsLocked(false);
      setPin('');
    } catch (err: unknown) {
      const e = err as Error;
      setResetError(e.message || 'Failed to set new PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-(--z-top) bg-slate-900/95 dark:bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-6 select-none transition-all duration-300">
      {/* Top Branding */}
      <div className="flex flex-col items-center mt-12">
        <div className="w-16 h-16 rounded-3xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mb-4 shadow-lg shadow-pink-500/10">
          <Lock className="w-8 h-8 text-[#ff1493]" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white">Sparkle is Locked</h2>
        <p className="text-xs text-slate-400 mt-1">Enter your 6-digit PIN to unlock</p>
      </div>

      {/* Center: PIN Dots and Error */}
      <div className="flex flex-col items-center my-6">
        <div className="flex items-center gap-3.5 mb-4">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                index < pin.length
                  ? 'bg-[#ff1493] border-[#ff1493] scale-110 shadow-sm shadow-pink-500/40'
                  : 'bg-transparent border-slate-600'
              }`}
            />
          ))}
        </div>

        {(error || lockoutRemaining > 0) && (
          <div className="flex flex-col items-center gap-1.5 mt-2 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-semibold animate-shake shadow-sm shadow-red-500/10">
            <div className="flex items-center gap-1.5 text-red-400">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-red-400 font-bold">{error || 'Too many attempts. Please wait...'}</span>
            </div>
            {lockoutRemaining > 0 && (
              <span className="text-[11px] text-red-300 font-medium">
                Try again in <strong className="text-red-200">{lockoutRemaining}s</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Keypad & Forgot PIN */}
      <div className="w-full max-w-xs mb-6 flex flex-col items-center">
        <div className="grid grid-cols-3 gap-3 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={lockoutRemaining > 0}
              className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-white text-2xl font-semibold transition-all border border-white/5 flex items-center justify-center disabled:opacity-30"
            >
              {digit}
            </button>
          ))}

          <div />

          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={lockoutRemaining > 0}
            className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-white text-2xl font-semibold transition-all border border-white/5 flex items-center justify-center disabled:opacity-30"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={pin.length === 0 || lockoutRemaining > 0}
            className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-slate-400 hover:text-white transition-all border border-white/5 flex items-center justify-center disabled:opacity-30"
            aria-label="Delete digit"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleOpenReset}
          className="mt-4 text-xs font-semibold text-slate-400 hover:text-pink-400 transition-colors py-2 px-4 rounded-xl hover:bg-white/5"
        >
          Forgot your PIN?
        </button>
      </div>

      {/* Half-Page Modal: Reset App Lock */}
      {showResetModal && (
        <div className="fixed inset-0 z-(--z-toast) flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-pink-500" />
                <h3 className="font-bold text-white text-base">Reset App Lock</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {resetError && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{resetError}</span>
              </div>
            )}

            {/* Step: Explain */}
            {resetStep === 'explain' && (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Your App PIN is stored locally and cannot be revealed or recovered by Sparkle , sparkle servers or any related infrastructure.
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  To keep your account secure, resetting App Lock requires verifying your identity through an existing security factor.
                </p>

                <div className="pt-4 flex flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={loadingFactors}
                    onClick={() => {
                      if (!factors) {
                        setResetError('Unable to load security factors. Reconnect to the internet and try again.');
                        return;
                      }
                      setResetStep('factors');
                    }}
                    className="w-full py-3 rounded-xl bg-[#ff1493] hover:bg-pink-600 active:scale-98 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {loadingFactors ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset App Lock'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="w-full py-2.5 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step: Choose Factor */}
            {resetStep === 'factors' && (
              <div className="mt-5 space-y-4">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Verify your identity
                </p>

                <div className="space-y-2.5">
                  {factors?.has_email_2fa && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleInitiateFactor('email')}
                      className="w-full p-3.5 rounded-2xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 text-left transition-all flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">Email verification</div>
                        <div className="text-xs text-zinc-400">Send code to {factors.email_masked}</div>
                      </div>
                      <span className="text-xs text-pink-400 font-semibold">Select</span>
                    </button>
                  )}

                  {factors?.has_sms_2fa && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleInitiateFactor('sms')}
                      className="w-full p-3.5 rounded-2xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 text-left transition-all flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">SMS verification</div>
                        <div className="text-xs text-zinc-400">Send code to {factors.phone_masked}</div>
                      </div>
                      <span className="text-xs text-pink-400 font-semibold">Select</span>
                    </button>
                  )}

                  {factors?.has_recovery_codes && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleInitiateFactor('recovery_code')}
                      className="w-full p-3.5 rounded-2xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 text-left transition-all flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">Recovery code</div>
                        <div className="text-xs text-zinc-400">Use one of your saved backup codes</div>
                      </div>
                      <span className="text-xs text-pink-400 font-semibold">Select</span>
                    </button>
                  )}

                  {factors?.has_password && !factors.requires_2fa_factor_for_removal && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleInitiateFactor('password')}
                      className="w-full p-3.5 rounded-2xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 text-left transition-all flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">Account password</div>
                        <div className="text-xs text-zinc-400">Verify using your account password</div>
                      </div>
                      <span className="text-xs text-pink-400 font-semibold">Select</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setResetStep('explain')}
                  className="w-full py-2 text-zinc-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              </div>
            )}

            {/* Step: Enter Code */}
            {resetStep === 'verify' && (
              <div className="mt-5 space-y-4">
                <p className="text-xs text-zinc-400">
                  {selectedFactor === 'password'
                    ? 'Enter your account password to verify identity.'
                    : selectedFactor === 'recovery_code'
                    ? 'Enter one of your 10-character backup recovery codes.'
                    : 'Enter the 6-digit verification code sent to your destination.'}
                </p>

                <input
                  type={selectedFactor === 'password' ? 'password' : 'text'}
                  value={factorCode}
                  onChange={(e) => setFactorCode(e.target.value)}
                  placeholder={selectedFactor === 'password' ? 'Account password' : selectedFactor === 'recovery_code' ? 'XXXXX-XXXXX' : '6-digit code'}
                  className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-pink-500"
                />

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting || !factorCode}
                    onClick={handleVerifyFactor}
                    className="w-full py-3 rounded-xl bg-[#ff1493] hover:bg-pink-600 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetStep('factors')}
                    className="w-full py-2 text-zinc-400 hover:text-white text-xs font-semibold"
                  >
                    Choose another method
                  </button>
                </div>
              </div>
            )}

            {/* Step: Set New 6-digit PIN */}
            {resetStep === 'new-pin' && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                  <Check className="w-4 h-4" /> Identity verified. Choose your new 6-digit PIN.
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400">New 6-Digit PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full mt-1 p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-center text-xl tracking-widest placeholder-zinc-600 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400">Confirm New PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full mt-1 p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-center text-xl tracking-widest placeholder-zinc-600 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting || newPin.length !== 6 || confirmPin.length !== 6}
                  onClick={handleFinishReset}
                  className="w-full mt-4 py-3 rounded-xl bg-[#ff1493] hover:bg-pink-600 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save New PIN & Unlock'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

