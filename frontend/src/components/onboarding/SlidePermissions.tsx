import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Camera,
  Mic,
  Image,
  Users,
  MapPin,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface SlidePermissionsProps {
  onNext: () => void;
  onBack: () => void;
}

interface PermissionSlideItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  headline: string;
  explanation: string;
  example: string;
  badge: string;
}

const PERMISSION_SLIDES: PermissionSlideItem[] = [
  {
    id: 'notifications',
    name: 'Notifications',
    icon: Bell,
    headline: 'Never miss a moment.',
    explanation:
      'Receive messages, incoming-call alerts, important activity updates and notifications from people you connect with.',
    example: 'Instant alerts when a classmate messages you or calls your phone.',
    badge: 'Communication',
  },
  {
    id: 'camera',
    name: 'Camera',
    icon: Camera,
    headline: 'Capture and share your world.',
    explanation:
      'Take photos, record videos, create Moments and participate in video calls on campus.',
    example: 'Snapping quick campus updates or showing your video during calls.',
    badge: 'Creation',
  },
  {
    id: 'microphone',
    name: 'Microphone',
    icon: Mic,
    headline: 'Let your voice be heard.',
    explanation:
      'Make voice calls, communicate during video calls and record audio content with friends.',
    example: 'Recording voice notes in chat and crystal-clear voice calling.',
    badge: 'Voice & Calls',
  },
  {
    id: 'media',
    name: 'Photos and videos',
    icon: Image,
    headline: 'Share your favourite memories.',
    explanation:
      'Choose photos and videos from your device to upload and share on Sparkle. You only share the media you explicitly choose.',
    example: 'Selecting photos from your camera roll for your profile or listings.',
    badge: 'Gallery',
  },
  {
    id: 'contacts',
    name: 'Contacts',
    icon: Users,
    headline: 'Find people you know.',
    explanation:
      'Discover people from your contacts when you choose to use contact discovery. Your privacy is always protected.',
    example: 'Connecting with classmates who are already active on Sparkle.',
    badge: 'Discovery',
  },
  {
    id: 'location',
    name: 'Location',
    icon: MapPin,
    headline: 'Discover what’s around you.',
    explanation:
      'Allow location-based features to provide relevant nearby campus experiences where available. Location is only accessed when you activate it.',
    example: 'Sharing live location with friends during campus events.',
    badge: 'Nearby',
  },
];

export default function SlidePermissions({ onNext, onBack }: SlidePermissionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentSlide = PERMISSION_SLIDES[currentIndex];
  const IconComponent = currentSlide.icon;
  const isLast = currentIndex === PERMISSION_SLIDES.length - 1;

  const handleNextSlide = () => {
    if (isLast) {
      onNext();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      onBack();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center text-center max-w-lg mx-auto w-full"
    >
      {/* Top Tag */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 dark:bg-pink-500/15 border border-pink-500/20 text-[#ff2d87] text-[11px] font-bold uppercase tracking-wider mb-3">
        <ShieldCheck size={14} />
        <span>Permission Guide</span>
      </div>

      {/* Main Title & Subtitle */}
      <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
        Make the most of <span className="text-[#ff2d87]">Sparkle</span>
      </h1>

      <p className="text-xs sm:text-sm font-normal text-slate-500 dark:text-zinc-300 leading-relaxed mb-6 max-w-[42ch]">
        Sparkle uses certain device permissions to help you connect, communicate and share moments. Here’s what each one does.
      </p>

      {/* Slide Carousel Card */}
      <div className="relative w-full bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 mb-6 shadow-sm overflow-hidden min-h-[260px] flex flex-col justify-between">
        {/* Swipe arrow controls for desktop/tap */}
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevSlide}
            disabled={currentIndex === 0}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            aria-label="Previous permission"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={handleNextSlide}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            aria-label="Next permission"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex flex-col items-center text-center w-full"
          >
            {/* Animated Icon */}
            <div className="relative mb-3.5 w-16 h-16 rounded-2xl bg-pink-500/10 dark:bg-pink-500/15 text-[#ff2d87] flex items-center justify-center border border-pink-500/20 shadow-xs">
              <IconComponent size={28} />
            </div>

            {/* Permission Badge & Name */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                {currentSlide.badge}
              </span>
              <span className="text-xs font-semibold text-slate-400 dark:text-zinc-400">
                {currentSlide.name}
              </span>
            </div>

            {/* Headline */}
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              {currentSlide.headline}
            </h2>

            {/* Explanation */}
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed max-w-[38ch] mb-3">
              {currentSlide.explanation}
            </p>

            {/* Practical Example pill */}
            <div className="w-full bg-white/70 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl p-2.5 text-[11px] text-slate-500 dark:text-zinc-300 text-center font-medium">
              💡 {currentSlide.example}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Carousel Dots */}
        <div className="flex items-center justify-center gap-2 pt-4 mt-2 border-t border-slate-200/60 dark:border-zinc-800/60">
          {PERMISSION_SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? 'w-6 bg-[#ff2d87]'
                  : 'w-1.5 bg-slate-300 dark:bg-zinc-700 hover:bg-slate-400'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2.5 w-full">
        <button
          type="button"
          onClick={handleNextSlide}
          className="w-full py-3.5 px-6 rounded-2xl bg-[#ff2d87] hover:bg-[#e02675] text-white font-bold text-sm tracking-wide active:scale-98 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff2d87]/20"
        >
          <span>{isLast ? 'Continue' : 'Next Permission'}</span>
          <ArrowRight size={17} strokeWidth={2.5} />
        </button>

        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/70 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 transition-colors flex items-center justify-center gap-1.5 active:scale-95"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={onNext}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900/70 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 transition-colors active:scale-95"
          >
            Skip for now
          </button>
        </div>
      </div>
    </motion.div>
  );
}
