import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import api from '../../api/api';
import { useUserStore } from '../../store/userStore';

export default function Success() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();

  useEffect(() => {
    // Trigger confetti
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#f43f5e', '#fb7185', '#fda4af', '#f43f5e']
    });

    async function finishOnboarding() {
      try {
        const res = await api.post('/onboarding/complete');
        if (res.data?.success) {
          // Update onboarding step locally
          if (user) {
            setUser({ ...user, onboarding_step: 6 });
          }
          const targetRoute = res.data.next?.route || '/dashboard';
          setTimeout(() => {
            navigate(targetRoute);
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to complete onboarding:', err);
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center max-w-lg mx-auto py-8"
    >
      <div className="relative mb-8 w-24 h-24">
        {/* Outer glowing pulsing circle */}
        <div className="absolute inset-0 bg-rose-100 rounded-full animate-ping opacity-75" />
        <div className="relative w-24 h-24 bg-gradient-to-tr from-rose-400 to-rose-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-rose-500/30">
          <Check size={48} strokeWidth={3.5} />
        </div>
      </div>

      <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-none mb-6 uppercase italic">
        You're <span className="text-rose-500">All Set!</span>
      </h1>

      <p className="text-lg font-medium text-slate-500 leading-relaxed mb-10">
        Your Sparkle profile is fully setup. Welcome to your new campus community. Let's start sparkling!
      </p>

      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-rose-500" size={24} />
        <span className="text-sm font-bold text-slate-400">Loading your dashboard...</span>
      </div>
    </motion.div>
  );
}
