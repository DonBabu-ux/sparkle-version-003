import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Copy, Check, MessageCircle, Mail, Send, Users, UserCheck, Clock, Award } from 'lucide-react';
import Navbar from '../components/Navbar';
import { MilestoneTracker } from '../components/MilestoneTracker';
import { RewardVault } from '../components/RewardVault';
import { Leaderboard } from '../components/Leaderboard';
import { FloatingRewardWidget } from '../components/FloatingRewardWidget';
import { AchievementGrid } from '../components/AchievementGrid';
import { useReferralData } from '../hooks/useReferralData';

export default function Invite() {
  const { data, loading, errors } = useReferralData();

  const [copied, setCopied] = useState(false);

  const [animFriends, setAnimFriends] = useState(0);
  const [animSignups, setAnimSignups] = useState(0);
  const [animPending, setAnimPending] = useState(0);
  const [animRewards, setAnimRewards] = useState(0);

  // Extract safe stats object
  const stats = data?.stats ?? {};

  // Animated counters
  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setAnimFriends(Math.floor(progress * (stats.friendsInvited ?? 0)));
      setAnimSignups(Math.floor(progress * (stats.successfulSignups ?? 0)));
      setAnimPending(Math.floor(progress * (stats.pendingRewards ?? 0)));
      setAnimRewards(Math.floor(progress * (stats.rewardPoints ?? 0)));
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
        console.error('Transmission failed:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  const shareOptions = [
    { name: 'WhatsApp', icon: MessageCircle, color: '#25D366', action: () => window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`) },
    { name: 'Telegram', icon: Send, color: '#0088cc', action: () => window.open(`https://t.me/share/url?url=${inviteLink}&text=${encodeURIComponent(inviteMessage)}`) },
    { name: 'Messenger', icon: MessageCircle, color: '#0084FF', action: () => window.open(`fb-messenger://share/?link=${encodeURIComponent(inviteLink)}`) },
    { name: 'Email', icon: Mail, color: '#EA4335', action: () => window.open(`mailto:?subject=Join the village on Sparkle&body=${encodeURIComponent(inviteMessage)}`) },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-primary">
        Loading...
      </div>
    );
  }

  const invitedCount = stats.friendsInvited ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F0A10] to-[#17111A] text-white font-sans flex flex-col items-center px-4 py-12 lg:px-24 lg:py-16">
      {/* HERO SECTION */}
      <header className="max-w-3xl text-center mb-12 animate-fade-in">
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4 text-white">Invite Friends &amp; Unlock Rewards</h1>
        <p className="text-xl text-gray-300">Earn rewards and watch Sparkle grow when your friends join.</p>
      </header>

      {/* REFERRAL LINK CARD */}
      <section className="w-full max-w-xl mb-12 animate-fade-in">
        <div className="premium-card flex items-center justify-between p-6">
          <span className="text-sm font-medium text-gray-200 break-all">{inviteLink}</span>
          <div className="flex gap-2 ml-4">
            <button onClick={copyToClipboard} className="premium-btn-primary flex items-center gap-2">
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={handleNativeShare} className="premium-btn-accent flex items-center gap-2">
              <Share2 size={18} /> Share
            </button>
          </div>
        </div>
      </section>

      {/* QUICK SHARE GRID */}
      <section className="w-full max-w-2xl mb-12 animate-fade-in">
        <h2 className="text-2xl font-bold text-center mb-6 text-white">Share Instantly</h2>
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
              <span className="text-sm font-medium text-gray-200">{opt.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ANALYTICS DASHBOARD */}
      <section className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 animate-fade-in">
        <div className="premium-card glass-card flex flex-col items-center p-6 hover:shadow-lg transition-shadow">
          <Users size={32} className="text-pink-400 mb-2" />
          <div className="text-3xl font-bold text-white">{animFriends}</div>
          <div className="text-sm text-gray-400">Friends Invited</div>
        </div>
        <div className="premium-card glass-card flex flex-col items-center p-6 hover:shadow-lg transition-shadow">
          <UserCheck size={32} className="text-pink-400 mb-2" />
          <div className="text-3xl font-bold text-white">{animSignups}</div>
          <div className="text-sm text-gray-400">Successful Signups</div>
        </div>
        <div className="premium-card glass-card flex flex-col items-center p-6 hover:shadow-lg transition-shadow">
          <Clock size={32} className="text-pink-400 mb-2" />
          <div className="text-3xl font-bold text-white">{animPending}</div>
          <div className="text-sm text-gray-400">Pending Referrals</div>
        </div>
        <div className="premium-card glass-card flex flex-col items-center p-6 hover:shadow-lg transition-shadow">
          <Award size={32} className="text-pink-400 mb-2" />
          <div className="text-3xl font-bold text-white">{animRewards}</div>
          <div className="text-sm text-gray-400">Rewards Earned</div>
        </div>
      </section>

      {/* PROGRESS TRACKER */}
      <MilestoneTracker />

      {/* REWARD VAULT */}
      <RewardVault invitedCount={invitedCount} />

      {/* LEADERBOARD */}
      <Leaderboard />

      {/* ACHIEVEMENTS */}
      <AchievementGrid achievements={data?.achievements ?? []} />

      {/* HOW IT WORKS TIMELINE */}
      <section className="w-full max-w-2xl mb-12 animate-fade-in">
        <h2 className="text-2xl font-bold text-center mb-6 text-white">How It Works</h2>
        <ol className="space-y-6">
          {[1, 2, 3, 4].map((step) => (
            <li key={step} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-white">{step}</div>
              <p className="text-gray-300">
                {step === 1 && 'Share your unique invite link.'}
                {step === 2 && 'Friends join Sparkle using your link.'}
                {step === 3 && 'Each successful referral counts.'}
                {step === 4 && 'Unlock Sparkle Plus for 30 days after 5 referrals.'}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* REWARD SHOWCASE */}
      <section className="w-full max-w-xl text-center mb-12 animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-white">Your Reward</h2>
        <div className="premium-card p-6">
          <h3 className="text-xl font-black mb-2 text-white">Sparkle Plus</h3>
          <ul className="text-left space-y-2 text-gray-300">
            <li className="text-gray-300">Priority discovery boosts</li>
            <li className="text-gray-300">Enhanced profile visibility</li>
            <li className="text-gray-300">Exclusive premium features</li>
            <li className="text-gray-300">Premium badge displayed</li>
          </ul>
        </div>
      </section>

      {/* FLOATING REWARD WIDGET */}
      <FloatingRewardWidget />

      {/* STICKY MOBILE SHARE BUTTON */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:hidden">
        <button onClick={handleNativeShare} className="premium-btn-primary flex items-center gap-2">
          <Share2 size={20} /> Share Invite
        </button>
      </div>
    </div>
  );
}
