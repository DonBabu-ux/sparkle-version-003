import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { showError } from '../../utils/toast';
import { storyStickerApi } from '../../services/storyStickerApi';

interface ReactionStickerProps {
  config: {
    emoji: string;
    count?: number;
  };
  /** Layer id of this sticker inside the story_layers payload. */
  stickerId?: string;
  /** Story the sticker lives on. Without it the reaction stays local (composer). */
  storyId?: string;
  onInteract?: (data: { action: 'react' }) => void;
}

const ReactionSticker: React.FC<ReactionStickerProps> = ({ config, stickerId, storyId, onInteract }) => {
  const [reacted, setReacted] = useState(false);
  const [pending, setPending] = useState(false);

  const handleReact = async () => {
    if (reacted || pending) return;

    // Optimistic: the emoji lights up before the server confirms.
    setReacted(true);
    onInteract?.({ action: 'react' });

    // No story context (the composer) → the tap never leaves the device.
    if (!storyId || !stickerId) return;

    setPending(true);
    try {
      await storyStickerApi.react(storyId, stickerId, config.emoji || '🔥');
    } catch {
      setReacted(false);
      showError('Could not send your reaction');
    } finally {
      setPending(false);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.8, rotate: -15 }}
      onClick={(e) => { e.stopPropagation(); handleReact(); }}
      disabled={pending}
      className={`bg-white/90 backdrop-blur-md rounded-full w-16 h-16 shadow-xl border flex items-center justify-center text-[32px] hover:bg-white transition-colors ${reacted ? 'border-primary ring-2 ring-primary/40' : 'border-white/40'} ${pending ? 'opacity-70' : ''}`}
    >
      <span className="drop-shadow-lg">{config.emoji || '🔥'}</span>
    </motion.button>
  );
};

export default ReactionSticker;
