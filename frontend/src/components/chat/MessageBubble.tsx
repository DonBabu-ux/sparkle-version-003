// src/components/chat/MessageBubble.tsx
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import { designTokens } from '../../theme/designTokens';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLongPress } from '../../hooks/useLongPress';

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

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isCurrentUser, onReply }) => {
  const editMessage = useChatStore((s) => s.editMessage);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);

  const canEdit = message.permissions?.canEdit ?? false;

  // Handlers for delete and forward actions
  const handleDeleteForMe = async () => {
    try {
      await fetch(`/api/messages/${message.message_id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forEveryone: false }),
      });
      const chatId = useChatStore.getState().activeConversationId as string;
      if (chatId) useChatStore.getState().deleteMessageLocal(chatId, message.message_id);
      setShowOverlay(false);
    } catch (err) {
      console.error('Delete for me failed', err);
    }
  };

  const handleDeleteForEveryone = async () => {
    try {
      await fetch(`/api/messages/${message.message_id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forEveryone: true, chatId: useChatStore.getState().activeConversationId }),
      });
      const chatId = useChatStore.getState().activeConversationId as string;
      if (chatId) useChatStore.getState().deleteMessageForEveryone(chatId, message.message_id, 'This message was deleted');
      setShowOverlay(false);
    } catch (err) {
      console.error('Delete for everyone failed', err);
    }
  };

  const handleForward = async () => {
    const targetChatIds = prompt('Enter comma‑separated chat IDs to forward to:');
    if (!targetChatIds) return;
    try {
      await fetch(`/api/messages/${message.message_id}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetChatIds: targetChatIds.split(',').map(id => id.trim()) }),
      });
      setShowOverlay(false);
    } catch (err) {
      console.error('Forward failed', err);
    }
  };

  const handleEdit = () => {
    if (draft.trim() && draft !== message.content) {
      const chatId = useChatStore.getState().activeConversationId as string;
      if (chatId) editMessage(chatId, message.message_id, draft);
    }
    setIsEditing(false);
  };

  // Close overlay when clicking outside the bubble
  useEffect(() => {
    if (!showOverlay) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.message-bubble')) {
        setShowOverlay(false);
        setShowMoreActions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showOverlay]);

  const longPressHandlers = useLongPress(() => setShowOverlay(true), 500);

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
        {/* Action Overlay */}
        {showOverlay && (
          <div className="absolute z-10 mt-2 p-2 bg-white dark:bg-gray-800 rounded shadow-lg flex flex-col space-y-1 min-w-[120px]">
            {/* Quick reactions */}
            {!showMoreActions && (
              <>
                <div className="flex space-x-2 mb-1">
                  <span className="cursor-pointer" role="img" aria-label="thumbs up">👍</span>
                  <span className="cursor-pointer" role="img" aria-label="heart">❤️</span>
                  <span className="cursor-pointer" role="img" aria-label="laugh">😂</span>
                  <span className="cursor-pointer" role="img" aria-label="clap">🙌</span>
                </div>
                <button className="text-sm text-left" onClick={() => setShowMoreActions(true)}>
                  More
                </button>
              </>
            )}
            {/* Expanded actions */}
            {showMoreActions && (
              <div className="flex flex-col text-sm space-y-1">
                <button onClick={() => setShowMoreActions(false)} className="text-left">
                  Back
                </button>
                {message.permissions?.canDeleteForMe && (
                  <button onClick={handleDeleteForMe} className="text-left text-red-600">
                    Delete for Me
                  </button>
                )}
                {message.permissions?.canDeleteForEveryone && (
                  <button onClick={handleDeleteForEveryone} className="text-left text-red-800">
                    Delete for Everyone
                  </button>
                )}
                {message.permissions?.canReply && (
                  <button onClick={() => onReply(message.message_id)} className="text-left">
                    Reply
                  </button>
                )}
                <button onClick={handleForward} className="text-left">
                  Forward
                </button>
              </div>
            )}
          </div>
        )}
    </div>
  );
};
