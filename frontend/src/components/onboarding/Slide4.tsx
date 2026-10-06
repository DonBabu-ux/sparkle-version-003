import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, UserCheck, ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import api from '../../api/api';
import { logger } from '../../utils/logger';

interface Creator {
  user_id: string;
  name: string;
  username: string;
  avatar_url?: string;
  headline?: string;
  follower_count: number;
}

interface SlideProps {
  onNext: () => void;
  onBack: () => void;
}

const CATEGORIES = [
  { id: 'Tech', label: 'Tech & Code' },
  { id: 'Art', label: 'Art & Design' },
  { id: 'Music', label: 'Music & Beats' },
  { id: 'Sports', label: 'Sports & Fit' },
  { id: 'Business', label: 'Business' },
];

export default function Slide4({ onNext, onBack }: SlideProps) {
  const [activeTab, setActiveTab] = useState(CATEGORIES[0].id);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadCategoryCreators() {
      setLoading(true);
      try {
        const res = await api.get(`/onboarding/recommendations?category=${activeTab}`);
        if (res.data?.success) {
          setCreators(res.data.data.creators || []);
        }
      } catch (err) {
        logger.error(`Failed to load creators for category ${activeTab}:`, err);
      } finally {
        setLoading(false);
      }
    }
    loadCategoryCreators();
  }, [activeTab]);

  const toggleFollow = (id: string) => {
    setFollowingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFollowAll = () => {
    const creatorsToFollow = creators.filter((c) => !followingIds.includes(c.user_id));
    if (creatorsToFollow.length === 0) {
      const tabIds = creators.map((c) => c.user_id);
      setFollowingIds((prev) => prev.filter((id) => !tabIds.includes(id)));
    } else {
      setFollowingIds((prev) => [...prev, ...creatorsToFollow.map((c) => c.user_id)]);
    }
  };

  const handleNext = async () => {
    if (followingIds.length === 0) {
      onNext();
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/onboarding/follow', { userIds: followingIds });
      onNext();
    } catch (err) {
      logger.error('Failed to follow creators:', err);
      onNext();
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
          <Sparkles size={28} strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1.5">
          Suggested <span className="text-[#ff2d87]">For You.</span>
        </h1>
        <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 max-w-[42ch]">
          Explore campus creators by study focus and interest.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
        {CATEGORIES.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                isActive
                  ? 'bg-[#ff2d87] border-[#ff2d87] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <Loader2 className="animate-spin text-[#ff2d87]" size={28} />
          <span className="text-sm font-medium text-slate-400 dark:text-zinc-400">Loading recommendations...</span>
        </div>
      ) : creators.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 mb-6">
          <p className="text-slate-500 dark:text-zinc-400 font-medium text-sm">No creators found in this category yet.</p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-400 uppercase tracking-wider">
              {creators.length} in {activeTab}
            </span>
            <button
              onClick={handleFollowAll}
              type="button"
              className="text-xs font-bold text-[#ff2d87] hover:underline"
            >
              {creators.every((c) => followingIds.includes(c.user_id)) ? 'Deselect Tab' : 'Follow All'}
            </button>
          </div>

          <div className="space-y-2 mb-6 overflow-y-auto pr-1 max-h-[280px] custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {creators.map((c) => {
                const isFollowing = followingIds.includes(c.user_id);
                return (
                  <div
                    key={c.user_id}
                    className="p-3.5 bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 flex-shrink-0">
                        <img
                          src={c.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                          }}
                        />
                      </div>
                      <div className="text-left min-w-0">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-zinc-100 truncate">
                          {c.name}
                        </h4>
                        <p className="text-xs text-[#ff2d87] font-medium truncate">
                          @{c.username}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                          {c.headline || `${c.follower_count || 0} followers`}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleFollow(c.user_id)}
                      type="button"
                      className={`p-2 rounded-xl transition-all active:scale-95 flex-shrink-0 ml-2 ${
                        isFollowing
                          ? 'bg-[#ff2d87] text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-300'
                      }`}
                    >
                      {isFollowing ? <UserCheck size={16} strokeWidth={2.5} /> : <UserPlus size={16} strokeWidth={2.5} />}
                    </button>
                  </div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}

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
          disabled={submitting}
          className="flex-1 py-3.5 px-6 rounded-2xl bg-[#ff2d87] hover:bg-[#e02675] text-white font-bold text-sm tracking-wide active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="animate-spin" size={17} />
          ) : followingIds.length === 0 ? (
            <>
              <span>Skip for Now</span>
              <ArrowRight size={17} strokeWidth={2.5} />
            </>
          ) : (
            <>
              <span>Follow ({followingIds.length}) & Next</span>
              <ArrowRight size={17} strokeWidth={2.5} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
