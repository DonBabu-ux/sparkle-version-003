import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface PollStickerProps {
  config: {
    question: string;
    options: string[];
    votes?: number[];
    voted_index?: number;
  };
  onInteract?: (data: any) => void;
}

const PollSticker: React.FC<PollStickerProps> = ({ config, onInteract }) => {
  const [votedIndex, setVotedIndex] = useState(config.voted_index);
  const totalVotes = (config.votes || []).reduce((a, b) => a + b, 0);

  const handleVote = (index: number) => {
    if (votedIndex !== undefined) return;
    setVotedIndex(index);
    onInteract?.({ action: 'vote', index });
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-[24px] p-5 shadow-2xl border border-white/20 min-w-[220px] flex flex-col gap-4">
      <h4 className="text-[16px] font-black italic uppercase tracking-tight text-black text-center leading-tight">
        {config.question || 'Poll'}
      </h4>

      <div className="flex flex-col gap-2">
        {config.options.map((opt, i) => {
          const percentage = totalVotes > 0 ? Math.round(((config.votes?.[i] || 0) / totalVotes) * 100) : 0;
          
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => { e.stopPropagation(); handleVote(i); }}
              className={`relative h-12 w-full rounded-xl overflow-hidden border-2 transition-all ${votedIndex === i ? 'border-primary' : 'border-black/5 hover:border-black/10'}`}
            >
              {/* Progress Bar */}
              {votedIndex !== undefined && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  className={`absolute inset-y-0 left-0 ${votedIndex === i ? 'bg-primary/20' : 'bg-black/5'}`}
                />
              )}
              
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <span className={`text-[13px] font-bold ${votedIndex === i ? 'text-primary' : 'text-black/60'}`}>
                  {opt}
                </span>
                {votedIndex !== undefined && (
                  <span className="text-[12px] font-black text-black/40">
                    {percentage}%
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default PollSticker;
