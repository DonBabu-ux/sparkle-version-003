// src/components/chat/MessageBubble.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { designTokens } from '../../theme/designTokens';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MessagePermissions {
  canEdit?: boolean;
  canDeleteForMe?: boolean;
  canDeleteForEveryone?: boolean;
  canReply?: boolean;
  canReact?: boolean;
  canPin?: boolean;
}

interface MessageBubbleProps {
  message: {
    message_id: string;
    sender_id: string;
    content: string;
    type?: string;
    media_url?: string;
    is_edited?: boolean;
    created_at?: string;
    permissions?: MessagePermissions;
  };
  isCurrentUser: boolean;
  onReply: (msgId: string) => void;
}

// Hook for long‑press detection
const useLongPress = (onLongPress: () => void, ms = 500) => {
  const timerRef = useRef<number>();
  const start = () => {
    // @ts-ignore
    timerRef.current = window.setTimeout(onLongPress, ms);
  };
  const cancel = () => {
    // @ts-ignore
    clearTimeout(timerRef.current);
  };
  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
  };
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isCurrentUser, onReply }) => {
  const editMessage = useChatStore((s) => s.editMessage);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [showOverlay, setShowOverlay] = useState(false);

  const canEdit = message.permissions?.canEdit ?? false;

  const handleEdit = () => {
    if (draft.trim() && draft !== message.content) {
      editMessage(message.message_id, draft);
    }
    setIsEditing(false);
  };

  const longPressHandlers = useLongPress(() => setShowOverlay(true), 500);

  // Close overlay when clicking outside the bubble
  useEffect(() => {
    if (!showOverlay) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.message-bubble')) {
        setShowOverlay(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showOverlay]);

  return (
    <div id={message.message_id} className="flex flex-col mb-3" style={{ alignItems: isCurrentUser ? 'flex-end' : 'flex-start' }}>
      <div
        className="message-bubble max-w-[60%] rounded-xl p-3 relative"
        style={{
          backgroundColor: isCurrentUser ? designTokens.colors.accent : designTokens.colors.surface,
          color: isCurrentUser ? '#fff' : designTokens.colors.textPrimary,
        }}
        {...longPressHandlers}
      >
        {isEditing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-20 p-2 rounded border"
            autoFocus
          />
        ) : (
          <span>{message.content}</span>
        )}
        {message.is_edited && !isEditing && (
          <span style={designTokens.editBadge} className="absolute bottom-[-12px] right-0">
            edited
          </span>
        )}
        {isCurrentUser && canEdit && !isEditing && (
          <AnimatePresence>
            <motion.button
              key="edit-btn"
              onClick={() => setIsEditing(true)}
              className="absolute top-1 right-1 text-white/70 hover:text-white"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
            >
              <X size={14} />
            </motion.button>
          </AnimatePresence>
        )}
        {isEditing && (
          <div className="flex justify-end mt-2 space-x-2">
            <button onClick={() => setIsEditing(false)} className="px-2 py-1 text-sm rounded bg-gray-300">
              Cancel
            </button>
            <button onClick={handleEdit} className="px-2 py-1 text-sm rounded bg-blue-500 text-white">
              Save
            </button>
          </div>
        )}
        <button onClick={() => onReply(message.message_id)} className="absolute left-1 top-1 text-white/70 hover:text-white">
          <Check size={14} />
        </button>
      </div>
      {showOverlay && (
        <div className="absolute z-10 mt-2 p-2 bg-white dark:bg-gray-800 rounded shadow-lg flex space-x-2">
          <span className="cursor-pointer">👍</span>
          <span className="cursor-pointer">❤️</span>
          <span className="cursor-pointer">😂</span>
          <span className="cursor-pointer">🙌</span>
          <button className="ml-2 text-sm" onClick={() => setShowOverlay(false)}>
            More
          </button>
        </div>
      )}
    </div>
  );
};
