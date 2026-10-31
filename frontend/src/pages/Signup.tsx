import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail, ArrowRight, ArrowLeft, Check, Eye, EyeOff,
  GraduationCap, Building2, Briefcase, Gift,
  Sparkles, Users, Heart,
} from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { getPendingReferral, capturePendingReferral, clearPendingReferral } from '../services/referralAttribution';

type Step = 1 | 2 | 3 | 4 | 5;

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

const HERO_IMAGE = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=640&q=80&auto=format';

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
  const [ otpSuccess,  ] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Referral Attribution State
  const [searchParams] = useSearchParams();
  const [referralCode, setReferralCode] = useState('');
  const [handoffToken, setHandoffToken] = useState('');
  const [referredByUsername, setReferredByUsername] = useState<string | null>(null);
  const [showReferralInput, setShowReferralInput] = useState(false);

  const navigate = useNavigate();
  const { login } = useUserStore();

  useEffect(() => {
    setMounted(true);

    // 1. Check URL query params for ?ref=... or ?code=...
    const urlRef = searchParams.get('ref') || searchParams.get('code');
    const urlHandoff = searchParams.get('handoff');

    if (urlRef) {
      const code = urlRef.trim().toUpperCase();
      setReferralCode(code);
      if (urlHandoff) setHandoffToken(urlHandoff);
      capturePendingReferral({ referralCode: code, handoffToken: urlHandoff || undefined });
    } else {
      // 2. Fall back to pending referral stored in localStorage
      const pending = getPendingReferral();
      if (pending) {
        setReferralCode(pending.referralCode);
        if (pending.handoffToken) setHandoffToken(pending.handoffToken);
        if (pending.referrer?.username) setReferredByUsername(pending.referrer.username);
      }
    }
  }, [searchParams]);

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
        const res = await api.get(`/auth/check-username?username=${encodeURIComponent(form.username.trim())}`);
        if (res.data) {
          setUsernameAvailable(res.data.available);
          setUsernameSuggestions(res.data.suggestions || []);
        }
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [form.username]);

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
      } catch {
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
      const res = await api.post('/auth/signup', {
        name: form.name, username: form.username,
        email: form.email, password: form.password,
        campus: form.affiliation_type !== 'None' ? form.campus : undefined,
        major: form.major || undefined, year: form.year || undefined,
        user_type: 'student',
        terms_version: '1.0',
        privacy_version: '1.0',
        referral_code: referralCode.trim() || undefined,
        handoff_token: handoffToken || undefined
      });
      clearPendingReferral();
      if (res.data?.token) {
        localStorage.setItem('sparkle_signup_token', res.data.token);
        localStorage.setItem('sparkle_signup_refresh', res.data.refreshToken);
        localStorage.setItem('sparkle_signup_user', JSON.stringify(res.data.user));
      }
      showSuccess('Signed up! Verify your email.');
      setStep(5);
      setOtpCooldown(60);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      showError(e.response?.data?.message || 'Something went wrong.');
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
    <div className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#f8e7ed] p-6 font-sans text-[#18181b] dark:bg-zinc-900 dark:text-zinc-100">
      <div className={`relative z-10 grid w-full max-w-[1080px] grid-cols-1 items-center gap-8 transition-all duration-700 ease-out lg:grid-cols-2 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>

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
              It's quick and easy. Join the sweetest Sparkle network and bloom with your people.
            </p>
            <div className="flex flex-col gap-2.5 pt-1">
              {[
                { icon: Users, label: 'Find your people instantly' },
                { icon: Sparkles, label: 'Campus-first experience' },
                { icon: Heart, label: 'Share moments that matter' },
              ].map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                >
                  <f.icon size={16} strokeWidth={2} className="shrink-0 text-[#ff1493]" />
                  <span className="text-sm font-medium text-[#18181b] dark:text-zinc-100">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Signup card */}
        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-md">
            {/* Brand (mobile) */}
            <div className="mb-6 text-center lg:hidden">
              <h1 className="text-3xl font-bold tracking-tight text-[#18181b] dark:text-zinc-100">Sparkle</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600 dark:text-zinc-300">
                It's quick and easy. Join the sweetest Sparkle network and bloom with your people.
              </p>
            </div>

        {/* Signup card */}
        <div className="rounded-3xl border border-[#e6d8e1] bg-[#fdf8fa] p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
          <div className="mb-5">
            <h3 className="text-xl font-bold text-[#18181b] dark:text-zinc-100">Create account</h3>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600 dark:text-zinc-300">Step {step} of 5</p>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className={`h-2 w-2 rounded-full transition-colors ${s <= step ? 'bg-[#ff1493]' : 'bg-[#f0e5ec] dark:bg-zinc-700'}`} />
                ))}
              </div>
            </div>
          </div>

          {(error || success) && (
            <div className={`mb-5 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-semibold ${error ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'}`} />
              {error || success}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Step 1: Welcome */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <button onClick={nextStep} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#ff1493] text-sm font-bold text-white transition-colors hover:bg-[#ff2d87]" type="button">
                  Get started
                  <ArrowRight size={18} strokeWidth={2.5} />
                </button>

                <p className="text-center text-sm text-slate-600 dark:text-zinc-300">
                  Already have an account?{' '}
                  <Link to="/login" className="font-bold text-[#ff1493] hover:underline">Sign in</Link>
                </p>
              </div>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Full name</label>
                    <input type="text" name="name" autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] px-4 py-3 text-sm text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-300" placeholder="Jane Doe" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Username</label>
                      {checkingUsername && <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Checking...</span>}
                      {!checkingUsername && usernameAvailable === true && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Available</span>}
                      {!checkingUsername && usernameAvailable === false && <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">✖ Taken</span>}
                    </div>
                    <input type="text" name="username" autoComplete="username" value={form.username} onChange={(e) => update('username', e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))} className="w-full rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] px-4 py-3 text-sm text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-300" placeholder="janedoe" />
                  </div>
                </div>

                {!checkingUsername && usernameAvailable === false && usernameSuggestions.length > 0 && (
                  <div className="-mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-600 dark:text-zinc-300">Suggestions:</span>
                    {usernameSuggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => { update('username', sug); setUsernameAvailable(true); }}
                        className="rounded-full border border-[#e6d8e1] bg-[#f0e5ec] px-2.5 py-1 text-xs font-semibold text-[#ff1493] transition-colors hover:bg-[#ede3e9] dark:border-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Email address</label>
                    {checkingEmail && <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Checking...</span>}
                    {!checkingEmail && emailAvailable === true && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Available</span>}
                    {!checkingEmail && emailAvailable === false && <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">✖ Registered</span>}
                  </div>
                  <input type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] px-4 py-3 text-sm text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-300" placeholder="you@university.edu" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      className="w-full rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] py-3 pl-4 pr-11 text-sm text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-300"
                      placeholder="At least 8 characters"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 transition-colors hover:text-[#ff1493] dark:text-zinc-300 dark:hover:text-[#ff2d87]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {form.password && (
                    <div className="mt-1">
                      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-zinc-300">
                        <span>Strength:</span>
                        <span className="capitalize" style={{
                          color: passwordStrength === 'strong' ? '#10b981' : passwordStrength === 'medium' ? '#f59e0b' : '#e11d48'
                        }}>{passwordStrength}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-[#ede3e9] dark:bg-zinc-700">
                        <div style={{
                          height: '100%',
                          width: passwordStrength === 'strong' ? '100%' : passwordStrength === 'medium' ? '66%' : '33%',
                          backgroundColor: passwordStrength === 'strong' ? '#10b981' : passwordStrength === 'medium' ? '#f59e0b' : '#e11d48',
                          transition: 'width 0.3s ease, background-color 0.3s ease'
                        }} />
                      </div>
                    </div>
                  )}

                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {[
                      { label: '8+ characters', met: pwdCriteria.length },
                      { label: 'One uppercase', met: pwdCriteria.upper },
                      { label: 'One number', met: pwdCriteria.number },
                      { label: 'One special char', met: pwdCriteria.special }
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center gap-1.5 text-xs font-semibold ${item.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-zinc-300'}`}>
                        <span>{item.met ? '✓' : '○'}</span>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button onClick={prevStep} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e6d8e1] bg-[#fdf8fa] text-slate-600 transition-colors hover:bg-[#f0e5ec] hover:text-[#18181b] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100" type="button" aria-label="Back">
                    <ArrowLeft size={18} />
                  </button>
                  <button onClick={handleNextFromStep2} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#ff1493] text-sm font-bold text-white transition-colors hover:bg-[#ff2d87]" type="button">
                    Next <ArrowRight size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Affiliation */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2">
                  {AFFILIATION_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => update('affiliation_type', type.id)}
                      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 px-2 py-4 text-xs font-semibold transition-colors ${form.affiliation_type === type.id ? 'border-[#ff1493] bg-[#ff1493] text-white' : 'border-[#e6d8e1] bg-[#f6eef3] text-slate-600 hover:border-[#ff1493] hover:text-[#18181b] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100'}`}
                      type="button"
                    >
                      <type.icon size={22} strokeWidth={2} />
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Sparkle Region</label>
                  <select value={form.campus} onChange={(e) => update('campus', e.target.value)} className="w-full rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] px-4 py-3 text-sm text-[#18181b] outline-none transition-colors focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                    <option value="">Select your Sparkle region...</option>
                    {UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Major</label>
                  <input type="text" value={form.major} onChange={(e) => update('major', e.target.value)} className="w-full rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] px-4 py-3 text-sm text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-300" placeholder="Computer Science" />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button onClick={prevStep} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e6d8e1] bg-[#fdf8fa] text-slate-600 transition-colors hover:bg-[#f0e5ec] hover:text-[#18181b] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100" type="button" aria-label="Back">
                    <ArrowLeft size={18} />
                  </button>
                  <button onClick={nextStep} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#ff1493] text-sm font-bold text-white transition-colors hover:bg-[#ff2d87]" type="button">
                    Almost there <ArrowRight size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] p-5 dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="flex items-center gap-4">
                    <Check size={28} strokeWidth={2.5} className="shrink-0 text-[#ff1493]" />
                    <div>
                      <h4 className="text-lg font-bold text-[#18181b] dark:text-zinc-100">{form.name || 'Your Name'}</h4>
                      <p className="text-xs text-slate-600 dark:text-zinc-300">@{form.username || 'username'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[#ede3e9] pt-4 dark:border-zinc-900">
                    <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Sparkle Region</span>
                    <span className="text-sm font-semibold text-[#18181b] dark:text-zinc-100">{form.campus || 'Sparkle Global'}</span>
                  </div>

                  {/* Referral Attribution Indicator & Fallback */}
                  {referralCode ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e6d8e1] bg-[#f0e5ec] p-4 dark:border-zinc-700 dark:bg-zinc-700">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-[#ff1493]">
                        <Gift size={13} /> Invited by
                      </span>
                      <span className="text-sm font-bold text-[#18181b] dark:text-zinc-100">
                        {referredByUsername ? `@${referredByUsername}` : referralCode}
                      </span>
                    </div>
                  ) : (
                    <div className="text-left">
                      {!showReferralInput ? (
                        <button
                          type="button"
                          onClick={() => setShowReferralInput(true)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#ff1493] hover:underline"
                        >
                          <Gift size={13} /> Have a referral code?
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={referralCode}
                            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                            placeholder="Enter referral code"
                            className="w-full flex-1 rounded-2xl border border-[#e6d8e1] bg-[#fdf8fa] px-3 py-2 text-xs uppercase text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-300"
                          />
                          <button
                            type="button"
                            onClick={() => setShowReferralInput(false)}
                            className="rounded-full border border-[#e6d8e1] bg-[#fdf8fa] px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-[#f0e5ec] hover:text-[#18181b] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-center text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
                  By creating an account, you agree to Sparkle's{' '}
                  <Link to="/legal/terms" target="_blank" className="font-semibold text-[#ff1493] underline">
                    Terms &amp; Conditions
                  </Link>{' '}
                  and acknowledge the{' '}
                  <Link to="/legal/privacy" target="_blank" className="font-semibold text-[#ff1493] underline">
                    Privacy Policy
                  </Link>.
                </p>

                <button onClick={handleSubmit} disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff1493] text-base font-bold text-white transition-colors hover:bg-[#ff2d87] disabled:opacity-60" type="button">
                  {loading ? <Spinner size="small" color="#fff" /> : 'Create my account'}
                </button>
                <button onClick={prevStep} className="mx-auto text-xs font-semibold text-slate-600 transition-colors hover:text-[#18181b] dark:text-zinc-300 dark:hover:text-zinc-100" type="button">Make changes</button>
              </div>
            )}

            {/* Step 5: OTP */}
            {otpSuccess ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center animate-scale-in">
                <Check size={48} strokeWidth={2.5} className="text-emerald-500" />
                <h3 className="text-2xl font-bold text-[#18181b] dark:text-zinc-100">Verified!</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-300">Setting up your profile...</p>
              </div>
            ) : step === 5 ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <Mail size={40} strokeWidth={1.5} className="text-[#ff1493]" />
                <h3 className="text-xl font-bold text-[#18181b] dark:text-zinc-100">Verify email</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-300">
                  Code sent to <strong className="font-semibold text-[#ff1493]">{form.email}</strong>
                </p>

                <input
                  type="text" name="otp" inputMode="numeric" autoComplete="one-time-code" value={otpCode} maxLength={6}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  className="h-14 w-44 rounded-2xl border border-[#e6d8e1] bg-[#f6eef3] text-center text-2xl font-bold tracking-[0.2em] text-[#ff1493] outline-none transition-colors focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="000000"
                />

                <button onClick={handleVerifyOTP} disabled={verifying} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#ff1493] text-sm font-bold text-white transition-colors hover:bg-[#ff2d87] disabled:opacity-60" type="button">
                  {verifying ? <Spinner size="small" color="#fff" /> : 'Complete signup'}
                </button>
                <button
                  className="text-xs font-semibold text-slate-600 transition-colors hover:text-[#18181b] disabled:opacity-50 dark:text-zinc-300 dark:hover:text-zinc-100"
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendingOtp || otpCooldown > 0}
                >
                  {resendingOtp ? 'Sending…' : otpCooldown > 0 ? `Resend code (${otpCooldown}s)` : 'Resend code'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
