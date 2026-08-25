import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, Sparkles, X, User } from 'lucide-react';
import { IdentityManager } from '../../utils/identityManager';
import { useThemeStore } from '../../store/themeStore';

interface SparklePeekCardProps {
  chat: any | null;
  isOpen: boolean;
  onClose: () => void;
  onViewProfile?: () => void;
}

export const SparklePeekCard: React.FC<SparklePeekCardProps> = ({
  chat,
  isOpen,
  onClose,
  onViewProfile,
}) => {
  const currentTheme = useThemeStore((state) => state.currentTheme);
  const primaryColor = currentTheme?.colors?.primary || '#FF008A';

  if (!isOpen || !chat) return null;

  const identity = IdentityManager.resolveIdentity(chat);
  const username = chat.partner_username || chat.username || identity.displayName.toLowerCase().replace(/\s+/g, '');

  const getSubtleStatus = () => {
    if (chat.is_typing) return 'typing...';
    if (identity.presence.showPresence && identity.presence.isOnline) return 'online';
    if (chat.last_seen) return `last seen ${chat.last_seen}`;
    return 'last seen recently';
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[450] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="w-full max-w-sm bg-[#131122]/95 border border-white/15 rounded-3xl p-6 shadow-2xl overflow-hidden backdrop-blur-2xl relative select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle Shimmer Accent Line */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              backgroundImage: `linear-gradient(to right, transparent, ${primaryColor}, transparent)`,
            }}
          />

          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close card"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90"
          >
            <X size={16} />
          </button>

          {/* Clean Telegram/iMessage Header */}
          <div className="flex flex-col items-center text-center pt-2 pb-4">
            <div className="relative mb-4">
              <img
                src={identity.avatar}
                className="w-20 h-20 rounded-full object-cover border-2 border-white/20 shadow-2xl"
                alt={identity.displayName}
              />
              {identity.presence.showPresence && identity.presence.isOnline && (
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-[#131122] rounded-full shadow-md" />
              )}
            </div>

            {/* Conversation Name (18-20px, Semibold) */}
            <h3 className="text-xl font-semibold text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>{identity.displayName}</span>
              {chat.is_pinned && (
                <Pin size={15} className="text-[#FF008A] fill-[#FF008A] shrink-0" />
              )}
              {chat.is_favorite && (
                <Sparkles size={15} className="text-amber-400 fill-amber-400 shrink-0" />
              )}
            </h3>

            {/* Username (@handle) */}
            <p className="text-xs font-medium text-white/50 mt-0.5">
              @{username}
            </p>

            {/* Subtle Status (13-14px, 70% opacity) */}
            <p className="text-xs font-medium text-white/70 mt-2 capitalize">
              {getSubtleStatus()}
            </p>
          </div>

          {/* Sparkle Peek Message Preview Section */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 my-2 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                <span>👁</span> Sparkle Peek Preview
              </span>
              <span className="text-[10px] text-white/40 font-medium">Unread state preserved</span>
            </div>
            <p className="text-sm font-medium text-white/90 line-clamp-3 leading-relaxed">
              {chat.last_message || (chat.last_message_type === 'attachment' ? '🎬 Story reply / Media attachment' : 'No recent message text available.')}
            </p>
          </div>

          {/* Action Button */}
          {onViewProfile && (
            <button
              onClick={() => {
                onViewProfile();
                onClose();
              }}
              className="w-full mt-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-98 border border-white/10"
            >
              <User size={16} />
              <span>View Profile</span>
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

