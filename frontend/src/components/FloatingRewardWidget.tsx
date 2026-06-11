import React from 'react';
import { Award } from 'lucide-react';
import { mockStats } from '../mocks/referralData';

// A floating widget that shows the total rewards earned.
export function FloatingRewardWidget() {
  const { rewardsEarned } = mockStats;
  return (
    <div className="fixed bottom-6 right-6 hidden md:flex items-center bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-4 py-2 shadow-lg hover:shadow-2xl transition-shadow">
      <Award size={20} className="text-pink-400 mr-2" />
      <span className="text-sm font-medium text-gray-200">Rewards: {rewardsEarned}</span>
    </div>
  );
}
