import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import api from '../../api/api';
import { useUserStore } from '../../store/userStore';
import { logger } from '../../utils/logger';

export default function Success() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();

  useEffect(() => {
    // Trigger clean pink & white celebratory confetti
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff2d87', '#ff6aa9', '#ffffff'],
    });

    async function finishOnboarding() {
      try {
        const res = await api.post('/onboarding/complete');
        if (res.data?.success) {
          if (user) {
            setUser({ ...user, onboarding_step: 6 });
          }
          const targetRoute = res.data.next?.route || '/dashboard';
          setTimeout(() => {
            navigate(targetRoute);
          }, 2000);
        }
      } catch (err) {
        logger.error('Failed to complete onboarding:', err);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } finally {
        setLoading(false);
      }
    }

    finishOnboarding();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center text-center max-w-lg mx-auto py-6"
    >
      {/* Icon */}
      <div className="relative mb-6 w-20 h-20 rounded-full bg-pink-50 dark:bg-[#ff2d87]/15 border border-pink-200 dark:border-[#ff2d87]/25 flex items-center justify-center text-[#ff2d87]">
        <Check size={36} strokeWidth={2.5} />
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
        You're <span className="text-[#ff2d87]">All Set!</span>
      </h1>

      <p className="text-sm sm:text-base font-normal text-slate-500 dark:text-zinc-400 leading-relaxed mb-8 max-w-[40ch]">
        Your Sparkle profile is ready. Welcome to your campus community!
      </p>

      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
        <Loader2 className="animate-spin text-[#ff2d87]" size={16} />
        <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">Taking you to your dashboard...</span>
      </div>
    </motion.div>
  );
}
