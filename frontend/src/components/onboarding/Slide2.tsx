import React from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowRight, ArrowLeft } from 'lucide-react';

interface SlideProps {
  onNext: () => void;
  onBack: () => void;
}

const SAMPLE_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80&auto=format',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80&auto=format',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80&auto=format',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&q=80&auto=format',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&q=80&auto=format',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80&auto=format',
];

export default function Slide2({ onNext, onBack }: SlideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.6, cubicBezier: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center text-center max-w-lg mx-auto"
    >
      <div className="w-20 h-20 bg-rose-500 text-white rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-rose-500/20">
        <Users size={38} strokeWidth={2.5} />
      </div>

      <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-none mb-6 uppercase italic">
        Find Your <span className="text-rose-500">People.</span>
      </h1>

      <p className="text-lg font-medium text-slate-500 leading-relaxed mb-10">
        Sparkle groups together students and creators across various regions. Find connection, build memories, and share moments easily.
      </p>

      {/* Floating circular avatars animation */}
      <div className="relative w-72 h-72 mb-12 flex items-center justify-center">
        {/* Center avatar/ring */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="w-24 h-24 rounded-full bg-rose-100 flex items-center justify-center border-4 border-white shadow-xl relative z-10"
        >
          <div className="w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold">
            YOU
          </div>
        </motion.div>

        {/* Orbit avatars */}
        {SAMPLE_AVATARS.map((src, index) => {
          const angle = (index * 360) / SAMPLE_AVATARS.length;
          const radius = 100;
          const x = radius * Math.cos((angle * Math.PI) / 180);
          const y = radius * Math.sin((angle * Math.PI) / 180);

          return (
            <motion.div
              key={index}
              animate={{
                x: [x, x + (Math.random() - 0.5) * 15, x],
                y: [y, y + (Math.random() - 0.5) * 15, y],
              }}
              transition={{
                repeat: Infinity,
                duration: 4 + index,
                ease: "easeInOut",
              }}
              className="absolute w-12 h-12 rounded-full border-2 border-white shadow-lg overflow-hidden"
              style={{ left: `calc(50% - 24px)`, top: `calc(50% - 24px)` }}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </motion.div>
          );
        })}
      </div>

      <div className="flex gap-4 w-full">
        <button
          onClick={onBack}
          className="px-6 py-4 border-2 border-rose-200 hover:border-rose-300 text-rose-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center"
          type="button"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-4 bg-gradient-to-r from-rose-400 to-rose-600 hover:from-rose-500 hover:to-rose-700 text-white text-base font-black rounded-2xl shadow-xl shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-wider italic"
        >
          Let's go
          <ArrowRight size={18} strokeWidth={3} />
        </button>
      </div>
    </motion.div>
  );
}
