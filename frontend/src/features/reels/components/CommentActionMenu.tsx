import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommentActionKind = 'copy' | 'reply' | 'edit' | 'delete' | 'report';

export interface CommentActionItem {
  kind: CommentActionKind;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
}

interface CommentActionMenuProps {
  open: boolean;
  /** Viewport rect of the long-pressed comment (from getBoundingClientRect). */
  anchor: DOMRect | null;
  actions: CommentActionItem[];
  /** Small header, e.g. "@username" — identifies the menu target. */
  title?: string;
  onSelect: (kind: CommentActionKind) => void;
  onClose: () => void;
}

// ─── Layout math ──────────────────────────────────────────────────────────────

const MENU_WIDTH = 240;
const ITEM_HEIGHT = 48;
const EDGE = 12;
/** Extra clearance so a floating menu never sits under a cutout/status bar. */
const TOP_SAFE = 16;

interface MenuLayout {
  mode: 'float' | 'sheet';
  style: React.CSSProperties;
}

function computeLayout(
  anchor: DOMRect,
  actionCount: number,
  hasTitle: boolean
): MenuLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(MENU_WIDTH, vw - EDGE * 2);
  const height = (hasTitle ? 40 : 8) + actionCount * ITEM_HEIGHT + 12;

  const spaceBelow = vh - anchor.bottom;
  const fitsBelow = spaceBelow >= height + EDGE;
  const fitsAbove = anchor.top >= height + EDGE + TOP_SAFE;

  // Floating only when it clearly fits; otherwise fall back to a native-style
  // bottom action sheet (the safe pattern on small screens / near the fold).
  if (fitsBelow || fitsAbove) {
    let left = anchor.left;
    if (left + width > vw - EDGE) left = vw - width - EDGE;
    if (left < EDGE) left = EDGE;

    let top = fitsBelow ? anchor.bottom + 8 : anchor.top - height - 8;
    if (top < TOP_SAFE) top = TOP_SAFE;
    if (top + height > vh - EDGE) top = Math.max(TOP_SAFE, vh - height - EDGE);

    return { mode: 'float', style: { top, left, width } };
  }

  return { mode: 'sheet', style: { width: '100%', maxWidth: 480 } };
}

// ─── Component ────────────────────────────────────────────────────────────────

const CommentActionMenu: React.FC<CommentActionMenuProps> = ({
  open,
  anchor,
  actions,
  title,
  onSelect,
  onClose,
}) => {
  const [layout, setLayout] = useState<MenuLayout | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Recompute placement whenever the menu opens or the viewport changes.
  useLayoutEffect(() => {
    if (!open || !anchor) {
      setLayout(null);
      return;
    }
    const apply = () => setLayout(computeLayout(anchor, actions.length, !!title));
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('scroll', apply, true);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('scroll', apply, true);
    };
  }, [open, anchor, actions.length, title]);

  // Focus first item for keyboard / screen-reader users; restore on close.
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = (document.activeElement as HTMLElement) || null;
      const t = window.setTimeout(() => {
        panelRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
      }, 30);
      return () => window.clearTimeout(t);
    }
    const prev = restoreFocusRef.current;
    if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
      prev.focus();
    }
  }, [open]);

  // Escape dismisses the menu (mirrors the sheet's Escape behavior).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const handleSelect = useCallback(
    (kind: CommentActionKind) => {
      onClose();
      onSelect(kind);
    },
    [onClose, onSelect]
  );

  const isActive = open && !!anchor && !!layout && actions.length > 0;

  const panel = (
    <motion.div
      key="menu-panel"
      ref={panelRef}
      role="menu"
      aria-label={title ? `Actions for comment by ${title}` : 'Comment actions'}
      initial={{ opacity: 0, scale: layout?.mode === 'float' ? 0.94 : 1, y: layout?.mode === 'sheet' ? 24 : -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: layout?.mode === 'float' ? 0.96 : 1, y: layout?.mode === 'sheet' ? 24 : -4 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
      className={clsx(
        'z-(--z-modal-top) bg-white dark:bg-[#2c2c2e] shadow-[0_12px_40px_rgba(0,0,0,0.28)] border border-black/5 dark:border-white/10 overflow-hidden',
        layout?.mode === 'sheet'
          ? 'fixed left-0 right-0 bottom-0 mx-auto rounded-t-3xl pb-[calc(0.75rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] px-[calc(var(--safe-area-inset-left,env(safe-area-inset-left,0px))+0.25rem)]'
          : 'fixed rounded-2xl'
      )}
      style={layout?.mode === 'float' ? layout.style : undefined}
    >
      {title && (
        <div className="px-4 pt-3 pb-2 text-[12px] font-bold text-gray-400 dark:text-zinc-500 truncate border-b border-black/5 dark:border-white/10">
          {title}
        </div>
      )}
      <div role="none" className="py-1">
        {actions.map((action) => (
          <button
            key={action.kind}
            type="button"
            role="menuitem"
            aria-label={action.label}
            onClick={() => handleSelect(action.kind)}
            className={clsx(
              'w-full min-h-[48px] px-4 flex items-center gap-3 text-[14px] font-semibold transition-colors active:bg-black/5 dark:active:bg-white/10',
              action.danger
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                : 'text-gray-800 dark:text-zinc-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            )}
          >
            <span className="shrink-0 opacity-80">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
      {layout?.mode === 'sheet' && (
        <div className="pt-1 pb-1 border-t border-black/5 dark:border-white/10 mt-1">
          <button
            type="button"
            role="menuitem"
            aria-label="Cancel"
            onClick={onClose}
            className="w-full min-h-[48px] px-4 flex items-center justify-center text-[14px] font-bold text-gray-500 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </motion.div>
  );

  return (
    <AnimatePresence>
      {/* Transparent dismissal layer — unmounts with the menu, so it can
          never linger and block the Reel controls afterwards. */}
      {isActive && (
        <motion.div
          key="menu-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-(--z-modal)"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      {isActive && panel}
    </AnimatePresence>
  );
};

export default CommentActionMenu;
