import { motion } from 'framer-motion';

/**
 * The full-screen emoji burst played when a word effect fires.
 * Extracted from pages/Messages.tsx.
 */

const WordEffectBubbles = ({ emoji, active }: { emoji: string | null, active: boolean }) => {
  if (!active || !emoji) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          initial={{
            y: '110vh',
            x: `${Math.random() * 100}vw`,
            scale: 0.5,
            opacity: 0,
            rotate: 0
          }}
          animate={{
            y: '-10vh',
            x: `${Math.random() * 100}vw`,
            scale: [0.5, 1.5, 1],
            opacity: [0, 1, 1, 0],
            rotate: Math.random() * 360
          }}
          transition={{
            duration: Math.random() * 2 + 2,
            delay: Math.random() * 1.5,
            ease: "easeOut"
          }}
          className="absolute text-5xl select-none"
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  );
};

export default WordEffectBubbles;
