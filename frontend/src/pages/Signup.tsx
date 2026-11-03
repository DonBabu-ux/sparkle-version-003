import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail, ArrowRight, ArrowLeft, Check, Eye, EyeOff,
  GraduationCap, Building2, Briefcase, Gift,
  Sparkles, Users, Heart, Play, ShoppingBag, ShieldCheck, MessageCircle,
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

  if (step === 1) {
    return (
      <div className="relative min-h-dvh flex flex-col justify-between overflow-x-hidden bg-[#FFF3F8] dark:bg-zinc-950 font-sans text-[#10112D] dark:text-white selection:bg-[#FF008C] selection:text-white pb-6">
        {/* ── 1. BACKGROUND DECORATIVE SHAPES & ILLUMINATION ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {/* Soft Central Pink Illumination */}
          <div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full opacity-60 dark:opacity-20 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(255, 0, 140, 0.22) 0%, rgba(255, 140, 195, 0.12) 45%, transparent 70%)',
            }}
          />

          {/* Upper Left Organic Blush Wave */}
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-[#FFA7D3]/40 via-[#FFD2EB]/20 to-transparent blur-2xl" />

          {/* Upper Right Curved Wave */}
          <div className="absolute -top-16 -right-16 w-88 h-88 rounded-full bg-gradient-to-bl from-[#FF75BA]/35 via-[#FFA9DD]/15 to-transparent blur-2xl" />

          {/* Top Decorative Floating Petal Shapes */}
          <svg className="absolute top-12 left-6 w-8 h-8 text-[#FF008C]/30 -rotate-12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C12 2 14 8 19 9C14 10 12 16 12 16C12 16 10 10 5 9C10 8 12 2 12 2Z" />
          </svg>
          <svg className="absolute top-24 right-8 w-6 h-6 text-[#FF52AE]/40 rotate-45" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C12 2 14 8 19 9C14 10 12 16 12 16C12 16 10 10 5 9C10 8 12 2 12 2Z" />
          </svg>
        </div>

        {/* ── 2. BRAND HEADER ── */}
        <header className="relative z-10 pt-7 sm:pt-9 pb-2 px-5 text-center max-w-md mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black text-[#10112D] dark:text-white tracking-tight leading-none mb-2">
            Sparkle
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#565177] dark:text-zinc-300 leading-relaxed max-w-xs mx-auto">
            It's quick and easy. Join the sweetest <span className="font-black text-[#FF008C]">Sparkle</span> network and bloom with your people.
          </p>
        </header>

        {/* ── 3. HERO COMPOSITION (WOMAN + 3D SOCIAL ICONS + SOCIAL CARDS) ── */}
        <div className="relative z-10 w-full max-w-md mx-auto px-4 my-auto flex flex-col items-center">
          {/* Hero Visual Area Container */}
          <div className="relative w-full flex items-center justify-center pt-3 pb-2">
            {/* Concentric Decorative Rings behind Woman */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] rounded-full border border-[#FFBFDE]/60 bg-gradient-to-b from-[#FFE6F3]/70 to-[#FFF0F7]/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[230px] h-[230px] sm:w-[260px] sm:h-[260px] rounded-full bg-gradient-to-tr from-[#FFD2EB]/80 to-[#FFF4F9]" />
            </div>

            {/* Central Woman Photograph */}
            <div className="relative z-10 w-48 h-48 sm:w-56 sm:h-56 rounded-full p-1 bg-gradient-to-tr from-[#FF008C] via-white to-[#FFA0D2] shadow-[0_16px_38px_rgba(255,0,140,0.25)] overflow-hidden">
              <img
                src="/signup-hero-woman.jpg"
                alt="Happy young woman using smartphone on Sparkle"
                className="w-full h-full rounded-full object-cover"
              />
            </div>

            {/* ── Floating Social Media Card: Left (Friends Sunset) ── */}
            <div className="absolute left-1 sm:left-3 top-10 z-20 -rotate-6 hover:rotate-0 transition-transform duration-300 pointer-events-auto">
              <div className="w-24 sm:w-28 p-1.5 bg-white dark:bg-zinc-800 rounded-2xl shadow-[0_12px_28px_rgba(0,0,0,0.15)] border border-white/95 dark:border-white/10">
                <div className="relative w-full h-20 sm:h-24 rounded-xl overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=240&q=80&auto=format"
                    alt="Friends celebrating sunset"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1.5 left-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm text-[9px] font-black text-[#10112D] dark:text-white">
                    <Heart size={9} className="text-[#FF008C]" fill="#FF008C" />
                    <span>12.4K</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Floating Social Media Card: Right (City Lifestyle) ── */}
            <div className="absolute right-1 sm:right-3 top-12 z-20 rotate-6 hover:rotate-0 transition-transform duration-300 pointer-events-auto">
              <div className="w-24 sm:w-28 p-1.5 bg-white dark:bg-zinc-800 rounded-2xl shadow-[0_12px_28px_rgba(0,0,0,0.15)] border border-white/95 dark:border-white/10">
                <div className="relative w-full h-20 sm:h-24 rounded-xl overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?w=240&q=80&auto=format"
                    alt="City lifestyle moment"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1.5 left-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm text-[9px] font-black text-[#10112D] dark:text-white">
                    <Heart size={9} className="text-[#FF008C]" fill="#FF008C" />
                    <span>8.7K</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 4 Floating 3D Glossy Magenta Icons ── */}
            {/* 1. Upper-Left: Message Bubble with 3 Dots */}
            <div
              className="absolute left-6 sm:left-12 -top-1 z-30 w-11 h-11 rounded-2xl flex items-center justify-center text-white -rotate-12 transition-transform hover:scale-110 shadow-[0_10px_22px_rgba(255,0,140,0.42),inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-2px_4px_rgba(0,0,0,0.15)]"
              style={{ background: 'linear-gradient(135deg, #FF2E93 0%, #FF008C 50%, #C9006E 100%)' }}
            >
              <div className="flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
              </div>
            </div>

            {/* 2. Upper-Right: Reels / Video Play Icon */}
            <div
              className="absolute right-6 sm:right-12 top-0 z-30 w-11 h-11 rounded-2xl flex items-center justify-center text-white rotate-12 transition-transform hover:scale-110 shadow-[0_10px_22px_rgba(255,0,140,0.42),inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-2px_4px_rgba(0,0,0,0.15)]"
              style={{ background: 'linear-gradient(135deg, #FF2E93 0%, #FF008C 50%, #C9006E 100%)' }}
            >
              <Play size={18} fill="white" className="ml-0.5 text-white" />
            </div>

            {/* 3. Lower-Left: Friends / Group Icon */}
            <div
              className="absolute left-10 sm:left-14 bottom-4 z-30 w-10 h-10 rounded-2xl flex items-center justify-center text-white rotate-6 transition-transform hover:scale-110 shadow-[0_8px_18px_rgba(255,0,140,0.38),inset_0_2px_3px_rgba(255,255,255,0.7),inset_0_-2px_3px_rgba(0,0,0,0.15)]"
              style={{ background: 'linear-gradient(135deg, #FF2E93 0%, #FF008C 50%, #C9006E 100%)' }}
            >
              <Users size={18} strokeWidth={2.4} />
            </div>

            {/* 4. Lower-Right: Heart / Like Icon */}
            <div
              className="absolute right-10 sm:right-14 bottom-3 z-30 w-10 h-10 rounded-2xl flex items-center justify-center text-white -rotate-6 transition-transform hover:scale-110 shadow-[0_8px_18px_rgba(255,0,140,0.38),inset_0_2px_3px_rgba(255,255,255,0.7),inset_0_-2px_3px_rgba(0,0,0,0.15)]"
              style={{ background: 'linear-gradient(135deg, #FF2E93 0%, #FF008C 50%, #C9006E 100%)' }}
            >
              <Heart size={18} fill="white" className="text-white" />
            </div>
          </div>

          {/* ── 4. LARGE CREATE ACCOUNT CARD ── */}
          <div className="relative z-20 -mt-6 sm:-mt-8 w-full rounded-[36px] sm:rounded-[42px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-[#FADCEB] dark:border-white/10 shadow-[0_20px_55px_rgba(255,0,140,0.14)] p-6 sm:p-7">
            {/* Card Header & 5 Circular Progress Dots */}
            <div className="flex items-center justify-between mb-4 pb-1">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#10112D] dark:text-white tracking-tight">
                  Create account
                </h2>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-xs font-bold text-[#656083] dark:text-zinc-400">Step 1 of 5</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF008C] shadow-sm shadow-[#FF008C]/40" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                </div>
              </div>
            </div>

            {/* 4 Feature Rows */}
            <div className="space-y-3">
              {/* Row 1: Connect with friends */}
              <div className="flex items-center gap-3.5 pb-2.5 border-b border-[#F7E6EF] dark:border-white/5">
                <div className="w-11 h-11 rounded-full bg-[#FFEBF5] text-[#FF008C] flex items-center justify-center shrink-0 shadow-inner">
                  <Users size={20} strokeWidth={2.4} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-[#10112D] dark:text-white leading-tight">
                    Connect with friends
                  </h4>
                  <p className="text-xs font-medium text-[#656083] dark:text-zinc-400 mt-0.5 truncate">
                    Chat, follow and grow your circle.
                  </p>
                </div>
              </div>

              {/* Row 2: Explore amazing content */}
              <div className="flex items-center gap-3.5 pb-2.5 border-b border-[#F7E6EF] dark:border-white/5">
                <div className="w-11 h-11 rounded-full bg-[#FFEBF5] text-[#FF008C] flex items-center justify-center shrink-0 shadow-inner">
                  <Play size={19} strokeWidth={2.4} className="ml-0.5" fill="#FF008C" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-[#10112D] dark:text-white leading-tight">
                    Explore amazing content
                  </h4>
                  <p className="text-xs font-medium text-[#656083] dark:text-zinc-400 mt-0.5 truncate">
                    Short videos, stories and more.
                  </p>
                </div>
              </div>

              {/* Row 3: Buy & sell easily */}
              <div className="flex items-center gap-3.5 pb-2.5 border-b border-[#F7E6EF] dark:border-white/5">
                <div className="w-11 h-11 rounded-full bg-[#FFEBF5] text-[#FF008C] flex items-center justify-center shrink-0 shadow-inner">
                  <ShoppingBag size={20} strokeWidth={2.4} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-[#10112D] dark:text-white leading-tight">
                    Buy &amp; sell easily
                  </h4>
                  <p className="text-xs font-medium text-[#656083] dark:text-zinc-400 mt-0.5 truncate">
                    On our marketplace.
                  </p>
                </div>
              </div>

              {/* Row 4: Safe & secure */}
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-[#FFEBF5] text-[#FF008C] flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldCheck size={20} strokeWidth={2.4} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-[#10112D] dark:text-white leading-tight">
                    Safe &amp; secure
                  </h4>
                  <p className="text-xs font-medium text-[#656083] dark:text-zinc-400 mt-0.5 truncate">
                    Your privacy, our priority.
                  </p>
                </div>
              </div>
            </div>

            {/* Small Dimensional Pink Sparkle Decoration in Lower-Right */}
            <div className="absolute -bottom-2.5 right-6 text-[#FF008C] pointer-events-none drop-shadow-[0_2px_8px_rgba(255,0,140,0.45)]">
              <Sparkles size={22} fill="#FF008C" />
            </div>

            {/* Primary Action Button */}
            <button
              onClick={nextStep}
              className="w-full mt-5 py-3.5 px-6 rounded-full bg-[#FF008C] hover:bg-[#E6007E] active:scale-[0.98] text-white font-extrabold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(255,0,140,0.36)] transition-all cursor-pointer"
              type="button"
            >
              <span>Get started</span>
              <ArrowRight size={18} strokeWidth={2.8} />
            </button>

            {/* Sign-in Action */}
            <p className="mt-3.5 text-center text-xs sm:text-sm font-medium text-[#565177] dark:text-zinc-400">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-[#FF008C] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* ── 5. BOTTOM DECORATIVE WAVES (OVERLAPPING PINK & MAGENTA LAYERS) ── */}
        <div className="w-full overflow-hidden leading-none pointer-events-none mt-2 relative z-0">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-12 sm:h-16 object-cover"
            preserveAspectRatio="none"
          >
            <path
              d="M0,32L60,42.7C120,53,240,75,360,74.7C480,75,600,53,720,42.7C840,32,960,32,1080,42.7C1200,53,1320,75,1380,85.3L1440,96L1440,120L1380,120C1320,120,1200,120,1080,120C960,120,840,120,720,120C600,120,480,120,360,120C240,120,120,120,60,120L0,120Z"
              fill="#FFA8D5"
              fillOpacity="0.4"
            />
            <path
              d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,64C960,75,1056,85,1152,80C1248,75,1344,53,1392,42.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
              fill="#FF52AE"
              fillOpacity="0.35"
            />
            <path
              d="M0,96L60,90.7C120,85,240,75,360,69.3C480,64,600,64,720,69.3C840,75,960,85,1080,85.3C1200,85,1320,75,1380,69.3L1440,64L1440,120L1380,120C1320,120,1200,120,1080,120C960,120,840,120,720,120C600,120,480,120,360,120C240,120,120,120,60,120L0,120Z"
              fill="#FF008C"
              fillOpacity="0.25"
            />
          </svg>
        </div>
      </div>
    );
  }

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
