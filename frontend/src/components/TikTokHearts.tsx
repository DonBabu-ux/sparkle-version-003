import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Heart {
  id: number;
  x: number;
  y: number;
  gradientId: string;
  size: number;
  rotation: number;
  drift: number;
}

const GRADIENTS = [
  { id: 'heart-grad-1', colors: ['#FF0000', '#FF006E', '#8338EC'] }, // Red -> Pink -> Purple
  { id: 'heart-grad-2', colors: ['#FF006E', '#3A86FF'] },           // Pink -> Blue
  { id: 'heart-grad-3', colors: ['#3A86FF', '#8338EC'] },           // Blue -> Purple
  { id: 'heart-grad-4', colors: ['#FF006E', '#FF006E', '#FB5607'] } // Pink -> Orange
];

export const TikTokHearts = () => {
  const [hearts, setHearts] = useState<Heart[]>([]);

  const spawnHeart = useCallback((x: number, y: number, pattern: 'burst' | 'v' = 'burst') => {
    // Spawn hearts based on pattern
    const count = pattern === 'v' ? 2 : 2 + Math.floor(Math.random() * 2);
    
    for (let i = 0; i < count; i++) {
      const id = Date.now() + Math.random() + i;
      const grad = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
      const size = pattern === 'v' ? 70 : 60 + Math.random() * 80;
      const rotation = (Math.random() - 0.5) * 40;
      
      // V-pattern physics
      let drift = (Math.random() - 0.5) * 200;
      let flyUp = 400 + Math.random() * 200;
      
      if (pattern === 'v') {
        // First heart goes left-ish, second goes right-ish
        drift = i === 0 ? -120 - Math.random() * 60 : 120 + Math.random() * 60;
        flyUp = 500 + Math.random() * 100;
      }

      const delay = i * 0.05;

      setTimeout(() => {
        setHearts(prev => [...prev, { id, x, y, gradientId: grad.id, size, rotation, drift }]);
      }, delay * 1000);

      setTimeout(() => {
        setHearts(prev => prev.filter(h => h.id !== id));
      }, 1200);
    }
  }, []);

  // Listen for global custom event
  useEffect(() => {
    const handleSpawn = (e: CustomEvent<{ x: number, y: number, pattern?: 'burst' | 'v' }>) => {
      spawnHeart(e.detail.x, e.detail.y, e.detail.pattern || 'burst');
    };

    window.addEventListener('spawn-tiktok-heart' as any, handleSpawn);
    return () => window.removeEventListener('spawn-tiktok-heart' as any, handleSpawn);
  }, [spawnHeart]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
      <svg width="0" height="0" className="absolute">
        <defs>
          {GRADIENTS.map(grad => (
            <linearGradient key={grad.id} id={grad.id} x1="0%" y1="0%" x2="100%" y2="100%">
              {grad.colors.map((color, idx) => (
                <stop key={idx} offset={`${(idx / (grad.colors.length - 1)) * 100}%`} stopColor={color} />
              ))}
            </linearGradient>
          ))}
        </defs>
      </svg>

      <AnimatePresence>
        {hearts.map(heart => (
          <motion.div
            key={heart.id}
            initial={{ 
              opacity: 0,
              scale: 0, 
              x: heart.x - heart.size / 2, 
              y: heart.y - heart.size / 2,
              rotate: heart.rotation
            }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              scale: [0, 1.4, 1.6, 1.2], 
              y: heart.y - 450 - Math.random() * 200,
              x: heart.x - heart.size / 2 + heart.drift,
              rotate: heart.rotation + (Math.random() - 0.5) * 120
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 1.0, 
              ease: [0.17, 0.67, 0.83, 0.67], // Punchy ease
            }}
            className="absolute"
          >
            <svg 
              width={heart.size} 
              height={heart.size} 
              viewBox="0 0 24 24" 
              fill={`url(#${heart.gradientId})`}
              className="drop-shadow-[0_12px_24px_rgba(0,0,0,0.3)] filter brightness-110"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export const emitHeart = (x: number, y: number, pattern: 'burst' | 'v' = 'burst') => {
  const event = new CustomEvent('spawn-tiktok-heart', { detail: { x, y, pattern } });
  window.dispatchEvent(event);
};


