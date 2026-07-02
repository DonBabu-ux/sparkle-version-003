import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, UserCheck, ArrowRight, ArrowLeft, Loader2, Compass } from 'lucide-react';
import api from '../../api/api';

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

export default function Slide3({ onNext, onBack }: SlideProps) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadCreators() {
      try {
        const res = await api.get('/onboarding/popular-users');
        if (res.data?.success) {
          setCreators(res.data.data.creators || []);
        }
      } catch (err) {
        console.error('Failed to load popular creators:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCreators();
  }, []);

  const toggleFollow = (id: string) => {
    setFollowingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFollowAll = () => {
    if (followingIds.length === creators.length) {
      setFollowingIds([]);
    } else {
      setFollowingIds(creators.map((c) => c.user_id));
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
      console.error('Failed to follow creators:', err);
      onNext(); // Proceed anyway
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
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-20 h-20 bg-rose-500 text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-rose-500/20">
          <Compass size={38} strokeWidth={2.5} />
        </div>
        <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-none mb-4 uppercase italic">
          Popular <span className="text-rose-500">Creators.</span>
        </h1>
        <p className="text-base font-semibold text-slate-500">
          Follow creators to instantly seed your feed with campus sparks.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="animate-spin text-rose-500" size={32} />
          <span className="text-sm font-bold text-slate-400">Finding trends...</span>
        </div>
      ) : creators.length === 0 ? (
        <div className="text-center py-10 bg-white border border-rose-100 rounded-3xl p-8 mb-8">
          <p className="text-slate-400 font-bold">No new popular creators to follow!</p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4 px-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {creators.length} Recommended
            </span>
            <button
              onClick={handleFollowAll}
              type="button"
              className="text-xs font-black text-rose-500 uppercase tracking-wider hover:underline"
            >
              {followingIds.length === creators.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div
            className="space-y-3 mb-8 overflow-y-auto pr-1"
            style={{ maxHeight: '340px' }}
          >
            <AnimatePresence>
              {creators.map((c) => {
                const isFollowing = followingIds.includes(c.user_id);
                return (
                  <motion.div
                    key={c.user_id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 bg-white/70 backdrop-blur border border-rose-100 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-rose-100 bg-rose-50">
                        <img
                          src={c.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                          }}
                        />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-sm text-slate-800 leading-tight">
                          {c.name}
                        </h4>
                        <p className="text-xs text-rose-500 font-semibold mb-1">
                          @{c.username}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold line-clamp-1">
                          {c.headline || `${c.follower_count || 0} followers`}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleFollow(c.user_id)}
                      type="button"
                      className={`p-2.5 rounded-xl transition-all ${
                        isFollowing
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                          : 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                      }`}
                    >
                      {isFollowing ? <UserCheck size={18} /> : <UserPlus size={18} />}
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}

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
          disabled={submitting}
          className="flex-1 py-4 bg-gradient-to-r from-rose-400 to-rose-600 hover:from-rose-500 hover:to-rose-700 text-white text-base font-black rounded-2xl shadow-xl shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-wider italic disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="animate-spin" size={18} />
          ) : followingIds.length === 0 ? (
            <>
              Skip
              <ArrowRight size={18} strokeWidth={3} />
            </>
          ) : (
            <>
              Follow & Next
              <ArrowRight size={18} strokeWidth={3} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
