// components/sparkly/SparklyAvatar.tsx
// Canonical Sparkly Bot avatar — single source of truth, used everywhere
import React from 'react';

interface SparklyAvatarProps {
  size?: number;
  className?: string;
  pulse?: boolean;
}

/**
 * SparklyAvatar — the official Sparkly Bot identity icon.
 * A friendly circular avatar with an S-star motif in purple/indigo.
 * Works at any size from 16px to 200px.
 */
export const SparklyAvatar: React.FC<SparklyAvatarProps> = ({
  size = 32,
  className = '',
  pulse = false
}) => {
  const id = `sg-${Math.floor(size)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${pulse ? 'animate-pulse' : ''} ${className}`}
      aria-label="Sparkly AI"
      role="img"
    >
      {/* Outer circle background */}
      <circle cx="20" cy="20" r="20" fill="#1a1827" />

      {/* Gradient definitions */}
      <defs>
        <radialGradient id={`${id}-bg`} cx="35%" cy="25%" r="70%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#1a1827" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-star`} x1="8" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c084fc" />
          <stop offset="0.5" stopColor="#818cf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id={`${id}-inner`} x1="15" y1="15" x2="25" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#e9d5ff" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Subtle glow fill */}
      <circle cx="20" cy="20" r="20" fill={`url(#${id}-bg)`} />

      {/* Outer ring */}
      <circle cx="20" cy="20" r="19" stroke="#7c3aed" strokeOpacity="0.4" strokeWidth="1" fill="none" />

      {/* Large 4-point star */}
      <path
        d="M20 6 L22.5 17.5 L34 20 L22.5 22.5 L20 34 L17.5 22.5 L6 20 L17.5 17.5 Z"
        fill={`url(#${id}-star)`}
      />

      {/* Small accent stars */}
      <circle cx="29" cy="12" r="1.5" fill="#c084fc" opacity="0.7" />
      <circle cx="12" cy="29" r="1.2" fill="#818cf8" opacity="0.6" />

      {/* Central dot */}
      <circle cx="20" cy="20" r="3" fill={`url(#${id}-inner)`} />
    </svg>
  );
};

/** Compact streaming dots indicator shown beside Sparkly avatar */
export const SparklyTypingDots: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-[3px] ${className}`} aria-label="Sparkly is typing">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-purple-400"
        style={{
          animation: `sparklyDot 1.2s ease-in-out ${i * 0.2}s infinite`
        }}
      />
    ))}
    <style>{`
      @keyframes sparklyDot {
        0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
        40% { opacity: 1; transform: scale(1); }
      }
    `}</style>
  </span>
);

export default SparklyAvatar;
