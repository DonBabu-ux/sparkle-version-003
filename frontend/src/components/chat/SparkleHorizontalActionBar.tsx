import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Trash2,
  Pin,
  Archive,
  BellOff,
  Volume2,
  MoreVertical,
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

export interface SparkleSelectionToolbarProps {
  selectedCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  isFavorite?: boolean;
  onClearSelection: () => void;
  onPin?: () => void;
  onMute?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onMore?: () => void;
}

export const SparkleHorizontalActionBar: React.FC<SparkleSelectionToolbarProps> = ({
  selectedCount,
  isPinned = false,
  isMuted = false,
  onClearSelection,
  onPin,
  onMute,
  onArchive,
  onDelete,
  onMore,
}) => {
  const currentTheme = useThemeStore((state) => state.currentTheme);
  const primaryColor = currentTheme?.colors?.primary || '#ff1493';

  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        className="w-full bg-[#13131a] border-b border-white/[0.08] shadow-lg select-none z-40 relative"
      >
        {/* Subtle Accent Glow Line */}
        <div
          className="h-[2px] w-full"
          style={{
            backgroundImage: `linear-gradient(to right, transparent, ${primaryColor}, transparent)`,
          }}
        />

        <div className="px-4 py-3 flex items-center justify-between min-h-[58px]">
          {/* Left Controls: Exit Selection + Reactive Count */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClearSelection}
              aria-label="Exit selection mode"
              className="w-10 h-10 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
              title="Cancel selection"
            >
              <ArrowLeft size={22} strokeWidth={2.2} />
            </button>

            <span className="text-[19px] font-bold text-white tracking-tight leading-none">
              {selectedCount}
            </span>
          </div>

          {/* Right Action Toolbar: Mute, Delete, Pin, Archive, More */}
          <div className="flex items-center gap-1 sm:gap-2">
            {onMute && (
              <button
                onClick={onMute}
                aria-label={isMuted ? "Unmute conversations" : "Mute conversations"}
                className="w-10 h-10 rounded-full text-white/90 hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <BellOff size={20} strokeWidth={2} className="text-purple-400 shrink-0" />
                ) : (
                  <Volume2 size={20} strokeWidth={2} className="text-white shrink-0" />
                )}

              </button>
            )}

            {onDelete && (
              <button
                onClick={onDelete}
                aria-label="Delete conversations"
                className="w-10 h-10 rounded-full text-white/90 hover:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-all active:scale-90"
                title="Delete conversation"
              >
                <Trash2 size={20} strokeWidth={2} />
              </button>
            )}

            {onPin && (
              <button
                onClick={onPin}
                aria-label={isPinned ? "Unpin conversations" : "Pin conversations"}
                className="w-10 h-10 rounded-full text-white/90 hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
                title={isPinned ? "Unpin" : "Pin"}
              >
                <Pin
                  size={20}
                  strokeWidth={2}
                  className={isPinned ? "text-[#ff1493] fill-[#ff1493]" : "text-white"}
                />
              </button>
            )}

            {onArchive && (
              <button
                onClick={onArchive}
                aria-label="Archive conversations"
                className="w-10 h-10 rounded-full text-white/90 hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
                title="Archive"
              >
                <Archive size={20} strokeWidth={2} className="text-white" />
              </button>
            )}

            {onMore && (
              <button
                onClick={onMore}
                aria-label="More options"
                className="w-10 h-10 rounded-full text-white/90 hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
                title="More options"
              >
                <MoreVertical size={20} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
