import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, Sparkles, X, User } from 'lucide-react';
import { IdentityManager } from '../../utils/identityManager';

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
  if (!isOpen || !chat) return null;

  const identity = IdentityManager.resolveIdentity(chat);
  const username = chat.partner_username || chat.username || identity.displayName.toLowerCase().replace(/\s+/g, '');

  // Minimal peek card: identity row + last message + one action. Everything
  // else lives in the main chat — this window just answers "who is this and
  // what did they last say" without leaving the conversation list.
  const status = chat.is_typing
    ? 'typing…'
    : identity.presence.showPresence && identity.presence.isOnline
      ? 'online'
      : chat.last_seen
        ? `last seen ${chat.last_seen}`
        : '';
  const lastMessage = chat.last_message
    || (chat.last_message_type === 'attachment' ? 'Attachment' : '');

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-(--z-modal) bg-black/60 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-[280px] bg-[#1a1626]/95 border border-white/10 rounded-2xl p-4 shadow-xl relative select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center transition-all active:scale-90"
          >
            <X size={14} />
          </button>

          {/* Identity row */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src={identity.avatar}
                className="w-11 h-11 rounded-full object-cover border border-white/15"
                alt=""
              />
              {identity.presence.showPresence && identity.presence.isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#1a1626] rounded-full" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold text-white truncate flex items-center gap-1">
                <span className="truncate">{identity.displayName}</span>
                {Boolean(chat.is_pinned) && (
                  <Pin size={12} className="text-[#FF008A] fill-[#FF008A] shrink-0" />
                )}
                {Boolean(chat.is_favorite) && (
                  <Sparkles size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                )}
              </h3>
              <p className="text-[11px] text-white/50 truncate">
                @{username}{status ? ` · ${status}` : ''}
              </p>
            </div>
          </div>

          {/* Last message — two lines max */}
          {lastMessage && (
            <p className="mt-3 text-[13px] leading-snug text-white/80 line-clamp-2">
              {lastMessage}
            </p>
          )}

          {onViewProfile && (
            <button
              onClick={() => {
                onViewProfile();
                onClose();
              }}
              className="w-full mt-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-[13px] flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <User size={14} />
              <span>View Profile</span>
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

