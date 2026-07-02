import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
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
  { slug: 'movies', label: '🍿 Movies & TV' }
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
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.6, cubicBezier: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-20 h-20 bg-rose-500 text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-rose-500/20">
          <Heart size={38} strokeWidth={2.5} />
        </div>
        <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-none mb-4 uppercase italic">
          Choose <span className="text-rose-500">Interests.</span>
        </h1>
        <p className="text-base font-semibold text-slate-500">
          Select at least <strong className="text-rose-500">3 topics</strong> to personalize your campus feed.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-bold text-center">
          {error}
        </div>
      )}

      {/* Grid of Interests */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {INTERESTS.map((item) => {
          const isSelected = selectedSlugs.includes(item.slug);
          return (
            <button
              key={item.slug}
              onClick={() => toggleInterest(item.slug)}
              type="button"
              className={`p-4 rounded-2xl text-sm font-bold text-center transition-all border ${
                isSelected
                  ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/10 scale-[1.02]'
                  : 'bg-white border-rose-100 text-slate-700 hover:border-rose-200'
              }`}
            >
              {item.label}
            </button>
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
          onClick={handleNext}
          disabled={selectedSlugs.length < 3 || submitting}
          className="flex-1 py-4 bg-gradient-to-r from-rose-400 to-rose-600 hover:from-rose-500 hover:to-rose-700 text-white text-base font-black rounded-2xl shadow-xl shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-wider italic disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <>
              Confirm ({selectedSlugs.length}/3)
              <ArrowRight size={18} strokeWidth={3} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
