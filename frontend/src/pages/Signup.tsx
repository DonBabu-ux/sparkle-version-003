import { useState, useEffect, type ReactNode } from 'react';
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

function GlossyIcon({
  children,
  size = 44,
  radius = 17,
}: {
  children: ReactNode;
  size?: number;
  radius?: number;
}) {
  return (
    <span
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: 'linear-gradient(145deg, #FF5FB4 0%, #FF008C 46%, #C0006A 100%)',
        boxShadow:
          '0 14px 26px rgba(216,0,124,0.42), inset 0 2px 3px rgba(255,255,255,0.72), inset 0 -4px 8px rgba(120,0,70,0.35)',
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          background: 'linear-gradient(150deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.06) 42%, rgba(255,255,255,0) 62%)',
        }}
      />
      <span className="relative z-10 flex items-center justify-center text-white">{children}</span>
    </span>
  );
}

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
      <div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#FFF3F8] font-sans text-[#10112D] selection:bg-[#FF008C] selection:text-white dark:bg-zinc-950 dark:text-white">
        {/* ── 1. BACKGROUND: blush base, central illumination, corner curves, layered ellipses ── */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {/* Soft central pink illumination */}
          <div
            className="absolute left-1/2 top-[26%] h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl dark:opacity-25"
            style={{
              background:
                'radial-gradient(circle, rgba(255,0,140,0.20) 0%, rgba(255,150,200,0.13) 45%, rgba(255,243,248,0) 72%)',
            }}
          />

          {/* Upper-left large curved band */}
          <svg className="absolute -left-24 -top-24 h-[300px] w-[300px] -rotate-12" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="86" stroke="#FFC4E5" strokeWidth="30" opacity="0.7" />
          </svg>
          <div className="absolute -left-14 top-28 h-40 w-40 rounded-full bg-[#FFDDF1] opacity-70" />

          {/* Upper-right large curved band */}
          <svg className="absolute -right-28 -top-24 h-[290px] w-[290px] rotate-[20deg]" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="86" stroke="#FFB3DD" strokeWidth="26" opacity="0.65" />
          </svg>
          <div className="absolute -right-12 top-24 h-32 w-32 rounded-full bg-[#FFD2EB] opacity-75" />

          {/* Layered circular / elliptical shapes behind the hero */}
          <div className="absolute left-1/2 top-[15%] h-[430px] w-[430px] -translate-x-1/2 rounded-[50%] bg-[#FFE4F3] opacity-75" />
          <div className="absolute left-1/2 top-[19%] h-[350px] w-[350px] -translate-x-1/2 rounded-[50%] bg-[#FFEDF7] opacity-85" />
        </div>

        {/* ── CONTENT COLUMN ── */}
        <div className="relative z-10 flex min-h-dvh flex-1 flex-col">
          {/* ── 2. SPARKLE BRAND HEADER ── */}
          <header className="px-6 pb-3 pt-7 text-center sm:pt-9">
            <h1 className="text-[32px] font-black leading-none tracking-tight text-[#10112D] sm:text-4xl dark:text-white">
              Sparkle
            </h1>
            <p className="mx-auto mt-2.5 max-w-[19.5rem] text-xs font-medium leading-relaxed text-[#565177] sm:text-[13.5px] dark:text-zinc-300">
              It's quick and easy. Join the sweetest{' '}
              <span className="font-black text-[#FF008C]">Sparkle</span> network and bloom with your people.
            </p>
          </header>

          {/* ── HERO + CREATE ACCOUNT CARD ── */}
          <main className="flex flex-1 flex-col justify-end px-4 pb-1">
            <div className="relative mx-auto w-full max-w-[372px]">
              {/* Large pink curved area behind the woman (reaches under the card) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-3 bottom-[-76px] w-[132%] -translate-x-1/2 rounded-[999px] bg-gradient-to-b from-[#FFD5EC] via-[#FFEAF6] to-[#FFF7FB]"
              />

              {/* ── 3. HERO COMPOSITION ── */}
              <div className="relative h-[292px] sm:h-[332px]">
                {/* Concentric decorative rings behind the woman */}
                <div className="pointer-events-none absolute inset-x-0 top-1 mx-auto flex h-[252px] w-[252px] items-center justify-center rounded-full border border-white/70 bg-white/35 sm:h-[286px] sm:w-[286px]" />
                <div className="pointer-events-none absolute inset-x-0 top-6 mx-auto flex h-[206px] w-[206px] items-center justify-center rounded-full bg-white/55 sm:h-[236px] sm:w-[236px]" />

                {/* Central woman photograph — bottom tucks behind the card */}
                <div className="absolute left-1/2 top-0 z-10 h-[calc(100%+46px)] w-[76%] -translate-x-1/2 overflow-hidden rounded-[40px] bg-[#FFE9F5] shadow-[0_26px_56px_rgba(176,44,116,0.24)] ring-1 ring-white/75 sm:rounded-[46px]">
                  <img
                    src="/signup-hero-woman.jpg"
                    alt="Happy young woman smiling at her smartphone on Sparkle"
                    className="h-full w-full object-cover object-top"
                    draggable={false}
                    decoding="async"
                  />
                </div>

                {/* ── Floating social card: left (friends at sunset) ── */}
                <div className="absolute left-0 top-[24%] z-20 w-[104px] -rotate-[7deg] transition-transform duration-300 hover:rotate-0 sm:w-[112px]">
                  <div className="rounded-[20px] border border-white bg-white p-[5px] shadow-[0_16px_32px_rgba(126,24,80,0.22)]">
                    <div className="relative h-[74px] overflow-hidden rounded-[15px] bg-[#F3E7EE] sm:h-[80px]">
                      <img
                        src="/signup-card-friends.jpg"
                        alt="Friends celebrating together at sunset"
                        className="h-full w-full object-cover"
                        draggable={false}
                        decoding="async"
                      />
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-[2px] shadow-[0_2px_6px_rgba(0,0,0,0.16)]">
                        <Heart size={9} className="text-[#FF008C]" fill="#FF008C" strokeWidth={2.5} />
                        <span className="text-[9px] font-black leading-none text-[#10112D]">12.4K</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Floating social card: right (city lifestyle) ── */}
                <div className="absolute right-0 top-[34%] z-20 w-[104px] rotate-[7deg] transition-transform duration-300 hover:rotate-0 sm:w-[112px]">
                  <div className="rounded-[20px] border border-white bg-white p-[5px] shadow-[0_16px_32px_rgba(126,24,80,0.22)]">
                    <div className="relative h-[74px] overflow-hidden rounded-[15px] bg-[#F3E7EE] sm:h-[80px]">
                      <img
                        src="/signup-card-city.jpg"
                        alt="City lifestyle moment"
                        className="h-full w-full object-cover"
                        draggable={false}
                        decoding="async"
                      />
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-[2px] shadow-[0_2px_6px_rgba(0,0,0,0.16)]">
                        <Heart size={9} className="text-[#FF008C]" fill="#FF008C" strokeWidth={2.5} />
                        <span className="text-[9px] font-black leading-none text-[#10112D]">8.7K</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 4 FLOATING 3D GLOSSY MAGENTA ICONS ── */}
                {/* 1. Upper-left: message bubble with three dots */}
                <div className="absolute left-[6%] top-[3%] z-30 -rotate-[12deg] transition-transform duration-300 hover:scale-110">
                  <GlossyIcon size={44} radius={17}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M19.6 11.4c0 3.5-3.4 6.3-7.6 6.3-.95 0-1.86-.14-2.7-.4L5.1 19.1l1.16-3.02C4.45 14.9 3.6 13.25 3.6 11.4c0-3.53 3.4-6.4 7.6-6.4s8.4 2.87 8.4 6.4Z"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <circle cx="8.4" cy="11.4" r="1.15" fill="white" />
                      <circle cx="11.6" cy="11.4" r="1.15" fill="white" />
                      <circle cx="14.8" cy="11.4" r="1.15" fill="white" />
                    </svg>
                  </GlossyIcon>
                </div>

                {/* 2. Upper-right: reels / video play */}
                <div className="absolute right-[6%] top-0 z-30 rotate-[12deg] transition-transform duration-300 hover:scale-110">
                  <GlossyIcon size={44} radius={17}>
                    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5.2" stroke="white" strokeWidth="1.8" />
                      <path d="M10.3 9.1v5.8l4.9-2.9-4.9-2.9Z" fill="white" />
                    </svg>
                  </GlossyIcon>
                </div>

                {/* 3. Lower-left: friends / group */}
                <div className="absolute bottom-[19%] left-[9%] z-30 rotate-[6deg] transition-transform duration-300 hover:scale-110">
                  <GlossyIcon size={40} radius={16}>
                    <Users size={19} strokeWidth={2.4} />
                  </GlossyIcon>
                </div>

                {/* 4. Lower-right: heart / like */}
                <div className="absolute bottom-[17%] right-[9%] z-30 -rotate-[6deg] transition-transform duration-300 hover:scale-110">
                  <GlossyIcon size={40} radius={16}>
                    <Heart size={18} fill="white" strokeWidth={2} />
                  </GlossyIcon>
                </div>
              </div>

              {/* ── 5. LARGE CREATE ACCOUNT CARD ── */}
              <div className="relative z-30 -mt-[46px] w-full overflow-hidden rounded-[34px] border border-[#FBDCEC] bg-gradient-to-b from-white via-white to-[#FFF7FB] p-5 shadow-[0_26px_60px_rgba(190,36,114,0.18)] sm:rounded-[40px] sm:p-6 dark:border-white/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
                {/* Decorative pink curved shapes within the card */}
                <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 h-52 w-52 rounded-full bg-[#FFE7F4] dark:bg-white/5" />
                <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-16 h-44 w-44 rounded-full bg-[#FFF1F8] dark:bg-white/[0.03]" />

                {/* Heading + step progress */}
                <div className="relative mb-4 flex items-start justify-between gap-3">
                  <h2 className="text-[21px] font-black leading-none tracking-tight text-[#10112D] sm:text-[23px] dark:text-white">
                    Create account
                  </h2>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-[11px] font-bold leading-none text-[#6B6688] dark:text-zinc-400">
                      Step 1 of 5
                    </span>
                    <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={1} aria-valuemin={1} aria-valuemax={5}>
                      <span className="h-2.5 w-2.5 rounded-full bg-[#FF008C] shadow-[0_0_8px_rgba(255,0,140,0.55)]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#E7E2EC] dark:bg-zinc-700" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#E7E2EC] dark:bg-zinc-700" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#E7E2EC] dark:bg-zinc-700" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#E7E2EC] dark:bg-zinc-700" />
                    </div>
                  </div>
                </div>

                {/* ── 6. FOUR FEATURE ROWS ── */}
                <div className="relative">
                  {[
                    { icon: Users, title: 'Connect with friends', desc: 'Chat, follow and grow your circle.' },
                    { icon: Play, title: 'Explore amazing content', desc: 'Short videos, stories and more.', solid: true },
                    { icon: ShoppingBag, title: 'Buy & sell easily', desc: 'On our marketplace.' },
                    { icon: ShieldCheck, title: 'Safe & secure', desc: 'Your privacy, our priority.' },
                  ].map(({ icon: Icon, title, desc, solid }, i) => (
                    <div
                      key={title}
                      className={`flex items-center gap-3.5 ${i < 3 ? 'border-b border-[#F7E7F0] pb-3 dark:border-white/5' : ''
                        } ${i > 0 ? 'pt-3' : ''}`}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFEBF5] text-[#FF008C] shadow-[inset_0_1px_2px_rgba(255,255,255,0.9)] dark:bg-white/10">
                        <Icon size={20} strokeWidth={2.3} fill={solid ? '#FF008C' : 'none'} className={solid ? 'ml-0.5' : ''} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[13.5px] font-black leading-tight text-[#10112D] dark:text-white">{title}</h4>
                        <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-[#6B6688] dark:text-zinc-400">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Small dimensional pink sparkle decoration (lower-right) */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-[70px] right-4 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6BB8] to-[#E6007E] text-white shadow-[0_10px_20px_rgba(255,0,140,0.45),inset_0_2px_3px_rgba(255,255,255,0.6),inset_0_-3px_6px_rgba(140,0,80,0.35)]"
                >
                  <Sparkles size={17} fill="white" strokeWidth={1.6} />
                </span>

                {/* ── 7. PRIMARY ACTION BUTTON ── */}
                <button
                  onClick={nextStep}
                  type="button"
                  className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#FF008C] px-6 py-3.5 text-[15px] font-extrabold tracking-wide text-white shadow-[0_14px_28px_rgba(255,0,140,0.38),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all hover:bg-[#E6007E] active:scale-[0.985] cursor-pointer"
                >
                  <span>Get started</span>
                  <ArrowRight size={18} strokeWidth={2.8} />
                </button>

                {/* ── 8. SIGN-IN ACTION ── */}
                <p className="relative mt-3.5 text-center text-xs font-medium text-[#565177] sm:text-[13px] dark:text-zinc-400">
                  Already have an account?{' '}
                  <Link to="/login" className="font-bold text-[#FF008C] hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </main>

          {/* ── 9. BOTTOM DECORATIVE WAVES (OVERLAPPING PINK & MAGENTA LAYERS) ── */}
          <div aria-hidden="true" className="relative z-0 mt-3 w-full overflow-hidden leading-none">
            <svg
              viewBox="0 0 1440 140"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-14 w-full sm:h-16"
              preserveAspectRatio="none"
            >
              <path
                d="M0,34C120,10 240,10 360,28C480,46 600,80 720,86C840,92 960,70 1080,52C1200,34 1320,22 1380,18L1440,14L1440,140L0,140Z"
                fill="#FFC0E2"
                fillOpacity="0.55"
              />
              <path
                d="M0,62C120,44 240,44 360,58C480,72 600,98 720,104C840,110 960,96 1080,80C1200,64 1320,50 1380,44L1440,38L1440,140L0,140Z"
                fill="#FF86C6"
                fillOpacity="0.5"
              />
              <path
                d="M0,88C140,72 280,70 420,82C560,94 700,118 840,122C980,126 1120,110 1260,94C1330,86 1390,80 1440,74L1440,140L0,140Z"
                fill="#FF4FAE"
                fillOpacity="0.45"
              />
              <path
                d="M0,112C160,102 320,100 480,108C640,116 800,132 960,134C1120,136 1280,124 1440,112L1440,140L0,140Z"
                fill="#FF008C"
                fillOpacity="0.35"
              />
            </svg>
          </div>
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
