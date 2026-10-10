// frontend/src/pages/InviteLandingPage.tsx
// Public Referral Invitation Landing Page (/invite/:code)
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Smartphone, Copy, Check, AlertCircle, ArrowRight, CheckCircle2, LogIn } from 'lucide-react';
import QRCode from 'react-qr-code';
import { validateReferralCode, recordReferralClick } from '../services/referralService';
import type { PublicInviteInfo } from '../services/referralService';
import { capturePendingReferral } from '../services/referralAttribution';
import { useUserStore } from '../store/userStore';
import Avatar from '../components/Avatar';

// Sleek aesthetic modern Sparkle insignia (replacing generic stars & sparkles)
const AestheticBrandMark = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="aestheticBrandGradS" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ff006e" />
        <stop offset="100%" stopColor="#ff477e" />
      </linearGradient>
    </defs>
    <rect x="2.5" y="2.5" width="19" height="19" rx="6" stroke="url(#aestheticBrandGradS)" strokeWidth="1.8" />
    <path
      d="M15.5 7.5C14.3 6.4 12.8 5.8 11.2 5.8C8.5 5.8 6.5 7.8 6.5 10.2C6.5 13.5 13.5 12.6 13.5 15.6C13.5 17.2 12.2 18.2 10.5 18.2C8.8 18.2 7.4 17.2 6.8 16"
      stroke="url(#aestheticBrandGradS)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="16.5" cy="7" r="1.5" fill="#ff006e" />
  </svg>
);

export default function InviteLandingPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user: currentUser } = useUserStore();

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<PublicInviteInfo | null>(null);
  const [handoffToken, setHandoffToken] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const cleanCode = (code || '').trim().toUpperCase();
  const canonicalUrl = `${window.location.origin}/invite/${cleanCode}`;

  useEffect(() => {
    if (!cleanCode) {
      setLoading(false);
      return;
    }

    async function initInvite() {
      setLoading(true);
      try {
        // 1. Record click & generate server-side handoff token
        const clickRes = await recordReferralClick({
          code: cleanCode,
          platform: 'web',
          source: 'invite_landing'
        });

        const token = clickRes?.handoffToken || '';
        if (token) setHandoffToken(token);

        // 2. Validate referral code info
        const info = await validateReferralCode(cleanCode);
        setInviteData(info);

        if (info.valid && info.referrer) {
          // 3. Persist pending referral locally so it survives APK download/installation
          capturePendingReferral({
            referralCode: cleanCode,
            handoffToken: token,
            referrer: info.referrer
          });
        }
      } catch (err) {
        console.error('Failed to load referral invite:', err);
      } finally {
        setLoading(false);
      }
    }

    initInvite();
  }, [cleanCode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenApp = () => {
    // Attempt custom scheme deep link to installed APK
    window.location.href = `sparkle://invite/${cleanCode}`;
  };

  const handleDownloadApk = () => {
    // Preserves handoffToken in localStorage and downloads direct APK
    const downloadUrl = '/sparkle.apk';
    window.location.href = downloadUrl;
  };

  const handleContinueWeb = () => {
    const signupUrl = `/signup?ref=${encodeURIComponent(cleanCode)}${handoffToken ? `&handoff=${encodeURIComponent(handoffToken)}` : ''}`;
    navigate(signupUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-2 border-[#ff006e] border-t-transparent animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-medium">Validating Sparkle invite...</p>
      </div>
    );
  }

  // Case: Invalid or expired referral code
  if (!inviteData?.valid) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'radial-gradient(120% 90% at 50% 0%, #231234 0%, #130e1f 45%, #07060a 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Ambient atmospheric aura behind modal */}
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 480,
            height: 480,
            background: 'radial-gradient(circle, rgba(255,0,110,0.18) 0%, rgba(139,92,246,0.1) 40%, transparent 70%)',
            pointerEvents: 'none',
            borderRadius: '50%',
            filter: 'blur(45px)',
          }}
        />

        {/* Sparkle Brand Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 28,
            zIndex: 1,
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #ff006e 0%, #ff477e 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(255,0,110,0.45)',
              flexShrink: 0,
            }}
          >
            <AestheticBrandMark size={24} />
          </div>
          <span style={{ fontWeight: 900, fontSize: 26, color: '#ffffff', letterSpacing: '-0.5px' }}>
            Sparkle
          </span>
        </div>

        {/* Modal Card - Clearly Elevated and Separated from Background */}
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            background: 'linear-gradient(170deg, rgba(37, 34, 52, 0.98) 0%, rgba(24, 22, 34, 0.99) 100%)',
            border: '2px solid rgba(255, 255, 255, 0.22)',
            borderRadius: 28,
            padding: '36px 28px',
            textAlign: 'center',
            boxShadow: '0 30px 90px rgba(0, 0, 0, 0.85), 0 0 50px rgba(255, 0, 110, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Warning Icon Badge */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(251, 191, 36, 0.15)',
              border: '2px solid rgba(251, 191, 36, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              boxShadow: '0 0 35px rgba(251, 191, 36, 0.25)',
            }}
          >
            <AlertCircle size={36} color="#fbbf24" strokeWidth={2.2} />
          </div>

          {/* Heading */}
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: '#ffffff',
              margin: '0 0 12px 0',
              letterSpacing: '-0.3px',
              lineHeight: 1.3,
            }}
          >
            Invitation Expired or Unavailable
          </h2>

          {/* Sub-text */}
          <p
            style={{
              fontSize: 14,
              color: '#cbd5e1',
              lineHeight: 1.6,
              margin: '0 0 28px 0',
            }}
          >
            {inviteData?.message || 'This invitation link is invalid or has expired. You can still join Sparkle directly for free!'}
          </p>

          {/* Divider */}
          <div
            style={{
              width: '100%',
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
              marginBottom: 24,
            }}
          />

          {/* Primary Action: Sign Up */}
          <button
            onClick={() => navigate('/signup')}
            style={{
              width: '100%',
              padding: '16px 24px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #ff006e 0%, #ff1f7d 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 10px 32px rgba(255,0,110,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'transform 0.15s, opacity 0.15s, box-shadow 0.15s',
              letterSpacing: '-0.2px',
              marginBottom: 12,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 14px 40px rgba(255,0,110,0.8)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 32px rgba(255,0,110,0.6)';
            }}
          >
            <span>Join Sparkle Directly</span>
            <ArrowRight size={18} strokeWidth={2.6} />
          </button>

          {/* Secondary Action: High Contrast Clickable Login */}
          <button
            onClick={() => navigate('/login')}
            style={{
              width: '100%',
              padding: '14px 22px',
              borderRadius: 16,
              background: '#ffffff',
              border: '1.5px solid #ffffff',
              color: '#000000',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 16px rgba(255,255,255,0.2)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f4f4f5';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <LogIn size={17} strokeWidth={2.4} color="#ff006e" />
            <span>Already have an account? Log In</span>
          </button>
        </div>

        {/* Footer */}
        <p style={{ marginTop: 28, fontSize: 12, color: '#94a3b8', zIndex: 1 }}>
          © {new Date().getFullYear()} Sparkle. Built for modern communities.
        </p>
      </div>
    );
  }

  const referrer = inviteData.referrer;
  const inviterName = referrer?.name || referrer?.username || 'A Sparkle member';
  const inviterHandle = referrer?.username ? `@${referrer.username.replace(/^@/, '')}` : '';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(120% 90% at 50% -10%, #251338 0%, #130d22 45%, #07060a 100%)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px',
        position: 'relative',
        overflowX: 'hidden',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Ambient atmospheric aura behind the modal to make it stand out against the background */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          height: 520,
          background: 'radial-gradient(circle, rgba(255,0,110,0.2) 0%, rgba(139,92,246,0.12) 40%, transparent 70%)',
          pointerEvents: 'none',
          borderRadius: '50%',
          filter: 'blur(50px)',
          zIndex: 0,
        }}
      />

      {/* Header */}
      <header
        style={{
          maxWidth: 440,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          paddingBottom: 8,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ff006e 0%, #ff477e 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(255,0,110,0.4)',
              flexShrink: 0,
            }}
          >
            <AestheticBrandMark size={22} />
          </div>
          <span style={{ fontWeight: 900, fontSize: 24, letterSpacing: '-0.5px', color: '#ffffff' }}>
            Sparkle
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '5px 12px',
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#f4f4f5',
            border: '1.5px solid rgba(255, 255, 255, 0.2)',
            letterSpacing: '0.2px',
            backdropFilter: 'blur(8px)',
          }}
        >
          Official Invite
        </span>
      </header>

      {/* Main Card */}
      <main
        style={{
          maxWidth: 440,
          width: '100%',
          margin: '20px auto',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: 'linear-gradient(170deg, rgba(37, 34, 52, 0.98) 0%, rgba(24, 22, 34, 0.99) 100%)',
            border: '2px solid rgba(255, 255, 255, 0.22)',
            borderRadius: 28,
            padding: '34px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 30px 90px rgba(0, 0, 0, 0.85), 0 0 50px rgba(255, 0, 110, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
            position: 'relative',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Subtle Top Pink Ambient Glow */}
          <div
            style={{
              position: 'absolute',
              top: -80,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 260,
              height: 260,
              background: 'radial-gradient(circle, rgba(255,0,110,0.22) 0%, rgba(255,0,110,0) 70%)',
              pointerEvents: 'none',
              borderRadius: '50%',
            }}
          />

          {/* Inviter Avatar */}
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <Avatar
              src={referrer?.avatar_url || undefined}
              name={inviterName}
              size="lg"
              className="w-20 h-20 rounded-full border-2 border-[#ff006e] shadow-xl"
            />
            <div
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                background: 'linear-gradient(135deg, #ff006e 0%, #ff477e 100%)',
                color: '#ffffff',
                borderRadius: '50%',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              <CheckCircle2 size={14} strokeWidth={2.8} />
            </div>
          </div>

          {/* Invitation Badge */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#ff2d87',
              background: 'rgba(255,0,110,0.14)',
              border: '1px solid rgba(255,0,110,0.4)',
              padding: '4px 12px',
              borderRadius: 999,
              marginBottom: 12,
            }}
          >
            YOU'RE INVITED
          </span>

          {/* Headline */}
          <h1
            style={{
              fontSize: 23,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.3px',
              lineHeight: 1.3,
              margin: '0 0 10px 0',
            }}
          >
            {inviterHandle || inviterName} invited you to join Sparkle
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 14,
              color: '#cbd5e1',
              lineHeight: 1.6,
              margin: '0 0 24px 0',
              maxWidth: 380,
            }}
          >
            Join thousands connecting on Sparkle. Discover moments, explore campus clubs, buy & sell on Marketplace, and earn rewards together!
          </p>

          {/* If the current user is ALREADY logged in */}
          {isAuthenticated ? (
            <div
              style={{
                width: '100%',
                padding: 16,
                borderRadius: 18,
                background: '#232330',
                border: '1.5px solid #3f3f54',
                textAlign: 'left',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                <CheckCircle2 size={18} />
                <span>You're already on Sparkle</span>
              </div>
              <p style={{ color: '#d4d4d8', fontSize: 13, marginBottom: 12 }}>
                Logged in as <strong style={{ color: '#ffffff' }}>@{currentUser?.username}</strong>. Referral rewards only apply to new signups.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: '#333342',
                  border: '1px solid #4a4a5e',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Go to Sparkle Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* Primary Action Buttons Container */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
                {/* 1. HERO SIGN UP CTA (Attractive, Vibrant, Highly Appealing) */}
                <button
                  onClick={handleContinueWeb}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #ff006e 0%, #ff1f7d 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    boxShadow: '0 10px 32px rgba(255,0,110,0.6)',
                    letterSpacing: '-0.2px',
                    transition: 'transform 0.15s, opacity 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 14px 40px rgba(255,0,110,0.8)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 10px 32px rgba(255,0,110,0.6)';
                  }}
                >
                  <span>Claim Invite & Sign Up Free</span>
                  <ArrowRight size={19} strokeWidth={2.8} />
                </button>

                {/* 2. DEDICATED HIGH-CONTRAST CLICKABLE LOG IN BUTTON */}
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    width: '100%',
                    padding: '14px 22px',
                    borderRadius: 16,
                    background: '#ffffff',
                    border: '1.5px solid #ffffff',
                    color: '#000000',
                    fontWeight: 800,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 9,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(255,255,255,0.2)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#f4f4f5';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <LogIn size={18} strokeWidth={2.4} color="#ff006e" />
                  <span>Already have an account? Log In</span>
                </button>

                {/* 3. APP / APK OPTIONS ROW (Clean, modern secondary choices) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 2 }}>
                  <button
                    onClick={handleDownloadApk}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: '#2d2d3f',
                      border: '1px solid #45455f',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#36364a';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#2d2d3f';
                    }}
                  >
                    <Download size={16} strokeWidth={2.4} color="#38bdf8" />
                    <span>Download APK</span>
                  </button>

                  <button
                    onClick={handleOpenApp}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: '#2d2d3f',
                      border: '1px solid #45455f',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#36364a';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#2d2d3f';
                    }}
                  >
                    <Smartphone size={16} strokeWidth={2.2} color="#a78bfa" />
                    <span>Open in App</span>
                  </button>
                </div>
              </div>

              {/* Referral Code Badge & Copy (High Contrast Card Surface) */}
              <div
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: 18,
                  background: 'linear-gradient(180deg, #2d2b40 0%, #222032 100%)',
                  border: '1.5px solid #555174',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 20,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      color: '#c4b5fd',
                      marginBottom: 2,
                    }}
                  >
                    Referral Code
                  </span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 18,
                      fontWeight: 900,
                      color: '#ffffff',
                      letterSpacing: '1.5px',
                    }}
                  >
                    {cleanCode}
                  </span>
                </div>
                <button
                  onClick={handleCopyCode}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 12,
                    background: copied
                      ? '#10b981'
                      : 'linear-gradient(135deg, #ff006e 0%, #ff477e 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    boxShadow: copied
                      ? '0 4px 14px rgba(16,185,129,0.35)'
                      : '0 4px 14px rgba(255,0,110,0.35)',
                    transition: 'all 0.15s',
                  }}
                >
                  {copied ? <Check size={15} strokeWidth={3} /> : <Copy size={15} strokeWidth={2.4} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* Desktop QR Code Section (Hidden on small mobile screens) */}
              <div
                className="hidden sm:flex"
                style={{
                  flexDirection: 'column',
                  alignItems: 'center',
                  paddingTop: 16,
                  borderTop: '1px solid rgba(255, 255, 255, 0.14)',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600, marginBottom: 12 }}>
                  Or scan with your phone camera
                </span>
                <div
                  style={{
                    padding: 14,
                    background: '#ffffff',
                    borderRadius: 18,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  <QRCode value={canonicalUrl} size={128} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ maxWidth: 440, width: '100%', margin: '0 auto', textAlign: 'center', paddingBottom: 12, position: 'relative', zIndex: 1 }}>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
          © {new Date().getFullYear()} Sparkle. Built for modern campus and general communities.
        </p>
      </footer>
    </div>
  );
}
