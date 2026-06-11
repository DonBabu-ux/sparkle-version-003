// src/components/MilestoneTracker.tsx
import React from 'react';
import { motion } from 'framer-motion';

export const MilestoneTracker = () => (
  <motion.div
    className="premium-card p-6 mb-12 animate-fade-in"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <h3 className="text-xl font-bold mb-2 text-center">Milestone Tracker</h3>
    <p className="text-gray-300 text-center">
      {/* Placeholder – will display XP progress and level */}
      XP progress coming soon.
    </p>
  </motion.div>
);
