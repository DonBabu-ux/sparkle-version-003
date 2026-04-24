import React from 'react';
import { motion } from 'framer-motion';

interface ReactionStickerProps {
  config: {
    emoji: string;
    count?: number;
  };
  onInteract?: (data: any) => void;
}

const ReactionSticker: React.FC<ReactionStickerProps> = ({ config, onInteract }) => {
  return (
    <motion.button
      whileTap={{ scale: 0.8, rotate: -15 }}
      onClick={(e) => { e.stopPropagation(); onInteract?.({ action: 'react' }); }}
      className="bg-white/90 backdrop-blur-md rounded-full w-16 h-16 shadow-xl border border-white/40 flex items-center justify-center text-[32px] hover:bg-white transition-colors"
    >
      <span className="drop-shadow-lg">{config.emoji || '🔥'}</span>
    </motion.button>
  );
};

export default ReactionSticker;
