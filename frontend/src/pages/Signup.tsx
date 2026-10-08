import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail, ArrowRight, ArrowLeft, Check, Users, Heart, Eye, EyeOff,
  Sparkles, Compass, Orbit, GraduationCap, Building2, Briefcase,
} from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

type Step = 1 | 2 | 3 | 4 | 5;

const HERO_IMAGE = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=640&q=80&auto=format';

const UNIVERSITIES = [
  'Karatina University', 'Chuka University', 'Dedan Kimathi University',
  'Mount Kenya University', "Murang'a University", 'Pwani University',
  'Mount Media University', 'University of Nairobi',
];

const AFFILIATION_TYPES = [
  { id: 'University', icon: GraduationCap, label: 'University' },
  { id: 'Company', icon: Building2, label: 'Company' },
  { id: 'Business', icon: Briefcase, label: 'Business' },
];

export default function Signup() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    name: '', username: '', email: '', password: '',
    affiliation_type: 'University', campus: '', major: '', year: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Availability checks
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  // Password strength
  const [passwordStrength, setPasswordStrength] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [pwdCriteria, setPwdCriteria] = useState({
    length: false,
    upper: false,
    number: false,
    special: false
  });
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const navigate = useNavigate();
  const { login } = useUserStore();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (otpCooldown > 0) {
      const t = setInterval(() => setOtpCooldown(p => p - 1), 1000);
      return () => clearInterval(t);
    }
  }, [otpCooldown]);

  useEffect(() => {
    if (!form.username.trim() || form.username.length < 3) {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      return;
    }
    setCheckingUsername(true);
    const handler = setTimeout(async () => {
      try {
        const res = await api.get(
          `/auth/check-username?username=${encodeURIComponent(form.username.trim())}&name=${encodeURIComponent(form.name.trim())}`
        );
        if (res.data) {
          setUsernameAvailable(res.data.available);
          setUsernameSuggestions(res.data.suggestions || []);
        }
      } catch (err) {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [form.username, form.name]);

  useEffect(() => {
    const emailTrim = form.email.trim();
    if (!emailTrim || !emailTrim.includes('@')) {
      setEmailAvailable(null);
      return;
    }
    setCheckingEmail(true);
    const handler = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-email?email=${encodeURIComponent(emailTrim)}`);
        if (res.data) {
          setEmailAvailable(res.data.available);
        }
      } catch (err) {
        setEmailAvailable(null);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [form.email]);

  useEffect(() => {
    const pwd = form.password;
    const criteria = {
      length: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[^A-Za-z0-9]/.test(pwd)
    };
    setPwdCriteria(criteria);

    let score = 0;
    if (criteria.length) score++;
    if (criteria.upper) score++;
    if (criteria.number) score++;
    if (criteria.special) score++;

    if (!pwd) setPasswordStrength('');
    else if (score <= 2) setPasswordStrength('weak');
    else if (score === 3) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  }, [form.password]);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const showError = (msg: string) => { setError(msg); setSuccess(''); };
  const showSuccess = (msg: string) => { setSuccess(msg); setError(''); };
  const prevStep = () => { if (step > 1) setStep((step - 1) as Step); };
  const nextStep = () => { if (step < 5) setStep((step + 1) as Step); };

  const validateStep2 = () => {
    if (!form.name.trim()) return 'Name required.';
    if (!form.username.trim() || form.username.length < 3) return 'Username must be at least 3 characters.';
    if (usernameAvailable === false) return 'Username is already taken.';
    if (!form.email.trim() || !form.email.includes('@')) return 'Invalid email address.';
    if (emailAvailable === false) return 'Email address is already registered.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (!pwdCriteria.upper || !pwdCriteria.number || !pwdCriteria.special) return 'Password must meet all requirements.';
    return '';
  };

  const handleNextFromStep2 = () => {
    const err = validateStep2();
    if (err) { showError(err); return; }
    setError('');
    setStep(3);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/signup', {
        name: form.name, username: form.username,
        email: form.email, password: form.password,
        campus: form.affiliation_type !== 'None' ? form.campus : undefined,
        major: form.major || undefined, year: form.year || undefined,
        user_type: 'student',
        terms_version: '1.0',
        privacy_version: '1.0',
      });
      // A.4 #2: signup tokens were mirrored into localStorage
      // (`sparkle_signup_*`) but never read anywhere — removed. The verify-email
      // step issues the real session (login() below).
      showSuccess('Signed up! Verify your email.');
      setStep(5);
      setOtpCooldown(60);
    } catch (err) {
      const e = err as {
        response?: {
          data?: {
            message?: string;
            errors?: Array<{ field?: string; code?: string; message?: string; suggestions?: string[] }>;
          };
        }
      };
      const data = e.response?.data;
      const taken = data?.errors?.find(x => x.code === 'USERNAME_TAKEN' && x.suggestions?.length);
      if (taken?.suggestions) {
        setUsernameSuggestions(taken.suggestions);
        setUsernameAvailable(false);
        setStep(2); // land the user back on the username field with chips visible
      }
      showError(data?.message || taken?.message || data?.errors?.[0]?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) { showError('6-digit code required'); return; }
    setVerifying(true);
    setError('');
    try {
      const res = await api.post('/auth/verify-email', { email: form.email, code: otpCode });
      const data = res.data;

      // Assume backend returns tokens and next route
      if (data?.token) {
        login(data.token, data.refreshToken || '', data.user);
      }

      showSuccess('Verified! Redirecting...');
      const targetRoute = data?.next?.route || '/dashboard';
      setTimeout(() => navigate(targetRoute), 1500);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      showError(e.response?.data?.message || 'Invalid code.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0 || resendingOtp) return;
    setResendingOtp(true);
    setError('');
    try {
      await api.post('/auth/resend-verification', { email: form.email });
      showSuccess('Verification code resent!');
      setOtpCooldown(60);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; retryAfter?: number } } };
      const retryAfter = e.response?.data?.retryAfter;
      if (retryAfter) setOtpCooldown(retryAfter);
      showError(e.response?.data?.message || 'Failed to resend code.');
    } finally {
      setResendingOtp(false);
    }
  };

  return (
    <div className="su-page">
      <div className="su-orb su-orb--1" />
      <div className="su-orb su-orb--2" />

      <div className={`su-container ${mounted ? 'is-visible' : ''}`}>

        {/* LEFT: Image + Branding */}
        <div className="su-left">
          <div className="su-img-wrap">
            <img src={HERO_IMAGE} alt="Students on campus" className="su-img" />
            <div className="su-img-overlay" />
            <div className="su-img-text">
              <div className="su-badge">
                <Sparkles size={14} strokeWidth={2.5} />
                Join the community
              </div>
              <h2 className="su-img-headline">Start something<br />beautiful.</h2>
            </div>
          </div>

          <div className="su-info">
            <h1 className="su-logo">Sparkle</h1>
            <p className="su-tagline">
              It's quick and easy. Join the sweetest Sparkle network and bloom with your people.
            </p>
            <div className="su-features">
              {[
                { icon: Compass, label: 'Explore Sparkle spots' },
                { icon: Users, label: 'Find your people' },
                { icon: Heart, label: 'Share real moments' },
                { icon: Orbit, label: 'Stay connected' },
              ].map((f, i) => (
                <div key={i} className="su-feat" style={{ transitionDelay: `${0.5 + i * 0.1}s` }}>
                  <div className="su-feat__icon"><f.icon size={16} strokeWidth={2} /></div>
                  <span className="su-feat__text">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Signup card */}
        <div className="su-card-wrap">
          <div className="su-card">
            <div className="su-card__head">
              <h3 className="su-card__title">Create account</h3>
              <div className="su-card__step-row">
                <p className="su-card__sub">Step {step} of 5</p>
                <div className="su-progress">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className={`su-progress__dot ${s <= step ? 'su-progress__dot--active' : ''}`} />
                  ))}
                </div>
              </div>
            </div>

            {(error || success) && (
              <div className={`su-toast ${error ? 'su-toast--err' : 'su-toast--ok'}`}>
                <span className="su-toast__dot" />
                {error || success}
              </div>
            )}

            <div className="su-body">
              {/* Step 1: Welcome */}
              {step === 1 && (
                <div className="su-step">
                  <button onClick={nextStep} className="su-btn su-btn--main" type="button">
                    Get started
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </button>

                  <p className="su-link-row">
                    Already have an account?{' '}
                    <Link to="/login" className="su-link">Sign in</Link>
                  </p>
                </div>
              )}

              {/* Step 2: Details */}
              {step === 2 && (
                <div className="su-step">
                  <div className="su-grid-2">
                    <div className="su-field">
                      <label className="su-label">Full name</label>
                      <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} className="su-input" placeholder="Jane Doe" />
                    </div>
                    <div className="su-field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="su-label">Username</label>
                        {checkingUsername && <span style={{ fontSize: '0.65rem', color: '#a8a29e' }}>Checking...</span>}
                        {!checkingUsername && usernameAvailable === true && <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold' }}>✓ Available</span>}
                        {!checkingUsername && usernameAvailable === false && <span style={{ fontSize: '0.65rem', color: '#e11d48', fontWeight: 'bold' }}>✖ Taken</span>}
                      </div>
                      <input type="text" value={form.username} onChange={(e) => update('username', e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))} className="su-input" placeholder="janedoe" />
                    </div>
                  </div>
                  
                  {!checkingUsername && usernameAvailable === false && usernameSuggestions.length > 0 && (
                    <div style={{ marginTop: '-0.4rem', marginBottom: '0.2rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                      <span className="su-muted" style={{ fontSize: '0.72rem', color: '#78716c' }}>Suggestions:</span>
                      {usernameSuggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => { update('username', sug); setUsernameAvailable(true); }}
                          className="su-suggest"
                          style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '6px',
                            border: '1px solid #fecdd3',
                            backgroundColor: '#fff',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#e11d48',
                            cursor: 'pointer'
                          }}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="su-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="su-label">Email address</label>
                      {checkingEmail && <span style={{ fontSize: '0.65rem', color: '#a8a29e' }}>Checking...</span>}
                      {!checkingEmail && emailAvailable === true && <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold' }}>✓ Available</span>}
                      {!checkingEmail && emailAvailable === false && <span style={{ fontSize: '0.65rem', color: '#e11d48', fontWeight: 'bold' }}>✖ Registered</span>}
                    </div>
                    <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="su-input" placeholder="you@university.edu" />
                  </div>

                  <div className="su-field">
                    <label className="su-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => update('password', e.target.value)}
                        className="su-input"
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          color: '#a8a29e'
                        }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {form.password && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <div className="su-muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600, color: '#78716c', marginBottom: '0.2rem' }}>
                          <span>Strength:</span>
                          <span style={{
                            color: passwordStrength === 'strong' ? '#10b981' : passwordStrength === 'medium' ? '#f59e0b' : '#e11d48',
                            textTransform: 'capitalize'
                          }}>{passwordStrength}</span>
                        </div>
                        <div style={{ height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: passwordStrength === 'strong' ? '100%' : passwordStrength === 'medium' ? '66%' : '33%',
                            backgroundColor: passwordStrength === 'strong' ? '#10b981' : passwordStrength === 'medium' ? '#f59e0b' : '#e11d48',
                            transition: 'width 0.3s ease, background-color 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '0.4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                      {[
                        { label: '8+ characters', met: pwdCriteria.length },
                        { label: 'One uppercase', met: pwdCriteria.upper },
                        { label: 'One number', met: pwdCriteria.number },
                        { label: 'One special char', met: pwdCriteria.special }
                      ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: item.met ? '#10b981' : '#a8a29e', fontWeight: 600 }}>
                          <span style={{ fontSize: '0.8rem' }}>{item.met ? '✓' : '○'}</span>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="su-nav-row">
                    <button onClick={prevStep} className="su-nav-back" type="button"><ArrowLeft size={20} /></button>
                    <button onClick={handleNextFromStep2} className="su-btn su-btn--main" type="button">
                      Next <ArrowRight size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Affiliation */}
              {step === 3 && (
                <div className="su-step">
                  <div className="su-affil-grid">
                    {AFFILIATION_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => update('affiliation_type', type.id)}
                        className={`su-affil ${form.affiliation_type === type.id ? 'su-affil--active' : ''}`}
                        type="button"
                      >
                        <type.icon size={22} strokeWidth={2} />
                        <span>{type.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="su-field">
                    <label className="su-label">Sparkle Region</label>
                    <select value={form.campus} onChange={(e) => update('campus', e.target.value)} className="su-input su-select">
                      <option value="">Select your Sparkle region...</option>
                      {UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>

                  <div className="su-field">
                    <label className="su-label">Major</label>
                    <input type="text" value={form.major} onChange={(e) => update('major', e.target.value)} className="su-input" placeholder="Computer Science" />
                  </div>

                  <div className="su-nav-row">
                    <button onClick={prevStep} className="su-nav-back" type="button"><ArrowLeft size={20} /></button>
                    <button onClick={nextStep} className="su-btn su-btn--main" type="button">
                      Almost there <ArrowRight size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {step === 4 && (
                <div className="su-step">
                  <div className="su-review">
                    <div className="su-review__row">
                      <div className="su-review__avatar">
                        <Check size={28} strokeWidth={3} />
                      </div>
                      <div>
                        <h4 className="su-review__name">{form.name || 'Your Name'}</h4>
                        <p className="su-review__handle">@{form.username || 'username'}</p>
                      </div>
                    </div>
                    <div className="su-review__detail">
                      <span className="su-review__label">Sparkle Region</span>
                      <span className="su-review__value">{form.campus || 'Sparkle Global'}</span>
                    </div>
                  </div>

                  <p className="su-muted" style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', margin: '0.75rem 0 1rem 0', lineHeight: 1.5 }}>
                    By creating an account, you agree to Sparkle's{' '}
                    <Link to="/legal/terms" target="_blank" style={{ color: '#ec4899', textDecoration: 'underline', fontWeight: 600 }}>
                      Terms &amp; Conditions
                    </Link>{' '}
                    and acknowledge the{' '}
                    <Link to="/legal/privacy" target="_blank" style={{ color: '#ec4899', textDecoration: 'underline', fontWeight: 600 }}>
                      Privacy Policy
                    </Link>.
                  </p>

                  <button onClick={handleSubmit} disabled={loading} className="su-btn su-btn--main su-btn--lg" type="button">
                    {loading ? <span className="su-spin" /> : 'Create my account'}
                  </button>
                  <button onClick={prevStep} className="su-back-text" type="button">Make changes</button>
                </div>
              )}

              {/* Step 5: OTP */}
              {otpSuccess ? (
                <div className="su-step su-step--center py-10 animate-scale-up" style={{ textAlign: 'center' }}>
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
                    <Check size={48} strokeWidth={3} className="su-spin" style={{ animation: 'su-drift 1s ease-in-out infinite' }} />
                  </div>
                  <h3 className="su-card__title text-2xl mb-2" style={{ fontFamily: "'Varela Round', sans-serif", fontWeight: 700 }}>Verified!</h3>
                  <p className="su-card__sub text-base">Setting up your profile...</p>
                </div>
              ) : step === 5 ? (
                <div className="su-step su-step--center">
                  <div className="su-otp-icon">
                    <Mail size={40} strokeWidth={1.5} />
                  </div>
                  <h3 className="su-card__title">Verify email</h3>
                  <p className="su-card__sub">
                    Code sent to <strong style={{ color: '#e11d48' }}>{form.email}</strong>
                  </p>

                  <input
                    type="text" value={otpCode} maxLength={6}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="su-otp-input"
                    placeholder="000000"
                  />

                  <button onClick={handleVerifyOTP} disabled={verifying} className="su-btn su-btn--main" type="button">
                    {verifying ? <span className="su-spin" /> : 'Complete signup'}
                  </button>
                  <button
                    className="su-back-text"
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendingOtp || otpCooldown > 0}
                    style={{ opacity: resendingOtp || otpCooldown > 0 ? 0.5 : 1 }}
                  >
                    {resendingOtp ? 'Sending…' : otpCooldown > 0 ? `Resend code (${otpCooldown}s)` : 'Resend code'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .su-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: #fdf2f4;
          position: relative;
          overflow: hidden;
          font-family: 'Nunito Sans', system-ui, sans-serif;
        }

        .su-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.4;
          pointer-events: none;
          will-change: transform;
        }
        .su-orb--1 {
          width: 480px; height: 480px;
          background: radial-gradient(circle, #fda4af, transparent 70%);
          top: -10%; right: -5%;
          animation: su-drift 20s ease-in-out infinite;
        }
        .su-orb--2 {
          width: 380px; height: 380px;
          background: radial-gradient(circle, #fbcfe8, transparent 70%);
          bottom: -8%; left: -4%;
          animation: su-drift 24s ease-in-out infinite reverse;
        }

        .su-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1100px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
          align-items: center;
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .su-container.is-visible { opacity: 1; transform: translateY(0); }
        @media (min-width: 1024px) {
          .su-container { grid-template-columns: 1.1fr 440px; gap: 4rem; }
        }

        /* LEFT */
        .su-left { display: none; }
        @media (min-width: 1024px) { .su-left { display: flex; flex-direction: column; gap: 1.75rem; } }

        .su-img-wrap {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 16px 48px rgba(190, 18, 60, 0.1);
        }
        .su-img { width: 100%; height: 260px; object-fit: cover; display: block; }
        .su-img-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(136, 19, 55, 0.75) 0%, rgba(136, 19, 55, 0.15) 55%, transparent 100%);
        }
        .su-img-text {
          position: absolute; bottom: 0; left: 0; padding: 1.5rem;
          display: flex; flex-direction: column; gap: 0.5rem;
        }
        .su-badge {
          display: inline-flex; align-items: center; gap: 0.35rem;
          background: rgba(255,255,255,0.2); backdrop-filter: blur(8px);
          padding: 0.3rem 0.7rem; border-radius: 8px;
          font-size: 0.7rem; font-weight: 700; color: #fff;
          width: fit-content; text-transform: none; font-style: normal;
        }
        .su-img-headline {
          font-family: 'Varela Round', sans-serif;
          font-weight: 700; font-size: 2rem; line-height: 1.15;
          color: #fff; text-transform: none; font-style: normal;
        }

        .su-info { display: flex; flex-direction: column; gap: 0.75rem; }
        .su-logo {
          font-family: 'Varela Round', sans-serif;
          font-weight: 700; font-size: 2.4rem; color: #be123c;
          text-transform: none; font-style: normal;
        }
        .su-tagline {
          font-size: 1rem; line-height: 1.55; color: #78716c;
          max-width: 420px; text-transform: none; font-style: normal;
        }

        .su-features { display: flex; flex-direction: column; gap: 0.55rem; }
        .su-feat {
          display: flex; align-items: center; gap: 0.6rem;
          opacity: 0; transform: translateX(-10px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .is-visible .su-feat { opacity: 1; transform: translateX(0); }
        .su-feat__icon {
          width: 32px; height: 32px; border-radius: 9px; background: #fff;
          display: flex; align-items: center; justify-content: center;
          color: #e11d48; box-shadow: 0 2px 6px rgba(0,0,0,0.04); flex-shrink: 0;
        }
        .su-feat__text {
          font-size: 0.88rem; font-weight: 600; color: #44403c;
          text-transform: none; font-style: normal;
        }

        /* RIGHT */
        .su-card-wrap { display: flex; justify-content: center; }
        @media (min-width: 1024px) { .su-card-wrap { justify-content: flex-end; } }

        .su-card {
          width: 100%; max-width: 440px;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.65);
          border-radius: 22px; padding: 2rem;
          box-shadow: 0 20px 60px rgba(190,18,60,0.08), 0 4px 14px rgba(0,0,0,0.03);
          transition: box-shadow 0.35s ease;
        }
        .su-card:hover {
          box-shadow: 0 24px 68px rgba(190,18,60,0.12), 0 6px 20px rgba(0,0,0,0.04);
        }

        .su-card__head { margin-bottom: 1.25rem; }
        .su-card__title {
          font-family: 'Varela Round', sans-serif;
          font-weight: 700; font-size: 1.5rem; color: #1c1917;
          text-transform: none; font-style: normal; margin-bottom: 0.15rem;
        }
        .su-card__sub { font-size: 0.82rem; color: #a8a29e; text-transform: none; font-style: normal; }
        .su-card__step-row {
          display: flex; align-items: center; justify-content: space-between; margin-top: 0.25rem;
        }
        .su-progress { display: flex; gap: 0.3rem; }
        .su-progress__dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #fecdd3; transition: background 0.3s ease;
        }
        .su-progress__dot--active { background: #e11d48; }

        .su-toast {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.6rem 0.85rem; border-radius: 11px;
          font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem;
          text-transform: none; font-style: normal;
        }
        .su-toast--err { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; }
        .su-toast--ok { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; }
        .su-toast__dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .su-toast--err .su-toast__dot { background: #e11d48; }
        .su-toast--ok .su-toast__dot { background: #10b981; }

        .su-body { min-height: 300px; display: flex; flex-direction: column; justify-content: center; }
        .su-step { display: flex; flex-direction: column; gap: 0.9rem; }
        .su-step--center { align-items: center; text-align: center; }

        .su-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .su-label {
          font-size: 0.72rem; font-weight: 700; color: #78716c;
          text-transform: none; font-style: normal;
        }
        .su-input {
          width: 100%; padding: 0.75rem 0.9rem;
          background: rgba(255,241,242,0.35); border: 1.5px solid #fecdd3;
          border-radius: 12px; font-size: 0.9rem; font-weight: 500;
          color: #1c1917; outline: none;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
          text-transform: none; font-style: normal;
        }
        .su-input::placeholder { color: #d4d4d4; text-transform: none; font-style: normal; }
        .su-input:focus {
          border-color: #fb7185; background: #fff;
          box-shadow: 0 0 0 3px rgba(251,113,133,0.12);
        }
        .su-select { cursor: pointer; }
        .su-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

        /* Affiliation */
        .su-affil-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .su-affil {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 0.35rem; padding: 0.9rem 0.5rem;
          border: 2px solid #fecdd3; border-radius: 12px;
          background: rgba(255,241,242,0.3); color: #a8a29e;
          font-size: 0.72rem; font-weight: 700; cursor: pointer;
          transition: all 0.2s ease; text-transform: none; font-style: normal;
        }
        .su-affil:hover { border-color: #fda4af; }
        .su-affil--active {
          background: linear-gradient(135deg, #fb7185, #e11d48);
          border-color: #e11d48; color: #fff;
          box-shadow: 0 4px 14px rgba(225,29,72,0.2);
        }

        /* Review */
        .su-review {
          background: rgba(255,241,242,0.4); border: 1px solid #fecdd3;
          border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;
        }
        .su-review__row { display: flex; align-items: center; gap: 0.75rem; }
        .su-review__avatar {
          width: 48px; height: 48px; border-radius: 14px;
          background: linear-gradient(135deg, #fb7185, #e11d48);
          display: flex; align-items: center; justify-content: center;
          color: #fff; flex-shrink: 0;
        }
        .su-review__name {
          font-family: 'Varela Round', sans-serif;
          font-weight: 700; font-size: 1.15rem; color: #1c1917;
          text-transform: none; font-style: normal;
        }
        .su-review__handle { font-size: 0.78rem; color: #a8a29e; text-transform: none; font-style: normal; }
        .su-review__detail {
          display: flex; justify-content: space-between; align-items: center;
          padding-top: 0.6rem; border-top: 1px solid #fecdd3;
        }
        .su-review__label { font-size: 0.7rem; font-weight: 700; color: #a8a29e; text-transform: none; font-style: normal; }
        .su-review__value { font-size: 0.85rem; font-weight: 600; color: #44403c; text-transform: none; font-style: normal; }

        /* Buttons */
        .su-btn {
          display: flex; align-items: center; justify-content: center; gap: 0.45rem;
          width: 100%; padding: 0.8rem; border-radius: 12px;
          font-size: 0.92rem; font-weight: 800; cursor: pointer; border: none;
          transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.12s ease;
          text-decoration: none; text-transform: none; font-style: normal;
        }
        .su-btn:active { transform: scale(0.975); }
        .su-btn--main {
          background: linear-gradient(135deg, #fb7185, #e11d48);
          color: #fff; box-shadow: 0 6px 18px rgba(225,29,72,0.22);
        }
        .su-btn--main:hover { box-shadow: 0 8px 26px rgba(225,29,72,0.32); }
        .su-btn--main:disabled { opacity: 0.65; cursor: not-allowed; }
        .su-btn--lg { padding: 1rem; font-size: 1rem; }

        .su-nav-row { display: flex; gap: 0.6rem; align-items: center; padding-top: 0.25rem; }
        .su-nav-back {
          width: 48px; height: 48px; border-radius: 12px;
          border: 1.5px solid #fecdd3; background: #fff;
          display: flex; align-items: center; justify-content: center;
          color: #a8a29e; cursor: pointer; flex-shrink: 0;
          transition: border-color 0.2s ease, color 0.2s ease;
        }
        .su-nav-back:hover { border-color: #fda4af; color: #e11d48; }

        .su-google {
          display: flex; align-items: center; justify-content: center; gap: 0.6rem;
          width: 100%; padding: 0.75rem; border-radius: 12px;
          border: 1.5px solid #fecdd3; background: #fff;
          font-size: 0.88rem; font-weight: 700; color: #44403c;
          cursor: pointer; transition: border-color 0.2s ease, box-shadow 0.2s ease;
          text-transform: none; font-style: normal;
        }
        .su-google:hover { border-color: #fda4af; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .su-google__img { width: 20px; height: 20px; }

        .su-sep {
          display: flex; align-items: center; gap: 0.8rem; margin: 0.25rem 0;
        }
        .su-sep::before, .su-sep::after { content: ''; flex: 1; height: 1px; background: #fecdd3; }
        .su-sep span {
          font-size: 0.7rem; font-weight: 700; color: #d6d3d1;
          text-transform: uppercase; letter-spacing: 0.1em; font-style: normal;
        }

        .su-link-row {
          text-align: center; font-size: 0.85rem; color: #78716c;
          text-transform: none; font-style: normal;
        }
        .su-link { color: #e11d48; font-weight: 700; cursor: pointer; text-transform: none; font-style: normal; }
        .su-link:hover { text-decoration: underline; }

        .su-back-text {
          font-size: 0.78rem; font-weight: 700; color: #a8a29e;
          background: none; border: none; cursor: pointer;
          transition: color 0.2s ease; text-transform: none; font-style: normal;
          align-self: center;
        }
        .su-back-text:hover { color: #e11d48; }

        .su-otp-icon {
          width: 64px; height: 64px; border-radius: 18px;
          background: linear-gradient(135deg, #fff1f2, #ffe4e6);
          display: flex; align-items: center; justify-content: center;
          color: #e11d48;
        }
        .su-otp-input {
          width: 100%; max-width: 220px; padding: 0.9rem;
          background: rgba(255,241,242,0.35); border: 2px solid #fecdd3;
          border-radius: 14px; font-size: 2rem; font-weight: 800;
          color: #e11d48; letter-spacing: 0.2em; text-align: center;
          outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease;
          text-transform: none; font-style: normal;
        }
        .su-otp-input:focus {
          border-color: #fb7185;
          box-shadow: 0 0 0 3px rgba(251,113,133,0.12);
        }
        .su-otp-input::placeholder { color: #d4d4d4; }

        .su-spin {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: su-spin 0.6s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .su-orb { animation: none; }
          .su-container { transition: none; }
          .su-feat { transition: none; opacity: 1; transform: none; }
          .su-card { transition: none; }
        }

        /* ============================================================
           DARK THEME (UI_AUDIT S3 P2-4)
           Base rules above are the light look and stay untouched; this
           block is the dark: twin for every hardcoded light surface.
           ============================================================ */
        .dark .su-page { background: #000000; }

        .dark .su-logo { color: #f43f5e; }
        .dark .su-tagline { color: #a8a29e; }
        .dark .su-feat__icon { background: rgba(255,255,255,0.08); color: #fb7185; }
        .dark .su-feat__text { color: #d6d3d1; }

        .dark .su-card {
          background: rgba(16,18,23,0.92);
          border-color: rgba(255,255,255,0.08);
        }
        .dark .su-card__title { color: #fafafa; }

        .dark .su-progress__dot { background: rgba(255,255,255,0.2); }
        .dark .su-progress__dot--active { background: #fb7185; }

        .dark .su-toast--err {
          background: rgba(225,29,72,0.14);
          border-color: rgba(251,113,133,0.35);
          color: #fda4af;
        }
        .dark .su-toast--ok {
          background: rgba(16,185,129,0.14);
          border-color: rgba(52,211,153,0.35);
          color: #6ee7b7;
        }

        .dark .su-label { color: #a8a29e; }

        .dark .su-input {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.12);
          color: #fafafa;
        }
        .dark .su-input::placeholder { color: #a1a1aa; }
        .dark .su-input:focus {
          border-color: #fb7185;
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 3px rgba(251,113,133,0.18);
        }

        .dark .su-affil {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.15);
          color: #a1a1aa;
        }

        .dark .su-review {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.1);
        }
        .dark .su-review__name { color: #fafafa; }
        .dark .su-review__detail { border-color: rgba(255,255,255,0.1); }
        .dark .su-review__value { color: #e7e5e4; }

        .dark .su-nav-back {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.15);
          color: #a1a1aa;
        }
        .dark .su-nav-back:hover { color: #fb7185; }

        .dark .su-link-row { color: #a8a29e; }
        .dark .su-link { color: #fb7185; }

        .dark .su-back-text:hover { color: #fb7185; }

        .dark .su-otp-icon {
          background: rgba(255,255,255,0.06);
          color: #fb7185;
        }
        .dark .su-otp-input {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.15);
          color: #fb7185;
        }
        .dark .su-otp-input:focus {
          border-color: #fb7185;
          background: rgba(255,255,255,0.06);
        }
        .dark .su-otp-input::placeholder { color: #a1a1aa; }

        /* Inline-styled hint text + suggestion chips (see JSX): !important
           beats the inline light values they carry. */
        .dark .su-muted { color: #a1a1aa !important; }
        .dark .su-suggest {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.15) !important;
          color: #fb7185 !important;
        }
      `}</style>
    </div>
  );
}
