import React from 'react';
import { RotateCw } from 'lucide-react';

interface ErrorRetryProps {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/** Canonical load-failure state (S8/P1 — never show these as empty states). */
export const ErrorRetry: React.FC<ErrorRetryProps> = ({
  message = "Something went wrong while loading. Check your connection and try again.",
  onRetry,
  retryLabel = 'Try again',
  className = '',
}) => (
  <div
    role="alert"
    className={`flex flex-col items-center justify-center text-center p-8 min-h-[240px] ${className}`}
  >
    <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center mb-4">
      <RotateCw className="w-7 h-7 text-red-500" />
    </div>
    <p className="font-heading font-bold text-[15px] text-black dark:text-white">Load failed</p>
    <p className="mt-1 text-[13px] text-black/50 dark:text-white/50 max-w-[280px] leading-relaxed">
      {message}
    </p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="tap-target mt-4 px-5 py-2.5 rounded-full bg-black text-white dark:bg-white dark:text-black text-[13px] font-bold hover:opacity-90 transition-opacity"
      >
        {retryLabel}
      </button>
    )}
  </div>
);

export default ErrorRetry;
