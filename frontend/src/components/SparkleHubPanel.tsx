import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import SparkleHub from './SparkleHub';

interface SparkleHubPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

export default function SparkleHubPanel({ open, onClose, anchorRect }: SparkleHubPanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !anchorRect) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  // Facebook-style drawer: full height, slides in from the right edge, width
  // responsive per breakpoint (no fixed pixel box anywhere).
  const width = isMobile ? 'min(88vw, 380px)' : 'min(520px, calc(100vw - 96px))';

  return createPortal(
    <>
      <style>{`
        @keyframes hub-slide-from-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .hub-slide-from-right { animation: hub-slide-from-right 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
      <div className="fixed inset-0 z-(--z-sheet) bg-black/30" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Sparkle Menu"
        className="fixed top-0 right-0 bottom-0 z-(--z-modal) hub-slide-from-right bg-[#fdf8fa] dark:bg-[#0a0a0c] shadow-2xl overflow-hidden flex flex-col rounded-l-[28px] border-l border-[#e6d8e1] dark:border-zinc-700"
        style={{ width }}
      >
        <SparkleHub embedded onClose={onClose} />
      </div>
    </>,
    document.body
  );
}
