import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

// Placeholder reward data
const rewards = [
  { name: 'Rose', icon: '🌹' },
  { name: 'Diamond', icon: '💎' },
  { name: 'VIP Rocket', icon: '🚀' },
  { name: 'Crown', icon: '👑' },
  { name: 'Treasure Chest', icon: '🧰' },
  { name: 'Sparkle Coin', icon: '🪙' },
  { name: 'Music Token', icon: '🎵' },
  { name: 'Creator Trophy', icon: '🏆' },
];

const carouselVariants = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  exit: { opacity: 0, y: -20 },
};

export default function RewardCarousel() {
  return (
    <div className="w-full overflow-hidden py-8">
      <motion.div
        className="flex gap-6"
        variants={carouselVariants}
        initial="enter"
        animate="center"
        exit="exit"
      >
        {rewards.map((r, i) => (
          <div
            key={i}
            className="flex flex-col items-center bg-[#120b22]/30 backdrop-blur-xl border border-white/10 rounded-xl p-4 min-w-[80px]"
          >
            <span className="text-3xl mb-2" role="img" aria-label={r.name}>
              {r.icon}
            </span>
            <span className="text-sm font-bold text-white/80" style={{ fontFamily: 'Outfit' }}>
              {r.name}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
