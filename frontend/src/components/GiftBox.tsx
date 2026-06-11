import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface GiftBoxProps {
  size?: number;
  hoverScale?: number;
}

export const GiftBox: React.FC<GiftBoxProps> = ({ size = 120, hoverScale = 1.05 }) => {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      whileHover={{ scale: hoverScale }}
      style={{ width: size, height: size }}
    >
      <div
        className="w-full h-full rounded-[16px] bg-[#FF4FA3] shadow-xl flex items-center justify-center"
        style={{ boxShadow: '0 0 20px rgba(255,79,163,0.6)' }}
      >
        <Sparkles size={size / 2} className="text-white" />
      </div>
    </motion.div>
  );
};
