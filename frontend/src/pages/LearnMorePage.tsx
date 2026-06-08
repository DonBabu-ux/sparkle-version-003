import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

const MicrophoneShowcase = lazy(() => import('../components/MicrophoneShowcase'));
const RewardCarousel = lazy(() => import('../components/RewardCarousel'));

export default function LearnMorePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#09050B] text-white overflow-hidden font-sans selection:bg-[#ff008a]/20 relative pb-24">
      {/* Ambient background orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-[#ff008a] opacity-15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#ff4db8] opacity-10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[350px] h-[350px] rounded-full bg-[#ff008a] opacity-[0.12] blur-[110px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 md:px-8 pt-6 space-y-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black" style={{ fontFamily: 'Outfit' }}>Learn More</h1>
          <button
            onClick={() => navigate('/streams')}
            className="bg-[#ff008a] hover:bg-[#ff4db8] text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider"
          >
            Back to Streams
          </button>
        </div>

        {/* Hero section mirroring LockedLivePage */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-[#120b22]/40 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden shadow-2xl"
        >
          {/* Left side */}
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 bg-[#ff008a] text-white px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase shadow-md">
              LIVE
            </div>
            <span className="text-base font-extrabold text-white/95 ml-2.5" style={{ fontFamily: 'Outfit' }}>Sparkle Live</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white" style={{ fontFamily: 'Outfit' }}>
              Unlock <span className="text-[#ff008a]">Sparkle Live</span>
            </h2>
            <p className="text-white/60 text-xs md:text-sm leading-relaxed max-w-sm">
              Reach 1,000 followers to unlock live streaming, build your audience, and appear in Live Discovery.
            </p>
          </div>

          {/* Right side showcase */}
          <div className="relative w-56 h-56 flex items-center justify-center shrink-0">
            <Suspense fallback={null}>
              <MicrophoneShowcase />
            </Suspense>
          </div>
        </motion.div>

        {/* Reward carousel */}
        <Suspense fallback={null}>
          <RewardCarousel />
        </Suspense>

        {/* Additional copy */}
        <div className="text-center mt-8">
          <h3 className="text-xl font-black text-white" style={{ fontFamily: 'Outfit' }}>Why Sparkle Live?</h3>
          <p className="text-white/70 text-sm max-w-xl mx-auto mt-2">
            Sparkle Live empowers creators to connect with their audience in real time, receive premium gifts, and grow their community.
          </p>
        </div>
      </div>
    </div>
  );
}
