import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Camera,
  Music,
  Shield,
  ArrowRight,
  CheckCircle2,
  X,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

interface OfficialInteractiveOnboardingProps {
  onComplete: () => void;
}

interface StepCard {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  actionText: string;
  route: string;
  color: string;
}

export const OfficialInteractiveOnboarding: React.FC<OfficialInteractiveOnboardingProps> = ({
  onComplete,
}) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const steps: StepCard[] = [
    {
      id: 'connect',
      title: 'Connect with Friends',
      subtitle: 'Find classmates, friends, and campus circles on Sparkle.',
      icon: <Users size={24} className="text-sky-400" />,
      actionText: 'Open Connect',
      route: '/connect',
      color: '#38BDF8',
    },
    {
      id: 'stories',
      title: 'Share Your First Story',
      subtitle: 'Post campus moments and daily updates that disappear after 24h.',
      icon: <Camera size={24} className="text-pink-400" />,
      actionText: 'Create Story',
      route: '/stories',
      color: '#EC4899',
    },
    {
      id: 'music',
      title: 'Explore Campus Music',
      subtitle: 'Listen to trending campus tracks and share playlists with friends.',
      icon: <Music size={24} className="text-amber-400" />,
      actionText: 'Open Music',
      route: '/music',
      color: '#F59E0B',
    },
    {
      id: 'privacy',
      title: 'Privacy & Security',
      subtitle: 'Control who can message you, view your profile, and see your online status.',
      icon: <Shield size={24} className="text-emerald-400" />,
      actionText: 'Review Settings',
      route: '/settings',
      color: '#10B981',
    },
  ];

  const handleComplete = async () => {
    try {
      await api.post('/messages/official-chat/complete-onboarding');
    } catch (err) {
      console.warn('Failed to complete onboarding on server:', err);
    }
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const activeCard = steps[currentStep];
  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div className="w-full my-4 p-5 rounded-3xl bg-[#171529]/95 border border-white/15 shadow-2xl backdrop-blur-2xl relative select-none overflow-hidden">
      {/* Top Brand Shimmer Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF008A] via-purple-500 to-[#FF008A] animate-pulse" />

      {/* Header with Step Count & Skip Button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#FF008A]" />
          <span className="text-xs font-black uppercase text-white/90 tracking-wider">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>

        <button
          onClick={handleSkip}
          className="px-3 py-1 text-xs font-bold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-90"
        >
          Skip
        </button>
      </div>

      {/* Animated Progress Bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-5">
        <motion.div
          className="h-full bg-gradient-to-r from-[#FF008A] to-purple-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Actionable Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCard.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
              {activeCard.icon}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">
                {activeCard.title}
              </h3>
              <p className="text-xs font-medium text-white/70 mt-1 leading-relaxed">
                {activeCard.subtitle}
              </p>
            </div>
          </div>

          {/* Deep-Link Action Button */}
          <button
            onClick={() => navigate(activeCard.route)}
            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs flex items-center justify-between transition-all active:scale-98 border border-white/10"
          >
            <span>{activeCard.actionText}</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Footer Navigation */}
      <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {steps.map((s, idx) => (
            <div
              key={s.id}
              onClick={() => setCurrentStep(idx)}
              className={`h-2 rounded-full cursor-pointer transition-all ${
                idx === currentStep
                  ? 'w-6 bg-[#FF008A]'
                  : 'w-2 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="px-4 py-2 rounded-xl bg-[#FF008A] hover:bg-[#FF008A]/90 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
        >
          <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
          {currentStep === steps.length - 1 ? (
            <CheckCircle2 size={14} />
          ) : (
            <ArrowRight size={14} />
          )}
        </button>
      </div>
    </div>
  );
};
