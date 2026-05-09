import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Heart {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
}

const COLORS = ['#FF2D55', '#AF52DE', '#D63384', '#5856D6'];

export const TikTokHearts = () => {
  const [hearts, setHearts] = useState<Heart[]>([]);

  const spawnHeart = useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random();
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size = 40 + Math.random() * 60; // Much bigger
    const rotation = (Math.random() - 0.5) * 60;
    
    setHearts(prev => [...prev, { id, x, y, color, size, rotation }]);

    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== id));
    }, 800);
  }, []);

  // Listen for global custom event
  useEffect(() => {
    const handleSpawn = (e: CustomEvent<{ x: number, y: number }>) => {
      spawnHeart(e.detail.x, e.detail.y);
    };

    window.addEventListener('spawn-tiktok-heart' as any, handleSpawn);
    return () => window.removeEventListener('spawn-tiktok-heart' as any, handleSpawn);
  }, [spawnHeart]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
      <AnimatePresence>
        {hearts.map(heart => (
          <motion.div
            key={heart.id}
            initial={{ 
              opacity: 0,
              scale: 0.3, 
              x: heart.x - heart.size / 2, 
              y: heart.y - heart.size / 2,
              rotate: heart.rotation
            }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              scale: [0.3, 1.2, 1.3, 1.1], 
              y: heart.y - 300 - Math.random() * 150,
              x: heart.x + (Math.random() - 0.5) * 150,
              rotate: heart.rotation + (Math.random() - 0.5) * 90
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute"
          >
            <svg 
              width={heart.size} 
              height={heart.size} 
              viewBox="0 0 24 24" 
              fill={heart.color}
              className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.2)]"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export const emitHeart = (x: number, y: number) => {
  const event = new CustomEvent('spawn-tiktok-heart', { detail: { x, y } });
  window.dispatchEvent(event);
};
