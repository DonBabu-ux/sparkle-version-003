// src/components/RewardVault.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Gift, Star } from 'lucide-react';

interface Reward {
  title: string;
  unlockAt: number;
  description: string;
}

const rewards: Reward[] = [
  { title: 'Sparkle Plus', unlockAt: 5, description: 'Premium subscription for 30 days.' },
  { title: 'Premium Profile Badge', unlockAt: 10, description: 'Show off a premium badge on your profile.' },
  { title: 'Discovery Boost', unlockAt: 20, description: 'Higher visibility in discovery feeds.' },
  { title: 'VIP Creator Access', unlockAt: 35, description: 'Access special creator tools.' },
  { title: 'Elite Membership', unlockAt: 50, description: 'All‑star elite status.' },
];

export const RewardVault: React.FC<{ invitedCount: number }> = ({ invitedCount }) => (
  <section className="w-full max-w-4xl mx-auto mb-12 animate-fade-in">
    <h2 className="text-2xl font-bold text-center mb-6">Rewards Vault</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {rewards.map((r) => {
        const unlocked = invitedCount >= r.unlockAt;
        return (
          <motion.div
            key={r.title}
            className={`premium-card glass-surface p-6 rounded-2xl text-center ${unlocked ? '' : 'opacity-50'}`}
            whileHover={unlocked ? { scale: 1.03, rotateY: 5 } : {}}
            transition={{ type: 'spring', stiffness: 150 }}
          >
            <Gift size={48} className={`mb-3 ${unlocked ? 'text-pink-300' : 'text-gray-500'}`} />
            <h3 className="text-xl font-bold mb-2 text-pink-200">{r.title}</h3>
            <p className="text-sm text-gray-300 mb-2">Unlock at {r.unlockAt} referrals</p>
            <p className="text-xs text-gray-400">{r.description}</p>
            {unlocked && <Star size={24} className="text-pink-400 mt-2" />}
          </motion.div>
        );
      })}
    </div>
  </section>
);
