import React from 'react';

interface SkeletonProps {
  className?: string;
}

/** Canonical loading skeleton (S8/P1 — replaces ad-hoc animate-pulse divs). */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse bg-black/5 dark:bg-white/10 rounded-xl ${className}`}
  />
);

export default Skeleton;
