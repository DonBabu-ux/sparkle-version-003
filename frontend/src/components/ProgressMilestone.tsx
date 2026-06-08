import React from 'react';
import { useUserStore } from '../../store/userStore'; // adjust import path as needed

/**
 * ProgressMilestone displays the user's follower progress towards the 1,000 follower unlock.
 * It uses the real follower count from the user store.
 */
const ProgressMilestone: React.FC = () => {
  const user = useUserStore(state => state.user);
  const followers = user?.followers_count ?? 0;
  const progress = Math.min(100, Math.round((followers / 1000) * 100));
  const milestones = [250, 500, 750, 1000];
  const nextMilestone = milestones.find(m => followers < m) ?? 1000;
  const remaining = nextMilestone - followers;
  const canGoLive = followers >= 1000;

  return (
    <section className="bg-[#120b22]/40 backdrop-blur-xl border border-white/5 rounded-[28px] p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h3 className="text-sm font-black text-white/50 uppercase tracking-widest">
            Your Progress
          </h3>
          <p className="text-2xl font-extrabold text-white mt-1">
            {followers.toLocaleString()}{' '}
            <span className="text-white/40 font-normal text-base">/ 1,000 Followers</span>
          </p>
        </div>
        <div className="w-48">
          <div className="h-1.5 bg-white/10 rounded-full relative">
            <div
              className="h-full bg-gradient-to-r from-[#ff008a] to-[#ff4db8] rounded-full shadow-[0_0_12px_rgba(255,0,138,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-white/60 mt-2 text-center md:text-left">
            {canGoLive ? 'Live unlocked! 🎉' : `${remaining.toLocaleString()} followers remaining`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#ff008a]/10 flex items-center justify-center text-[#ff4db8] shadow-inner">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-black text-white/40 uppercase tracking-wider">Next Milestone</p>
            <p className="text-base font-extrabold text-white mt-0.5">{nextMilestone} Followers</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProgressMilestone;
