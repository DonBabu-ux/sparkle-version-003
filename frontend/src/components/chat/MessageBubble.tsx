import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useMessageStore } from '../../store/messageStore';
import { designTokens } from '../../theme/designTokens';
import { X, Check, Pin, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLongPress } from '../../hooks/useLongPress';
import { MessageActionModal } from '../modals/MessageActionModal';
import { FullEmojiPickerModal } from './MessageActionModals';
import type { MessagePermissions } from '../../types/messagePermissions';

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
  const deleteMessageLocal = useChatStore((s) => s.deleteMessageLocal);
  const deleteMessageForEveryone = useChatStore((s) => s.deleteMessageForEveryone);
  const messageStore = useMessageStore();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const canEdit = message.permissions?.canEdit ?? false;

  const handleDeleteForMe = async () => {
    await messageStore.deleteForMe(message.message_id);
    const chatId = useChatStore.getState().activeConversationId as string;
    if (chatId) deleteMessageLocal(chatId, message.message_id);
  };

  const handleDeleteForEveryone = async () => {
    await messageStore.deleteForAll(message.message_id);
    const chatId = useChatStore.getState().activeConversationId as string;
    if (chatId) deleteMessageForEveryone(chatId, message.message_id, 'This message was deleted');
  };

  const handleForward = async () => {
    const targetChatIds = prompt('Enter comma‑separated chat IDs to forward to:');
    if (!targetChatIds) return;
    await messageStore.forwardMessage(message.message_id);
  };

  const handleEdit = async () => {
    if (draft.trim() && draft !== message.content) {
      const chatId = useChatStore.getState().activeConversationId as string;
      if (chatId) editMessage(chatId, message.message_id, draft);
    }
    setIsEditing(false);
  };

  const handlePinToggle = async () => {
    const newPinned = !(message.permissions?.pinned ?? false);
    await messageStore.pinMessage(message.message_id, newPinned);
    messageStore.updateMessage(message.message_id, { permissions: { ...(message.permissions as any), pinned: newPinned } } as any);
  };

  const longPressHandlers = useLongPress(() => setShowActionModal(true), 500);

  return (
    <div id={message.message_id} className="flex flex-col mb-3" style={{ alignItems: isCurrentUser ? 'flex-end' : 'flex-start' }}>
      <div
        className="message-bubble max-w-[60%] rounded-xl p-3 relative cursor-pointer"
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
            className="w-full h-20 p-2 rounded border text-black"
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
            <button onClick={() => setIsEditing(false)} className="px-2 py-1 text-sm rounded bg-gray-300 text-black">
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
        {/* Pin indicator */}
        {message.permissions?.pinned && (
          <Pin size={12} className="absolute top-1 left-1 text-[#ff1493]" />
        )}

        {/* Action Button trigger (three-dot menu) */}
        <button
          onClick={() => setShowActionModal(true)}
          className="absolute right-1 bottom-1 opacity-0 hover:opacity-100 message-bubble-actions text-white/50 hover:text-white transition-opacity"
        >
          <MoreHorizontal size={14} />
        </button>

        {/* Action Modals */}
        <MessageActionModal
          isOpen={showActionModal}
          onClose={() => setShowActionModal(false)}
          messageId={message.message_id}
          content={message.content}
          isMe={isCurrentUser}
          permissions={message.permissions}
          onReply={() => onReply(message.message_id)}
          onCopy={() => navigator.clipboard.writeText(message.content)}
          onDeleteForMe={handleDeleteForMe}
          onDeleteForAll={handleDeleteForEveryone}
          onPin={handlePinToggle}
          onEdit={() => setIsEditing(true)}
          onForward={handleForward}
          onReact={(emoji) => messageStore.reactMessage(message.message_id, emoji)}
          onOpenEmojiPicker={() => {
            setShowActionModal(false);
            setShowEmojiPicker(true);
          }}
        />

        <FullEmojiPickerModal
          isOpen={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onSelect={(emoji) => {
            messageStore.reactMessage(message.message_id, emoji);
            setShowEmojiPicker(false);
          }}
        />
      </div>
    </div>
  );
};

