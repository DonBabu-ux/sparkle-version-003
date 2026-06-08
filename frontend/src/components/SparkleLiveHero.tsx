import React from 'react';
import MicrophoneShowcase from './MicrophoneShowcase';
import RewardIcon from './RewardIcon';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Simple fallback SVGs (reuse from LockedLivePage if needed)
const DiamondSvg = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="diamondGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#ff66c4" />
        <stop offset="100%" stopColor="#ff008a" />
      </linearGradient>
    </defs>
    <path d="M14 14H30L36 22L22 36L8 22L14 14Z" fill="url(#diamondGrad)" stroke="#ffffff" strokeWidth="1" />
  </svg>
);

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
    <rect x="8" y="18" width="32" height="22" rx="4" fill="url(#giftBody)" stroke="#ff4db8" strokeWidth="1" />
    <rect x="6" y="12" width="36" height="8" rx="2" fill="url(#giftLid)" stroke="#ffffff" strokeWidth="0.5" />
    <path d="M24 12C21 6 15 6 18 12C14 12 14 6 18 4C21 4 24 9 24 12Z" fill="#ffb3d1" />
    <path d="M24 12C27 6 33 6 30 12C34 12 34 6 30 4C27 4 24 9 24 12Z" fill="#ffb3d1" />
    <rect x="22" y="12" width="4" height="28" fill="#ffb3d1" />
    <rect x="8" y="27" width="32" height="4" fill="#ffb3d1" />
  </svg>
);

const TokenSvg = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="15" fill="#150827" stroke="#ff008a" strokeWidth="2" />
    <path d="M20 9L23 16H30L25 21L27 28L20 24L13 28L15 21L10 16H17L20 9Z" fill="none" stroke="#ffd700" strokeWidth="1.5" />
    <circle cx="20" cy="19" r="3" fill="#ff4db8" />
  </svg>
);

// Placeholder reward data
const rewards = [
  { id: 'diamond', component: <DiamondSvg /> },
  { id: 'gift', component: <GiftBoxImage /> },
  { id: 'note', component: <TokenSvg /> },
  // Add more rewards as needed
];

const SparkleLiveHero: React.FC = () => {
  const shouldReduce = useReducedMotion();

  return (
    <section className="relative w-full flex flex-col items-center justify-center py-12">
      {/* Holographic Platform */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Placeholder for HolographicPlatform component if needed */}
      </div>

      {/* Orbit Rings */}
      {!shouldReduce && (
        <>
          {/* Large clockwise ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}
            className="absolute inset-0 border border-dashed border-[#ff008a] rounded-full flex items-center justify-center"
          >
            <div className="absolute top-0 right-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_#ff008a]" />
            <div className="absolute bottom-0 left-1/2 w-1.5 h-1.5 bg-[#ff008a] rounded-full" />
          </motion.div>

          {/* Smaller anti‑clockwise ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
            className="absolute w-40 h-40 border border-dotted border-[#ff4db8]/50 rounded-full flex items-center justify-center"
          >
            <div className="absolute top-4 left-4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_6px_#ff4db8]" />
          </motion.div>
        </>
      )}

      {/* Microphone Showcase */}
      <MicrophoneShowcase />

      {/* Reward Icons positioned around the microphone */}
      <div className="absolute inset-0 pointer-events-none">
        {rewards.map((r, i) => (
          <motion.div
            key={r.id}
            animate={
              shouldReduce
                ? { opacity: 1 }
                : { y: [0, -8, 0], rotate: [0, 8, 0] }
            }
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.5,
            }}
            className="absolute"
            style={getRewardPosition(i)}
          >
            <RewardIcon>{r.component}</RewardIcon>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

// Simple utility to spread icons in a circle
const getRewardPosition = (index: number): React.CSSProperties => {
  const radius = 120; // distance from center in px
  const angle = (index / 8) * Math.PI * 2; // distribute over circle
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(50% + ${y}px)`,
    transform: 'translate(-50%, -50%)',
  };
};

export default SparkleLiveHero;
