import React from 'react';
import { motion } from 'framer-motion';

interface AvatarLoopStickerProps {
  config: {
    avatars: string[];
    label?: string;
  };
}

const AvatarLoopSticker: React.FC<AvatarLoopStickerProps> = ({ config }) => {
  const avatars = [...config.avatars, ...config.avatars]; // Double for seamless loop

  return (
    <div className="bg-black/80 backdrop-blur-xl rounded-full px-4 py-2 shadow-2xl border border-white/10 flex items-center gap-3 overflow-hidden max-w-[200px]">
      <div className="flex items-center gap-1">
        <motion.div 
          animate={{ x: [0, -100] }}
          transition={{ 
            duration: 10, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="flex items-center gap-1"
        >
          {avatars.map((av, i) => (
            <img 
              key={i} 
              src={av || '/uploads/avatars/default.png'} 
              className="w-8 h-8 rounded-full border border-white/20 object-cover shrink-0" 
              alt=""
            />
          ))}
        </motion.div>
      </div>
      
      {config.label && (
        <span className="text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap pr-2">
          {config.label}
        </span>
      )}
    </div>
  );
};

export default AvatarLoopSticker;
