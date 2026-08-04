import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, VolumeX, Archive, Trash2, Sparkles, CheckSquare, X, MoreHorizontal } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

interface SparkleHorizontalActionBarProps {
  selectedCount: number;
  isPinned?: boolean;
  isFavorite?: boolean;
  isMuted?: boolean;
  onPin: () => void;
  onMute: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onMore: () => void;
  onClearSelection: () => void;
}

export const SparkleHorizontalActionBar: React.FC<SparkleHorizontalActionBarProps> = ({
  selectedCount,
  isPinned = false,
  isFavorite = false,
  isMuted = false,
  onPin,
  onMute,
  onArchive,
  onDelete,
  onFavorite,
  onMore,
  onClearSelection,
}) => {
  const currentTheme = useThemeStore((state) => state.currentTheme);
  const primaryColor = currentTheme?.colors?.primary || '#ff1493';

  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="w-full bg-[#181628]/95 border-b border-white/15 backdrop-blur-xl px-5 py-3 flex items-center justify-between shadow-2xl z-40"
      >
        {/* Selection Counter */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClearSelection}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-all active:scale-90"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-2 text-white font-extrabold text-sm tracking-tight">
            <CheckSquare size={18} style={{ color: primaryColor }} />
            <span>{selectedCount} Selected</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {selectedCount === 1 && (
            <button
              onClick={onPin}
              title={isPinned ? "Unpin Chat" : "Pin Chat"}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 border border-white/10"
            >
              <Pin size={15} className={isPinned ? "text-[#ff1493] fill-[#ff1493]" : "text-slate-300"} />
              <span>{isPinned ? "Unpin" : "Pin"}</span>
            </button>
          )}

          {selectedCount === 1 && (
            <button
              onClick={onFavorite}
              title={isFavorite ? "Remove Favorite" : "Add Favorite"}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 border border-white/10"
            >
              <Sparkles size={15} className={isFavorite ? "text-amber-400 fill-amber-400" : "text-slate-300"} />
              <span>{isFavorite ? "Fav" : "Favorite"}</span>
            </button>
          )}

          <button
            onClick={onMute}
            title="Mute"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 border border-white/10"
          >
            <VolumeX size={16} className={isMuted ? "text-purple-400" : "text-slate-300"} />
          </button>

          <button
            onClick={onArchive}
            title="Archive"
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 border border-white/10"
          >
            <Archive size={15} className="text-purple-300" />
            <span className="hidden sm:inline">Archive</span>
          </button>

          <button
            onClick={onDelete}
            title="Delete"
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-1.5 border border-rose-500/30 transition-all active:scale-95"
          >
            <Trash2 size={15} />
            <span className="hidden sm:inline">Delete</span>
          </button>

          <button
            onClick={onMore}
            title="More Options"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 border border-white/10"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
