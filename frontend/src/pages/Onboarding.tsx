import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Sparkles, X } from 'lucide-react';
import api from '../api/api';
import Slide1 from '../components/onboarding/Slide1';
import Slide2 from '../components/onboarding/Slide2';
import Slide3 from '../components/onboarding/Slide3';
import Slide4 from '../components/onboarding/Slide4';
import Slide5 from '../components/onboarding/Slide5';
import Success from '../components/onboarding/Success';
import OnboardingSheet from '../components/onboarding/OnboardingSheet';
import { logger } from '../utils/logger';

export default function Onboarding() {
  const [currentSlide, setCurrentSlide] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If user accesses /onboarding/sheet or /onboarding/sheets directly
    if (location.pathname.includes('/sheet') || location.pathname.includes('/about')) {
      setShowSheetModal(true);
    }

    async function fetchStatus() {
      try {
        const res = await api.get('/onboarding/status');
        const step = res.data?.data?.onboarding_step ?? res.data?.onboarding_step ?? 0;
        if (step >= 6) {
          navigate('/dashboard');
        } else if (step === 1) {
          setCurrentSlide(3); // Popular Creators
        } else if (step === 2) {
          setCurrentSlide(4); // Recommendations
        } else if (step >= 3) {
          setCurrentSlide(5); // Interests
        } else {
          setCurrentSlide(1); // Welcome Pitch / Onboarding Sheet
        }
      } catch (err) {
        logger.error('Failed to fetch onboarding status:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0712] gap-3">
        <Loader2 className="animate-spin text-[#ff2d87]" size={36} />
        <span className="text-sm font-bold text-[#b9a8cc]">Loading Sparkle experience...</span>
      </div>
    );
  }

  // Slide 1 renders the full-screen immersive Onboarding Sheet experience
  if (currentSlide === 1 && !showSheetModal) {
    return (
      <div className="relative">
        <OnboardingSheet
          onGetStarted={() => setCurrentSlide(3)}
        />
        {/* Floating Quick Setup Action */}
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setCurrentSlide(3)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 text-white text-xs font-bold py-2.5 px-4 rounded-full shadow-2xl transition-all active:scale-95"
          >
            <span>Skip to Campus Creators</span>
            <span>→</span>
          </button>
        </div>
      </div>
    );
  }

  const totalSlides = 6;
  const progressPercent = ((currentSlide - 1) / (totalSlides - 1)) * 100;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0e0d13] text-slate-900 dark:text-[#f4f2f7] flex flex-col justify-center items-center p-4 sm:p-6 relative font-sans selection:bg-[#ff2d87] selection:text-white">
      {/* Top Bar with Onboarding Sheet Trigger */}
      <div className="w-full max-w-xl flex justify-between items-center mb-5 z-20 px-2">
        <button
          onClick={() => setShowSheetModal(true)}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 px-3.5 py-1.5 rounded-full transition-colors active:scale-95 shadow-sm"
        >
          <Sparkles size={14} className="text-[#ff2d87]" />
          <span>About Sparkle</span>
        </button>

        <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 px-3 py-1 rounded-full shadow-sm">
          Step {Math.min(currentSlide, 5)} of 5
        </span>
      </div>

      {/* Main wizard wrapper */}
      <div className="w-full max-w-xl bg-white dark:bg-[#16151e] border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col">
        {/* Progress Bar */}
        {currentSlide < 6 && (
          <div className="w-full h-1 bg-zinc-800/80 overflow-hidden">
            <div
              className="h-full bg-[#ff2d87] transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Slide Content Area */}
        <div className="p-6 sm:p-10 flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {currentSlide === 1 && (
              <Slide1
                key="slide1"
                onNext={() => setCurrentSlide(3)}
                onViewSheet={() => setShowSheetModal(true)}
              />
            )}
            {currentSlide === 2 && (
              <Slide2
                key="slide2"
                onNext={() => setCurrentSlide(3)}
                onBack={() => setCurrentSlide(1)}
              />
            )}
            {currentSlide === 3 && (
              <Slide3
                key="slide3"
                onNext={() => setCurrentSlide(4)}
                onBack={() => setCurrentSlide(1)}
              />
            )}
            {currentSlide === 4 && (
              <Slide4
                key="slide4"
                onNext={() => setCurrentSlide(5)}
                onBack={() => setCurrentSlide(3)}
              />
            )}
            {currentSlide === 5 && (
              <Slide5
                key="slide5"
                onNext={() => setCurrentSlide(6)}
                onBack={() => setCurrentSlide(4)}
              />
            )}
            {currentSlide === 6 && <Success key="success" />}
          </AnimatePresence>
        </div>
      </div>

      {/* Full Sheet Overlay Modal */}
      <AnimatePresence>
        {showSheetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-[#0b0712]"
          >
            <div className="relative">
              <OnboardingSheet
                showDismiss={true}
                onDismiss={() => setShowSheetModal(false)}
                onGetStarted={() => {
                  setShowSheetModal(false);
                  setCurrentSlide(3);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

