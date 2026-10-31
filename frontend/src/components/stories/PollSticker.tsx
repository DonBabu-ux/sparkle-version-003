import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { showError } from '../../utils/toast';
import { storyStickerApi } from '../../services/storyStickerApi';

interface PollStickerProps {
  config: {
    question: string;
    options: string[];
    votes?: number[];
    voted_index?: number;
  };
  /** Layer id of this sticker inside the story_layers payload. */
  stickerId?: string;
  /** Story the sticker lives on. Without it the vote stays local (composer). */
  storyId?: string;
  onInteract?: (data: { action: 'vote'; index: number }) => void;
}

const PollSticker: React.FC<PollStickerProps> = ({ config, stickerId, storyId, onInteract }) => {
  // An already-voted config (voted_index) locks the poll — bars render read-only.
  const [votedIndex, setVotedIndex] = useState(config.voted_index);
  // Local copy of the tallies so an optimistic vote moves the bars immediately.
  const [voteCounts, setVoteCounts] = useState<number[]>(() =>
    config.options.map((_, i) => config.votes?.[i] ?? 0)
  );
  const [pending, setPending] = useState(false);
  const totalVotes = voteCounts.reduce((a, b) => a + b, 0);

  const handleVote = async (index: number) => {
    if (votedIndex !== undefined || pending) return;
    const previousCounts = voteCounts;

    // Optimistic: show the vote and its bar before the server answers.
    setVotedIndex(index);
    setVoteCounts(prev => prev.map((count, i) => (i === index ? count + 1 : count)));
    onInteract?.({ action: 'vote', index });

    // No story context (the composer) → the tap never leaves the device.
    if (!storyId || !stickerId) return;

    setPending(true);
    try {
      await storyStickerApi.vote(storyId, stickerId, index);
    } catch {
      setVotedIndex(undefined);
      setVoteCounts(previousCounts);
      showError('Could not record your vote');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-[24px] p-5 shadow-2xl border border-white/20 min-w-[220px] flex flex-col gap-4">
      <h4 className="text-[16px] font-black italic uppercase tracking-tight text-[#18181b] dark:text-white text-center leading-tight">
        {config.question || 'Poll'}
      </h4>

      <div className="flex flex-col gap-2">
        {config.options.map((opt, i) => {
          const percentage = totalVotes > 0 ? Math.round((voteCounts[i] / totalVotes) * 100) : 0;

          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => { e.stopPropagation(); handleVote(i); }}
              disabled={votedIndex !== undefined || pending}
              className={`relative h-12 w-full rounded-xl overflow-hidden border-2 transition-all ${votedIndex === i ? 'border-primary' : 'border-black/5 hover:border-black/10'} ${pending ? 'opacity-70' : ''} ${votedIndex !== undefined ? 'cursor-default' : ''}`}
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
