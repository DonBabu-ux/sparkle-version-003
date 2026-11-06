import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import Spinner from '../../../components/ui/Spinner';

// ─── Reasons (must stay in sync with the server's MODERATION_REASONS set) ────

export const MODERATION_REASONS = [
  { value: 'spam_or_advertising', label: 'Spam or advertising' },
  { value: 'harassment_or_bullying', label: 'Harassment or bullying' },
  { value: 'hate_speech_or_abusive_language', label: 'Hate speech or abusive language' },
  { value: 'inappropriate_or_offensive_content', label: 'Inappropriate or offensive content' },
  { value: 'irrelevant_content', label: 'Irrelevant content' },
  { value: 'impersonation_or_suspicious_activity', label: 'Impersonation or suspicious activity' },
  { value: 'other', label: 'Other' },
] as const;

export type ModerationReason = (typeof MODERATION_REASONS)[number]['value'];

const reasonLabel = (value: string): string =>
  MODERATION_REASONS.find((r) => r.value === value)?.label || value;

// ─── Component ────────────────────────────────────────────────────────────────

interface CommentModerationDialogProps {
  open: boolean;
  /** Username of the comment being removed (shown for confirmation). */
  username: string;
  /** Short preview of the comment content. */
  content: string;
  isReply?: boolean;
  /** True while the moderation request is in flight (locks the dialog). */
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (reason: ModerationReason, details?: string) => void;
}

const CommentModerationDialog: React.FC<CommentModerationDialogProps> = ({
  open,
  username,
  content,
  isReply = false,
  submitting = false,
  onCancel,
  onConfirm,
}) => {
  const [reason, setReason] = useState<ModerationReason | ''>('');
  const [details, setDetails] = useState('');
  const firstRadioRef = useRef<HTMLInputElement>(null);

  // Fresh state every time the dialog opens.
  useEffect(() => {
    if (open) {
      setReason('');
      setDetails('');
      const t = window.setTimeout(() => firstRadioRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Escape cancels (but never while a removal is in flight).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, submitting, onCancel]);

  const canConfirm = !!reason && !submitting;

  const handleConfirm = () => {
    if (!canConfirm || !reason) return;
    onConfirm(reason, reason === 'other' && details.trim() ? details.trim() : undefined);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="moderation-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-(--z-modal) flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] p-0 sm:p-4"
          onClick={() => { if (!submitting) onCancel(); }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="moderation-dialog-title"
            initial={{ y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white dark:bg-[#1c1c1e] sm:rounded-3xl rounded-t-3xl shadow-2xl border border-black/5 dark:border-white/10 max-h-[92vh] flex flex-col overflow-hidden pb-[calc(0.75rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] sm:pb-4 pl-[calc(var(--safe-area-inset-left,env(safe-area-inset-left,0px))+0.25rem)] pr-[calc(var(--safe-area-inset-right,env(safe-area-inset-right,0px))+0.25rem)]"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 shrink-0">
              <p
                id="moderation-dialog-title"
                className="text-[16px] font-bold text-gray-900 dark:text-white"
              >
                {isReply ? 'Remove this reply?' : 'Remove this comment?'}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500 dark:text-zinc-400">
                You are removing another user's {isReply ? 'reply' : 'comment'} from your Reel.
                Select a reason so the action can be recorded appropriately.
              </p>
            </div>

            {/* Confirmation summary — author, preview, selected reason */}
            <div className="mx-5 mb-3 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-3 shrink-0">
              <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">
                @{username || 'unknown'}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-gray-500 dark:text-zinc-400 line-clamp-2 break-words">
                {content || '—'}
              </p>
              <p className="mt-2 text-[12px] font-semibold text-[#fe2c55]">
                {reason ? `Reason: ${reasonLabel(reason)}` : 'Select a reason below'}
              </p>
            </div>

            {/* Reason picker */}
            <div
              role="radiogroup"
              aria-label="Moderation reason"
              className="flex-1 overflow-y-auto px-5 min-h-0"
              style={{ overscrollBehavior: 'contain' }}
            >
              {MODERATION_REASONS.map((r, idx) => (
                <label
                  key={r.value}
                  className={clsx(
                    'flex items-center gap-3 min-h-[44px] px-2 -mx-2 rounded-xl cursor-pointer transition-colors',
                    reason === r.value
                      ? 'bg-[#fe2c55]/[0.06]'
                      : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                  )}
                >
                  <input
                    ref={idx === 0 ? firstRadioRef : undefined}
                    type="radio"
                    name="moderation-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-[#fe2c55] w-4 h-4 shrink-0"
                    aria-label={r.label}
                  />
                  <span
                    className={clsx(
                      'text-[13.5px] font-semibold py-2',
                      reason === r.value ? 'text-[#fe2c55]' : 'text-gray-700 dark:text-zinc-300'
                    )}
                  >
                    {r.label}
                  </span>
                </label>
              ))}

              {reason === 'other' && (
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Add details (optional)"
                  aria-label="Additional details"
                  className="mt-2 w-full rounded-xl bg-gray-100 dark:bg-zinc-800 border border-transparent focus:border-[#fe2c55]/40 focus:ring-2 focus:ring-[#fe2c55]/15 outline-none p-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 resize-none"
                />
              )}
            </div>

            {/* Actions */}
            <div className="shrink-0 flex gap-3 px-5 pt-4 border-t border-black/5 dark:border-white/5 mt-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="flex-1 min-h-[46px] rounded-xl text-[14px] font-bold text-gray-600 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                aria-label="Confirm removal"
                className={clsx(
                  'flex-1 min-h-[46px] rounded-xl text-[14px] font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2',
                  canConfirm
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-red-600'
                    : 'bg-gray-200 dark:bg-zinc-700 text-gray-400 dark:text-zinc-500 cursor-not-allowed'
                )}
              >
                {submitting ? (
                  <>
                    <Spinner size="small" color="text-white" />
                    Removing…
                  </>
                ) : (
                  'Confirm removal'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommentModerationDialog;
