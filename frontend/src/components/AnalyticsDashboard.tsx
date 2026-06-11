// src/components/AnalyticsDashboard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import AnalyticsCard from './AnalyticsCard';
import { UserCheck, Users, Clock, Sparkles, Award } from 'lucide-react';
import { mockStats } from '../mocks/referralData';

export const AnalyticsDashboard: React.FC = () => {
  const cards = [
    { title: 'Friends Invited', count: mockStats.friendsInvited, icon: <Users size={32} className="text-pink-400" /> },
    { title: 'Successful Sign‑ups', count: mockStats.successfulSignups, icon: <UserCheck size={32} className="text-pink-400" /> },
    { title: 'Pending Rewards', count: mockStats.pendingRewards, icon: <Clock size={32} className="text-pink-400" /> },
    { title: 'Reward Points', count: mockStats.rewardPoints, icon: <Award size={32} className="text-pink-400" /> },
    { title: 'Referral Rank', count: mockStats.referralRank, icon: <Sparkles size={32} className="text-pink-400" /> },
    { title: 'Current Tier', count: mockStats.currentTier, icon: <UserCheck size={32} className="text-pink-400" /> },
  ];

  return (
    <section className="w-full max-w-4xl mx-auto mb-12 animate-fade-in">
      <h2 className="text-2xl font-bold text-center mb-6 text-pink-200">Referral Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((c, i) => (
          <motion.div key={i} whileHover={{ y: -4, scale: 1.02 }} transition={{ type: 'spring', stiffness: 200 }}>
            <AnalyticsCard icon={c.icon} title={c.title} count={c.count} />
          </motion.div>
        ))}
      </div>
    </section>
  );
};
