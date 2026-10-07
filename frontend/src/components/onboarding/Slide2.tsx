import React from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowRight, ArrowLeft } from 'lucide-react';

interface SlideProps {
  onNext: () => void;
  onBack: () => void;
}

const SAMPLE_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&q=80&auto=format',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80&auto=format',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80&auto=format',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&q=80&auto=format',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&q=80&auto=format',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&q=80&auto=format',
];

export default function Slide2({ onNext, onBack }: SlideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center text-center max-w-lg mx-auto"
    >
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-[#ff2d87]/15 text-[#ff2d87] flex items-center justify-center mb-6 border border-[#ff2d87]/20">
        <Users size={32} strokeWidth={2.2} />
      </div>

      <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">
        Find Your <span className="text-[#ff2d87]">People.</span>
      </h1>

      <p className="text-sm sm:text-base font-normal text-slate-500 dark:text-zinc-400 leading-relaxed mb-8 max-w-[42ch]">
        Sparkle brings together students across your campus. Connect genuinely, share what's happening, and build real friendships.
      </p>

      {/* Orbit Visualization */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 mb-8 flex items-center justify-center">
        {/* Subtle border guide */}
        <div className="absolute inset-0 rounded-full border border-zinc-800" />

        {/* Center avatar */}
        <div className="w-20 h-20 rounded-full bg-zinc-900 border-2 border-[#ff2d87] flex flex-col items-center justify-center text-white text-xs font-bold shadow-lg z-10">
          <span className="text-base text-[#ff2d87]">✦</span>
          <span>YOU</span>
        </div>

        {/* Orbit avatars */}
        {SAMPLE_AVATARS.map((src, index) => {
          const angle = (index * 360) / SAMPLE_AVATARS.length;
          const radius = 96;
          const x = radius * Math.cos((angle * Math.PI) / 180);
          const y = radius * Math.sin((angle * Math.PI) / 180);

          return (
            <div
              key={index}
              className="absolute w-11 h-11 rounded-full border border-zinc-700 bg-zinc-800 shadow-md overflow-hidden"
              style={{
                left: `calc(50% - 22px + ${x}px)`,
                top: `calc(50% - 22px + ${y}px)`,
              }}
            >
              <img src={src} alt="Student avatar" className="w-full h-full object-cover" />
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 w-full">
        <button
          onClick={onBack}
          className="p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors active:scale-98 flex items-center justify-center"
          type="button"
          aria-label="Back"
        >
          <ArrowLeft size={18} strokeWidth={2.2} />
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3.5 px-6 rounded-2xl bg-[#ff2d87] hover:bg-[#e02675] text-white font-bold text-sm tracking-wide active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <span>Continue</span>
          <ArrowRight size={17} strokeWidth={2.5} />
        </button>
      </div>
    </motion.div>
  );
}
