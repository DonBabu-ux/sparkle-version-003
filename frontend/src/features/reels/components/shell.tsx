import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';
import { useCreateMomentsTheme } from '../useCreateMomentsTheme';

/** Full-screen creation stage chrome: header + scrollable body, safe-area aware. */
export function StageShell({
  title,
  leftIcon,
  onLeft,
  right,
  children,
  dark,
  bodyClassName = '',
}: {
  title: ReactNode;
  leftIcon: 'close' | 'back';
  onLeft: () => void;
  right?: ReactNode;
  children: ReactNode;
  dark?: boolean;
  bodyClassName?: string;
}) {
  const { isDark } = useCreateMomentsTheme();
  const effectiveDark = dark !== undefined ? dark : isDark;

  return (
    <div
      className={`fixed inset-0 z-[var(--z-modal,60)] flex flex-col ${effectiveDark ? 'text-white' : 'text-gray-900'}`}
      style={{
        background: effectiveDark ? '#0B070C' : '#FFFFFF',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'Reel creation step'}
    >
      <header
        className="flex items-center justify-between gap-2 px-3 h-14 shrink-0 border-b"
        style={{
          background: effectiveDark ? 'rgba(11, 7, 12, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          borderColor: effectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <button
          type="button"
          onClick={onLeft}
          aria-label={leftIcon === 'close' ? 'Close' : 'Back'}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: effectiveDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
            color: effectiveDark ? '#fff' : '#111827',
          }}
        >
          {leftIcon === 'close' ? <X size={20} /> : <ArrowLeft size={20} />}
        </button>
        <h1
          className="text-[17px] font-extrabold truncate"
          style={{
            color: effectiveDark ? '#fff' : '#111827',
            fontFamily: "'Varela Round', sans-serif",
          }}
        >
          {title}
        </h1>
        <div className="min-w-[40px] flex justify-end">{right}</div>
      </header>
      <div className={`flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/** Bottom sheet: drag-to-dismiss, backdrop, safe area, scroll lock. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeightsvh = 70,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxHeightsvh?: number;
  dark?: boolean;
}) {
  const { isDark } = useCreateMomentsTheme();
  const effectiveDark = dark !== undefined ? dark : isDark;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[var(--z-sheet,70)]"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            className={`fixed left-0 right-0 bottom-0 z-[calc(var(--z-sheet,70)+1)] rounded-t-3xl flex flex-col ${effectiveDark ? 'text-white' : 'text-gray-900'}`}
            style={{
              maxHeight: `${maxHeightsvh}dvh`,
              background: effectiveDark ? '#16101A' : '#FFFFFF',
              borderTop: effectiveDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
              boxShadow: effectiveDark ? 'none' : '0 -10px 30px rgba(0,0,0,0.1)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            role="dialog"
            aria-modal="true"
            aria-label={title || 'Options'}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0" aria-hidden>
              <div
                className="w-10 h-1.5 rounded-full"
                style={{ background: effectiveDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' }}
              />
            </div>
            {title && (
              <div
                className={`px-5 pb-2 font-extrabold text-[16px] ${effectiveDark ? 'text-white' : 'text-gray-900'}`}
                style={{ fontFamily: "'Varela Round', sans-serif" }}
              >
                {title}
              </div>
            )}
            <div className="px-4 pb-5 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Keep-editing / Discard confirmation. */
export function ConfirmDiscardDialog({
  open,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  const { isDark } = useCreateMomentsTheme();
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => keepRef.current?.focus(), 50);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[calc(var(--z-modal,60)+10)] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      role="alertdialog"
      aria-modal="true"
      aria-label="Unsaved changes"
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl"
        style={{
          background: isDark ? '#16101A' : '#FFFFFF',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <h2
          className={`font-extrabold text-lg mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
          style={{ fontFamily: "'Varela Round', sans-serif" }}
        >
          Discard this reel?
        </h2>
        <p className={`text-sm mb-6 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
          You have unsaved edits. Leaving now will clear this session — you can save a draft instead.
        </p>
        <div className="flex flex-col gap-3">
          <button
            ref={keepRef}
            type="button"
            onClick={onKeepEditing}
            className="w-full py-3 rounded-2xl font-bold text-white shadow-sm"
            style={{ background: '#ff1493' }}
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className={`w-full py-3 rounded-2xl font-bold transition-colors ${
              isDark
                ? 'bg-white/10 text-white/80 hover:bg-white/15'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small spinner used across loading states. */
export function InlineSpinner({ size = 18, color = '#FF3D6D' }: { size?: number; color?: string }) {
  return (
    <span
      className="inline-block rounded-full animate-spin"
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, size / 8)}px solid rgba(255,255,255,0.2)`,
        borderTopColor: color,
      }}
      aria-label="Loading"
      role="status"
    />
  );
}

export const PINK = '#FF006E';
export const PINK_SOFT = '#FF3D6D';
