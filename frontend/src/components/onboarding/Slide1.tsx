import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Shield, VolumeX } from 'lucide-react';

interface SlideProps {
  onNext: () => void;
  onViewSheet?: () => void;
}

export default function Slide1({ onNext, onViewSheet }: SlideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center text-center max-w-lg mx-auto"
    >
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-pink-50 dark:bg-[#ff2d87]/15 text-[#ff2d87] flex items-center justify-center mb-6 border border-pink-100 dark:border-[#ff2d87]/20">
        <VolumeX size={32} strokeWidth={2.2} />
      </div>

      <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">
        Forget the <span className="text-[#ff2d87]">Noise.</span>
      </h1>

      <p className="text-sm sm:text-base font-normal text-slate-600 dark:text-zinc-400 leading-relaxed mb-8 max-w-[42ch]">
        Sparkle is built to bring your campus community closer. No algorithmic spam or noisy feeds — just real moments with real students.
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-2 gap-3 w-full mb-8">
        <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center text-center">
          <Sparkles className="text-[#ff2d87] mb-2" size={20} />
          <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Campus First</span>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center text-center">
          <Shield className="text-[#ff2d87] mb-2" size={20} />
          <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Private & Secure</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={onNext}
          className="w-full py-3.5 px-6 rounded-2xl bg-[#ff2d87] hover:bg-[#e02675] text-white font-bold text-sm tracking-wide active:scale-98 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff2d87]/20"
        >
          <span>Sounds Good</span>
          <ArrowRight size={17} strokeWidth={2.5} />
        </button>

        {onViewSheet && (
          <button
            onClick={onViewSheet}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/70 dark:hover:bg-zinc-800 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-medium rounded-xl border border-slate-200 dark:border-zinc-800 transition-colors"
          >
            Learn more about Sparkle
          </button>
        )}
      </div>
    </motion.div>
  );
}
