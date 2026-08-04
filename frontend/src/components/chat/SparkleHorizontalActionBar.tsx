import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Reply,
  Star,
  Forward,
  Trash2,
  Copy,
  Sparkles,
  Orbit,
  X,
  Pin,
  Archive,
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

interface SparkleHorizontalActionBarProps {
  selectedCount: number;
  isPinned?: boolean;
  isFavorite?: boolean;
  onPin?: () => void;
  onMute?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onFavorite?: () => void;
  onMore?: () => void;
  onClearSelection: () => void;
  onReply?: () => void;
  onForward?: () => void;
  onCopy?: () => void;
}

export const SparkleHorizontalActionBar: React.FC<SparkleHorizontalActionBarProps> = ({
  selectedCount,
  isPinned = false,
  isFavorite = false,
  onPin,
  onMute,
  onArchive,
  onDelete,
  onFavorite,
  onMore,
  onClearSelection,
  onReply,
  onForward,
  onCopy,
}) => {
  const currentTheme = useThemeStore((state) => state.currentTheme);
  const primaryColor = currentTheme?.colors?.primary || '#FF008A';

  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -70, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 350 }}
        className="w-full bg-[#131122]/95 border-b border-white/15 backdrop-blur-2xl shadow-2xl z-40 select-none overflow-hidden relative"
      >
        {/* Subtle Top Accent Line */}
        <div
          className="h-[2px] w-full"
          style={{
            backgroundImage: `linear-gradient(to right, transparent, ${primaryColor}, transparent)`,
          }}
        />

        {/* Multi-Select Header */}
        <div className="px-5 py-2.5 flex items-center justify-between border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClearSelection}
              aria-label="Clear selection"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90"
            >
              <X size={18} />
            </button>
            <span className="text-base font-extrabold text-white tracking-tight">
              {selectedCount} Selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedCount === 1 && onPin && (
              <button
                onClick={onPin}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-white/10"
              >
                <Pin size={14} className={isPinned ? "text-[#FF008A] fill-[#FF008A]" : "text-white"} />
                <span>{isPinned ? "Unpin" : "Pin"}</span>
              </button>
            )}
            {onArchive && (
              <button
                onClick={onArchive}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-white/10"
              >
                <Archive size={14} className="text-white" />
                <span>Archive</span>
              </button>
            )}
          </div>
        </div>

        {/* Equal Width Item Bar (48x48dp min targets, 8px gaps) */}
        <div className="flex items-center justify-evenly py-2 px-2">
          {onReply && (
            <button
              onClick={onReply}
              className="flex-1 min-h-[48px] px-2 flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 text-white transition-all active:scale-95"
            >
              <Reply size={20} className="text-white" />
              <span className="text-[12px] font-medium text-white tracking-tight">Reply</span>
            </button>
          )}

          {onFavorite && (
            <button
              onClick={onFavorite}
              className="flex-1 min-h-[48px] px-2 flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 text-white transition-all active:scale-95"
            >
              <Star size={20} className={isFavorite ? "text-amber-400 fill-amber-400" : "text-white"} />
              <span className="text-[12px] font-medium text-white tracking-tight">
                {isFavorite ? "Unstar" : "Star"}
              </span>
            </button>
          )}

          {onForward && (
            <button
              onClick={onForward}
              className="flex-1 min-h-[48px] px-2 flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 text-white transition-all active:scale-95"
            >
              <Forward size={20} className="text-white" />
              <span className="text-[12px] font-medium text-white tracking-tight">Forward</span>
            </button>
          )}

          {onCopy && (
            <button
              onClick={onCopy}
              className="flex-1 min-h-[48px] px-2 flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 text-white transition-all active:scale-95"
            >
              <Copy size={20} className="text-white" />
              <span className="text-[12px] font-medium text-white tracking-tight">Copy</span>
            </button>
          )}

          {onDelete && (
            <button
              onClick={onDelete}
              className="flex-1 min-h-[48px] px-2 flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-rose-500/20 text-rose-300 transition-all active:scale-95"
            >
              <Trash2 size={20} className="text-rose-400" />
              <span className="text-[12px] font-medium text-rose-300 tracking-tight">Delete</span>
            </button>
          )}

          {onMore && (
            <button
              onClick={onMore}
              className="flex-1 min-h-[48px] px-2 flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-white/10 text-white transition-all active:scale-95"
            >
              <Sparkles size={20} className="text-[#FF008A]" />
              <span className="text-[12px] font-bold text-white tracking-tight">More</span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
