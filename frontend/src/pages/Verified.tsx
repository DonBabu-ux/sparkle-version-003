import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ShieldCheck,
  Crown,
  UsersRound,
  Zap,
  Star,
  Flame,
  Lock,
  ChevronRight,
  Globe,
  MessageCircleHeart,
  Shield,
  X,
  Upload,
  Send,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { getAvatarUrl } from '../utils/imageUtils';
import Spinner from '../components/ui/Spinner';
import api from '../api/api';
import { logger } from '../utils/logger';
import { showError } from '../utils/toast';
import { validateFile } from '../utils/fileValidation';
import './Verified.css';

interface CriteriaStats {
  followers: number;
  engagement: number;
  trustLevel: number;
  totalSparks: number;
  totalComments: number;
}

type ActiveSheet = 'none' | 'followers' | 'engagement' | 'badges' | 'locked' | 'support' | 'search' | 'protection' | 'legacy' | 'viewAll' | 'evolution';

export default function Verified() {
  const navigate = useNavigate();
  const { user } = useUserStore();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CriteriaStats>({
    followers: 0,
    engagement: 0,
    trustLevel: 1,
    totalSparks: 0,
    totalComments: 0
  });

  const [activeSheet, setActiveSheet] = useState<ActiveSheet>('none');

  // Evolution Application form data (accessible when user opens evolution or application)
  const [formData, setFormData] = useState({
    category: '',
    documentType: '',
    description: ''
  });
  const [idFile, setIdFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/analytics/creator');
        const data = res.data || {};
        const followers = Number(data.followers) || 0;
        const totalSparks = Number(data.totalSparks) || 0;
        const totalComments = Number(data.totalComments) || 0;
        const rawTrust = Number(data.reputation?.trustLevel) || 1;
        const trustLevel = Math.max(1, Math.min(rawTrust, 5));

        // Legitimate engagement calculation clamped 0 - 100%
        const computedEngagement = followers > 0
          ? Math.min(Math.round(((totalSparks + totalComments) / followers) * 100), 100)
          : (totalSparks + totalComments > 0 ? Math.min(totalSparks + totalComments, 100) : 0);

        setStats({
          followers,
          engagement: computedEngagement,
          trustLevel,
          totalSparks,
          totalComments
        });
      } catch (err) {
        logger.error('Failed to fetch criteria stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [fetchNotifications]);

  const isEligible = stats.followers >= 1000 && stats.engagement >= 70 && stats.trustLevel >= 3;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/explore');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Honest feedback required: No identity verification pipeline exists server-side.
    // Must state that file was NOT uploaded.
    showError('Identity verification is not accepting submissions yet. Your document was NOT uploaded and nothing was sent.');
  };

  const trustLevelNames: Record<number, string> = {
    1: 'RECOGNIZED',
    2: 'TRUSTED',
    3: 'ESTABLISHED',
    4: 'CONFIRMED',
    5: 'VERIFIED'
  };

  const currentLevelName = trustLevelNames[stats.trustLevel] || 'RECOGNIZED';

  if (loading) {
    return (
      <div className="verification-page-bg flex items-center justify-center min-h-dvh">
        <Spinner size="large" color="text-[#FF008C]" />
      </div>
    );
  }

  return (
    <div className="verification-page-bg text-[#10112D] dark:text-white font-sans transition-colors duration-300 relative select-none">

      {/* Decorative Wave Ribbons and Ambient Lighting */}
      <div className="verification-wave-ribbon top-0 left-0 right-0 h-96 overflow-hidden pointer-events-none opacity-80">
        <svg
          viewBox="0 0 500 350"
          preserveAspectRatio="none"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="pinkWaveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFA7DF" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#FF64B0" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="pinkWaveGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E2A5F8" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#FFA9DD" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M-50,60 C120,130 200,-20 380,80 C470,130 520,70 560,90 L560,0 L-50,0 Z"
            fill="url(#pinkWaveGrad1)"
          />
          <path
            d="M-30,160 C90,80 240,220 420,110 C490,70 540,140 560,130 L560,0 L-30,0 Z"
            fill="url(#pinkWaveGrad2)"
          />
        </svg>
      </div>

      {/* Subtle Magenta Star Glints */}
      <div className="absolute top-28 left-14 text-[#FF168F] pointer-events-none sparkle-star-glint opacity-85">
        <Sparkles size={18} fill="#FF168F" />
      </div>
      <div className="absolute top-36 right-20 text-[#FF168F] pointer-events-none sparkle-star-glint opacity-75" style={{ animationDelay: '1.8s' }}>
        <Sparkles size={14} fill="#FF168F" />
      </div>
      <div className="absolute top-72 right-10 text-[#FF8BD2] pointer-events-none sparkle-star-glint opacity-60" style={{ animationDelay: '2.5s' }}>
        <Sparkles size={12} fill="#FF8BD2" />
      </div>

      {/* Main Container - Constrained to Mobile Width matching screenshot */}
      <div className="max-w-md mx-auto px-4 pt-6 md:pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] relative z-10">

        {/* ── 2. PROFILE HERO (PIXEL-PERFECT VISUAL CENTERPIECE) ── */}
        <section className="relative text-center pt-6 pb-6 mb-2 overflow-hidden">
          {/* Large Translucent Pink 3D Glass Shield with White Crown on the Right */}
          <div
            className="verification-shield-3d w-20 h-24 absolute right-2 top-3 flex items-center justify-center rotate-6 pointer-events-none opacity-90 transition-transform duration-500 hover:rotate-12"
            aria-hidden="true"
          >
            <Crown size={34} className="text-white drop-shadow-[0_2px_6px_rgba(255,255,255,0.8)]" strokeWidth={2} />
          </div>

          {/* Center Avatar with Luminous Ring and Blue Shield Badge */}
          <div className="relative inline-block mx-auto mb-2.5">
            <div className="w-[104px] h-[104px] rounded-full p-[3px] bg-gradient-to-tr from-[#FF8BD2] via-white to-[#FFA9DD] shadow-[0_12px_32px_rgba(255,142,204,0.38)]">
              <img
                src={getAvatarUrl(user?.avatar_url, user?.username)}
                alt={user?.display_name || user?.username || 'User Avatar'}
                className="w-full h-full rounded-full object-cover border-2 border-white/95 dark:border-black/50"
              />
            </div>
            {/* Overlapping Blue Verification-Style Shield Badge at Lower Right */}
            <div
              className="absolute -bottom-1 -right-0.5 w-8 h-8 rounded-full bg-white dark:bg-zinc-800 shadow-[0_4px_12px_rgba(37,99,235,0.35)] flex items-center justify-center p-0.5"
              title="Verified Identity Shield"
            >
              <div className="w-full h-full rounded-full bg-[#1D9BF0] flex items-center justify-center text-white">
                <ShieldCheck size={18} strokeWidth={2.8} />
              </div>
            </div>
          </div>

          {/* Cursive Sparkle Brand Signature below Avatar */}
          <div className="flex flex-col items-center justify-center mb-1">
            <div className="flex items-center gap-0.5 text-[#FF008C] text-sm -mb-1">
              <Crown size={11} fill="#FF008C" />
            </div>
            <span className="font-cursive-signature text-2xl font-bold text-[#10112D] dark:text-white tracking-wide">
              Sparkle
            </span>
          </div>

          {/* Main Heading: LEVEL 1: RECOGNIZED */}
          <h1 className="text-2xl font-black italic uppercase tracking-tight leading-none mb-1 text-[#10112D] dark:text-white">
            LEVEL {stats.trustLevel}:{' '}
            <span className="text-[#FF008C] drop-shadow-[0_2px_10px_rgba(255,0,140,0.25)]">
              {currentLevelName}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-[13px] font-medium text-[#565177] dark:text-zinc-400 mb-4 px-4">
            Keep growing your presence to unlock more features
          </p>

          {/* 5 Horizontally Aligned Rounded Progress Segments */}
          <div className="flex items-center justify-center gap-2 max-w-[280px] mx-auto px-2">
            {[1, 2, 3, 4, 5].map((lvl) => {
              const isFilled = lvl <= stats.trustLevel;
              return (
                <div
                  key={lvl}
                  className={`h-2 flex-1 rounded-full transition-all duration-700 ${
                    isFilled
                      ? 'bg-[#FF008C] shadow-[0_2px_8px_rgba(255,0,140,0.45)]'
                      : 'bg-[#E7DBF3] dark:bg-white/10'
                  }`}
                />
              );
            })}
          </div>
        </section>

        {/* ── 3. CARDS STACK ── */}
        <div className="space-y-3.5 mb-5">

          {/* Card 1 — GLOBAL FOLLOWERS */}
          <button
            type="button"
            onClick={() => setActiveSheet('followers')}
            className="w-full text-left verification-glass-card p-4 flex flex-col gap-3 group focus:outline-none"
            aria-label="Global Followers Progress Card"
          >
            <div className="flex items-center justify-between gap-3">
              {/* Circular Pastel-Pink Icon Container */}
              <div className="w-12 h-12 rounded-full bg-[#FFE3F3] dark:bg-pink-900/30 flex items-center justify-center text-[#FF008C] shrink-0 shadow-inner">
                <UsersRound size={22} strokeWidth={2.4} />
              </div>

              {/* Title & Subtitle */}
              <div className="flex-1 min-w-0 pr-1">
                <h2 className="text-sm font-black italic uppercase tracking-tight text-[#10112D] dark:text-white leading-tight">
                  GLOBAL FOLLOWERS
                </h2>
                <p className="text-[11px] text-[#565177] dark:text-zinc-400 truncate mt-0.5 font-medium">
                  Gain more followers to increase your reach worldwide.
                </p>
              </div>

              {/* Count & Chevron */}
              <div className="flex items-center gap-1 shrink-0 text-[#10112D] dark:text-white">
                <span className="text-xs font-black italic tracking-tight">
                  {stats.followers.toLocaleString()} / 1,000
                </span>
                <ChevronRight size={17} className="text-[#8F87A6] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Inset Lavender Progress Bar */}
            <div className="w-full h-2 rounded-full verification-progress-track overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-[#E5D7F2] dark:bg-pink-300/30 transition-all duration-1000"
                style={{ width: `${Math.min((stats.followers / 1000) * 100, 100)}%` }}
              />
            </div>
          </button>

          {/* Card 2 — ENGAGEMENT */}
          <button
            type="button"
            onClick={() => setActiveSheet('engagement')}
            className="w-full text-left verification-glass-card p-4 flex flex-col gap-3 group focus:outline-none"
            aria-label="Engagement Rate Progress Card"
          >
            <div className="flex items-center justify-between gap-3">
              {/* Circular Pink Container with Bright Magenta Lightning */}
              <div className="w-12 h-12 rounded-full bg-[#FFE0F2] dark:bg-pink-900/30 flex items-center justify-center text-[#FF008C] shrink-0 shadow-inner">
                <Zap size={22} fill="currentColor" strokeWidth={1} />
              </div>

              {/* Title & Subtitle */}
              <div className="flex-1 min-w-0 pr-1">
                <h2 className="text-sm font-black italic uppercase tracking-tight text-[#10112D] dark:text-white leading-tight">
                  ENGAGEMENT
                </h2>
                <p className="text-[11px] text-[#565177] dark:text-zinc-400 truncate mt-0.5 font-medium">
                  Your content engagement rate
                </p>
              </div>

              {/* Percentage & Chevron */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs font-black italic tracking-tight text-[#FF008C]">
                  {stats.engagement}% / 70%
                </span>
                <ChevronRight size={17} className="text-[#8F87A6] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Inset Pink Progress Bar */}
            <div className="w-full h-2 rounded-full verification-progress-track overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF008C] to-[#FF64B0] shadow-[0_0_10px_rgba(255,0,140,0.35)] transition-all duration-1000"
                style={{ width: `${Math.min((stats.engagement / 70) * 100, 100)}%` }}
              />
            </div>
          </button>

          {/* Card 3 — REPUTATION BADGES (TALLER WITH TWO TILES) */}
          <div className="verification-glass-card p-4 space-y-3">
            <button
              type="button"
              onClick={() => setActiveSheet('badges')}
              className="w-full flex items-center justify-between gap-3 text-left focus:outline-none group"
            >
              {/* Circular Lavender Icon with Purple Star */}
              <div className="w-12 h-12 rounded-full bg-[#EFE4FD] dark:bg-purple-900/30 flex items-center justify-center text-[#8C32ED] shrink-0 shadow-inner">
                <Star size={22} fill="currentColor" strokeWidth={1} />
              </div>

              {/* Title & Subtitle */}
              <div className="flex-1 min-w-0 pr-1">
                <h2 className="text-sm font-black italic uppercase tracking-tight text-[#10112D] dark:text-white leading-tight">
                  REPUTATION BADGES
                </h2>
                <p className="text-[11px] text-[#565177] dark:text-zinc-400 truncate mt-0.5 font-medium">
                  Earn badges by being active and positive
                </p>
              </div>

              {/* Badges Earned / Total */}
              <div className="flex items-center gap-1 shrink-0 text-[#8C32ED]">
                <span className="text-xs font-black italic tracking-tight">
                  {stats.trustLevel >= 3 ? '2 / 2' : '1 / 2'}
                </span>
                <ChevronRight size={17} className="text-[#8F87A6] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* Two Badge Tiles Side-by-Side */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Badge Tile A — Spark Seed */}
              <button
                type="button"
                onClick={() => setActiveSheet('badges')}
                className="verification-badge-tile-active p-3.5 flex flex-col items-center justify-center text-center transition-transform active:scale-95 focus:outline-none"
              >
                <Flame size={22} className="text-[#F97316] mb-1" fill="#F97316" />
                <span className="text-[12px] font-black uppercase tracking-tight text-[#10112D] dark:text-white leading-tight">
                  SPARK SEED
                </span>
                <span className="text-[10px] font-medium text-[#7A6E55] dark:text-amber-200/70 mt-0.5">
                  Current Badge
                </span>
              </button>

              {/* Badge Tile B — Viral */}
              <button
                type="button"
                onClick={() => setActiveSheet('badges')}
                className="verification-badge-tile-locked p-3.5 flex flex-col items-center justify-center text-center transition-transform active:scale-95 focus:outline-none"
              >
                <Lock size={20} className="text-[#8A849C] mb-1.5" strokeWidth={2.4} />
                <span className="text-[12px] font-black uppercase tracking-tight text-[#10112D] dark:text-white leading-tight">
                  VIRAL
                </span>
                <span className="text-[10px] font-medium text-[#7D7791] dark:text-zinc-400 mt-0.5">
                  {stats.trustLevel >= 3 ? 'Unlocked' : 'Locked'}
                </span>
              </button>
            </div>
          </div>

          {/* Card 4 — APPLICATION LOCKED (Or Eligible Unlocked Notice) */}
          {!isEligible ? (
            <button
              type="button"
              onClick={() => setActiveSheet('locked')}
              className="w-full text-left verification-locked-card p-4 flex items-center gap-3.5 group focus:outline-none"
            >
              {/* Circular Golden Icon with Orange Lock */}
              <div className="w-12 h-12 rounded-full bg-[#FFEAA7] flex items-center justify-center text-[#D97706] shrink-0 shadow-sm">
                <Lock size={22} strokeWidth={2.6} />
              </div>

              {/* Text Description */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-black uppercase tracking-tight text-[#92400E] dark:text-amber-300 leading-tight">
                  APPLICATION LOCKED
                </h3>
                <p className="text-[11px] font-medium text-[#78350F]/85 dark:text-amber-100/75 mt-0.5 leading-snug">
                  Increase your profile engagement and follower reach to unlock the verification evolution.
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveSheet('evolution')}
              className="w-full text-left verification-glass-card p-4 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border-emerald-400/50 flex items-center justify-between gap-3 group focus:outline-none"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-tight text-emerald-800 dark:text-emerald-300">
                    APPLICATION UNLOCKED!
                  </h3>
                  <p className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-200/80 mt-0.5">
                    You have achieved all criteria. Tap here to begin evolution.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

        </div>

        {/* ── 4. MORE ACTIONS SECTION (2x2 GRID + VIEW ALL) ── */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-black italic uppercase tracking-wider text-[#10112D] dark:text-white">
              MORE ACTIONS
            </h2>
            <button
              type="button"
              onClick={() => setActiveSheet('viewAll')}
              className="flex items-center gap-0.5 text-xs font-bold text-[#FF008C] hover:opacity-85 active:scale-95 transition-all"
            >
              View All
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Card 1 — Priority Support */}
            <button
              type="button"
              onClick={() => setActiveSheet('support')}
              className="verification-action-card p-3.5 flex items-center justify-between gap-2 text-left focus:outline-none group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#FFE4F3] dark:bg-pink-900/40 text-[#FF008C] flex items-center justify-center shrink-0">
                  <MessageCircleHeart size={18} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[11px] font-black uppercase tracking-tight text-[#10112D] dark:text-white leading-tight truncate">
                    PRIORITY SUPPORT
                  </h4>
                  <p className="text-[9.5px] font-medium text-[#565177] dark:text-zinc-400 truncate mt-0.5">
                    Get faster help from our team
                  </p>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#8F87A6] shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Card 2 — Global Search */}
            <button
              type="button"
              onClick={() => setActiveSheet('search')}
              className="verification-action-card p-3.5 flex items-center justify-between gap-2 text-left focus:outline-none group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#E3FBF3] dark:bg-emerald-900/40 text-[#10B981] flex items-center justify-center shrink-0">
                  <Globe size={18} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[11px] font-black uppercase tracking-tight text-[#10112D] dark:text-white leading-tight truncate">
                    GLOBAL SEARCH
                  </h4>
                  <p className="text-[9.5px] font-medium text-[#565177] dark:text-zinc-400 truncate mt-0.5">
                    Increase your discoverability
                  </p>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#8F87A6] shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Card 3 — Account Protection */}
            <button
              type="button"
              onClick={() => setActiveSheet('protection')}
              className="verification-action-card p-3.5 flex items-center justify-between gap-2 text-left focus:outline-none group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#FEF6DC] dark:bg-amber-900/40 text-[#D97706] flex items-center justify-center shrink-0">
                  <Shield size={18} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[11px] font-black uppercase tracking-tight text-[#10112D] dark:text-white leading-tight truncate">
                    ACCOUNT PROTECTION
                  </h4>
                  <p className="text-[9.5px] font-medium text-[#565177] dark:text-zinc-400 truncate mt-0.5">
                    Keep your account safe
                  </p>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#8F87A6] shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Card 4 — Legacy Badge */}
            <button
              type="button"
              onClick={() => setActiveSheet('legacy')}
              className="verification-action-card p-3.5 flex items-center justify-between gap-2 text-left focus:outline-none group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#FFE8F5] dark:bg-pink-900/40 text-[#FF008C] flex items-center justify-center shrink-0">
                  <Star size={18} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[11px] font-black uppercase tracking-tight text-[#10112D] dark:text-white leading-tight truncate">
                    LEGACY BADGE
                  </h4>
                  <p className="text-[9.5px] font-medium text-[#565177] dark:text-zinc-400 truncate mt-0.5">
                    For long-term contributors
                  </p>
                </div>
              </div>
              <ChevronRight size={15} className="text-[#8F87A6] shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </section>

      </div>

      {/* ── INTERACTIVE BOTTOM SHEETS & DETAILS ── */}
      {activeSheet !== 'none' && (
        <div className="fixed inset-0 z-[1001] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[env(safe-area-inset-bottom)] animate-fade-in">
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-[34px] sm:rounded-[34px] border border-white/80 dark:border-white/10 shadow-2xl p-6 pb-8 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10 mb-4">
              <h3 className="text-base font-black italic uppercase tracking-tight text-[#10112D] dark:text-white">
                {activeSheet === 'followers' && 'Global Followers Criteria'}
                {activeSheet === 'engagement' && 'Engagement Metrics & Formula'}
                {activeSheet === 'badges' && 'Reputation Badges System'}
                {activeSheet === 'locked' && 'Verification Evolution Status'}
                {activeSheet === 'support' && 'Priority Creator Support'}
                {activeSheet === 'search' && 'Global Search & Discovery'}
                {activeSheet === 'protection' && 'Account & Node Protection'}
                {activeSheet === 'legacy' && 'Legacy Contributor Badge'}
                {activeSheet === 'viewAll' && 'All Verification Benefits'}
                {activeSheet === 'evolution' && 'Evolution Application'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveSheet('none')}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#565177] dark:text-zinc-300"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sheet Content Details */}
            {activeSheet === 'followers' && (
              <div className="space-y-4 text-sm text-[#565177] dark:text-zinc-300">
                <div className="p-4 rounded-2xl bg-[#FFE4F3] text-[#10112D]">
                  <p className="font-bold text-xs uppercase tracking-wider text-[#FF008C] mb-1">
                    Current Milestone
                  </p>
                  <p className="text-xl font-black italic">
                    {stats.followers.toLocaleString()} of 1,000 Followers
                  </p>
                  <p className="text-xs text-[#565177] mt-1">
                    {stats.followers >= 1000
                      ? '✓ Target met! You qualify for the follower requirement.'
                      : `You need ${(1000 - stats.followers).toLocaleString()} more followers to meet the Level 1 threshold.`}
                  </p>
                </div>
                <p>
                  Sparkle creators who achieve 1,000 organic followers become recognized nodes in the ecosystem, increasing recommendation reach in Discover and search ranking.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => { setActiveSheet('none'); navigate('/explore'); }}
                    className="w-full py-3 rounded-2xl bg-[#FF008C] text-white font-bold text-sm text-center shadow-lg shadow-[#FF008C]/30"
                  >
                    Grow Followers in Discover
                  </button>
                </div>
              </div>
            )}

            {activeSheet === 'engagement' && (
              <div className="space-y-4 text-sm text-[#565177] dark:text-zinc-300">
                <div className="p-4 rounded-2xl bg-[#FFE0F2] text-[#10112D]">
                  <p className="font-bold text-xs uppercase tracking-wider text-[#FF008C] mb-1">
                    Current Engagement Rate
                  </p>
                  <p className="text-xl font-black italic text-[#FF008C]">
                    {stats.engagement}% / 100% Target
                  </p>
                  <p className="text-xs text-[#565177] mt-1">
                    Calculated from {stats.totalSparks} sparks and {stats.totalComments} comments across your published moments and posts.
                  </p>
                </div>
                <div>
                  <h5 className="font-bold text-xs uppercase text-[#10112D] dark:text-white mb-1">Measurement Window:</h5>
                  <p className="text-xs text-[#565177] dark:text-zinc-400">
                    Activity is aggregated over the trailing 30 days. Higher community replies, reposts, and reactions raise your score.
                  </p>
                </div>
              </div>
            )}

            {activeSheet === 'badges' && (
              <div className="space-y-4 text-sm text-[#565177] dark:text-zinc-300">
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 flex items-center gap-3">
                    <Flame size={24} className="text-orange-500 shrink-0" fill="#F97316" />
                    <div>
                      <p className="font-black text-xs uppercase text-[#10112D] dark:text-white">Spark Seed (Earned)</p>
                      <p className="text-[11px] text-[#7A6E55] dark:text-amber-200/70">Granted to authentic members upon initial verified node activation.</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-purple-200 bg-purple-50/60 dark:bg-purple-950/20 flex items-center gap-3">
                    <Lock size={22} className="text-purple-600 shrink-0" />
                    <div>
                      <p className="font-black text-xs uppercase text-[#10112D] dark:text-white">Viral (Locked)</p>
                      <p className="text-[11px] text-purple-700/80 dark:text-purple-300/70">Requires achieving 50,000+ views and 70%+ engagement on a single Sparkle Moment.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSheet === 'locked' && (
              <div className="space-y-4 text-sm text-[#565177] dark:text-zinc-300">
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 flex items-center gap-3">
                  <AlertCircle size={28} className="text-amber-600 shrink-0" />
                  <div>
                    <h5 className="font-black text-xs uppercase text-amber-900 dark:text-amber-300">Application Currently Locked</h5>
                    <p className="text-xs text-amber-800/80 dark:text-amber-200/70 mt-0.5">
                      You must meet 1,000 followers and 70% engagement before advancing to the Evolution pipeline.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-bold uppercase text-[#10112D] dark:text-white">Criteria Checklist:</p>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
                    <span>1,000 Followers</span>
                    <span className={stats.followers >= 1000 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                      {stats.followers >= 1000 ? '✓ Complete' : `${stats.followers} / 1,000`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
                    <span>70% Engagement Rate</span>
                    <span className={stats.engagement >= 70 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                      {stats.engagement >= 70 ? '✓ Complete' : `${stats.engagement}% / 70%`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {(activeSheet === 'support' || activeSheet === 'search' || activeSheet === 'protection' || activeSheet === 'legacy' || activeSheet === 'viewAll') && (
              <div className="space-y-3 text-sm text-[#565177] dark:text-zinc-300">
                <p>
                  Sparkle verified nodes unlock dedicated features to accelerate creator audience growth, direct hotline assistance, higher search ranking, and authenticated account protection.
                </p>
                <div className="p-3 rounded-2xl bg-pink-50 dark:bg-pink-950/30 text-xs text-[#FF008C] font-semibold">
                  Evolution status: LEVEL {stats.trustLevel} ({currentLevelName})
                </div>
                <button
                  onClick={() => setActiveSheet('none')}
                  className="w-full py-3 rounded-2xl bg-[#FF008C] text-white font-bold text-sm text-center"
                >
                  Understood
                </button>
              </div>
            )}

            {activeSheet === 'evolution' && (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-[#565177] dark:text-zinc-400">
                    Creator Evolution Category
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-semibold text-[#10112D] dark:text-white focus:outline-none"
                  >
                    <option value="">Select category</option>
                    <option value="creator">Creator Elite</option>
                    <option value="public_figure">Public Figure</option>
                    <option value="brand">Brand / Studio</option>
                    <option value="community_leader">Community Leader</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-[#565177] dark:text-zinc-400">
                    Supporting Document
                  </label>
                  <div className="border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl p-4 text-center">
                    <input
                      type="file"
                      id="evolution-file"
                      className="sr-only"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const check = validateFile(file, { kind: 'any', maxSizeMB: 10 });
                        if (!check.ok) {
                          showError(check.error!);
                          e.target.value = '';
                          return;
                        }
                        setIdFile(file);
                      }}
                    />
                    <label htmlFor="evolution-file" className="cursor-pointer flex flex-col items-center">
                      <Upload size={24} className="text-[#FF008C] mb-1" />
                      <span className="text-xs font-bold text-[#10112D] dark:text-white">
                        {idFile ? idFile.name : 'Choose Government ID or Document'}
                      </span>
                      <span className="text-[10px] text-[#565177] dark:text-zinc-400 mt-0.5">
                        JPG, PNG, PDF up to 10MB
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-[#565177] dark:text-zinc-400">
                    Reason for Evolution
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Briefly state your verification intent..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl px-4 py-3 text-sm text-[#10112D] dark:text-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-[#FF008C] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#FF008C]/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  <Send size={18} />
                  Submit Evolution
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ── 7. SPARKLE HUB OVERLAY MODAL (Triggered by Top Right Grid Button) ── */}
      {showHub && (
        <SparkleHub onClose={() => setShowHub(false)} />
      )}

    </div>
  );
}
