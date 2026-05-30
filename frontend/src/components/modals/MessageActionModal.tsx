import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Copy, Trash2, Pin, Edit3, Forward, Info, Smile } from 'lucide-react';
import type { MessagePermissions } from '../../types/messagePermissions';

// Quick reactions
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '💯'];

interface MessageActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  content: string;
  isMe: boolean;
  permissions?: MessagePermissions;
  onReply: () => void;
  onCopy: () => void;
  onDeleteForMe: () => void;
  onDeleteForAll: () => void;
  onPin: () => void;
  onEdit: () => void;
  onForward: () => void;
  onReact: (emoji: string) => void;
  onOpenEmojiPicker: () => void;
}

export const MessageActionModal: React.FC<MessageActionModalProps> = ({
  isOpen,
  onClose,
  messageId,
  content,
  isMe,
  permissions,
  onReply,
  onCopy,
  onDeleteForMe,
  onDeleteForAll,
  onPin,
  onEdit,
  onForward,
  onReact,
  onOpenEmojiPicker,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-end justify-center sm:items-center p-4">
        {/* Glassmorphic backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-md select-none text-white z-10"
        >
          {/* Header & Quick Reactions */}
          {(!permissions || permissions.canReact !== false) && (
            <div className="mb-4">
              <p className="text-xs text-white/50 font-bold tracking-wider uppercase mb-2">Reactions</p>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReact(emoji);
                      onClose();
                    }}
                    className="text-2xl hover:scale-125 transition-transform active:scale-95 shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => {
                    onOpenEmojiPicker();
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center shrink-0"
                >
                  <Smile size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Action List */}
          <div className="space-y-1">
            <p className="text-xs text-white/50 font-bold tracking-wider uppercase mb-2">Actions</p>

            <ActionButton icon={<Reply size={16} />} label="Reply" onClick={() => { onReply(); onClose(); }} />
            <ActionButton icon={<Copy size={16} />} label="Copy Text" onClick={() => { onCopy(); onClose(); }} />

            {(!permissions || permissions.canPin !== false) && (
              <ActionButton
                icon={<Pin size={16} className={permissions?.pinned ? "text-[#ff1493]" : ""} />}
                label={permissions?.pinned ? "Unpin Message" : "Pin Message"}
                onClick={() => { onPin(); onClose(); }}
              />
            )}

            {isMe && (!permissions || permissions.canEdit !== false) && (
              <ActionButton icon={<Edit3 size={16} />} label="Edit Message" onClick={() => { onEdit(); onClose(); }} />
            )}

            {(!permissions || permissions.canForward !== false) && (
              <ActionButton icon={<Forward size={16} />} label="Forward" onClick={() => { onForward(); onClose(); }} />
            )}

            <div className="h-px bg-white/10 my-2" />

            {/* Delete Options */}
            {(!permissions || permissions.canDeleteForMe !== false) && (
              <ActionButton
                icon={<Trash2 size={16} className="text-red-400" />}
                label="Delete for Me"
                onClick={() => { onDeleteForMe(); onClose(); }}
                className="text-red-400 hover:bg-red-500/10"
              />
            )}

            {isMe && (!permissions || permissions.canDeleteForEveryone !== false) && (
              <ActionButton
                icon={<Trash2 size={16} className="text-red-500 font-bold" />}
                label="Delete for Everyone"
                onClick={() => { onDeleteForAll(); onClose(); }}
                className="text-red-500 hover:bg-red-500/20 font-bold"
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const ActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}> = ({ icon, label, onClick, className = "" }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 active:scale-98 transition-all text-sm text-left ${className}`}
  >
    <span className="opacity-70 shrink-0">{icon}</span>
    <span>{label}</span>
  </button>
);
