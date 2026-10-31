import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, Shield, Check, X, ChevronLeft } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import api from '../api/api';
import { parseResetLinkParams } from '../utils/resetLink';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const { email: emailParam, code: tokenParam } = parseResetLinkParams(location.hash, location.search);

  // OTP inputs state: 6 separate fields
  const [otpValues, setOtpValues] = useState<string[]>(() => {
    if (tokenParam && tokenParam.length === 6) {
      return tokenParam.split('');
    }
    return Array(6).fill('');
  });

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [newProtocolCode, setNewProtocolCode] = useState('');
  const [repeatCode, setRepeatCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<boolean>(() => Boolean(emailParam));

  // Timer for code resend
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  // Mask email utility
  const maskEmail = (email: string) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    if (local.length <= 3) {
      return `${local[0] || ''}${'*'.repeat(local.length - 1)}@${domain}`;
    }
    const visible = local.slice(0, 3);
    const masked = '*'.repeat(local.length - 3);
    return `${visible}${masked}@${domain}`;
  };

  // Password checklist items
  const checklist = [
    { id: 'length', label: 'At least 8 characters', met: newProtocolCode.length >= 8 },
    { id: 'upper', label: 'Uppercase letter', met: /[A-Z]/.test(newProtocolCode) },
    { id: 'lower', label: 'Lowercase letter', met: /[a-z]/.test(newProtocolCode) },
    { id: 'number', label: 'Number', met: /[0-9]/.test(newProtocolCode) },
    { id: 'special', label: 'Special character', met: /[^A-Za-z0-9]/.test(newProtocolCode) },
  ];

  // Strength score
  const strengthScore = checklist.filter((item) => item.met).length;

  const getStrengthInfo = (score: number) => {
    if (!newProtocolCode) return { label: 'Empty', color: 'transparent', width: '0%' };
    if (score <= 2) return { label: 'Weak', color: '#ef4444', width: `${score * 20}%` };
    if (score === 3) return { label: 'Fair', color: '#f97316', width: '60%' };
    if (score === 4) return { label: 'Strong', color: '#eab308', width: '80%' };
    return { label: 'Excellent', color: '#10b981', width: '100%' };
  };

  const strengthInfo = getStrengthInfo(strengthScore);

  // OTP handlers
  const handleOtpChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const nextOtp = [...otpValues];
    nextOtp[index] = digit;
    setOtpValues(nextOtp);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpValues[index] && index > 0) {
        const nextOtp = [...otpValues];
        nextOtp[index - 1] = '';
        setOtpValues(nextOtp);
        otpRefs.current[index - 1]?.focus();
        e.preventDefault();
      } else if (otpValues[index]) {
        const nextOtp = [...otpValues];
        nextOtp[index] = '';
        setOtpValues(nextOtp);
        e.preventDefault();
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData.length === 6) {
      const nextOtp = pasteData.split('');
      setOtpValues(nextOtp);
      otpRefs.current[5]?.focus();
    }
  };

  const handleResend = async () => {
    if (timer > 0 || resending) return;
    setResending(true);
    setError('');
    setResendSuccess(false);
    try {
      await api.post('/auth/forgot-password', { email: emailParam });
      setResendSuccess(true);
      setTimer(60);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResendSuccess(false);

    const otpCode = otpValues.join('');
    if (otpCode.length < 6) return setError('Please enter the 6-digit verification code.');
    if (newProtocolCode.length < 8) return setError('Password must be at least 8 characters.');
    if (newProtocolCode !== repeatCode) return setError('Passwords do not match.');

    const payload = {
      token: otpCode,
      email: emailParam,
      code: otpCode,
      newPassword: newProtocolCode,
    };

    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', payload);
      setSuccess(true);
      setTimeout(() => {
        if (response?.data?.next?.route) {
          navigate(response.data.next.route);
        } else {
          navigate('/login');
        }
      }, 1500);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Reset failed. Verification code may be incorrect or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-app p-4 font-sans text-[#18181b] dark:text-zinc-100 sm:p-6">
      {/* Back Button */}
      <button onClick={() => navigate(-1)} className="absolute left-4 top-4 flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-[#18181b] dark:text-zinc-300 dark:hover:text-zinc-100 sm:left-6 sm:top-6">
        <ChevronLeft size={16} /> Back
      </button>

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#e6d8e1] bg-[#fdf8fa] p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        {success && (
          <div className="absolute inset-0 z-10 flex animate-fade-in flex-col items-center justify-center bg-[#fdf8fa] text-center dark:bg-zinc-800">
            <CheckCircle2 size={40} strokeWidth={2.5} className="mb-6 text-emerald-500" />
            <h2 className="mb-2 text-2xl font-bold text-[#18181b] dark:text-zinc-100">Password updated</h2>
            <p className="max-w-xs text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
              Your account has been secured.<br />Redirecting...
            </p>
          </div>
        )}

        {/* Header Block */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Shield size={32} strokeWidth={2} className="mb-4 text-[#ff1493]" />
          <h1 className="text-3xl font-bold tracking-tight text-[#18181b] dark:text-zinc-100">Sparkle Security</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
            Protect your account with a strong password. This keeps your conversations, profile, and data secure.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex animate-fade-in items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <X size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {resendSuccess && (
          <div className="mb-6 flex animate-fade-in items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3.5 text-xs font-bold text-emerald-800 shadow-sm dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                <Check size={14} strokeWidth={3} />
              </div>
              <span>Verification code sent successfully.</span>
            </div>
            <button
              type="button"
              onClick={() => setResendSuccess(false)}
              className="rounded-lg p-1 text-emerald-700 transition-colors hover:bg-emerald-200/50 hover:text-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-200"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identity Verification OTP Blocks */}
          <div className="space-y-3 rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-xs font-bold text-[#ff1493]">Verify your identity</h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
              We've sent a verification code to <span className="font-semibold text-[#18181b] dark:text-zinc-100">{maskEmail(emailParam)}</span>. Enter the code below to continue.
            </p>

            <div className="mt-4 flex justify-between gap-2">
              {otpValues.map((val, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={val}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={handleOtpPaste}
                  className="h-14 w-12 rounded-2xl border border-[#e6d8e1] bg-[#fdf8fa] text-center text-xl font-bold text-[#18181b] outline-none transition-colors focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#ede3e9] pt-3 text-xs text-slate-600 dark:border-zinc-900 dark:text-zinc-300">
              <span>Didn't receive it?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={timer > 0 || resending}
                className="flex items-center gap-1.5 font-bold text-[#ff1493] transition-colors hover:text-[#ff2d87] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resending && <Spinner size="small" />}
                {timer > 0 ? `Resend code (${timer}s)` : 'Resend code'}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="newPassword"
                autoComplete="new-password"
                value={newProtocolCode}
                onChange={(e) => setNewProtocolCode(e.target.value)}
                className="w-full rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] py-3 pl-4 pr-11 text-sm text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-300"
                placeholder="Enter new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors hover:text-[#ff1493] dark:text-zinc-300 dark:hover:text-[#ff2d87]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password Requirements Checklist & Strength bar */}
            {newProtocolCode && (
              <div className="mt-3 space-y-3 rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="text-xs font-bold text-slate-700 dark:text-zinc-300">Password requirements</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {checklist.map((item) => (
                    <div key={item.id} className={`flex items-center gap-2 text-xs ${item.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-zinc-300'}`}>
                      {item.met ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <X size={14} className="text-slate-600 dark:text-zinc-300" />
                      )}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 border-t border-[#ede3e9] pt-3 dark:border-zinc-900">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-300">
                    <span>Password strength</span>
                    <span className="font-bold" style={{ color: strengthInfo.color }}>
                      {strengthInfo.label}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#ede3e9] dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: strengthInfo.width,
                        backgroundColor: strengthInfo.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Confirm password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                autoComplete="new-password"
                value={repeatCode}
                onChange={(e) => setRepeatCode(e.target.value)}
                className="w-full rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] py-3 pl-4 pr-11 text-sm text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-300"
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors hover:text-[#ff1493] dark:text-zinc-300 dark:hover:text-[#ff2d87]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {repeatCode && (
              <div className="mt-1 flex items-center gap-1.5 px-1 text-xs">
                {newProtocolCode === repeatCode ? (
                  <>
                    <Check size={14} className="text-emerald-500" />
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Passwords match</span>
                  </>
                ) : (
                  <>
                    <X size={14} className="text-red-500" />
                    <span className="font-semibold text-red-600 dark:text-red-400">Passwords do not match</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Security Card */}
          <div className="flex gap-3 rounded-2xl border border-[#e6d8e1] bg-[#f0e5ec] p-4 text-xs leading-relaxed text-slate-600 dark:border-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
            <Shield size={16} className="mt-0.5 shrink-0 text-[#ff1493]" />
            <div>
              <span className="mb-0.5 block font-bold text-[#18181b] dark:text-zinc-100">Security tip</span>
              Never reuse passwords from other websites. A unique password keeps your Sparkle account safer.
            </div>
          </div>

          {/* Action Button */}
          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff1493] text-sm font-bold text-white transition-colors hover:bg-[#ff2d87] disabled:opacity-60">
            {loading ? (
              <>
                <Spinner size="small" color="#fff" />
                Updating, please wait…
              </>
            ) : (
              'Update password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
