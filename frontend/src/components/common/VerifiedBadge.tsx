import React from 'react';
import { motion } from 'framer-motion';
import { VerificationBadgeConfig } from '../../utils/identityManager';

export interface VerifiedBadgeProps {
  accountType?: string;
  isVerified?: boolean;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  accountType = 'user',
  isVerified = true,
  color,
  size = 'md',
  className = '',
  showLabel = false,
}) => {
  if (!isVerified) return null;

  const key = (accountType || 'user').toLowerCase();
  const config = VerificationBadgeConfig[key] || VerificationBadgeConfig.user;
  const badgeColor = color || config.color;

  const sizeDimensions = {
    xs: { px: 12, strokeWidth: 2.2, labelText: 'text-[9px]' },
    sm: { px: 15, strokeWidth: 2.4, labelText: 'text-[10px]' },
    md: { px: 18, strokeWidth: 2.5, labelText: 'text-xs' },
    lg: { px: 22, strokeWidth: 2.6, labelText: 'text-sm' },
  }[size] || { px: 18, strokeWidth: 2.5, labelText: 'text-xs' };

  const px = sizeDimensions.px;

  return (
    <motion.span
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, type: 'spring', stiffness: 350, damping: 22 }}
      className={`inline-flex items-center gap-1 shrink-0 ${className}`}
      title={config.label}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <svg
          width={px}
          height={px}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm"
        >
          {/* Filled circular background */}
          <circle cx="12" cy="12" r="10" fill={badgeColor} />

          {/* Subtle Sparkle 4-point star background accent */}
          <path
            d="M12 4L13.2 10.8L20 12L13.2 13.2L12 20L10.8 13.2L4 12L10.8 10.8L12 4Z"
            fill="#FFFFFF"
            fillOpacity="0.2"
          />

          {/* Clean checkmark silhouette */}
          <path
            d="M8.5 12.5L10.8 14.8L15.5 9.2"
            stroke="#FFFFFF"
            strokeWidth={sizeDimensions.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {showLabel && (
        <span className={`font-semibold text-white/90 ${sizeDimensions.labelText}`}>
          {config.label}
        </span>
      )}
    </motion.span>
  );
};
