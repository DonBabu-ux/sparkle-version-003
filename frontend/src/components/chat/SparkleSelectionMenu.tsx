import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Star,
  Eraser,
  Ban,
  Archive,
  Search,
  Flag,
  CheckCircle2,
  CheckSquare,
  Sparkles,
  Eye,
} from 'lucide-react';

export interface SparkleSelectionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  isAllSelected?: boolean;
  isPriority?: boolean;
  isFavorite?: boolean;
  isUnread?: boolean;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onTogglePriority?: () => void;
  onSparklePeek?: () => void;
  onSmartRecall?: () => void;
  onViewProfile?: () => void;
  onMarkUnread?: () => void;
  onFavorite?: () => void;
  onClearChat?: () => void;
  onBlock?: () => void;
  onArchive?: () => void;
  onSearch?: () => void;
  onReport?: () => void;
}

export const SparkleSelectionMenu: React.FC<SparkleSelectionMenuProps> = ({
  isOpen,
  onClose,
  selectedCount,
  isAllSelected = false,
  isPriority = false,
  isFavorite = false,
  isUnread = false,
  onSelectAll,
  onDeselectAll,
  onTogglePriority,
  onSparklePeek,
  onSmartRecall,

  onViewProfile,
  onMarkUnread,
  onFavorite,
  onClearChat,
  onBlock,
  onArchive,
  onSearch,
  onReport,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-(--z-modal) bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ type: 'spring', damping: 26, stiffness: 360 }}
          className="absolute top-14 right-4 w-64 bg-[#1f2c34] border border-gray-700/60 rounded-2xl shadow-2xl p-1.5 z-[101] select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-0.5">
            {/* Select All / Deselect All */}
            {(onSelectAll || onDeselectAll) && (
              <button
                onClick={() => {
                  if (isAllSelected && onDeselectAll) {
                    onDeselectAll();
                  } else if (onSelectAll) {
                    onSelectAll();
                  }
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 text-white flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                <CheckSquare size={17} className="text-purple-400 shrink-0" />
                <span>{isAllSelected ? "Deselect all" : "Select all"}</span>
              </button>
            )}

            {/* Sparkle Priority */}
            {onTogglePriority && (
              <button
                onClick={() => {
                  onTogglePriority();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 text-white flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                <Star
                  size={17}
                  className={isPriority ? "text-amber-400 fill-amber-400 shrink-0" : "text-amber-400 shrink-0"}
                />
                <span>{isPriority ? "Remove Priority" : "⭐ Sparkle Priority"}</span>
              </button>
            )}

            {/* Sparkle Peek */}
            {selectedCount === 1 && onSparklePeek && (
              <button
                onClick={() => {
                  onSparklePeek();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 text-white flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                <Eye size={17} className="text-sky-400 shrink-0" />
                <span>👁 Sparkle Peek</span>
              </button>
            )}

            {/* Smart Recall */}
            {onSmartRecall && (
              <button
                onClick={() => {
                  onSmartRecall();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 text-white flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                <Sparkles size={17} className="text-pink-400 shrink-0" />
                <span>🚀 Smart Recall</span>
              </button>
            )}


            {selectedCount === 1 && onViewProfile && (
              <button
                onClick={() => {
                  onViewProfile();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 text-white flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                <User size={17} className="text-white/80 shrink-0" />
                <span>View Profile</span>
              </button>
            )}

            {onMarkUnread && (
              <button
                onClick={() => {
                  onMarkUnread();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 text-white flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                {isUnread ? (
                  <>
                    <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
                    <span>Mark as Read</span>
                  </>
                ) : (
                  <>
                    <Mail size={17} className="text-emerald-400 shrink-0" />
                    <span>Mark as Unread</span>
                  </>
                )}
              </button>
            )}

            {onFavorite && (
              <button
                onClick={() => {
                  onFavorite();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 text-white flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                <Sparkles
                  size={17}
                  className={isFavorite ? "text-purple-400 fill-purple-400 shrink-0" : "text-purple-400 shrink-0"}
                />
                <span>{isFavorite ? "Remove Favorite" : "Add to Favorites"}</span>
              </button>
            )}

            {onArchive && (
              <button
                onClick={() => {
                  onArchive();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 text-white flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                <Archive size={17} className="text-indigo-400 shrink-0" />
                <span>Archive</span>
              </button>
            )}

            {onSearch && (
              <button
                onClick={() => {
                  onSearch();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-white/10 text-white flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                <Search size={17} className="text-sky-400 shrink-0" />
                <span>Search Messages</span>
              </button>
            )}

            {onClearChat && (
              <button
                onClick={() => {
                  onClearChat();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-orange-500/20 text-orange-300 flex items-center gap-3 text-[14px] font-semibold transition-all text-left border-t border-gray-700/50 pt-2 mt-1"
              >
                <Eraser size={17} className="text-orange-400 shrink-0" />
                <span>Clear Chat</span>
              </button>
            )}

            {onBlock && (
              <button
                onClick={() => {
                  onBlock();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-rose-500/20 text-rose-300 flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                <Ban size={17} className="text-rose-400 shrink-0" />
                <span>Block User</span>
              </button>
            )}

            {onReport && (
              <button
                onClick={() => {
                  onReport();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl hover:bg-rose-500/20 text-rose-300 flex items-center gap-3 text-[14px] font-semibold transition-all text-left"
              >
                <Flag size={17} className="text-rose-400 shrink-0" />
                <span>Report</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

