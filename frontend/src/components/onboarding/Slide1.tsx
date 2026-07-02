import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Shield, VolumeX } from 'lucide-react';

interface SlideProps {
  onNext: () => void;
}

export default function Slide1({ onNext }: SlideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, cubicBezier: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center text-center max-w-lg mx-auto"
    >
      <div className="w-20 h-20 bg-rose-500 text-white rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-rose-500/20">
        <VolumeX size={38} strokeWidth={2.5} />
      </div>

      <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-none mb-6 uppercase italic">
        Forget the <span className="text-rose-500">Noise.</span>
      </h1>

      <p className="text-lg font-medium text-slate-500 leading-relaxed mb-10">
        Sparkle is built to bring your campus community closer. Say goodbye to algorithmic spam and advertisements. Just real moments with real people.
      </p>

      <div className="grid grid-cols-2 gap-4 w-full mb-12">
        <div className="p-5 bg-white/70 backdrop-blur border border-rose-100 rounded-2xl flex flex-col items-center">
          <Sparkles className="text-rose-500 mb-2" size={24} />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Campus First</span>
        </div>
        <div className="p-5 bg-white/70 backdrop-blur border border-rose-100 rounded-2xl flex flex-col items-center">
          <Shield className="text-rose-500 mb-2" size={24} />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Secure Spaces</span>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 bg-gradient-to-r from-rose-400 to-rose-600 hover:from-rose-500 hover:to-rose-700 text-white text-base font-black rounded-2xl shadow-xl shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-wider italic"
      >
        Sounds good
        <ArrowRight size={18} strokeWidth={3} />
      </button>
    </motion.div>
  );
}
