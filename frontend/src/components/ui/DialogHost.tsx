import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDialogStore, settleDialog } from '../../store/dialogStore';

/**
 * Host for the shared confirm/prompt dialogs (S8). Mounted once in App.tsx.
 * - role="dialog" + aria-modal + Escape + focus management
 * - stacking on the --z-modal token (above chrome, alongside other modals)
 */
export const DialogHost: React.FC = () => {
  const pending = useDialogStore((s) => s.pending);
  const [value, setValue] = useState('');

  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pending) return;
    setValue(pending.kind === 'prompt' ? (pending.defaultValue ?? '') : '');
    const t = window.setTimeout(() => {
      if (pending.kind === 'prompt') inputRef.current?.focus();
      else confirmRef.current?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        settleDialog(pending.kind === 'confirm' ? false : null);
      }
      if (e.key === 'Enter' && pending.kind === 'prompt') {
        settleDialog(value);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [pending, value]);

  const isConfirm = pending?.kind === 'confirm';

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => settleDialog(isConfirm ? false : null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            role="dialog"
            aria-modal="true"
            aria-label={pending.title ?? (isConfirm ? 'Confirm' : 'Input')}
            className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <p className="font-heading font-bold text-[15px] text-black dark:text-white">
                {pending.title ?? (isConfirm ? 'Are you sure?' : 'Input required')}
              </p>
              <p className="mt-1.5 text-[13px] text-black/60 dark:text-white/60 leading-relaxed">
                {pending.message}
              </p>
              {pending.kind === 'prompt' && (
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mt-3 w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 text-sm text-black dark:text-white outline-none focus:ring-2 focus:ring-primary/50"
                />
              )}
            </div>
            <div className="flex border-t border-black/5 dark:border-white/10 divide-x divide-black/5 dark:divide-white/10">
              <button
                type="button"
                className="flex-1 py-3 text-sm font-bold text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                onClick={() => settleDialog(isConfirm ? false : null)}
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                className={`flex-1 py-3 text-sm font-bold transition-colors ${
                  isConfirm
                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                    : 'text-primary hover:bg-primary/5'
                }`}
                onClick={() => settleDialog(isConfirm ? true : value)}
              >
                {pending.confirmLabel ?? (isConfirm ? 'Confirm' : 'OK')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DialogHost;
