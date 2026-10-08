import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

/** Canonical empty state (S8/P1 — errors must use <ErrorRetry>, never this). */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'All caught up!',
  message = 'Nothing here yet — check back soon for more sparkle.',
  icon,
  action,
  compact = false,
  className = '',
}) => (
  <div
    className={`flex flex-col items-center justify-center text-center ${
      compact ? 'p-6' : 'p-8 min-h-[240px]'
    } ${className}`}
  >
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-4"
    >
      {icon ?? <Sparkles className="w-8 h-8 text-primary" />}
    </motion.div>
    <p className="font-heading font-bold text-[15px] text-black dark:text-white">{title}</p>
    <p className="mt-1 text-[13px] text-black/50 dark:text-white/50 max-w-[260px] leading-relaxed">
      {message}
    </p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
