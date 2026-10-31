import { showSuccess } from '../utils/toast';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, ShieldCheck, Sparkles, Heart, Users, Mail, Eye, EyeOff } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import {
  validateLoginInputs,
  classifyLoginError
} from '../utils/authErrorClassifier';
import type { AuthErrorInfo } from '../utils/authErrorClassifier';
import { getRoleFromToken } from '../utils/tokenUtils';
import { getPostLoginRoute } from '../utils/adminRoute';
import { recordDeviceSession } from '../utils/deviceSession';
import AuthErrorCard from '../components/auth/AuthErrorCard';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=640&q=80&auto=format';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // 2FA State
  const [show2FA, setShow2FA] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [twoFactorUserId, setTwoFactorUserId] = useState('');
  const [twoFactorMessage, setTwoFactorMessage] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resendingCode, setResendingCode] = useState(false);

  const { login } = useUserStore();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  // Post-login navigation timer — must be cleared on unmount/re-submit, else a
  // stale timer fires after the user already navigated away and bounces them
  // to /dashboard (seen as: open chat → suddenly back on home).
  const postLoginNavTimer = useRef<number | null>(null);
  const clearPostLoginNav = useCallback(() => {
    if (postLoginNavTimer.current !== null) {
      window.clearTimeout(postLoginNavTimer.current);
      postLoginNavTimer.current = null;
    }
  }, []);
  useEffect(() => clearPostLoginNav, [clearPostLoginNav]);

  useEffect(() => { setMounted(true); }, []);

  // Listen to network connectivity changes
  useEffect(() => {
    const handleOnline = () => {
      if (authError?.type === 'OFFLINE') {
        setAuthError(null);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [authError]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  }, []);

  const setSuccessView = (msg: string) => { setSuccess(msg); setAuthError(null); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setAuthError(null);

    const cleanEmail = email.trim().toLowerCase();
    setEmail(cleanEmail);

    // 1. Client-side input validation
    const validationError = validateLoginInputs(cleanEmail, password);
    if (validationError) {
      setAuthError(validationError);
      triggerShake();
      if (validationError.action === 'focus_email') {
        document.getElementById('login-email')?.focus();
      } else if (validationError.action === 'focus_password') {
        document.getElementById('login-pw')?.focus();
      }
      return;
    }

    // 2. Client-side online detection
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuthError({
        type: 'OFFLINE',
        title: "You're offline",
        message: 'No internet connection. Check your connection and try again.',
        action: 'retry',
        actionLabel: 'Try again',
        severity: 'warning'
      });
      return;
    }

    setLoading(true);
    clearPostLoginNav(); // cancel any pending post-login navigation from a previous submit
    try {
      // 15-second client-side timeout for responsive feedback
      const res = await api.post(
        '/auth/login',
        { username: cleanEmail, password },
        { timeout: 15000 }
      );
      const data = res.data;

      if (data?.status === 'requires_2fa' || data?.status === 'twofa_required') {
        setShow2FA(true);
        setTwoFactorUserId(data.userId);
        setTwoFactorMessage(data.message || 'Please enter your verification code or recovery backup code.');
        setCooldown(60);
        setLoading(false);
        setAuthError(null);
        return;
      }

      if ((data?.status === 'success' || data?.success) && data?.token) {
        setSuccessView('Welcome back!');
        login(data.token, data.refreshToken || '', data.user);
        recordDeviceSession(data.user?.user_id, data.sessionId);
        const targetRoute = data.next?.route === '/onboarding'
          ? '/onboarding'
          : getPostLoginRoute(data.user?.role ?? getRoleFromToken(data.token));
        clearPostLoginNav();
        postLoginNavTimer.current = window.setTimeout(() => {
          postLoginNavTimer.current = null;
          navigate(targetRoute);
        }, 1500);
        return;
      }

      // Unexpected response structure
      const classified = classifyLoginError(data);
      setAuthError(classified);
      setPassword('');
      document.getElementById('login-pw')?.focus();
      if (classified.shake) triggerShake();
    } catch (err) {
      const classified = classifyLoginError(err, { isOnline: navigator.onLine });
      setAuthError(classified);

      // Security practice: preserve email, clear password on credential failure
      if (classified.type === 'INVALID_CREDENTIALS') {
        setPassword('');
        document.getElementById('login-pw')?.focus();
      }

      if (classified.shake) {
        triggerShake();
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/[^0-9]/g, '');
    if (cleaned.length > 1) {
      // Handle paste
      const newPin = [...pin];
      for (let i = 0; i < cleaned.length && index + i < 6; i++) {
        newPin[index + i] = cleaned[i];
      }
      setPin(newPin);
      const nextIndex = Math.min(index + cleaned.length, 5);
      document.getElementById(`pin-${nextIndex}`)?.focus();
    } else {
      // Handle single digit
      const newPin = [...pin];
      newPin[index] = cleaned;
      setPin(newPin);
      if (cleaned && index < 5) {
        document.getElementById(`pin-${index + 1}`)?.focus();
      }
    }
    // Dismiss the resend-success toast as soon as the user starts typing
    if (success) setSuccess('');
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newPin = [...pin];
      if (pin[index]) {
        newPin[index] = '';
        setPin(newPin);
      } else if (index > 0) {
        newPin[index - 1] = '';
        setPin(newPin);
        document.getElementById(`pin-${index - 1}`)?.focus();
      }
    } else if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const newPin = [...pin];
      newPin[index] = e.key;
      setPin(newPin);
      if (index < 5) {
        document.getElementById(`pin-${index + 1}`)?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      document.getElementById(`pin-${index - 1}`)?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      document.getElementById(`pin-${index + 1}`)?.focus();
    }
  };

  const handleResend2FA = async () => {
    if (cooldown > 0 || resendingCode) return;
    setResendingCode(true);
    setAuthError(null);
    setSuccess('');
    try {
      const res = await api.post('/auth/resend-2fa', { userId: twoFactorUserId }, { timeout: 15000 });
      // Clear the old pin so the user enters the fresh code
      setPin(['', '', '', '', '', '']);
      showSuccess(res.data?.message || 'Verification code resent! Check your inbox or phone.');
      setCooldown(60);
      // Restore focus to first pin input
      setTimeout(() => document.getElementById('pin-0')?.focus(), 50);
    } catch (err: unknown) {
      const classified = classifyLoginError(err, { isOnline: navigator.onLine });
      setAuthError(classified);
    } finally {
      setResendingCode(false);
    }
  };

  const handleSendRecoveryCode = async () => {
    if (cooldown > 0 || resendingCode) return;
    setResendingCode(true);
    setAuthError(null);
    try {
      const res = await api.post('/auth/request-2fa-recovery', { userId: twoFactorUserId }, { timeout: 15000 });
      showSuccess(res.data?.message || 'Recovery code sent! It expires in 15 minutes.');
      setCooldown(60);
    } catch (err: unknown) {
      const classified = classifyLoginError(err, { isOnline: navigator.onLine });
      setAuthError(classified);
    } finally {
      setResendingCode(false);
    }
  };

  const handleVerify2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSuccess('');
    setAuthError(null);

    const codeToVerify = useRecoveryCode ? recoveryCode.trim() : pin.join('');
    if (!useRecoveryCode && codeToVerify.length !== 6) {
      setAuthError({
        type: 'INVALID_REQUEST',
        title: 'Incomplete code',
        message: 'Please enter the full 6-digit verification code.',
        severity: 'warning'
      });
      return;
    }
    if (useRecoveryCode && codeToVerify.length < 8) {
      setAuthError({
        type: 'INVALID_REQUEST',
        title: 'Check recovery code',
        message: 'Please enter your recovery backup code (e.g. 5A2F9-C104B).',
        severity: 'warning'
      });
      return;
    }

    setLoading(true);
    clearPostLoginNav();
    try {
      const res = await api.post(
        '/auth/verify-2fa',
        { userId: twoFactorUserId, code: codeToVerify, rememberMe },
        { timeout: 15000 }
      );
      const data = res.data;
      if ((data?.status === 'success' || data?.success) && data?.token) {
        setSuccessView('Verification successful!');
        login(data.token, data.refreshToken || '', data.user);
        recordDeviceSession(data.user?.user_id, data.sessionId);
        clearPostLoginNav();
        postLoginNavTimer.current = window.setTimeout(() => {
          postLoginNavTimer.current = null;
          navigate(getPostLoginRoute(data.user?.role ?? getRoleFromToken(data.token)));
        }, 1200);
      }
    } catch (err: unknown) {
      const classified = classifyLoginError(err, { isOnline: navigator.onLine });
      setAuthError(classified);
      if (useRecoveryCode) {
        setRecoveryCode('');
      } else {
        setPin(['', '', '', '', '', '']);
        document.getElementById('pin-0')?.focus();
      }
      if (classified.shake) triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#f8e7ed] p-6 font-sans dark:bg-zinc-900">

      <div className={`relative z-10 grid w-full max-w-[1080px] grid-cols-1 items-center gap-8 transition-all duration-700 ease-out lg:grid-cols-[1.1fr_400px] lg:gap-16 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>

        {/* LEFT: Image + Branding */}
        <div className="hidden flex-col gap-7 lg:flex">
          <div className="relative overflow-hidden rounded-3xl border border-[#e6d8e1] shadow-sm dark:border-zinc-700">
            <img
              src={HERO_IMAGE}
              alt="Students connecting on campus"
              className="h-72 w-full object-cover"
            />
            <div className="absolute inset-0 bg-[#18181b]/60 dark:bg-zinc-900/70" />
            <div className="absolute bottom-0 left-0 flex flex-col gap-2 p-6">
              <div className="flex w-fit items-center gap-2 rounded-full bg-[#18181b] px-3 py-1 text-xs font-semibold text-white">
                <Sparkles size={14} strokeWidth={2.5} className="text-[#ff1493]" />
                Campus Network
              </div>
              <h2 className="text-2xl font-bold leading-tight text-white">
                Your people<br />are here.
              </h2>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-[#18181b] dark:text-zinc-100">Sparkle</h1>
            <p className="max-w-[440px] text-base leading-relaxed text-slate-600 dark:text-zinc-300">
              Connect with friends and the world around you on the sweetest campus network.
            </p>
            <div className="flex flex-col gap-2.5 pt-1">
              {[
                { icon: Heart, label: 'Share moments that matter' },
                { icon: Users, label: 'Find your people instantly' },
                { icon: Sparkles, label: 'Campus-first experience' },
              ].map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                  style={{ transitionDelay: `${0.5 + i * 0.12}s` }}
                >
                  <f.icon size={16} strokeWidth={2} className="shrink-0 text-[#ff1493]" />
                  <span className="text-sm font-medium text-[#18181b] dark:text-zinc-100">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Login card */}
        <div className="flex justify-center lg:justify-end">
          <div className={`w-full max-w-[400px] rounded-3xl border border-[#e6d8e1] bg-[#fdf8fa] p-8 shadow-sm transition-shadow dark:border-zinc-700 dark:bg-zinc-800 ${isShaking ? 'animate-[gentleShake_0.4s_ease-in-out]' : ''}`}>
            {success ? (
              <div className="flex flex-col items-center justify-center gap-4 py-10 text-center animate-scale-in">
                <ShieldCheck size={48} strokeWidth={2} className="text-emerald-500 dark:text-emerald-400" />
                <h3 className="text-2xl font-bold text-[#18181b] dark:text-zinc-100">Welcome back</h3>
                <p className="text-base text-slate-600 dark:text-zinc-300">Signing you in securely...</p>
              </div>
            ) : !show2FA ? (
              <>
                <div className="mb-6">
                  <h3 className="mb-1 text-2xl font-bold text-[#18181b] dark:text-zinc-100">Welcome back</h3>
                  <p className="text-sm text-slate-600 dark:text-zinc-300">Sign in to your Sparkle account</p>
                </div>

                <AuthErrorCard
                  error={authError}
                  onDismiss={() => setAuthError(null)}
                  onRetry={() => {
                    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                    handleLogin(fakeEvent);
                  }}
                  onFocusField={(field) => {
                    if (field === 'email') document.getElementById('login-email')?.focus();
                    if (field === 'password') document.getElementById('login-pw')?.focus();
                  }}
                />

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-email" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      <Mail size={14} strokeWidth={2.5} className="text-[#ff1493]" />
                      Email or username
                    </label>
                    <input
                      id="login-email"
                      type="text"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 w-full rounded-xl border border-[#e6d8e1] bg-[#f6eef3] px-4 text-sm text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-300"
                      placeholder="you@university.edu"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-pw" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      <Lock size={14} strokeWidth={2.5} className="text-[#ff1493]" />
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="login-pw"
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[#e6d8e1] bg-[#f6eef3] px-4 pr-10 text-sm text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-300"
                        placeholder="Password"
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#ff1493] transition-colors hover:text-[#ff2d87]"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => {
                          setRememberMe(e.target.checked);
                          localStorage.setItem('sparkle_remember_me', e.target.checked ? 'true' : 'false');
                        }}
                        className="h-4 w-4 accent-[#ff1493]"
                      /> Remember me
                    </label>
                    <Link to="/forgot-password" className="text-xs font-semibold text-[#ff1493] transition-colors hover:text-[#ff2d87]">Forgot password?</Link>
                  </div>

                  <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff1493] text-sm font-bold text-white transition-colors hover:bg-[#ff2d87] disabled:cursor-not-allowed disabled:opacity-60">
                    {loading ? <Spinner size="small" color="#fff" /> : <><span>Sign in</span><ArrowRight size={18} strokeWidth={2.5} /></>}
                  </button>
                </form>

                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#ede3e9] dark:bg-zinc-900" />
                  <span className="text-xs text-slate-600 dark:text-zinc-300">or</span>
                  <div className="h-px flex-1 bg-[#ede3e9] dark:bg-zinc-900" />
                </div>

                <Link to="/signup" className="flex h-12 w-full items-center justify-center rounded-full border border-[#e6d8e1] bg-[#fdf8fa] text-sm font-bold text-[#18181b] transition-colors hover:bg-[#f6eef3] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
                  Create new account
                </Link>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 dark:text-zinc-300">
                  <Link to="/legal/terms" className="transition-colors hover:text-[#18181b] dark:hover:text-zinc-100">Terms &amp; Conditions</Link>
                  <span aria-hidden="true">•</span>
                  <Link to="/legal/privacy" className="transition-colors hover:text-[#18181b] dark:hover:text-zinc-100">Privacy Policy</Link>
                  <span aria-hidden="true">•</span>
                  <Link to="/recovery" className="font-semibold text-[#ff1493] transition-colors hover:text-[#ff2d87]">Account Recovery &amp; Appeals</Link>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <ShieldCheck size={36} strokeWidth={1.5} className="text-[#ff1493]" />
                <h3 className="text-2xl font-bold text-[#18181b] dark:text-zinc-100">
                  {useRecoveryCode ? 'Recovery backup code' : 'Two-factor authentication'}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                  {useRecoveryCode
                    ? 'Enter one of your 10-character emergency recovery codes (e.g. 5A2F9-C104B).'
                    : twoFactorMessage || 'Enter the 6-digit verification code sent to your account.'}
                </p>

                <AuthErrorCard
                  error={authError}
                  onDismiss={() => setAuthError(null)}
                  onRetry={() => {
                    handleVerify2FA();
                  }}
                />

                {!useRecoveryCode && (
                  <>
                    <button
                      onClick={handleResend2FA}
                      disabled={loading || resendingCode || cooldown > 0}
                      type="button"
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#e6d8e1] bg-[#fdf8fa] px-4 text-sm font-semibold text-[#18181b] transition-colors hover:bg-[#f6eef3] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    >
                      {resendingCode ? (
                        <>
                          <Spinner size="small" />
                          <span>Sending code...</span>
                        </>
                      ) : cooldown > 0 ? (
                        `Resend code in ${cooldown}s`
                      ) : (
                        'Resend code'
                      )}
                    </button>

                    <div className="flex justify-center gap-2">
                      {pin.map((digit, i) => (
                        <input
                          key={i}
                          id={`pin-${i}`}
                          name={`pin-${i}`}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={digit}
                          onChange={(e) => handlePinInput(i, e)}
                          onKeyDown={(e) => handlePinKeyDown(i, e)}
                          className="h-13 w-11 rounded-xl border-2 border-[#e6d8e1] bg-[#f6eef3] text-center text-xl font-bold text-[#18181b] outline-none transition-colors focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          aria-label={`PIN digit ${i + 1}`}
                          autoFocus={i === 0}
                        />
                      ))}
                    </div>
                  </>
                )}

                {useRecoveryCode && (
                  <div className="w-full">
                    <button
                      onClick={handleSendRecoveryCode}
                      disabled={loading || resendingCode || cooldown > 0}
                      type="button"
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#e6d8e1] bg-[#fdf8fa] px-4 text-sm font-semibold text-[#18181b] transition-colors hover:bg-[#f6eef3] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    >
                      {resendingCode ? (
                        <>
                          <Spinner size="small" />
                          <span>Sending recovery code...</span>
                        </>
                      ) : cooldown > 0 ? (
                        `Send recovery code in ${cooldown}s`
                      ) : (
                        'Email me a temporary recovery code'
                      )}
                    </button>
                    <input
                      type="text"
                      placeholder="XXXXX-XXXXX"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                      className="mt-3 h-12 w-full rounded-xl border border-[#e6d8e1] bg-[#f6eef3] text-center text-lg font-bold uppercase tracking-[3px] text-[#18181b] outline-none transition-colors focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      autoFocus
                    />
                    <p className="mt-1.5 text-center text-xs text-slate-600 dark:text-zinc-300">
                      Each code can only be used once.
                    </p>
                  </div>
                )}

                <button onClick={handleVerify2FA} disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff1493] text-sm font-bold text-white transition-colors hover:bg-[#ff2d87] disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? (
                    <Spinner size="small" color="#fff" />
                  ) : (
                    <>
                      <span>{useRecoveryCode ? 'Verify recovery code' : 'Verify code'}</span>
                      <ArrowRight size={18} strokeWidth={2.5} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode(!useRecoveryCode);
                    setAuthError(null);
                  }}
                  className="text-sm font-semibold text-[#ff1493] transition-colors hover:text-[#ff2d87]"
                >
                  {useRecoveryCode ? '← Use 6-digit verification code' : 'Lost your device? Use a recovery backup code'}
                </button>

                <button
                  onClick={() => {
                    setShow2FA(false);
                    setPin(['', '', '', '', '', '']);
                    setRecoveryCode('');
                    setUseRecoveryCode(false);
                  }}
                  className="text-xs font-semibold text-slate-600 transition-colors hover:text-[#18181b] dark:text-zinc-300 dark:hover:text-zinc-100"
                  type="button"
                >
                  Back to login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}


