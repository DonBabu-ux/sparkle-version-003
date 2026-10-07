import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, ShieldCheck, Sparkles, Heart, Users, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import {
  validateLoginInputs,
  classifyLoginError
} from '../utils/authErrorClassifier';
import type { AuthErrorInfo } from '../utils/authErrorClassifier';
import { getRoleFromToken } from '../utils/tokenUtils';
import { getPostLoginRoute } from '../utils/adminRoute';
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

  const showSuccess = (msg: string) => { setSuccess(msg); setAuthError(null); };

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
        showSuccess('Welcome back!');
        login(data.token, data.refreshToken || '', data.user);
        const targetRoute = data.next?.route === '/onboarding'
          ? '/onboarding'
          : getPostLoginRoute(data.user?.role ?? getRoleFromToken(data.token));
        setTimeout(() => navigate(targetRoute), 1500);
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
    }
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
    try {
      const res = await api.post('/auth/resend-2fa', { userId: twoFactorUserId }, { timeout: 15000 });
      showSuccess(res.data?.message || 'Verification code resent! Check your inbox or phone.');
      setCooldown(60);
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
    try {
      const res = await api.post(
        '/auth/verify-2fa',
        { userId: twoFactorUserId, code: codeToVerify, rememberMe },
        { timeout: 15000 }
      );
      const data = res.data;
      if ((data?.status === 'success' || data?.success) && data?.token) {
        showSuccess('Verification successful!');
        login(data.token, data.refreshToken || '', data.user);
        setTimeout(() => navigate(getPostLoginRoute(data.user?.role ?? getRoleFromToken(data.token))), 1200);
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
    <div className="login-page">
      {/* Soft background orbs */}
      <div className="login-orb login-orb--1" />
      <div className="login-orb login-orb--2" />

      <div className={`login-container ${mounted ? 'is-visible' : ''}`}>

        {/* LEFT: Image + Branding (Facebook-style) */}
        <div className="login-left">
          <div className="login-left__image-wrap">
            <img
              src={HERO_IMAGE}
              alt="Students connecting on campus"
              className="login-left__image"
            />
            <div className="login-left__image-overlay" />
            <div className="login-left__image-text">
              <div className="login-left__badge">
                <Sparkles size={14} strokeWidth={2.5} />
                Campus Network
              </div>
              <h2 className="login-left__headline">
                Your people<br />are here.
              </h2>
            </div>
          </div>

          <div className="login-left__info">
            <h1 className="login-left__logo">Sparkle</h1>
            <p className="login-left__tagline">
              Connect with friends and the world around you on the sweetest campus network.
            </p>
            <div className="login-left__features">
              {[
                { icon: Heart, label: 'Share moments that matter' },
                { icon: Users, label: 'Find your people instantly' },
                { icon: Sparkles, label: 'Campus-first experience' },
              ].map((f, i) => (
                <div
                  key={i}
                  className="login-feat"
                  style={{ transitionDelay: `${0.5 + i * 0.12}s` }}
                >
                  <div className="login-feat__icon">
                    <f.icon size={16} strokeWidth={2} />
                  </div>
                  <span className="login-feat__text">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Login card */}
        <div className="login-card-wrap">
          <div className={`login-card ${isShaking ? 'shake-card' : ''}`}>
            {success ? (
              <div className="login-success-anim text-center py-10 flex flex-col items-center justify-center animate-scale-up" style={{ textAlign: 'center' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  margin: '0 auto 1.5rem auto',
                  boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.3)'
                }}>
                  <ShieldCheck size={48} strokeWidth={2} className="su-spin" style={{ animation: 'su-drift 1s ease-in-out infinite' }} />
                </div>
                <h3 className="login-card__title text-2xl mb-2" style={{ fontFamily: "'Varela Round', sans-serif", fontWeight: 700 }}>Welcome Back!</h3>
                <p className="login-card__sub text-base">Signing you in securely...</p>
              </div>
            ) : !show2FA ? (
              <>
                <div className="login-card__head">
                  <h3 className="login-card__title">Welcome back</h3>
                  <p className="login-card__sub">Sign in to your Sparkle account</p>
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

                <form onSubmit={handleLogin} className="login-form">
                  <div className="login-field">
                    <label htmlFor="login-email" className="login-label">
                      <Mail size={14} strokeWidth={2.5} />
                      Email or username
                    </label>
                    <input
                      id="login-email"
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="login-input"
                      placeholder="you@university.edu"
                      autoComplete="username"
                    />
                  </div>

                  <div className="login-field">
                    <label htmlFor="login-pw" className="login-label">
                      <Lock size={14} strokeWidth={2.5} />
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="login-pw"
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="login-input pr-10"
                        placeholder="Password"
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="login-extras">
                    <label className="login-remember" style={{ display: 'flex', alignItems: 'left', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem', color: '#78716c', fontWeight: 600, marginRight: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => {
                          setRememberMe(e.target.checked);
                          localStorage.setItem('sparkle_remember_me', e.target.checked ? 'true' : 'false');
                        }}
                        className="login-checkbox"
                      /> Remember me
                    </label>
                    <Link to="/forgot-password" className="login-forgot">Forgot password?</Link>
                  </div>

                  <button type="submit" disabled={loading} className="login-btn login-btn--main">
                    {loading ? <span className="login-spin" /> : <><span>Sign in</span><ArrowRight size={18} strokeWidth={2.5} /></>}
                  </button>
                </form>

                <div className="login-sep">
                  <span>or</span>
                </div>

                <Link to="/signup" className="login-btn login-btn--alt">
                  Create new account
                </Link>

                <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.72rem', color: '#64748b', display: 'flex', itemsCenter: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link to="/legal/terms" style={{ color: '#94a3b8', textDecoration: 'none' }}>Terms &amp; Conditions</Link>
                  <span>•</span>
                  <Link to="/legal/privacy" style={{ color: '#94a3b8', textDecoration: 'none' }}>Privacy Policy</Link>
                  <span>•</span>
                  <Link to="/legal/community-guidelines" style={{ color: '#94a3b8', textDecoration: 'none' }}>Community Guidelines</Link>
                </div>
              </>
            ) : (
              <div className="login-2fa">
                <div className="login-2fa__badge">
                  <ShieldCheck size={36} strokeWidth={1.5} />
                </div>
                <h3 className="login-card__title">
                  {useRecoveryCode ? 'Recovery Backup Code' : 'Two-Factor Authentication'}
                </h3>
                <p className="login-card__sub" style={{ marginBottom: '0.75rem', lineHeight: '1.4' }}>
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

                {success && (
                  <div className="login-toast login-toast--ok" style={{ width: '100%', justifyContent: 'center' }}>
                    <span className="login-toast__dot" />
                    {success}
                  </div>
                )}

                {!useRecoveryCode && (
                  <>
                    <button 
                      onClick={handleResend2FA} 
                      disabled={loading || resendingCode || cooldown > 0}
                      type="button" 
                      className="login-btn login-btn--alt" 
                      style={{ padding: '0.6rem', fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}
                    >
                      {resendingCode ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Sending code...</span>
                        </>
                      ) : cooldown > 0 ? (
                        `Resend code in ${cooldown}s`
                      ) : (
                        'Resend code'
                      )}
                    </button>

                    <div className="login-pins">
                      {pin.map((digit, i) => (
                        <input
                          key={i}
                          id={`pin-${i}`}
                          type="text"
                          inputMode="numeric"
                          value={digit}
                          onChange={(e) => handlePinInput(i, e)}
                          onKeyDown={(e) => handlePinKeyDown(i, e)}
                          className="login-pin"
                          aria-label={`PIN digit ${i + 1}`}
                          autoFocus={i === 0}
                        />
                      ))}
                    </div>
                  </>
                )}

                {useRecoveryCode && (
                  <div style={{ width: '100%', marginBottom: '1rem' }}>
                    <button 
                      onClick={handleSendRecoveryCode} 
                      disabled={loading || resendingCode || cooldown > 0}
                      type="button" 
                      className="login-btn login-btn--alt" 
                      style={{ padding: '0.6rem', fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}
                    >
                      {resendingCode ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
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
                      className="login-pin"
                      style={{
                        width: '100%',
                        height: '50px',
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        letterSpacing: '3px',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        borderRadius: '14px',
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a'
                      }}
                      autoFocus
                    />
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem', textAlign: 'center' }}>
                      Each code can only be used once.
                    </p>
                  </div>
                )}

                <button onClick={handleVerify2FA} disabled={loading} className="login-btn login-btn--main">
                  {loading ? (
                    <span className="login-spin" />
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
                  className="login-back"
                  style={{ color: '#ff1493', fontWeight: 600, fontSize: '0.82rem', marginTop: '0.5rem' }}
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
                  className="login-back"
                  type="button"
                >
                  Back to login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        /* ================================================
           LOGIN — Varela Round + Hero Image + Glassmorphism
           ================================================ */

        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: #fdf2f4;
          position: relative;
          overflow: hidden;
          font-family: 'Nunito Sans', system-ui, sans-serif;
        }

        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.45;
          pointer-events: none;
          will-change: transform;
        }
        .login-orb--1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #fda4af, transparent 70%);
          top: -12%; left: -6%;
          animation: orb-float 20s ease-in-out infinite;
        }
        .login-orb--2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #fbcfe8, transparent 70%);
          bottom: -8%; right: -4%;
          animation: orb-float 25s ease-in-out infinite reverse;
        }
        @keyframes orb-float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(25px, -18px); }
        }

        /* Container */
        .login-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1080px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
          align-items: center;
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .login-container.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @media (min-width: 1024px) {
          .login-container {
            grid-template-columns: 1.1fr 400px;
            gap: 4rem;
          }
        }

        /* ====== LEFT PANE ====== */
        .login-left {
          display: none;
        }
        @media (min-width: 1024px) {
          .login-left {
            display: flex;
            flex-direction: column;
            gap: 1.75rem;
          }
        }

        /* Hero image */
        .login-left__image-wrap {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 16px 48px rgba(190, 18, 60, 0.1);
        }
        .login-left__image {
          width: 100%;
          height: 280px;
          object-fit: cover;
          display: block;
        }
        .login-left__image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(136, 19, 55, 0.75) 0%,
            rgba(136, 19, 55, 0.2) 50%,
            transparent 100%
          );
        }
        .login-left__image-text {
          position: absolute;
          bottom: 0;
          left: 0;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .login-left__badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(8px);
          padding: 0.3rem 0.7rem;
          border-radius: 8px;
          font-size: 0.7rem;
          font-weight: 700;
          color: #fff;
          width: fit-content;
          text-transform: none;
          font-style: normal;
        }
        .login-left__headline {
          font-family: 'Varela Round', 'Nunito Sans', sans-serif;
          font-weight: 700;
          font-size: 2rem;
          line-height: 1.15;
          color: #fff;
          text-transform: none;
          font-style: normal;
          letter-spacing: -0.01em;
        }

        /* Info block */
        .login-left__info {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .login-left__logo {
          font-family: 'Varela Round', 'Nunito Sans', sans-serif;
          font-weight: 700;
          font-size: 2.5rem;
          color: #be123c;
          letter-spacing: -0.02em;
          text-transform: none;
          font-style: normal;
        }
        .login-left__tagline {
          font-size: 1.05rem;
          line-height: 1.55;
          color: #78716c;
          max-width: 440px;
          text-transform: none;
          font-style: normal;
        }

        /* Features */
        .login-left__features {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          padding-top: 0.25rem;
        }
        .login-feat {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          opacity: 0;
          transform: translateX(-10px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .is-visible .login-feat {
          opacity: 1;
          transform: translateX(0);
        }
        .login-feat__icon {
          width: 32px; height: 32px;
          border-radius: 9px;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e11d48;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
          flex-shrink: 0;
        }
        .login-feat__text {
          font-size: 0.9rem;
          font-weight: 600;
          color: #44403c;
          text-transform: none;
          font-style: normal;
        }

        /* ====== RIGHT: CARD ====== */
        .login-card-wrap {
          display: flex;
          justify-content: center;
        }
        @media (min-width: 1024px) {
          .login-card-wrap { justify-content: flex-end; }
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.65);
          border-radius: 22px;
          padding: 2.25rem;
          box-shadow:
            0 20px 60px rgba(190, 18, 60, 0.08),
            0 4px 14px rgba(0, 0, 0, 0.03);
          transition: box-shadow 0.35s ease;
        }
        .login-card:hover {
          box-shadow:
            0 24px 68px rgba(190, 18, 60, 0.12),
            0 6px 20px rgba(0, 0, 0, 0.04);
        }

        .login-card__head { margin-bottom: 1.5rem; }
        .login-card__title {
          font-family: 'Varela Round', 'Nunito Sans', sans-serif;
          font-weight: 700;
          font-size: 1.6rem;
          color: #1c1917;
          letter-spacing: -0.01em;
          margin-bottom: 0.2rem;
          text-transform: none;
          font-style: normal;
        }
        .login-card__sub {
          font-size: 0.85rem;
          color: #a8a29e;
          text-transform: none;
          font-style: normal;
        }

        /* Toasts */
        .login-toast {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 0.9rem;
          border-radius: 11px;
          font-size: 0.82rem;
          font-weight: 600;
          margin-bottom: 1rem;
          text-transform: none;
          font-style: normal;
        }
        .login-toast--err {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
        }
        .login-toast--ok {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #047857;
        }
        .login-toast__dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .login-toast--err .login-toast__dot { background: #e11d48; }
        .login-toast--ok .login-toast__dot { background: #10b981; }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }
        .login-field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .login-label {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: #78716c;
          text-transform: none;
          font-style: normal;
        }
        .login-label svg { color: #d4d4d4 !important; }

        .login-input {
          width: 100%;
          padding: 0.8rem 0.95rem;
          background: rgba(255, 241, 242, 0.35);
          border: 1.5px solid #fecdd3;
          border-radius: 12px;
          font-size: 0.92rem;
          font-weight: 500;
          color: #1c1917;
          outline: none;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
          text-transform: none;
          font-style: normal;
        }
        .login-input::placeholder {
          color: #d4d4d4;
          text-transform: none;
          font-style: normal;
        }
        .login-input:focus {
          border-color: #fb7185;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.12);
        }

        .login-extras {
          display: flex;
          justify-content: flex-end;
        }
        .login-forgot {
          font-size: 0.78rem;
          font-weight: 700;
          color: #e11d48;
          cursor: pointer;
          transition: color 0.2s ease;
          text-transform: none;
          font-style: normal;
        }
        .login-forgot:hover { color: #be123c; }

        /* Buttons */
        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          width: 100%;
          padding: 0.85rem;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 800;
          cursor: pointer;
          border: none;
          transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.12s ease;
          text-decoration: none;
          text-transform: none;
          font-style: normal;
        }
        .login-btn:active { transform: scale(0.975); }

        .login-btn--main {
          background: linear-gradient(135deg, #fb7185 0%, #e11d48 100%);
          color: #fff;
          box-shadow: 0 6px 18px rgba(225, 29, 72, 0.22);
        }
        .login-btn--main:hover {
          box-shadow: 0 8px 26px rgba(225, 29, 72, 0.32);
        }
        .login-btn--main:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .login-btn--alt {
          background: transparent;
          color: #e11d48;
          border: 2px solid #fecdd3;
        }
        .login-btn--alt:hover {
          background: #fff1f2;
          border-color: #fda4af;
        }

        /* Divider */
        .login-sep {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          margin: 1.1rem 0;
        }
        .login-sep::before,
        .login-sep::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #fecdd3;
        }
        .login-sep span {
          font-size: 0.7rem;
          font-weight: 700;
          color: #d6d3d1;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-style: normal;
        }

        /* Spinner */
        .login-spin {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* 2FA */
        .login-2fa {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        .login-2fa__badge {
          width: 64px; height: 64px;
          border-radius: 18px;
          background: linear-gradient(135deg, #fff1f2, #ffe4e6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e11d48;
          margin-bottom: 0.25rem;
        }
        .login-pins {
          display: flex;
          gap: 0.4rem;
          justify-content: center;
        }
        .login-pin {
          width: 42px; height: 52px;
          border: 2px solid #fecdd3;
          border-radius: 11px;
          background: rgba(255, 241, 242, 0.3);
          text-align: center;
          font-size: 1.4rem;
          font-weight: 800;
          color: #e11d48;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          text-transform: none;
          font-style: normal;
        }
        .login-pin:focus {
          border-color: #fb7185;
          box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.12);
        }
        .login-back {
          font-size: 0.78rem;
          font-weight: 700;
          color: #a8a29e;
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.2s ease;
          text-transform: none;
          font-style: normal;
        }
        .login-back:hover { color: #e11d48; }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .login-orb { animation: none; }
          .login-container { transition: none; }
          .login-feat { transition: none; opacity: 1; transform: none; }
          .login-card { transition: none; }
          .shake-card { animation: none !important; }
        }

        /* Subtle horizontal card shake on credentials error */
        @keyframes gentleShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .shake-card {
          animation: gentleShake 0.4s ease-in-out !important;
        }
      `}</style>
    </div>
  );
}
