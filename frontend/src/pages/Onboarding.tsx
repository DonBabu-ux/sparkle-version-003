import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import api from '../api/api';
import Slide1 from '../components/onboarding/Slide1';
import Slide2 from '../components/onboarding/Slide2';
import Slide3 from '../components/onboarding/Slide3';
import Slide4 from '../components/onboarding/Slide4';
import Slide5 from '../components/onboarding/Slide5';
import Success from '../components/onboarding/Success';

export default function Onboarding() {
  const [currentSlide, setCurrentSlide] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
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
          setCurrentSlide(1); // Welcome Pitch
        }
      } catch (err) {
        console.error('Failed to fetch onboarding status:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fdf2f4] gap-3">
        <Loader2 className="animate-spin text-rose-500" size={36} />
        <span className="text-sm font-bold text-rose-400">Loading experience...</span>
      </div>
    );
  }

  const totalSlides = 6;
  const progressPercent = ((currentSlide - 1) / (totalSlides - 1)) * 100;

  return (
    <div className="min-h-screen bg-[#fdf2f4] flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-rose-200/30 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-rose-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Main wizard wrapper */}
      <div className="w-full max-w-xl bg-white/80 backdrop-blur-2xl border border-rose-100 rounded-[38px] shadow-xl shadow-rose-500/5 overflow-hidden relative z-10 flex flex-col">
        {/* Progress Bar */}
        {currentSlide < 6 && (
          <div className="w-full h-1.5 bg-rose-50 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Slide Content Area */}
        <div className="p-8 md:p-12 flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {currentSlide === 1 && (
              <Slide1 key="slide1" onNext={() => setCurrentSlide(2)} />
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
                onBack={() => setCurrentSlide(2)}
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
    </div>
  );
}
