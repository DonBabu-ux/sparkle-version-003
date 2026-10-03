import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  Key,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Lock
} from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

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

export const ChangePassword: React.FC = () => {
  const navigate = useNavigate();

  // Factors & Verification State (Step 1)
  const [step, setStep] = useState<'verify_choice' | 'verify_input' | 'create_password'>('verify_choice');
  const [factors, setFactors] = useState<AvailableFactors | null>(null);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [selectedFactor, setSelectedFactor] = useState<'email' | 'sms' | 'recovery_code' | 'password'>('email');
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  // New Password State (Step 2)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Status & Error
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setLoadingFactors(true);
    setError(null);
    try {
      const res = await api.get('/security/available-factors');
      if (res.data?.status === 'success') {
        const data = res.data.data;
        setFactors(data);
        if (data.has_email_2fa) {
          setSelectedFactor('email');
        } else if (data.has_sms_2fa) {
          setSelectedFactor('sms');
        } else if (data.has_recovery_codes) {
          setSelectedFactor('recovery_code');
        } else {
          setSelectedFactor('password');
        }
      }
    } catch {
      setError('Unable to load verification factors. Please check your connection.');
    } finally {
      setLoadingFactors(false);
    }
  };

  const handleInitiateVerification = async (factor: 'email' | 'sms' | 'recovery_code' | 'password') => {
    setSelectedFactor(factor);
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/security/transaction/initiate', {
        purpose: 'password_change',
        factor_type: factor
      });
      if (res.data?.status === 'success') {
        setActiveTxId(res.data.data.transaction_id);
        setStep('verify_input');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to initiate security verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTxId || !verificationCode) {
      setError('Please provide your verification code or password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/security/transaction/verify', {
        transaction_id: activeTxId,
        code: verificationCode,
        factor_type: selectedFactor
      });

      if (res.data?.status === 'success') {
        setVerificationToken(res.data.data.verification_token);
        setStep('create_password');
        setError(null);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  // Secure Password Generator (Cryptographically Secure)
  const handleGeneratePassword = () => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*()_+-=~';
    const all = uppercase + lowercase + numbers + symbols;

    const array = new Uint32Array(16);
    window.crypto.getRandomValues(array);

    let pwd = '';
    pwd += uppercase[array[0] % uppercase.length];
    pwd += lowercase[array[1] % lowercase.length];
    pwd += numbers[array[2] % numbers.length];
    pwd += symbols[array[3] % symbols.length];

    for (let i = 4; i < 16; i++) {
      pwd += all[array[i] % all.length];
    }

    // Shuffle characters
    const shuffled = pwd.split('').sort(() => 0.5 - Math.random()).join('');
    setGeneratedPassword(shuffled);
    setNewPassword(shuffled);
    setConfirmPassword(shuffled);
    setHasCopied(false);
  };

  const handleCopyGenerated = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch {}
  };

  // Password Strength Calculation
  const calculateStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: 'None', color: 'bg-zinc-700' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score === 4) return { score: 3, label: 'Good', color: 'bg-emerald-500' };
    return { score: 4, label: 'Strong', color: 'bg-[#ff1493]' };
  };

  const strength = calculateStrength(newPassword);

  const handleSubmitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationToken) {
      setError('Verification token is missing. Please re-verify.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/security/password/change', {
        verification_token: verificationToken,
        new_password: newPassword
      });

      if (res.data?.status === 'success') {
        setSuccess('Password changed successfully! Redirecting...');
        setTimeout(() => {
          navigate('/settings/security');
        }, 1500);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-24 transition-colors">
      <Navbar />

      <main className="max-w-xl mx-auto px-4 pt-6 animate-in slide-in-from-right duration-300">
        {/* Navigation Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-all shadow-sm active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <Key className="w-5 h-5 text-[#ff1493]" />
              Change password
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Create a new password to keep your Sparkle account secure.
            </p>
          </div>
        </div>

        {/* Status Banners */}
        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{success}</span>
          </div>
        )}

        {/* STEP 1: Verify It's You (Choice) */}
        {step === 'verify_choice' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-500">
              <Shield className="w-4 h-4" /> Step 1: Verify it's you
            </div>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Select an available security factor to verify your account identity before setting a new password.
            </p>

            {loadingFactors ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#ff1493]" />
                <span className="text-xs text-slate-400">Checking security factors...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {factors?.has_email_2fa && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleInitiateVerification('email')}
                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 text-left transition-all flex items-center justify-between group active:scale-99"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-[#ff1493]">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">Email verification</div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400">Send code to {factors.email_masked}</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-pink-500 group-hover:translate-x-0.5 transition-transform">Verify →</span>
                  </button>
                )}

                {factors?.has_sms_2fa && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleInitiateVerification('sms')}
                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 text-left transition-all flex items-center justify-between group active:scale-99"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">SMS verification</div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400">Send code to {factors.phone_masked}</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-pink-500 group-hover:translate-x-0.5 transition-transform">Verify →</span>
                  </button>
                )}

                {factors?.has_recovery_codes && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleInitiateVerification('recovery_code')}
                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 text-left transition-all flex items-center justify-between group active:scale-99"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">Recovery code</div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400">Use one of your saved backup codes ({factors.backup_codes_remaining} left)</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-pink-500 group-hover:translate-x-0.5 transition-transform">Verify →</span>
                  </button>
                )}

                {factors?.has_password && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleInitiateVerification('password')}
                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 text-left transition-all flex items-center justify-between group active:scale-99"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">Current account password</div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400">Verify using your existing password</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-pink-500 group-hover:translate-x-0.5 transition-transform">Verify →</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 1.5: Verify Code Input */}
        {step === 'verify_input' && (
          <form onSubmit={handleVerifyFactor} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-500">
                <Shield className="w-4 h-4" /> Enter Verification Code
              </div>
              <button
                type="button"
                onClick={() => setStep('verify_choice')}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                Change method
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              {selectedFactor === 'password'
                ? 'Enter your current account password to proceed.'
                : selectedFactor === 'recovery_code'
                ? 'Enter one of your 10-character recovery codes (e.g. XXXXX-XXXXX).'
                : 'Enter the 6-digit verification code sent to your device.'}
            </p>

            <input
              type={selectedFactor === 'password' ? 'password' : 'text'}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder={selectedFactor === 'password' ? 'Enter current password' : selectedFactor === 'recovery_code' ? 'XXXXX-XXXXX' : '6-digit code'}
              className="w-full p-3.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:border-pink-500 tracking-wide font-medium"
              autoFocus
              required
            />

            <button
              type="submit"
              disabled={loading || !verificationCode}
              className="w-full py-3.5 rounded-2xl bg-[#ff1493] hover:bg-pink-600 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 active:scale-98 shadow-md shadow-pink-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Proceed to Step 2'}
            </button>
          </form>
        )}

        {/* STEP 2: Create New Password */}
        {step === 'create_password' && (
          <form onSubmit={handleSubmitPasswordChange} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-500">
              <Check className="w-4 h-4" /> Identity Verified — Step 2: Create new password
            </div>

            {/* Generate Password Section */}
            <div className="p-4 rounded-2xl bg-pink-500/5 border border-pink-500/20 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Suggest Strong Password
                </span>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-xs font-bold text-[#ff1493] hover:underline"
                >
                  Generate
                </button>
              </div>

              {generatedPassword && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                  <code className="text-xs font-mono text-slate-800 dark:text-zinc-200 select-all">
                    {generatedPassword}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyGenerated}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Password Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full p-3.5 pr-11 rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:border-pink-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-slate-400">Password Strength:</span>
                      <span className={strength.score >= 3 ? 'text-emerald-500' : 'text-amber-500'}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-full flex-1 rounded-full transition-all duration-300 ${
                            i <= strength.score ? strength.color : 'bg-slate-200 dark:bg-zinc-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full p-3.5 pr-11 rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:border-pink-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
              className="w-full py-3.5 rounded-2xl bg-[#ff1493] hover:bg-pink-600 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 active:scale-98 shadow-lg shadow-pink-500/25"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change password'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
};

export default ChangePassword;
