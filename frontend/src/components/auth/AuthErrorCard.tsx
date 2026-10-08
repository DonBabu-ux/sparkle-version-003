import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  WifiOff,
  Clock,
  CloudOff,
  Lock,
  UserX,
  Mail,
  RotateCcw,
  X,
  ExternalLink,
  Hourglass
} from 'lucide-react';
import type { AuthErrorInfo } from '../../utils/authErrorClassifier';

interface AuthErrorCardProps {
  error: AuthErrorInfo | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  onFocusField?: (field: 'email' | 'password') => void;
  className?: string;
}

export const AuthErrorCard: React.FC<AuthErrorCardProps> = ({
  error,
  onDismiss,
  onRetry,
  onFocusField,
  className = ''
}) => {
  if (!error) return null;

  const getIcon = () => {
    switch (error.type) {
      case 'OFFLINE':
        return <WifiOff className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'TIMEOUT':
      case 'SERVER_504':
        return <Clock className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'TOO_MANY_ATTEMPTS':
        return <Hourglass className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'SERVER_UNREACHABLE':
      case 'SERVER_500':
      case 'SERVER_502':
      case 'SERVER_503':
        return <CloudOff className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'INVALID_CREDENTIALS':
      case 'ACCOUNT_LOCKED':
        return <Lock className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'ACCOUNT_SUSPENDED':
      case 'ACCOUNT_DISABLED':
        return <UserX className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'EMAIL_NOT_VERIFIED':
        return <Mail className="w-5 h-5 text-blue-500 shrink-0" />;
      default:
        return <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />;
    }
  };

  const getCardStyle = () => {
    if (error.severity === 'warning') {
      return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200';
    }
    if (error.severity === 'info') {
      return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-200';
    }
    return 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200';
  };

  const handleAction = () => {
    if (error.action === 'retry' && onRetry) {
      onRetry();
    } else if (error.action === 'focus_email' && onFocusField) {
      onFocusField('email');
    } else if (error.action === 'focus_password' && onFocusField) {
      onFocusField('password');
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`auth-error-card relative overflow-hidden rounded-2xl border p-4 mb-4 shadow-sm transition-all duration-300 animate-slide-up ${getCardStyle()} ${className}`}
      style={{
        boxShadow: error.severity === 'error' ? '0 4px 16px -2px rgba(225, 29, 72, 0.08)' : undefined
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0 pr-4">
          <h4 className="text-sm font-bold tracking-tight mb-1 flex items-center gap-1.5">
            {error.title}
          </h4>
          <p className="text-xs leading-relaxed opacity-90 font-medium">
            {error.message}
          </p>

          {/* Safe request identifier for support troubleshooting if available */}
          {error.requestId && (
            <p className="mt-1 text-[10px] font-mono opacity-70">
              Reference: {error.requestId}
            </p>
          )}

          {/* Action button or link */}
          <div className="mt-2.5 flex items-center gap-3">
            {error.actionLink ? (
              <Link
                to={error.actionLink}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#e11d48] dark:text-rose-400 hover:underline transition-all"
              >
                <span>{error.actionLabel || 'Learn more'}</span>
                <ExternalLink size={12} />
              </Link>
            ) : error.actionLabel ? (
              <button
                type="button"
                onClick={handleAction}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#e11d48] dark:text-rose-400 hover:opacity-80 active:scale-95 transition-all"
              >
                {error.action === 'retry' && <RotateCcw size={12} className="animate-spin-once" />}
                <span>{error.actionLabel}</span>
              </button>
            ) : null}
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="absolute top-3.5 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <style>{`
        
        .animate-slide-up {
          animation: acSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default AuthErrorCard;
