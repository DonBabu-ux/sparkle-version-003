import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, ArrowRight, ArrowLeft, Loader2, Check } from 'lucide-react';
import api from '../../api/api';

interface SlideProps {
  onNext: () => void;
  onBack: () => void;
}

const INTERESTS = [
  { slug: 'tech', label: '💻 Tech & Code' },
  { slug: 'design', label: '🎨 Art & Design' },
  { slug: 'music', label: '🎵 Music & Beats' },
  { slug: 'gaming', label: '🎮 Gaming' },
  { slug: 'dancing', label: '💃 Dancing' },
  { slug: 'food', label: '🍕 Foodie' },
  { slug: 'memes', label: '🤪 Memes' },
  { slug: 'books', label: '📚 Books & Writing' },
  { slug: 'startups', label: '🚀 Startups' },
  { slug: 'fitness', label: '💪 Fitness & Gym' },
  { slug: 'fashion', label: '👠 Fashion' },
  { slug: 'movies', label: '🍿 Movies & TV' },
];

export default function Slide5({ onNext, onBack }: SlideProps) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleInterest = (slug: string) => {
    setError('');
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]
    );
  };

  const handleNext = async () => {
    if (selectedSlugs.length < 3) {
      setError('Please select at least 3 interests to proceed.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/onboarding/interests', { interests: selectedSlugs });
      onNext();
    } catch (err) {
      console.error('Failed to save interests:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-pink-50 dark:bg-[#ff2d87]/15 text-[#ff2d87] flex items-center justify-center mb-4 border border-pink-100 dark:border-[#ff2d87]/20">
          <Heart size={28} strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1.5">
          Choose <span className="text-[#ff2d87]">Interests.</span>
        </h1>
        <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 max-w-[42ch]">
          Pick at least <strong className="text-slate-700 dark:text-zinc-200">3 topics</strong> to tune your campus feed.
        </p>

        {/* Status indicator */}
        <div className="mt-3">
          {selectedSlugs.length >= 3 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff2d87] bg-pink-50 dark:bg-[#ff2d87]/10 border border-pink-200 dark:border-[#ff2d87]/20 px-3 py-1 rounded-full">
              <Check size={13} strokeWidth={3} />
              {selectedSlugs.length} topics selected
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-3 py-1 rounded-full">
              {3 - selectedSlugs.length} more needed
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs sm:text-sm font-medium text-center">
          {error}
        </div>
      )}

      {/* Grid of Interests */}
      <div className="grid grid-cols-2 gap-2.5 mb-6 max-h-[290px] overflow-y-auto pr-1 custom-scrollbar">
        {INTERESTS.map((item) => {
          const isSelected = selectedSlugs.includes(item.slug);
          return (
            <button
              key={item.slug}
              onClick={() => toggleInterest(item.slug)}
              type="button"
              className={`p-3.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all border active:scale-95 flex items-center justify-between ${
                isSelected
                  ? 'bg-[#ff2d87] border-[#ff2d87] text-white shadow-sm'
                  : 'bg-slate-50 dark:bg-zinc-900/70 hover:bg-slate-100 dark:hover:bg-zinc-800/80 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <span>{item.label}</span>
              {isSelected && <Check size={15} strokeWidth={3} className="text-white ml-2 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 w-full">
        <button
          onClick={onBack}
          className="p-3.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors active:scale-95 flex items-center justify-center"
          type="button"
          aria-label="Back"
        >
          <ArrowLeft size={18} strokeWidth={2.2} />
        </button>
        <button
          onClick={handleNext}
          disabled={selectedSlugs.length < 3 || submitting}
          className="flex-1 py-3.5 px-6 rounded-2xl bg-[#ff2d87] hover:bg-[#e02675] text-white font-bold text-sm tracking-wide active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="animate-spin" size={17} />
          ) : (
            <>
              <span>Confirm ({selectedSlugs.length}/3)</span>
              <ArrowRight size={17} strokeWidth={2.5} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
