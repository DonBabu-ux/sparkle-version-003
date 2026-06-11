// src/components/Leaderboard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface Inviter {
  rank: number;
  name: string;
  count: number;
  badge?: React.ReactNode;
}

const topInviters: Inviter[] = [
  { rank: 1, name: 'Alice', count: 124, badge: <Trophy size={20} className="text-pink-400" /> },
  { rank: 2, name: 'Bob', count: 98, badge: <Trophy size={18} className="text-pink-300" /> },
  { rank: 3, name: 'Carol', count: 73, badge: <Trophy size={16} className="text-pink-200" /> },
];

export const Leaderboard: React.FC = () => (
  <section className="w-full max-w-2xl mx-auto mb-12 animate-fade-in">
    <h2 className="text-2xl font-bold text-center mb-6">Top Inviters</h2>
    <div className="space-y-4">
      {topInviters.map((inv) => (
        <motion.div
          key={inv.rank}
          className="premium-card flex items-center justify-between p-4 glass-surface"
          whileHover={{ y: -2, boxShadow: '0 8px 16px rgba(255,79,163,0.2)' }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <div className="flex items-center">
            <span className="text-xl font-bold mr-3 text-pink-200">#{inv.rank}</span>
            <span className="font-medium text-pink-100">{inv.name}</span>
          </div>
          <div className="flex items-center">
            {inv.badge}
            <span className="ml-2 text-pink-300">{inv.count} referrals</span>
          </div>
        </motion.div>
      ))}
    </div>
  </section>
);
