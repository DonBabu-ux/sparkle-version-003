import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../store/userStore';
import { CheckCircle2, User, GraduationCap, Compass, FileText, HelpCircle } from 'lucide-react';

export const OnboardingProgressCard: React.FC = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);

  const stats = useMemo(() => {
    if (!user) return { percentage: 0, steps: [] };

    const checks = [
      { name: 'Full Name', done: !!user.name, weight: 15 },
      { name: 'Profile Photo', done: !!user.avatar_url && !user.avatar_url.includes('default'), weight: 25 },
      { name: 'Campus Affiliation', done: !!user.campus, weight: 15 },
      { name: 'Major/Department', done: !!user.major, weight: 15 },
      { name: 'Short Bio', done: !!user.bio, weight: 15 },
      { name: 'Headline/Tagline', done: !!user.headline, weight: 15 },
    ];

    const doneWeight = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
    return {
      percentage: doneWeight,
      steps: checks,
    };
  }, [user]);

  if (!user) return null;

  const isCompleted = stats.percentage === 100;

  return (
    <div 
      className="p-5 rounded-2xl bg-gradient-to-br from-zinc-50 to-zinc-100/50 dark:from-zinc-900/60 dark:to-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800/80 shadow-md max-w-sm sm:max-w-md w-full animate-fade-in"
      role="region"
      aria-label="Profile onboarding progress tracker"
    >
      {isCompleted ? (
        <div className="text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center animate-bounce-subtle">
            <CheckCircle2 size={32} />
          </div>
          <h4 role="heading" aria-level={4} className="font-extrabold text-zinc-900 dark:text-white text-base sm:text-lg">
            🎉 Profile Completed!
          </h4>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            You're all set up! Find people to follow and share your first Spark.
          </p>
          <button
            onClick={() => navigate('/connect')}
            className="mt-3 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl hover:from-pink-600 hover:to-purple-700 active:scale-95 transition-all shadow-md shadow-pink-500/20"
          >
            Find Creators
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h4 role="heading" aria-level={4} className="font-extrabold text-zinc-900 dark:text-white text-sm sm:text-base">
              Complete your profile
            </h4>
            <span className="text-xs sm:text-sm font-black text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded-full">
              {stats.percentage}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-500 rounded-full"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>

          {/* Step suggestions / check list */}
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {stats.steps.map((st, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${st.done ? 'bg-green-500 shadow-sm shadow-green-500/50' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                <span className={st.done ? 'line-through text-zinc-400 dark:text-zinc-600' : ''}>
                  {st.name}
                </span>
              </div>
            ))}
          </div>

          {/* CTA Actions */}
          <div className="flex flex-col sm:flex-row gap-2 mt-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <button
              onClick={() => navigate('/settings?tab=profile')}
              className="flex-1 px-3 py-2 text-xs font-bold text-center rounded-xl bg-pink-500 text-white hover:bg-pink-600 active:scale-95 transition-all shadow shadow-pink-500/20"
            >
              Update Profile
            </button>
            <button
              onClick={() => navigate('/moments')}
              className="flex-1 px-3 py-2 text-xs font-bold text-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-750 active:scale-95 transition-all"
            >
              Explore Feed
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
