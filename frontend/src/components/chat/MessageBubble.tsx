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

  useEffect(() => {
    if (message.type && message.type !== 'text') {
      console.log(`[MEDIA_MESSAGE_RENDER] messageId=${message.message_id} type=${message.type}`);
    }
  }, [message.message_id, message.type]);

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
        ) : message.is_deleted_for_everyone ? (
          <span style={{ fontStyle: 'italic', color: '#888' }}>This message was deleted</span>
        ) : (message.type && message.type !== 'text') ? (
          <div className="media-bubble-content flex flex-col gap-2 min-w-[200px]">
            {/* Expired Media Notice */}
            {(message as any).media_status === 'DELETED' ? (
              <div className="flex flex-col items-center justify-center p-4 bg-black/40 rounded-lg text-center border border-white/10 select-none">
                <span className="text-xl mb-1">🕐</span>
                <span className="text-xs font-bold text-white/90">Media unavailable</span>
                <span className="text-[10px] text-white/50 mt-0.5">Request sender to resend</span>
                <button
                  onClick={() => fetch('/api/media/request-redelivery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaId: (message as any).media_id || message.message_id }) })}
                  className="mt-2 text-[10px] font-bold text-[#ff1493] underline hover:text-pink-400"
                >
                  Resend Request
                </button>
              </div>
            ) : isCurrentUser && ((message as any).status === 'sending' || (message as any).status === 'pending' || (message as any).status === 'uploading') ? (
              /* Sender Instant Optimistic Local Preview */
              <div className="relative rounded-lg overflow-hidden border border-white/10">
                {(message.media_url || (message as any).mediaUrl) ? (
                  <img src={message.media_url || (message as any).mediaUrl} alt="" className="w-full h-48 object-cover opacity-80" />
                ) : (
                  <div className="w-full h-36 bg-slate-800 flex items-center justify-center text-white/50 text-xs">Media Preview</div>
                )}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-1.5 text-xs text-white font-medium">
                  <span className="animate-spin text-sm">◷</span> Uploading...
                </div>
              </div>
            ) : (
              /* Media Card & Download Trigger */
              <div className="flex flex-col gap-1.5 p-2 bg-black/20 rounded-lg border border-white/10">
                <div className="flex items-center justify-between text-xs text-white/80 font-medium">
                  <span>{message.type === 'video' ? '🎥 Video' : message.type === 'audio' ? '🎤 Voice' : message.type === 'document' ? '📄 Document' : '📷 Photo'}</span>
                  <span className="text-[10px] opacity-60">{(message as any).mediaSize || '4.8 MB'}</span>
                </div>
                {(message.media_url || (message as any).mediaUrl) ? (
                  <img src={message.media_url || (message as any).mediaUrl} alt="" className="w-full h-44 object-cover rounded" />
                ) : (
                  <button
                    onClick={() => console.log('Downloading media payload:', message.message_id)}
                    className="w-full py-2 bg-[#ff1493]/20 hover:bg-[#ff1493]/30 border border-[#ff1493]/40 rounded text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>↓</span> Tap to Download
                  </button>
                )}
              </div>
            )}
            {message.content && <span className="text-sm mt-1">{message.content}</span>}
          </div>
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
          onCopy={() => {
            if (message.permissions?.canCopy === false) return;
            navigator.clipboard.writeText(message.content);
          }}
          onDeleteForMe={handleDeleteForMe}
          onDeleteForAll={handleDeleteForEveryone}
          onPin={handlePinToggle}
          onEdit={() => setIsEditing(true)}
          onForward={() => {
            if (message.permissions?.canForward === false) return;
            handleForward();
          }}
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

