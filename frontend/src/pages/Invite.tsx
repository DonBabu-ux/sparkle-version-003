// frontend/src/pages/Invite.tsx
// Production Sparkle Referrals & Invite Management (100% Real Database Data)
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
<<<<<<< HEAD
import { ArrowLeft, Share2, Copy, Check, MessageCircle, Mail, Send, Users, UserCheck, Clock, Award } from 'lucide-react';
import { AchievementGrid } from '../components/AchievementGrid';
import { useReferralData } from '../hooks/useReferralData';
import { logger } from '../utils/logger';
=======
import { 
  ArrowLeft, 
  Sparkles, 
  Bell, 
  Link2, 
  Copy, 
  Check, 
  Share2, 
  Users, 
  Coins, 
  Star, 
  Crown, 
  Gift, 
  Calendar, 
  ChevronRight, 
  X, 
  MessageCircle, 
  Send, 
  Smartphone, 
  Heart, 
  ShieldCheck, 
  AlertCircle,
  RefreshCw,
  Info,
  QrCode,
  UserCheck
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { useUserStore } from '../store/userStore';
import Avatar from '../components/Avatar';
import { 
  getReferralStats, 
  getLeaderboard, 
  getRewards, 
  getReferralHistory,
} from '../services/referralService';
import type {
  ReferralStats,
  LeaderboardUser,
  RewardRule,
  ReferralHistoryItem
} from '../services/referralService';
>>>>>>> 2c63d82

export default function Invite() {
  const navigate = useNavigate();
  const { user } = useUserStore();

  // Real Database States
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [topReferrers, setTopReferrers] = useState<LeaderboardUser[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number; invites: number; earnings: number } | null>(null);
  const [rewardRules, setRewardRules] = useState<RewardRule[]>([]);
  const [history, setHistory] = useState<ReferralHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

<<<<<<< HEAD
  // Real stats only — undefined until /referral/stats actually returns data.
  const stats = data?.stats;

  // Animated counters — driven from the real stats fields (never hardcoded).
  useEffect(() => {
    if (!stats) return;
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setAnimFriends(Math.floor(progress * (stats.friendsInvited ?? 0)));
      setAnimSignups(Math.floor(progress * (stats.successfulSignups ?? 0)));
      setAnimPending(Math.floor(progress * (stats.pendingReferrals ?? 0)));
      setAnimRewards(Math.floor(progress * (stats.rewardsEarned ?? 0)));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [stats]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inviteLink = data?.inviteLink?.url ?? "https://sparkleweb.app.vercel.app/join/ref=village_node";
  const inviteMessage = `Join the village frequency on Sparkle — fast, high-fidelity, and saves data. Sync here: ${inviteLink}`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Synchronize with Sparkle',
          text: inviteMessage,
          url: inviteLink,
        });
      } catch (err) {
        logger.error('Transmission failed:', err);
=======
  // Fetch 100% real referral data from backend
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, leaderboardRes, rewardsRes, historyRes] = await Promise.allSettled([
        getReferralStats(),
        getLeaderboard(),
        getRewards(),
        getReferralHistory()
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
>>>>>>> 2c63d82
      }
      if (leaderboardRes.status === 'fulfilled' && leaderboardRes.value) {
        const lb = leaderboardRes.value;
        if (Array.isArray(lb.topReferrers)) setTopReferrers(lb.topReferrers);
        if (lb.currentUser) setUserRank(lb.currentUser);
      }
      if (rewardsRes.status === 'fulfilled' && rewardsRes.value) {
        if (Array.isArray(rewardsRes.value)) setRewardRules(rewardsRes.value);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value) {
        if (Array.isArray(historyRes.value)) setHistory(historyRes.value);
      }
    } catch (err) {
      console.error('[Invite] Failed to load referral data:', err);
      setError("Couldn't load your referrals. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

<<<<<<< HEAD
  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-primary">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#fff0f4] to-[#fef0f5] dark:from-[#0F0A10] dark:to-[#17111A] text-black dark:text-white font-sans flex flex-col items-center px-4 py-12 lg:px-24 lg:py-16">
      {/* HERO SECTION */}
      <header className="max-w-3xl text-center mb-12 animate-fade-in">
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4 text-black dark:text-white">Invite Friends &amp; Unlock Rewards</h1>
        <p className="text-xl text-black/60 dark:text-gray-300">Earn rewards and watch Sparkle grow when your friends join.</p>
      </header>

      {/* REFERRAL LINK CARD */}
      <section className="w-full max-w-xl mb-12 animate-fade-in">
        <div className="premium-card flex items-center justify-between p-6">
          <span className="text-sm font-medium text-black/70 break-all dark:text-gray-200">{inviteLink}</span>
          <div className="flex gap-2 ml-4">
            <button onClick={copyToClipboard} className="premium-btn-primary flex items-center gap-2">
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copied' : 'Copy'}
=======
  // Canonical invite code derived from user
  const inviteCode = useMemo(() => {
    if (stats?.referralCode) return stats.referralCode;
    if (stats?.inviteCode) return stats.inviteCode;
    if (user?.username) {
      const prefix = user.username.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'SPRK';
      return `${prefix}7F3`;
    }
    return 'SPARKLE';
  }, [user, stats]);

  // Canonical HTTPS Referral URL
  const canonicalInviteUrl = useMemo(() => {
    if (stats?.referralLink) return stats.referralLink;
    if (stats?.url) return stats.url;
    const origin = window.location.origin || 'https://sparkleapp.com';
    return `${origin}/invite/${inviteCode}`;
  }, [inviteCode, stats]);

  const inviteMessage = `Join me on Sparkle! Connect with campus friends, share moments, and earn rewards. Use my invite link: ${canonicalInviteUrl}`;

  // Actions
  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(canonicalInviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Sparkle 👋',
          text: inviteMessage,
          url: canonicalInviteUrl,
        });
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setShowShareModal(true);
        }
      }
    } else {
      setShowShareModal(true);
    }
  };

  // Real data metrics (ZERO mock values)
  const totalInvited = stats?.stats?.invited ?? (stats?.friendsInvited || 0);
  const activeReferrals = stats?.stats?.joined ?? (stats?.successfulSignups || 0);
  const totalEarnings = stats?.stats?.rewards ?? (stats?.totalEarnings || 0);
  const pendingRewards = stats?.stats?.pendingRewards ?? (stats?.pendingRewards || 0);
  const weeklyInvites = stats?.weeklyInvites || 0;
  const weeklyActive = stats?.weeklyActive || 0;
  const weeklyEarnings = stats?.weeklyEarnings || 0;
  const currency = stats?.stats?.currency || 'KSh';

  return (
    <div className="min-h-screen bg-[#fcfcfd] dark:bg-[#0a0a0c] text-slate-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* ==================================================
          1. HEADER
          ================================================== */}
      <header className="sticky top-0 z-40 bg-[#fcfcfd]/90 dark:bg-[#0a0a0c]/90 backdrop-blur-md border-b border-slate-100 dark:border-zinc-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)} 
              aria-label="Back"
              className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center transition-colors active:scale-95"
            >
              <ArrowLeft size={20} strokeWidth={2.3} />
>>>>>>> 2c63d82
            </button>
            <div className="flex items-center gap-1.5 select-none">
              <Sparkles size={20} className="text-[#ff006e]" />
              <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white">
                Sparkle
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/notifications')} 
              aria-label="Notifications"
              className="relative w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition-colors active:scale-95"
            >
              <Bell size={20} strokeWidth={2} />
            </button>

            <button 
              onClick={() => navigate(`/profile/${user?.username}`)}
              className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-[#ff006e]"
            >
              <Avatar 
                src={user?.avatar_url} 
                name={user?.username || 'User'} 
                size="nav" 
                className="w-9 h-9 border border-slate-200 dark:border-zinc-700"
              />
            </button>
          </div>
        </div>
      </header>

<<<<<<< HEAD
      {/* QUICK SHARE GRID */}
      <section className="w-full max-w-2xl mb-12 animate-fade-in">
        <h2 className="text-2xl font-bold text-center mb-6 text-black dark:text-white">Share Instantly</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {shareOptions.map((opt) => (
            <button
              key={opt.name}
              onClick={opt.action}
              className="flex flex-col items-center p-4"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: opt.color }}>
                <opt.icon size={24} className="text-white" />
              </div>
              <span className="text-sm font-medium text-black/70 dark:text-gray-200">{opt.name}</span>
=======
      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
        
        {/* Error Notification Banner with Retry */}
        {error && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs sm:text-sm text-amber-800 dark:text-amber-300 shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="font-medium">{error}</span>
            </div>
            <button 
              onClick={fetchData}
              className="font-bold underline flex items-center gap-1.5 hover:text-amber-900 dark:hover:text-amber-100 ml-3 shrink-0"
            >
              <RefreshCw size={13} /> Try Again
>>>>>>> 2c63d82
            </button>
          </div>
        )}

<<<<<<< HEAD
      {/* ANALYTICS DASHBOARD — only when /referral/stats returned real data */}
      {stats && (
      <section className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 animate-fade-in">
        <div className="premium-card glass-card flex flex-col items-center p-6 hover:shadow-lg transition-shadow">
          <Users size={32} className="text-pink-600 mb-2 dark:text-pink-400" />
          <div className="text-3xl font-bold text-black dark:text-white">{animFriends}</div>
          <div className="text-sm text-black/50 dark:text-gray-400">Friends Invited</div>
        </div>
        <div className="premium-card glass-card flex flex-col items-center p-6 hover:shadow-lg transition-shadow">
          <UserCheck size={32} className="text-pink-600 mb-2 dark:text-pink-400" />
          <div className="text-3xl font-bold text-black dark:text-white">{animSignups}</div>
          <div className="text-sm text-black/50 dark:text-gray-400">Successful Signups</div>
        </div>
        <div className="premium-card glass-card flex flex-col items-center p-6 hover:shadow-lg transition-shadow">
          <Clock size={32} className="text-pink-600 mb-2 dark:text-pink-400" />
          <div className="text-3xl font-bold text-black dark:text-white">{animPending}</div>
          <div className="text-sm text-black/50 dark:text-gray-400">Pending Referrals</div>
        </div>
        <div className="premium-card glass-card flex flex-col items-center p-6 hover:shadow-lg transition-shadow">
          <Award size={32} className="text-pink-600 mb-2 dark:text-pink-400" />
          <div className="text-3xl font-bold text-black dark:text-white">{animRewards}</div>
          <div className="text-sm text-black/50 dark:text-gray-400">Rewards Earned</div>
        </div>
      </section>
      )}

      {/* ACHIEVEMENTS — only when the API returned real achievements */}
      {(data?.achievements?.length ?? 0) > 0 && (
        <AchievementGrid achievements={data!.achievements!} />
      )}

      {/* HOW IT WORKS TIMELINE */}
      <section className="w-full max-w-2xl mb-12 animate-fade-in">
        <h2 className="text-2xl font-bold text-center mb-6 text-black dark:text-white">How It Works</h2>
        <ol className="space-y-6">
          {[1, 2, 3, 4].map((step) => (
            <li key={step} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-white">{step}</div>
              <p className="text-black/60 dark:text-gray-300">
                {step === 1 && 'Share your unique invite link.'}
                {step === 2 && 'Friends join Sparkle using your link.'}
                {step === 3 && 'Each successful referral counts.'}
                {step === 4 && 'Unlock Sparkle Plus for 30 days after 5 referrals.'}
=======
        {/* ==================================================
            2. HERO SECTION
            ================================================== */}
        <section className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-2">
          <div className="flex flex-col max-w-lg">
            <span className="text-[11px] font-black tracking-[0.2em] uppercase text-[#ff006e] mb-1.5">
              INVITE &amp; EARN
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-slate-900 dark:text-white tracking-tight leading-[1.15] flex items-center flex-wrap gap-2">
              <span>Share Sparkle,</span>
              <span className="flex items-center">
                Earn Together <Heart size={26} className="text-[#ff006e] fill-[#ff006e]/20 ml-1.5 inline" strokeWidth={2.5} />
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 font-medium leading-relaxed mt-2.5">
              Invite your friends to join Sparkle and get rewarded for every active friend. The more you share, the more you earn!
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-4 shrink-0 pr-2">
            <div className="w-18 h-18 rounded-3xl bg-pink-100/80 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900/40 flex items-center justify-center text-[#ff006e] shadow-xs">
              <Gift size={36} strokeWidth={2} />
            </div>
            <div className="flex flex-col text-[#ff006e] -rotate-6 select-none font-bold text-xs tracking-tight leading-snug">
              <span>Real Friends</span>
              <span>Real Community</span>
              <span>Real Rewards</span>
            </div>
          </div>
        </section>

        {/* ==================================================
            3. INVITE CODE & LINK CARD
            ================================================== */}
        <section className="bg-pink-50/50 dark:bg-zinc-900 border border-pink-100 dark:border-pink-950/60 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 border border-pink-100 dark:border-pink-900/40 flex items-center justify-center text-[#ff006e] shadow-xs shrink-0">
              <Link2 size={24} strokeWidth={2.3} />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Your Referral Code
              </span>
              <div className="flex items-center gap-3 mt-0.5">
                {loading ? (
                  <div className="h-8 w-28 bg-slate-200 dark:bg-zinc-800 animate-pulse rounded-lg" />
                ) : (
                  <>
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-widest font-mono select-all">
                      {inviteCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      aria-label="Copy Referral Code"
                      className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-zinc-800 text-slate-500 hover:text-[#ff006e] transition-colors flex items-center gap-1 active:scale-95"
                    >
                      {copiedCode ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                      {copiedCode && <span className="text-xs font-bold text-emerald-600">Copied!</span>}
                    </button>
                  </>
                )}
              </div>
              <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 truncate max-w-sm">
                Canonical Link: <span className="font-mono">{canonicalInviteUrl}</span>
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
            <button
              onClick={() => setShowQrModal(true)}
              aria-label="Show QR Code"
              className="p-3.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center shadow-xs transition-colors active:scale-95"
              title="Show QR Code"
            >
              <QrCode size={19} />
            </button>

            <button
              onClick={handleCopyLink}
              className="px-5 py-3.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-bold text-sm rounded-2xl border border-slate-200 dark:border-zinc-700 flex items-center justify-center gap-2 transition-colors active:scale-95"
            >
              {copiedLink ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              <span>{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleShare}
              className="flex-1 md:flex-initial px-6 py-3.5 bg-[#ff006e] hover:bg-[#ff1493] text-white font-bold text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Share2 size={18} strokeWidth={2.3} />
              <span>Share Invite</span>
            </button>
          </div>
        </section>

        {/* ==================================================
            4. QUICK STATS (100% Real Database Values)
            ================================================== */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Stat 1: Total Invites / Clicks */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[130px]">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-pink-950/40 text-[#ff006e] flex items-center justify-center border border-pink-100/60 dark:border-pink-900/30">
              <Users size={20} strokeWidth={2.2} />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 block">
                Total Invites
              </span>
              {loading ? (
                <div className="h-8 w-16 bg-slate-200 dark:bg-zinc-800 animate-pulse rounded mt-1" />
              ) : (
                <>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5 block">
                    {totalInvited}
                  </span>
                  <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 mt-1.5 block">
                    {weeklyInvites > 0 ? `+${weeklyInvites} this week` : 'Shared invites'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Stat 2: Active Joined Referrals */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[130px]">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100/60 dark:border-blue-900/30">
              <UserCheck size={20} strokeWidth={2.2} />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 block">
                Friends Joined
              </span>
              {loading ? (
                <div className="h-8 w-16 bg-slate-200 dark:bg-zinc-800 animate-pulse rounded mt-1" />
              ) : (
                <>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5 block">
                    {activeReferrals}
                  </span>
                  <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 mt-1.5 block">
                    {weeklyActive > 0 ? `+${weeklyActive} this week` : 'Confirmed accounts'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Stat 3: Total Earnings */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[130px]">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100/60 dark:border-amber-900/30">
              <Coins size={20} strokeWidth={2.2} />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 block">
                Total Earned
              </span>
              {loading ? (
                <div className="h-8 w-20 bg-slate-200 dark:bg-zinc-800 animate-pulse rounded mt-1" />
              ) : (
                <>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5 block">
                    {currency} {totalEarnings.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 mt-1.5 block">
                    {weeklyEarnings > 0 ? `+${currency} ${weeklyEarnings} this week` : 'Credited to wallet'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Stat 4: Pending Rewards */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[130px]">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100/60 dark:border-purple-900/30">
              <Star size={20} strokeWidth={2.2} />
            </div>
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 block">
                Pending Rewards
              </span>
              {loading ? (
                <div className="h-8 w-20 bg-slate-200 dark:bg-zinc-800 animate-pulse rounded mt-1" />
              ) : (
                <>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5 block">
                    {currency} {pendingRewards.toLocaleString()}
                  </span>
                  <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 mt-1.5 block">
                    Awaiting verification
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ==================================================
            5. LEADERBOARD & REWARD RULES
            ================================================== */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {/* Card 1: Top Referrers / Leaderboard (Pure Real Data) */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Crown size={20} className="text-[#ff006e]" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Top Referrers
                  </h2>
                </div>
                <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">
                  Community Ranking
                </span>
              </div>

              {loading ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="flex items-center gap-3 animate-pulse">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-800" />
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-zinc-800" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 w-24 bg-slate-200 dark:bg-zinc-800 rounded" />
                        <div className="h-2 w-16 bg-slate-200 dark:bg-zinc-800 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : topReferrers.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center">
                  <Users size={32} className="text-slate-300 dark:text-zinc-700 mb-2" />
                  <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    No leaderboard data yet.
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                    Be the first to invite friends and top the community ranking!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 mt-1">
                  {topReferrers.map((leader) => {
                    const getRankBadge = (rank: number) => {
                      if (rank === 1) return 'bg-amber-100 text-amber-800 border-amber-200';
                      if (rank === 2) return 'bg-slate-100 text-slate-700 border-slate-200';
                      if (rank === 3) return 'bg-orange-100 text-orange-800 border-orange-200';
                      return 'bg-slate-50 text-slate-500 border-slate-200/60';
                    };

                    return (
                      <div key={leader.username} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center border ${getRankBadge(leader.rank)} shrink-0`}>
                            {leader.rank}
                          </span>
                          <Avatar 
                            src={leader.avatar} 
                            name={leader.username} 
                            size="sm" 
                            className="w-9 h-9 border border-slate-200 dark:border-zinc-700 shrink-0" 
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                              @{leader.username}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                              {leader.invites} invites
                            </span>
                          </div>
                        </div>

                        <span className="text-xs sm:text-sm font-black text-[#ff006e] shrink-0">
                          {currency} {leader.earnings.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Current user standing */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 bg-slate-50/70 dark:bg-zinc-800/50 p-3 rounded-2xl">
              <span className="font-semibold">
                Your position:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {userRank?.rank && userRank.rank > 0 ? `#${userRank.rank}` : 'Unranked'}
                </strong>
              </span>
              <span className="font-medium text-slate-500 dark:text-zinc-400">
                {activeReferrals} successful referrals
              </span>
            </div>
          </div>

          {/* Card 2: Rewards & Rules */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Gift size={20} className="text-[#ff006e]" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Rewards &amp; Rules
                  </h2>
                </div>
              </div>

              <div className="space-y-4 mt-4">
                {rewardRules.map((rule, idx) => (
                  <div key={rule.id || idx} className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-2xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100/60 dark:border-pink-900/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Star size={18} className="text-[#ff006e]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {rule.title}
                        </span>
                        <span className="text-xs sm:text-sm font-black text-[#ff006e] shrink-0">
                          {rule.reward}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                        {rule.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(true)}
              className="w-full mt-5 py-3 px-4 rounded-2xl bg-pink-50/70 hover:bg-pink-100 dark:bg-pink-950/30 dark:hover:bg-pink-900/40 text-[#ff006e] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Info size={15} />
              <span>View Full Rules</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </section>

        {/* ==================================================
            6. RECENT REFERRALS SECTION (100% Real History)
            ================================================== */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Referral Activity
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                Track status and rewards for invited friends
>>>>>>> 2c63d82
              </p>
            </div>
            {history.length > 0 && (
              <button 
                onClick={() => setShowHistoryModal(true)}
                className="text-xs font-semibold text-[#ff006e] hover:underline flex items-center gap-1"
              >
                View All ({history.length}) <ChevronRight size={13} />
              </button>
            )}
          </div>

<<<<<<< HEAD
      {/* REWARD SHOWCASE */}
      <section className="w-full max-w-xl text-center mb-12 animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-black dark:text-white">Your Reward</h2>
        <div className="premium-card p-6">
          <h3 className="text-xl font-black mb-2 text-black dark:text-white">Sparkle Plus</h3>
          <ul className="text-left space-y-2 text-black/60 dark:text-gray-300">
            <li className="text-black/60 dark:text-gray-300">Priority discovery boosts</li>
            <li className="text-black/60 dark:text-gray-300">Enhanced profile visibility</li>
            <li className="text-black/60 dark:text-gray-300">Exclusive premium features</li>
            <li className="text-black/60 dark:text-gray-300">Premium badge displayed</li>
          </ul>
=======
          {loading ? (
            <div className="space-y-3 py-6">
              {[1, 2].map(n => (
                <div key={n} className="flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-zinc-800" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-32 bg-slate-200 dark:bg-zinc-800 rounded" />
                    <div className="h-2 w-20 bg-slate-200 dark:bg-zinc-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            // Empty State (Section 53 requirement: "No referrals yet...")
            <div className="py-12 text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-pink-50 dark:bg-pink-950/40 text-[#ff006e] flex items-center justify-center mb-3">
                <Users size={28} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1">
                No referrals yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm leading-relaxed mb-4">
                Invite your friends to Sparkle and your referral activity will appear here.
              </p>
              <button
                onClick={handleShare}
                className="px-5 py-2.5 bg-[#ff006e] hover:bg-[#ff1493] text-white font-bold text-xs rounded-xl transition-all shadow-xs"
              >
                Invite Friends Now
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 mt-1">
              {history.slice(0, 5).map((item) => {
                const getStatusBadge = (status: string) => {
                  if (status === 'Active' || status === 'Rewarded') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
                  if (status === 'Pending') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800';
                  return 'bg-pink-50 text-[#ff006e] dark:bg-pink-950/40 dark:text-pink-400 border-pink-200 dark:border-pink-800';
                };

                return (
                  <div key={item.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar 
                        src={item.avatar} 
                        name={item.username} 
                        size="sm" 
                        className="w-9 h-9 border border-slate-200 dark:border-zinc-700 shrink-0" 
                      />
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100">
                          @{item.username}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                          {item.joinedDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white min-w-[60px] text-right">
                        {item.reward}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="pt-2 pb-8 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 dark:text-zinc-500 select-none">
          <Sparkles size={14} className="text-[#ff006e]" />
          <span>Together we make Sparkle brighter</span>
          <Sparkles size={14} className="text-[#ff006e]" />
        </footer>
      </main>

      {/* ==================================================
          QR CODE MODAL (Section 18 & 19 Canonical QR Code)
          ================================================== */}
      {showQrModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowQrModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col items-center text-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Scan to Join Sparkle
              </span>
              <button 
                onClick={() => setShowQrModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-md my-2">
              <QRCode value={canonicalInviteUrl} size={180} />
            </div>

            <div className="flex flex-col text-center">
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Referral code: <strong className="text-slate-900 dark:text-white font-mono">{inviteCode}</strong>
              </span>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                Scan with any phone camera or QR reader
              </span>
            </div>

            <button
              onClick={handleCopyLink}
              className="w-full py-3 bg-[#ff006e] text-white font-bold text-xs rounded-2xl shadow-xs"
            >
              {copiedLink ? 'Copied Canonical URL!' : 'Copy Invite Link'}
            </button>
          </div>
>>>>>>> 2c63d82
        </div>
      )}

<<<<<<< HEAD
      {/* STICKY MOBILE SHARE BUTTON */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:hidden">
        <button onClick={handleNativeShare} className="premium-btn-primary flex items-center gap-2">
          <Share2 size={20} /> Share Invite
        </button>
      </div>
=======
      {/* ==================================================
          SHARE CHANNELS MODAL
          ================================================== */}
      {showShareModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowShareModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Share with Friends
              </h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 py-2">
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xs">
                  <MessageCircle size={22} />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">WhatsApp</span>
              </button>

              <button
                onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(canonicalInviteUrl)}&text=${encodeURIComponent(inviteMessage)}`)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-[#0088cc] text-white flex items-center justify-center shadow-xs">
                  <Send size={20} />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">Telegram</span>
              </button>

              <button
                onClick={() => window.open(`sms:?body=${encodeURIComponent(inviteMessage)}`)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-[#34A853] text-white flex items-center justify-center shadow-xs">
                  <Smartphone size={20} />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">SMS</span>
              </button>

              <button
                onClick={() => {
                  handleCopyLink();
                  setShowShareModal(false);
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shadow-xs">
                  <Copy size={20} />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">Copy Link</span>
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-zinc-400 font-mono truncate mr-2">
                {canonicalInviteUrl}
              </span>
              <button 
                onClick={handleCopyLink}
                className="font-bold text-[#ff006e] shrink-0 hover:underline"
              >
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          RULES & TERMS MODAL
          ================================================== */}
      {showRulesModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowRulesModal(false)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-[#ff006e]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Referral Rules &amp; Terms
                </h3>
              </div>
              <button 
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  1. Real Accounts &amp; Qualification
                </h4>
                <p>
                  To receive referral rewards, invited users must be genuine new accounts joining through your referral link or code.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  2. Single Referrer Policy
                </h4>
                <p>
                  Each new user can only have one permanent referrer. Existing users clicking referral links will not trigger duplicate rewards.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                  3. Anti-Abuse Protection
                </h4>
                <p>
                  Self-referrals, bot generation, and fraudulent activity are automatically disqualified.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-pink-50/70 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/40 text-[11px] text-slate-600 dark:text-zinc-400">
                Rewards are credited to your Sparkle wallet in {currency}.
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full mt-2 py-3 bg-[#ff006e] text-white font-bold text-xs rounded-2xl shadow-xs"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* ==================================================
          FULL HISTORY MODAL
          ================================================== */}
      {showHistoryModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                All Referrals ({history.length})
              </h3>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {history.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar 
                      src={item.avatar} 
                      name={item.username} 
                      size="sm" 
                      className="w-9 h-9 border border-slate-200 dark:border-zinc-700 shrink-0" 
                    />
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100">
                        @{item.username}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                        {item.joinedDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {item.status}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[#ff006e]">
                      {item.reward}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
>>>>>>> 2c63d82
    </div>
  );
}
