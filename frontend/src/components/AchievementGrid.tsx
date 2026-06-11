// src/components/AchievementGrid.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Circle } from 'lucide-react';

interface Achievement {
  id: string;
  label: string;
  unlocked: boolean;
  progress: number; // 0-100
}

interface Props {
  achievements: Achievement[];
}

export const AchievementGrid: React.FC<Props> = ({ achievements }) => {
  return (
    <section className="w-full max-w-xl mx-auto mb-12 animate-fade-in">
      <h2 className="text-2xl font-bold text-center mb-6 text-pink-200">Achievements</h2>
      <div className="grid grid-cols-2 gap-4">
        {achievements.map((a) => (
          <motion.div
            key={a.id}
            className="premium-card glass-surface p-4 rounded-xl flex flex-col items-center"
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 150 }}
          >
            {a.unlocked ? (
              <CheckCircle size={32} className="text-pink-400 mb-2" />
            ) : (
              <Circle size={32} className="text-gray-500 mb-2" />
            )}
            <span className="font-medium text-pink-100 mb-1 text-center">{a.label}</span>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-full rounded-full ${a.unlocked ? 'bg-pink-400' : 'bg-pink-200'}`}
                style={{ width: `${a.progress}%` }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
