import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Archive, Trash2, Pin, Sparkles, VolumeX, Bookmark } from 'lucide-react';
import { clsx } from 'clsx';
import { IdentityManager } from '../../utils/identityManager';
import { VerifiedBadge } from '../common/VerifiedBadge';
import { formatChatTimestamp } from '../../utils/format';

interface SparkleSwipeableChatItemProps {
  chat: any;
  isSelected: boolean;
  isSelectionMode: boolean;
  user: any;
  onSelect: () => void;
  onOpen: () => void;
  onLongPress: () => void;
  onArchive: () => void;
  onDelete: () => void;
  getStatusLabel: (chat: any) => string;
  formatMessageText: (text: string) => string;
  typingUsers: { chatId: string; name: string }[];
}

export const SparkleSwipeableChatItem: React.FC<SparkleSwipeableChatItemProps> = ({
  chat,
  isSelected,
  isSelectionMode,
  user,
  onSelect,
  onOpen,
  onLongPress,
  onArchive,
  onDelete,
  getStatusLabel,
  formatMessageText,
  typingUsers,
}) => {
  const x = useMotionValue(0);
  const archiveBg = useTransform(x, [0, 80], ['rgba(147, 51, 234, 0)', 'rgba(147, 51, 234, 0.4)']);
  const deleteBg = useTransform(x, [-80, 0], ['rgba(225, 29, 72, 0.4)', 'rgba(225, 29, 72, 0)']);
  const iconScale = useTransform(x, [-100, -40, 0, 40, 100], [1.3, 1, 0.8, 1, 1.3]);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  const itemIdentity = IdentityManager.resolveIdentity(chat);
  const isSelfChat = chat.chat_type === 'self' || chat.partner_id === (user?.id || user?.user_id);
  const displayName = isSelfChat ? 'Saved Messages' : itemIdentity.displayName;

  const handleTouchStart = () => {
    setIsPressing(true);
    pressTimer.current = setTimeout(() => {
      onLongPress();
      setIsPressing(false);
    }, 350);
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    setIsPressing(false);
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 90) {
      onArchive();
    } else if (info.offset.x < -90) {
      onDelete();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl mb-1.5 group select-none">
      {/* Background Swipe Actions Indicators */}
      <motion.div
        style={{ backgroundColor: archiveBg }}
        className="absolute inset-0 flex items-center justify-start pl-5 z-0"
      >
        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2 text-purple-300 font-bold text-xs">
          <Archive size={20} />
          <span>Archive</span>
        </motion.div>
      </motion.div>

      <motion.div
        style={{ backgroundColor: deleteBg }}
        className="absolute inset-0 flex items-center justify-end pr-5 z-0"
      >
        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2 text-rose-300 font-bold text-xs">
          <span>Delete</span>
          <Trash2 size={20} />
        </motion.div>
      </motion.div>

      {/* Foreground Swipeable Card */}
      <motion.div
        drag={isSelectionMode ? false : "x"}
        dragConstraints={{ left: -110, right: 110 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ x }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onClick={() => {
          if (isSelectionMode) {
            onSelect();
          } else {
            onOpen();
          }
        }}
        className={clsx(
          "relative z-10 px-4 py-2 rounded-2xl transition-colors duration-200 cursor-pointer flex items-center gap-3 border border-transparent",
          isSelected ? 'bg-white/15 border-[#ff1493]/40' : 'bg-[#181824]/90 hover:bg-white/10',
          isPressing && 'scale-[0.98]'
        )}
      >
        {/* Avatar / Presence */}
        <div className="relative shrink-0">
          {isSelfChat ? (
            <div className="w-[52px] h-[52px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Bookmark size={22} />
            </div>
          ) : (
            <img src={itemIdentity.avatar} className="w-[52px] h-[52px] rounded-full object-cover border border-white/10 shadow-md" alt="" />
          )}
          {itemIdentity.presence.showPresence && itemIdentity.presence.isOnline && !isSelfChat && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-[3px] border-[#181824] rounded-full" />
          )}
        </div>

        {/* Content & Details */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex justify-between items-center mb-0.5">
            <h4 className={clsx(
              "text-[15px] tracking-tight truncate leading-tight flex items-center gap-1.5",
              chat.unread_count > 0 ? 'font-black text-[#f5f5f5]' : 'font-semibold text-[#f5f5f5]/90'
            )}>
              {displayName}
              {!isSelfChat && (
                <VerifiedBadge accountType={itemIdentity.accountType} isVerified={itemIdentity.badge.show} color={itemIdentity.badge.color} size="xs" />
              )}
              {chat.is_pinned && <Pin size={12} className="text-[#ff1493] fill-[#ff1493] shrink-0" />}
              {chat.is_favorite && (
                <span className="inline-flex items-center text-amber-400 animate-pulse">
                  <Sparkles size={13} className="fill-amber-400" />
                </span>
              )}
              {chat.is_muted && <VolumeX size={12} className="text-purple-400 shrink-0" />}
            </h4>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {chat.unread_count > 1 ? (
                <div className="flex items-center gap-1.5 truncate">
                  <p className="text-[13px] font-black text-[#ff1493] lowercase">
                    {chat.unread_count > 4 ? '4+ new messages' : `${chat.unread_count} new messages`}
                  </p>
                  <span className="text-[10px] font-bold text-white/20 lowercase shrink-0">· {getTimeAgo(chat.last_message_time || chat.last_message_at)}</span>
                </div>
              ) : chat.unread_count === 1 ? (
                <div className="flex items-center gap-1.5 truncate">
                  <p className="text-[13px] font-bold text-[#f5f5f5] truncate flex-1">
                    {chat.last_message_type === 'attachment' ? '🎬 Story reply' : chat.last_message ? formatMessageText(chat.last_message) : 'Sent a photo'}
                  </p>
                  <span className="text-[10px] font-bold text-white/20 lowercase shrink-0">· {getTimeAgo(chat.last_message_time || chat.last_message_at)}</span>
                </div>
              ) : (() => {
                const isTypingHere = typingUsers.some(t => t.chatId === chat.chat_id);
                const statusLabel = getStatusLabel(chat);
                const tsLabel = getTimeAgo(chat.last_message_time || chat.last_message_at);
                return (
                  <div className="flex items-center gap-1.5 truncate">
                    {isTypingHere ? (
                      <p className="text-[12px] font-bold text-[#ff1493] italic animate-pulse">Typing…</p>
                    ) : (
                      <p className="text-[12px] font-medium text-[#f5f5f5]/40 truncate lowercase">
                        {statusLabel}{statusLabel && tsLabel ? ' · ' : ''}{tsLabel}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
