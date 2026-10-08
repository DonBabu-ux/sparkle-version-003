import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, Shield, Check, X, RefreshCw, ChevronLeft } from 'lucide-react';
import api from '../api/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const emailParam = searchParams.get('email') || '';
  const tokenParam = searchParams.get('token') || searchParams.get('code') || '';

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
    <div className="security-page-bg">
      {/* Background visual orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-rose-200/20 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-pink-200/20 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Back Button */}
      <button onClick={() => navigate(-1)} className="security-back-btn relative z-10">
        <ChevronLeft size={16} /> Back
      </button>

      <div className="security-card relative z-10">
        {success && (
          <div className="success-overlay">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10 animate-bounce">
              <CheckCircle2 size={36} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Updated</h2>
            <p className="text-gray-500 text-sm text-center max-w-xs leading-relaxed">
              Your account has been secured.<br />Redirecting...
            </p>
          </div>
        )}

        {/* Header Block */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="animate-float-shield w-16 h-16 bg-pink-500/10 text-pink-500 rounded-2xl flex items-center justify-center mb-4 border border-pink-500/20 shadow-sm">
            <Shield size={32} strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sparkle Security</h1>
          <p className="text-gray-500 text-sm mt-2 max-w-sm leading-relaxed">
            Protect your account with a strong password. This keeps your conversations, profile, and data secure.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl flex items-center gap-3 animate-fade-in text-red-600 text-xs font-semibold">
            <X size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {resendSuccess && (
          <div className="mb-6 bg-emerald-50 border border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700/50 px-4 py-3.5 rounded-xl flex items-center justify-between gap-3 animate-fade-in text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Check size={14} strokeWidth={3} />
              </div>
              <span>Verification code sent successfully.</span>
            </div>
            <button
              type="button"
              onClick={() => setResendSuccess(false)}
              className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-200/50 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identity Verification OTP Blocks */}
          <div className="space-y-3 bg-white/40 border border-pink-500/10 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-pink-600">Verify Your Sparkle Identity</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              We've sent a verification code to <span className="text-gray-900 font-semibold">{maskEmail(emailParam)}</span>. Enter the code below to continue.
            </p>

            <div className="flex justify-between gap-2 mt-4">
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
                  className="input-otp-box"
                />
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 pt-2 border-t border-black/5 text-[11px] text-gray-500">
              <span>Didn't receive it?</span>
              <button
                type="button"
                onClick={handleResend}
                disabled={timer > 0 || resending}
                className="text-pink-600 font-bold hover:text-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
              >
                {resending && <RefreshCw size={10} className="animate-spin" />}
                {timer > 0 ? `Resend Code (${timer}s)` : 'Resend Code'}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newProtocolCode}
                onChange={(e) => setNewProtocolCode(e.target.value)}
                className="security-input pr-12"
                placeholder="Enter new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-500 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password Requirements Checklist & Strength bar */}
            {newProtocolCode && (
              <div className="mt-3 bg-white/40 border border-pink-500/10 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="text-xs font-bold text-gray-700">Password Requirements</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {checklist.map((item) => (
                    <div key={item.id} className={`requirement-item ${item.met ? 'met' : ''}`}>
                      {item.met ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <X size={14} className="text-gray-400" />
                      )}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-black/5 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] text-gray-500">
                    <span>Password Strength</span>
                    <span className="font-bold" style={{ color: strengthInfo.color }}>
                      {strengthInfo.label}
                    </span>
                  </div>
                  <div className="strength-bar-container">
                    <div
                      className="strength-bar-fill"
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
            <label className="text-xs font-bold text-gray-700">Confirm Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={repeatCode}
                onChange={(e) => setRepeatCode(e.target.value)}
                className="security-input pr-12"
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-500 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {repeatCode && (
              <div className="flex items-center gap-1.5 px-1 mt-1 text-[11px]">
                {newProtocolCode === repeatCode ? (
                  <>
                    <Check size={14} className="text-emerald-500" />
                    <span className="text-emerald-500 font-semibold">Passwords match</span>
                  </>
                ) : (
                  <>
                    <X size={14} className="text-red-500" />
                    <span className="text-red-500 font-semibold">Passwords do not match</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Security Card */}
          <div className="bg-pink-500/5 border border-pink-500/10 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-pink-800 shadow-sm">
            <Shield size={16} className="text-pink-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-pink-700 block mb-0.5">🛡 Security Tip</span>
              Never reuse passwords from other websites. A unique password keeps your Sparkle account safer.
            </div>
          </div>

          {/* Action Button */}
          <button type="submit" disabled={loading} className="security-btn">
            {loading ? (
              <>
                <div className="spinner" />
                Updating Please wait...
              </>
            ) : (
              'Update Password →'
            )}
          </button>
        </form>
      </div>

      <style>{`
        .security-page-bg {
          min-height: 100dvh;
          background-color: #fdf2f4;
          background-image: radial-gradient(circle at 10% 20%, rgba(244, 63, 94, 0.08) 0%, transparent 45%),
                            radial-gradient(circle at 90% 80%, rgba(219, 39, 119, 0.08) 0%, transparent 45%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 1.5rem;
          color: #1f2937;
          font-family: 'Outfit', 'Inter', sans-serif;
          position: relative;
        }

        .security-back-btn {
          position: absolute;
          top: 2rem;
          left: 2rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #4b5563;
          font-size: 0.875rem;
          font-weight: 600;
          transition: all 0.2s ease;
          background: none;
          border: none;
          outline: none;
          cursor: pointer;
        }

        .security-back-btn:hover {
          color: #db2777;
          transform: translateX(-3px);
        }

        .security-card {
          width: 100%;
          max-width: 480px;
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 28px;
          padding: 2.75rem 2.25rem;
          box-shadow: 0 25px 50px -12px rgba(219, 39, 119, 0.08), 0 0 50px rgba(219, 39, 119, 0.03);
          position: relative;
          overflow: hidden;
        }

        .animate-float-shield {
          animation: resetFloat 4s ease-in-out infinite;
        }

        .input-otp-box {
          width: 2.85rem;
          height: 3.5rem;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          text-align: center;
          font-size: 1.35rem;
          font-weight: 700;
          color: #111827;
          outline: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .input-otp-box:focus {
          border-color: #db2777;
          background: rgba(219, 39, 119, 0.02);
          box-shadow: 0 0 14px rgba(219, 39, 119, 0.2);
        }

        .security-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 16px;
          padding: 1rem 1.25rem;
          font-size: 0.95rem;
          color: #111827;
          outline: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .security-input:focus {
          border-color: #db2777;
          background: rgba(219, 39, 119, 0.02);
          box-shadow: 0 0 14px rgba(219, 39, 119, 0.2);
        }

        .requirement-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: #6b7280;
          transition: color 0.2s ease;
        }

        .requirement-item.met {
          color: #059669;
        }

        .strength-bar-container {
          height: 6px;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 9999px;
          overflow: hidden;
        }

        .strength-bar-fill {
          height: 100%;
          width: 0%;
          border-radius: 9999px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .security-btn {
          width: 100%;
          background: linear-gradient(135deg, #ec4899, #db2777);
          border: none;
          border-radius: 16px;
          padding: 1.1rem;
          color: #fff;
          font-weight: 700;
          font-size: 0.95rem;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 8px 16px -3px rgba(219, 39, 119, 0.2);
        }

        .security-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 20px -3px rgba(219, 39, 119, 0.35);
        }

        .security-btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .security-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .success-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #fdf2f4;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 50;
          animation: fadeInOverlay 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .spinner {
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-top-color: #fff;
          border-radius: 50%;
          width: 1.2rem;
          height: 1.2rem;
          animation: spin 0.8s linear infinite;
        }


        @media (max-width: 640px) {
          .security-page-bg {
            padding: 1.5rem 1rem;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
          }
          .security-card {
            padding: 2rem 1.5rem;
            border-radius: 24px;
          }
          .security-back-btn {
            position: relative;
            top: auto;
            left: auto;
            margin-bottom: 1.5rem;
            align-self: flex-start;
          }
        }

        @media (max-width: 480px) {
          .security-page-bg {
            padding: 1rem 0.5rem;
          }
          .security-card {
            padding: 1.75rem 1.25rem;
            border-radius: 20px;
          }
          .input-otp-box {
            width: 2.3rem;
            height: 3rem;
            font-size: 1.15rem;
            border-radius: 8px;
          }
          .security-card h1 {
            font-size: 1.25rem;
          }
          .security-card p {
            font-size: 0.8rem;
          }
        }

        @media (max-width: 360px) {
          .security-card {
            padding: 1.5rem 0.75rem;
          }
          .input-otp-box {
            width: 2rem;
            height: 2.6rem;
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
