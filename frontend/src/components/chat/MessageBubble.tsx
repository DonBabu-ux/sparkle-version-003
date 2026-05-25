// src/components/chat/MessageBubble.tsx
import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import { designTokens } from '../../theme/designTokens';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MessageBubbleProps {
  message: {
    message_id: string;
    sender_id: string;
    content: string;
    type?: string;
    media_url?: string;
    is_edited?: boolean;
    created_at?: string;
  };
  isCurrentUser: boolean;
  onReply: (msgId: string) => void;
}

// Helper to determine if edit button should be shown (5 min window)
const isEditable = (createdAt?: string) => {
  if (!createdAt) return false;
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  return (now - created) / 60000 <= 5;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isCurrentUser, onReply }) => {
  const editMessage = useChatStore((s) => s.editMessage);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [showEdit, setShowEdit] = useState(isEditable(message.created_at));

  const handleEdit = () => {
    if (draft.trim() && draft !== message.content) {
      editMessage(message.message_id, draft);
    }
    setIsEditing(false);
  };

  // Hide edit button after edit window expires
  useEffect(() => {
    if (!showEdit) return;
    const created = new Date(message.created_at ?? '').getTime();
    const remaining = Math.max(0, 5 * 60 * 1000 - (Date.now() - created));
    if (remaining <= 0) {
      setShowEdit(false);
      return;
    }
    const timer = setTimeout(() => setShowEdit(false), remaining);
    return () => clearTimeout(timer);
  }, [message.created_at, showEdit]);

  return (
    <div
      id={message.message_id}
      className="flex flex-col mb-3"
      style={{ alignItems: isCurrentUser ? 'flex-end' : 'flex-start' }}
    >
      <div
        className="max-w-[80%] rounded-xl p-3 relative"
        style={{
          backgroundColor: isCurrentUser ? designTokens.colors.accent : designTokens.colors.surface,
          color: isCurrentUser ? '#fff' : designTokens.colors.textPrimary,
        }}
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
        {/* Edited badge */}
        {message.is_edited && !isEditing && (
          <span
            style={designTokens.editBadge}
            className="absolute bottom-[-12px] right-0"
          >
            edited
          </span>
        )}
        {/* Edit button for own messages */}
        {isCurrentUser && showEdit && !isEditing && (
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
        {/* Save/Cancel when editing */}
        {isEditing && (
          <div className="flex justify-end mt-2 space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-2 py-1 text-sm rounded bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              className="px-2 py-1 text-sm rounded bg-blue-500 text-white"
            >
              Save
            </button>
          </div>
        )}
        {/* Reply indicator */}
        <button
          onClick={() => onReply(message.message_id)}
          className="absolute left-1 top-1 text-white/70 hover:text-white"
        >
          <Check size={14} />
        </button>
      </div>
    </div>
  );
};
