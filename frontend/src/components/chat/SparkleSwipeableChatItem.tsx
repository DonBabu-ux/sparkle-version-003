import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Archive, Trash2, Pin, Sparkles, VolumeX, Bookmark, Check, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { IdentityManager } from '../../utils/identityManager';
import { VerifiedBadge } from '../common/VerifiedBadge';
import { formatChatTimestamp } from '../../utils/format';
import { resolveChatListDisplay } from '../../utils/chatListDisplay';

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
  getStatusLabel?: (chat: any) => string;
  formatMessageText: (text: string) => string;
  typingUsers: { chatId: string; name: string }[];
  referenceTime?: number;
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
  referenceTime,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const archiveBg = useTransform(x, [0, 80], ['rgba(147, 51, 234, 0)', 'rgba(147, 51, 234, 0.4)']);
  const deleteBg = useTransform(x, [-80, 0], ['rgba(225, 29, 72, 0.4)', 'rgba(225, 29, 72, 0)']);
  const iconScale = useTransform(x, [-120, -50, 0, 50, 120], [1.3, 1, 0.8, 1, 1.3]);
  const actionOpacity = useTransform(x, [-130, -15, 0, 15, 130], [1, 0, 0, 0, 1]);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  const itemIdentity = IdentityManager.resolveIdentity(chat);
  const isSelfChat = chat.chat_type === 'self' || chat.partner_id === (user?.id || user?.user_id);
  const displayName = isSelfChat ? 'Saved Messages' : itemIdentity.displayName;

  const currentUserId = user?.id || user?.user_id;
  const displayInfo = resolveChatListDisplay({
    chat,
    currentUserId,
    referenceTime,
  });
  const hasUnreadIncoming = displayInfo.hasUnreadIncoming;

  // Reset swipe translation whenever selection mode changes
  useEffect(() => {
    if (isSelectionMode) {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 });
    }
  }, [isSelectionMode, x]);

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

  const resetSwipeState = () => {
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 });
  };

  const handleDragEnd = (_: any, info: any) => {
    const width = containerRef.current?.offsetWidth || 350;
    // 35% responsive threshold based on container width
    const threshold = Math.max(110, width * 0.35);

    if (info.offset.x > threshold) {
      resetSwipeState();
      onArchive();
    } else if (info.offset.x < -threshold) {
      resetSwipeState();
      onDelete();
    } else {
      // Tiny swipes < 35% spring back to 0 without triggering any action
      resetSwipeState();
    }
  };

  const timeLabel = formatChatTimestamp(chat.last_message_time || chat.last_message_at);

  return (
    <div ref={containerRef} className="relative overflow-hidden group select-none">
      {/* Background Swipe Actions Indicators - Opacity strictly 0 when unswiped */}
      <motion.div
        style={{ backgroundColor: archiveBg, opacity: actionOpacity }}
        className="absolute inset-0 flex items-center justify-start pl-6 z-0 pointer-events-none"
      >
        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2 text-purple-300 font-bold text-xs">
          <Archive size={20} />
          <span>Archive</span>
        </motion.div>
      </motion.div>

      <motion.div
        style={{ backgroundColor: deleteBg, opacity: actionOpacity }}
        className="absolute inset-0 flex items-center justify-end pr-6 z-0 pointer-events-none"
      >
        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2 text-rose-300 font-bold text-xs">
          <span>Delete</span>
          <Trash2 size={20} />
        </motion.div>
      </motion.div>

      {/* Foreground Flat Chat Item Row */}
      <motion.div
        drag={isSelectionMode ? false : "x"}
        dragDirectionLock={true}
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        style={{ x }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={resetSwipeState}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        onClick={() => {
          if (isSelectionMode) {
            onSelect();
          } else {
            onOpen();
          }
        }}
        className={clsx(
          "relative z-10 px-5 py-3.5 transition-all duration-150 cursor-pointer flex items-center gap-3.5 bg-[#13131a]",
          isSelected ? 'bg-[#ff1493]/15' : 'hover:bg-white/[0.02] active:bg-white/[0.04]',
          isPressing && 'scale-[0.99] opacity-90'
        )}
      >

        {/* Avatar / Presence / Selection checkmark badge */}
        <div className="relative shrink-0">
          {isSelected && (
            <div className="absolute -top-1 -left-1 z-20 w-5 h-5 bg-[#ff1493] rounded-full flex items-center justify-center text-white shadow-md animate-in zoom-in-75">
              <Check size={12} strokeWidth={3} />
            </div>
          )}
          {isSelfChat ? (
            <div className="w-[52px] h-[52px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Bookmark size={22} />
            </div>
          ) : (
            <img src={itemIdentity.avatar} className="w-[52px] h-[52px] rounded-full object-cover border border-white/10 shadow-md" alt="" />
          )}
          {itemIdentity.presence.showPresence && itemIdentity.presence.isOnline && !isSelfChat && !isSelected && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-[2.5px] border-[#13131a] rounded-full" />
          )}
        </div>


        {/* Content & Details */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex justify-between items-center mb-0.5">
            <h4 className={clsx(
              "text-[15px] tracking-tight truncate leading-tight flex items-center gap-1.5",
              hasUnreadIncoming ? 'font-black text-[#f5f5f5]' : 'font-semibold text-[#f5f5f5]/90'
            )}>
              {displayName}
              {!isSelfChat && (
                <VerifiedBadge accountType={itemIdentity.accountType} isVerified={itemIdentity.badge.show} color={itemIdentity.badge.color} size="xs" />
              )}
              {Boolean(chat.is_priority) && (
                <span className="inline-flex items-center text-amber-400" title="Sparkle Priority">
                  <Star size={13} className="fill-amber-400 text-amber-400 shrink-0" />
                </span>
              )}
              {Boolean(chat.is_pinned) && <Pin size={12} className="text-[#ff1493] fill-[#ff1493] shrink-0" />}
              {Boolean(chat.is_favorite) && (
                <span className="inline-flex items-center text-purple-400 animate-pulse">
                  <Sparkles size={13} className="fill-purple-400 shrink-0" />
                </span>
              )}
              {Boolean(chat.is_muted) && <VolumeX size={12} className="text-purple-400 shrink-0" />}
            </h4>

            {displayInfo.showUnreadEdgeDot && (
              <div
                className="w-2.5 h-2.5 rounded-full bg-[#ff1493] shrink-0 shadow-[0_0_8px_rgba(255,20,147,0.4)] ml-2"
                aria-label="Unread message indicator"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {(() => {
                const typingUser = typingUsers.find(t => t.chatId === chat.chat_id);
                if (typingUser) {
                  return (
                    <div className="flex items-center gap-1.5 truncate">
                      <p className="text-[13px] font-bold text-[#ff1493] italic truncate">
                        {typingUser.name ? `${typingUser.name} is typing • • •` : 'is typing • • •'}
                      </p>
                      <span className="text-[10px] font-bold text-white/20 lowercase shrink-0">· {timeLabel}</span>
                    </div>
                  );
                }

                if (displayInfo.mode === 'unread_summary') {
                  return (
                    <div className="flex items-center gap-1.5 truncate">
                      <p className="text-[13px] font-bold text-[#f5f5f5] truncate flex-1">
                        {displayInfo.unreadSummary}
                      </p>
                      <span className="text-[10px] font-bold text-white/30 lowercase shrink-0">· {timeLabel}</span>
                    </div>
                  );
                }

                const rawText = chat.last_message_type === 'attachment'
                  ? '🎬 Story reply'
                  : chat.last_message
                  ? formatMessageText(chat.last_message)
                  : 'Sent a photo';

                const previewText = displayInfo.senderPrefix ? `${displayInfo.senderPrefix}${rawText}` : rawText;

                return (
                  <div className="flex items-center gap-1.5 truncate">
                    <p className="text-[13px] font-normal text-[#f5f5f5]/60 truncate flex-1 min-w-0">
                      {previewText}
                    </p>
                    {displayInfo.middleLabel && (
                      <span className={clsx(
                        "text-[11px] shrink-0 font-medium",
                        displayInfo.middleLabel === 'Seen' ? "text-sky-400/90" :
                        displayInfo.middleLabel === 'Active now' ? "text-emerald-400/90" :
                        displayInfo.middleLabel === 'Failed' ? "text-rose-400/90" :
                        "text-white/50"
                      )}>
                        · {displayInfo.middleLabel}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-white/20 lowercase shrink-0">· {timeLabel}</span>
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


