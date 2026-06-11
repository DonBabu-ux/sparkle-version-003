import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Target, TrendingUp, Rocket, Gift, Radio, 
  BarChart2, Calendar, ChevronRight, Lock, BadgeCheck, 
  ArrowRight, Sparkles, Award, ArrowLeft, Info, HelpCircle, Star
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import { useNavigate } from 'react-router-dom';
import SparkleLiveHero from '../components/SparkleLiveHero';
// --- Custom Svg Components to match the exact elements in the image ---

// Wrapped Gift Box
const GiftBoxImage = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="giftBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ff008a" />
        <stop offset="100%" stopColor="#b30062" />
      </linearGradient>
      <linearGradient id="giftLid" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ff66c4" />
        <stop offset="100%" stopColor="#ff008a" />
      </linearGradient>
    </defs>
    {/* Body */}
    <rect x="8" y="18" width="32" height="22" rx="4" fill="url(#giftBody)" stroke="#ff4db8" strokeWidth="1" />
    {/* Lid */}
    <rect x="6" y="12" width="36" height="8" rx="2" fill="url(#giftLid)" stroke="#ffffff" strokeWidth="0.5" />
    {/* Ribbon Bow */}
    <path d="M24 12C21 6 15 6 18 12C14 12 14 6 18 4C21 4 24 9 24 12Z" fill="#ffb3d1" />
    <path d="M24 12C27 6 33 6 30 12C34 12 34 6 30 4C27 4 24 9 24 12Z" fill="#ffb3d1" />
    {/* Wrapped Ribbon Lines */}
    <rect x="22" y="12" width="4" height="28" fill="#ffb3d1" />
    <rect x="8" y="27" width="32" height="4" fill="#ffb3d1" />
  </svg>
);

// Holographic circular platforms below padlock
const HolographicPlatform = () => (
  <svg width="180" height="44" viewBox="0 0 180 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="90" cy="22" rx="80" ry="16" fill="#ff008a" fillOpacity="0.1" stroke="#ff008a" strokeWidth="1" />
    <ellipse cx="90" cy="22" rx="70" ry="12" fill="#ff4db8" fillOpacity="0.05" stroke="#ff4db8" strokeWidth="0.5" strokeDasharray="4 2" />
    <ellipse cx="90" cy="28" rx="60" ry="10" fill="none" stroke="#ff66c4" strokeWidth="1.5" />
    {/* Radial center glow */}
    <ellipse cx="90" cy="22" rx="40" ry="8" fill="#ff008a" fillOpacity="0.3" filter="blur(4px)" />
  </svg>
);

export default function LockedLivePage() {
  const user = useUserStore(state => state.user);
const invites = user?.invited_users_count ?? 0;
const progress = Math.min(100, Math.round((invites / 5) * 100)); // progress toward next milestone (5 invites base)

const milestones = [5, 10, 25, 50];
const nextMilestone = milestones.find(m => m > invites) || 50;
const remaining = nextMilestone - invites;
  
  const [creators, setCreators] = useState<any[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [earlyAccessRequested, setEarlyAccessRequested] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);

  const navigate = useNavigate();

  const unlockSectionRef = useRef<HTMLDivElement>(null);

  // Set mock creators to match the exact items in the image
  const mockCreatorsList = [
    {
      user_id: 'dj_sparkle',
      username: 'DJ Sparkle',
      followers_text: '1.2M Followers',
      viewers_text: '2.4K',
      avatar: 'https://images.unsplash.com/photo-1516280440502-a2fe018c6426?w=150'
    },
    {
      user_id: 'study_with_me',
      username: 'Study With Me',
      followers_text: '856K Followers',
      viewers_text: '1.8K',
      avatar: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=150'
    },
    {
      user_id: 'code_master',
      username: 'Code Master',
      followers_text: '542K Followers',
      viewers_text: '968',
      avatar: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=150'
    },
    {
      user_id: 'gamer_pro',
      username: 'Gamer Pro',
      followers_text: '432K Followers',
      viewers_text: '756',
      avatar: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=150'
    },
    {
      user_id: 'music_vibes',
      username: 'Music Vibes',
      followers_text: '321K Followers',
      viewers_text: '612',
      avatar: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=150'
    }
  ];

  useEffect(() => {
    // Mimic API suggestions fetch or default to mock creators
    const timer = setTimeout(() => {
      setCreators(mockCreatorsList);
      setLoadingCreators(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const scrollToUnlock = () => {
    unlockSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleRequestAccess = () => {
    if (followers < 500) {
      setShowAccessModal(true);
    } else {
      setEarlyAccessRequested(true);
    }
  };

  // Particles for background ambiance
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 2,
    duration: Math.random() * 6 + 6,
    delay: Math.random() * 3
  }));



  return (
    <div className="min-h-screen bg-[#07020d] text-white overflow-hidden relative pb-24 font-sans selection:bg-[#ff008a]/20">
      
      {/* Background Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-[#ff008a] opacity-15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#ff4db8] opacity-10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[350px] h-[350px] rounded-full bg-[#ff008a] opacity-[0.12] blur-[110px] pointer-events-none" />

      {/* Floating Particles */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#ff008a] opacity-35 pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -120],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Premium Header matching image layout */}
      <div className="sticky top-0 z-50 bg-[#07020d]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
            Live <span className="text-[#ff008a]">Streams</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="flex items-center gap-1.5 bg-white/[0.08] px-3 py-1 rounded-full text-[10px] font-black text-[#ff4db8] uppercase tracking-widest border border-white/5 shadow-inner">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff008a] animate-pulse" />
              On Air
            </span>
            <span className="bg-white/[0.08] border border-white/5 px-3 py-1 rounded-full text-[10px] font-black text-white/60 tracking-wider">
              23 creators live now
            </span>
          </div>
        </div>

        <button 
          onClick={scrollToUnlock}
          className="bg-gradient-to-r from-[#ff008a] to-[#ff4db8] hover:from-[#ff4db8] hover:to-[#ff66c4] text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#ff008a]/20 transition-all hover:scale-[1.02] active:scale-95 border border-white/10"
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
              <circle cx="12" cy="12" r="2" />
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
              <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
            </svg>
            Go Live
          </span>
          <Lock size={12} strokeWidth={3} className="opacity-80" />
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 pt-6 space-y-8 relative z-10">
        
        {/* Main Hero Card (Large Glass Box) */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-[#120b22]/40 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl"
        >
          {/* Inner ambient shadows */}
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[#ff008a]/10 blur-[80px] pointer-events-none" />

          {/* Left Side: Info */}
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 bg-[#ff008a] text-white px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase shadow-md">
              LIVE
            </div>
            <span className="text-base font-extrabold text-white/95 ml-2.5" style={{ fontFamily: 'Outfit' }}>Sparkle Live</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight" style={{ fontFamily: 'Outfit' }}>
              Unlock <span className="text-[#ff008a]">Sparkle Live</span>
            </h2>
            <p className="text-white/60 text-xs md:text-sm leading-relaxed max-w-sm">
              Reach 1,000 followers to unlock live streaming, build your audience, and appear in Live Discovery.
            </p>

            <button 
              onClick={() => navigate('/learn-more')}
              className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 rounded-full text-xs font-black text-white/70 hover:text-white transition-all shadow-sm"
            >
              Why is Live locked?
              <Info size={14} className="text-white/50" />
            </button>
          </div>

          {/* Right Side: Lock centerpiece exact layout */}
          <div className="relative w-56 h-56 flex items-center justify-center shrink-0">
            
            {/* Holographic Circular Platforms */}
            <div className="absolute bottom-2 scale-90">
              <HolographicPlatform />
            </div>

            {/* Rotating Orbit Rings with Arrows */}
            {/* Ring 1: Large clockwise */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
              className="absolute inset-0 border border-dashed border-[#ff008a] rounded-full flex items-center justify-center"
            >
              <div className="absolute top-0 right-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_#ff008a]" />
              <div className="absolute bottom-0 left-1/2 w-1.5 h-1.5 bg-[#ff008a] rounded-full" />
            </motion.div>

            {/* Ring 2: Smaller anti-clockwise */}
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
              className="absolute w-40 h-40 border border-dotted border-[#ff4db8]/50 rounded-full flex items-center justify-center"
            >
              <div className="absolute top-4 left-4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_6px_#ff4db8]" />
            </motion.div>

            {/* Glowing Padlock */}
            <motion.div 
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#ff008a] via-[#ff4db8] to-[#ff66c4] border border-white/20 flex items-center justify-center shadow-3xl shadow-[#ff008a]/50 relative z-10"
            >
              <Lock size={36} className="text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]" strokeWidth={2.5} />
            </motion.div>

            {/* Floating Wrapped Gifts, Diamonds and Notes around the core */}
            {/* Gift Box Top Right */}
            <motion.div 
              animate={{ y: [0, -8, 0], rotate: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-2 right-4 z-20 scale-90"
            >
              <GiftBoxImage />
            </motion.div>

            {/* Gift Box Lower Right */}
            <motion.div 
              animate={{ y: [0, 6, 0], rotate: [0, -6, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-8 right-2 z-20 scale-75"
            >
              <GiftBoxImage />
            </motion.div>

            {/* Floating Diamond Bottom Right */}
            <motion.div 
              animate={{ y: [0, -4, 0], rotate: [0, 15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute bottom-4 right-12 z-20"
            >
              <div className="filter drop-shadow-[0_0_8px_#ff008a] scale-75">
                <DiamondSvg />
              </div>
            </motion.div>

            {/* Music note right side */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
              className="absolute right-0 top-1/3 z-20 scale-75"
            >
              <div className="filter drop-shadow-[0_0_6px_#ff66c4]">
                <TokenSvg />
              </div>
            </motion.div>

            {/* Gift Box Bottom Left */}
            <motion.div 
              animate={{ y: [0, -7, 0], rotate: [0, -10, 0] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute bottom-6 left-2 z-20 scale-90"
            >
              <GiftBoxImage />
            </motion.div>

            {/* Floating Heart Far Left */}
            <motion.div 
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 3 }}
              className="absolute left-0 top-1/2 z-20 text-[#ff008a] scale-90 drop-shadow-[0_0_8px_#ff008a]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </motion.div>

          </div>

        </motion.div>

        {/* Progress Card Section matching image spacing */}
        <motion.div 
          ref={unlockSectionRef}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-[#120b22]/40 backdrop-blur-xl border border-white/5 rounded-[28px] p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 shadow-2xl relative"
        >
          {/* Left section: Your Progress */}
          <div className="md:col-span-7 space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-sm font-black text-white/50 uppercase tracking-widest">Your Progress</h3>
                <p className="text-2xl font-extrabold text-white mt-1">
                  {followers.toLocaleString()} <span className="text-white/40 font-normal text-base">/ 1,000 Followers</span>
                </p>
              </div>
              <div>
                <span className="text-3xl font-black text-[#ff4db8] drop-shadow-[0_0_10px_rgba(255,77,184,0.4)]">{progress}%</span>
              </div>
            </div>

            {/* Custom progress slider line */}
            <div className="relative py-4">
              <div className="h-1.5 bg-white/10 rounded-full w-full relative">
                <motion.div 
                  initial={{ width: 0 }}
                  whileInView={{ width: `${progress}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-[#ff008a] to-[#ff4db8] rounded-full relative shadow-[0_0_12px_rgba(255,0,138,0.6)]"
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#ff008a] shadow-lg shadow-[#ff008a]/50" />
                </motion.div>
              </div>

              {/* Milestones nodes */}
              <div className="absolute top-2 inset-x-0 flex justify-between pointer-events-none">
                {milestones.map((m, idx) => {
                  const isReached = followers >= m;
                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                        isReached 
                          ? 'bg-[#ff008a] border-[#ff008a] text-white shadow-md shadow-[#ff008a]/30' 
                          : 'bg-[#181125] border-white/10 text-white/35'
                      }`}>
                        {m === 1000 ? (
                          <Star size={9} fill={isReached ? "#fff" : "none"} strokeWidth={3} />
                        ) : (
                          <Lock size={8} strokeWidth={3} />
                        )}
                      </div>
                      <span className={`text-[10px] font-black mt-2 tracking-tighter ${isReached ? 'text-[#ff4db8]' : 'text-white/30'}`}>
                        {((idx + 1) * 25)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Vertical divider on desktop */}
          <div className="hidden md:block w-px bg-white/10 self-stretch md:col-span-1 justify-self-center" />

          {/* Right section: Next Milestone Card */}
          <div className="md:col-span-4 flex flex-col justify-center space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ff008a]/10 flex items-center justify-center text-[#ff4db8] shadow-inner">
                <Target size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-wider">Next Milestone</p>
                <p className="text-base font-extrabold text-white mt-0.5">{nextMilestone} Followers</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-white/50 font-bold">{remaining > 0 ? `${remaining.toLocaleString()} followers remaining` : 'Milestone achieved ✨'}</p>
              <div className="h-1 bg-white/10 rounded-full w-full mt-2 overflow-hidden">
                <div className="h-full bg-white/20 rounded-full" style={{ width: `${Math.min(100, Math.round((followers / nextMilestone) * 100))}%` }} />
              </div>
            </div>
          </div>

        </motion.div>

        {/* 3-column Insights cards layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Followers */}
          <div className="bg-[#120b22]/40 backdrop-blur-xl border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-[#ff008a]/10 flex items-center justify-center text-[#ff4db8] shrink-0">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-wider">Followers</p>
              <p className="text-xl font-extrabold text-white mt-0.5">{followers.toLocaleString()}</p>
              <p className="text-[10px] text-[#ff4db8] font-bold mt-0.5">{progress}% of the way there</p>
            </div>
          </div>

          {/* Card 2: Next Milestone */}
          <div className="bg-[#120b22]/40 backdrop-blur-xl border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-[#ff008a]/10 flex items-center justify-center text-[#ff4db8] shrink-0">
              <Target size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-wider">Next Milestone</p>
              <p className="text-xl font-extrabold text-white mt-0.5">{nextMilestone} Followers</p>
              <p className="text-[10px] text-white/40 font-bold mt-0.5">Reach {nextMilestone} to unlock rewards</p>
            </div>
          </div>

          {/* Card 3: Request Early Access */}
          <motion.div 
            whileHover={{ y: -2 }}
            onClick={handleRequestAccess}
            className={`p-5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all shadow-xl ${
              earlyAccessRequested
                ? 'from-emerald-950/40 to-emerald-900/20 border-emerald-500/20'
                : 'bg-gradient-to-r from-[#ff008a] to-[#ff4db8] hover:from-[#ff4db8] hover:to-[#ff66c4] border-white/10 hover:shadow-lg hover:shadow-[#ff008a]/20'
            }`}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                <Rocket size={20} className={earlyAccessRequested ? '' : 'animate-pulse'} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">
                  {earlyAccessRequested ? 'Requested' : 'Request Early Access'}
                </h4>
                <p className="text-[10px] text-white/80 mt-0.5 truncate leading-snug">
                  {earlyAccessRequested ? 'Awaiting review' : 'Get reviewed for early access'}
                </p>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white shrink-0 transition-colors">
              <ChevronRight size={14} strokeWidth={3} />
            </div>
          </motion.div>
        </div>

        {/* Why Go Live? Grid Section */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-black text-white/50 uppercase tracking-widest pl-1" style={{ fontFamily: 'Outfit' }}>Why Go Live?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Build Your Audience', desc: 'Connect with more people and grow your community.', icon: <Users size={22} /> },
              { title: 'Receive Gifts & Support', desc: 'Earn valuable gifts and real support from fans.', icon: <Gift size={22} /> },
              { title: 'Live Discovery', desc: 'Get discovered by thousands of users on Sparkle Live.', icon: <Radio size={22} /> },
              { title: 'Creator Tools', desc: 'Access powerful tools to analyze and grow faster.', icon: <BarChart2 size={22} /> }
            ].map((perk, i) => (
              <div 
                key={i}
                className="bg-[#120b22]/40 border border-white/5 rounded-[24px] p-6 flex flex-col justify-between h-40 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#ff4db8] drop-shadow-[0_0_8px_#ff008a]">
                  {perk.icon}
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider mt-4">{perk.title}</h4>
                  <p className="text-[10px] text-white/40 mt-1.5 leading-snug">{perk.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sparkle Live Centerpiece */}
        <div className="mt-12 text-center">
          <SparkleLiveHero />
          <p className="text-sm text-white/60 mb-6" style={{ fontFamily: 'Outfit' }}>Everything you unlock at 1,000 followers.</p>
        </div>

        {/* Bottom Banner Section exact mockup replica */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-gradient-to-b from-[#180a2b] to-[#0d0417] border border-white/10 rounded-[32px] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl"
        >
          {/* Spotlight elements */}
          <div className="absolute top-0 left-12 w-20 h-44 bg-gradient-to-b from-white/10 to-transparent -rotate-12 blur-[12px] pointer-events-none" />
          <div className="absolute top-0 right-32 w-16 h-44 bg-gradient-to-b from-white/5 to-transparent rotate-12 blur-[15px] pointer-events-none" />
          <div className="absolute -bottom-10 left-0 right-0 h-24 bg-gradient-to-t from-[#ff008a]/25 to-transparent blur-[40px] pointer-events-none" />

          {/* Left panel */}
          <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-[#ff008a]/10 border border-[#ff008a]/20 flex items-center justify-center text-[#ff4db8] shrink-0 shadow-lg">
              <Calendar size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-white" style={{ fontFamily: 'Outfit' }}>Live Streaming Coming Soon</h4>
              <p className="text-[10px] md:text-xs text-white/40 max-w-sm leading-relaxed">
                Keep growing your audience. Sparkle Live unlocks at 1,000 followers. The stage is waiting for you.
              </p>
            </div>
          </div>

          {/* Stage items and Learn More button */}
          <div className="flex items-center gap-6 relative z-10">
            {/* Illuminated neon LIVE platform display */}
            <div className="relative w-24 h-12 bg-black/60 rounded-xl border border-white/10 flex items-center justify-center shrink-0 shadow-[0_0_15px_#ff008a]">
              <div className="absolute inset-0 bg-[#ff008a]/15 blur-[5px] rounded-xl" />
              <span className="text-[11px] font-black text-white tracking-widest uppercase relative z-10" style={{ fontFamily: 'Outfit' }}>LIVE</span>
            </div>

            <button 
              onClick={() => navigate('/learn-more')} 
              className="bg-[#ff008a] hover:bg-[#ff4db8] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-[#ff008a]/30"
            >
              Learn More
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>

        {/* Footer Notes exactly matching mockup */}
        <div className="text-center pt-4 text-[10px] font-black text-white/30 uppercase tracking-widest flex items-center justify-center gap-2">
          <span>🔓 Unlock at 1,000 followers</span>
          <span>•</span>
          <span>No hidden fees</span>
          <span>•</span>
          <span>Fair and safe for all creators</span>
        </div>

      </div>

      {/* Access Goal Modal */}
      <AnimatePresence>
        {showAccessModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#120b22] border border-white/10 max-w-sm w-full rounded-[28px] p-6 text-center space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff008a]/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="w-14 h-14 rounded-full bg-[#ff008a]/10 border border-[#ff008a]/20 flex items-center justify-center text-[#ff4db8] mx-auto shadow-inner">
                <Rocket size={24} />
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white">Early Access Locked</h4>
                <p className="text-xs text-white/55 leading-relaxed">
                  To request early access, you need at least <span className="font-bold text-[#ff4db8]">500 followers</span>, an account older than 30 days, and no policy violations.
                </p>
              </div>

              <div className="space-y-2 border-t border-white/5 pt-4 text-left text-[11px] text-white/50 space-y-1.5">
                <div className="flex justify-between">
                  <span>Followers Goal (500)</span>
                  <span className={followers >= 500 ? 'text-emerald-400 font-bold' : 'text-[#ff008a] font-bold'}>
                    {followers} / 500
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Account Age &gt; 30d</span>
                  <span className="text-emerald-400 font-bold">✓ Met</span>
                </div>
                <div className="flex justify-between">
                  <span>Policy Violations</span>
                  <span className="text-emerald-400 font-bold">✓ None</span>
                </div>
              </div>

              <button 
                onClick={() => setShowAccessModal(false)}
                className="w-full py-3 bg-gradient-to-r from-[#ff008a] to-[#ff4db8] hover:from-[#ff4db8] hover:to-[#ff66c4] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                Got It
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function DiamondSvg() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="diamondGrad2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#ff66c4" />
          <stop offset="100%" stopColor="#ff008a" />
        </linearGradient>
      </defs>
      <path d="M14 14H30L36 22L22 36L8 22L14 14Z" fill="url(#diamondGrad2)" stroke="#ffffff" strokeWidth="1" />
      <path d="M14 14L22 22L8 22Z" fill="#ffffff" fillOpacity="0.2" />
      <path d="M30 14L22 22L36 22Z" fill="#ffffff" fillOpacity="0.3" />
      <path d="M14 14H30L22 22Z" fill="#ffffff" fillOpacity="0.4" />
    </svg>
  );
}

function TokenSvg() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="15" fill="#150827" stroke="#ff008a" strokeWidth="2" />
      <path d="M20 9L23 16H30L25 21L27 28L20 24L13 28L15 21L10 16H17L20 9Z" fill="none" stroke="#ffd700" strokeWidth="1.5" />
      <circle cx="20" cy="19" r="3" fill="#ff4db8" />
    </svg>
  );
}
