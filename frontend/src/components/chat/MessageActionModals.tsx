import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Copy, Trash2, MoreHorizontal, Pin, Edit2, Forward, Info, Plus, AlertTriangle } from 'lucide-react';
import { MessagePermissions } from '../../types/messagePermissions';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// Extended quick reactions for horizontal scrolling
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '💯', '✨', '🥺', '💀', '🙏', '🥰', '🎉', '🤡', '😭'];

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onMore: () => void;
  onReact: (emoji: string) => void;
  onOpenEmojiPicker: () => void;
  isMe: boolean;
  themeColor?: string;
  onForward?: () => void;
  permissions?: MessagePermissions;
}

export const MessageActionSheet: React.FC<ActionSheetProps> = ({
  isOpen, onClose, onReply, onCopy, onDelete, onMore, onReact, onOpenEmojiPicker, isMe, themeColor = "#ff1493", onForward, permissions
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[100]" 
            onClick={onClose} 
          />
          
          {/* Bottom Sheet */}
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-4 right-4 z-[101] flex flex-col items-center pb-4"
            style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            {/* Quick Reactions Pill */}
            <div className="bg-[#1e1e1e] rounded-[24px] mb-3 shadow-2xl shadow-black/50 border border-white/10 flex items-center overflow-hidden w-full max-w-[340px]">
              <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto no-scrollbar scroll-smooth snap-x">
                {QUICK_REACTIONS.map((emoji) => (
                  <button 
                    key={emoji}
                    onClick={() => onReact(emoji)}
                    className="text-3xl hover:scale-125 transition-transform active:scale-95 shrink-0 snap-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="shrink-0 flex items-center pr-3 pl-1 bg-gradient-to-r from-[#1e1e1e]/0 via-[#1e1e1e] to-[#1e1e1e]">
                <div className="w-px h-6 bg-white/10 mx-2" />
                <button 
                  onClick={onOpenEmojiPicker}
                  className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors active:scale-95 shrink-0"
                  style={{ color: themeColor }}
                >
                  <Plus size={22} strokeWidth={3} />
                </button>
              </div>
            </div>

            {/* Action Bar (Sleek Rectangle) */}
            <div className="bg-[#1e1e1e] w-full max-w-[340px] rounded-[16px] py-3 px-2 border border-white/10 flex justify-around shadow-2xl">
              <ActionButton icon={<Reply size={22} />} label="Reply" onClick={onReply} color={themeColor} />
              {(!permissions || permissions.canCopy !== false) && (
                <ActionButton icon={<Copy size={22} />} label="Copy" onClick={onCopy} color={themeColor} />
              )}
              {(!permissions || permissions.canForward !== false) && (
                <ActionButton icon={<Forward size={22} />} label="Forward" onClick={onForward} color={themeColor} />
              )}
              <ActionButton icon={<Trash2 size={22} />} label="Delete" onClick={onDelete} color="#ef4444" />
              <ActionButton icon={<MoreHorizontal size={22} />} label="More" onClick={onMore} color={themeColor} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

interface MoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPin: () => void;
  onEdit: () => void;
  onForward: () => void;
  onDetails: () => void;
  isPinned?: boolean;
  isMe?: boolean;
  onReport?: () => void;
  permissions?: MessagePermissions;
}

export const MessageMoreModal: React.FC<MoreModalProps> = ({
  isOpen, onClose, onPin, onEdit, onForward, onDetails, isPinned = false, isMe = false, onReport, permissions
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[110]" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: '-40%' }} 
            animate={{ opacity: 1, scale: 1, y: '-50%' }} 
            exit={{ opacity: 0, scale: 0.9, y: '-40%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-[#121b22]/95 backdrop-blur-xl rounded-2xl shadow-2xl z-[111] overflow-hidden border border-white/[0.08]"
          >
            <div className="flex flex-col py-1.5">
              {isMe ? (
                <>
                  <MoreOption 
                    icon={<Pin size={18} className={isPinned ? "text-[#ff1493]" : "text-white/60"} />} 
                    label={isPinned ? "Unpin Message" : "Pin Message"} 
                    onClick={onPin} 
                  />
                  <MoreOption icon={<Edit2 size={18} className="text-white/60" />} label="Edit Message" onClick={onEdit} />
                  {(!permissions || permissions.canForward !== false) && (
                    <MoreOption icon={<Forward size={18} className="text-white/60" />} label="Forward" onClick={onForward} />
                  )}
                  <div className="h-px bg-white/[0.06] my-1" />
                  <MoreOption icon={<Info size={18} className="text-white/60" />} label="Message Details" onClick={onDetails} />
                </>
              ) : (
                <>
                  <MoreOption 
                    icon={<AlertTriangle size={18} className="text-rose-500" />} 
                    label="Report" 
                    onClick={onReport} 
                  />
                  <MoreOption 
                    icon={<Pin size={18} className={isPinned ? "text-[#ff1493]" : "text-white/60"} />} 
                    label={isPinned ? "Unpin Message" : "Pin Message"} 
                    onClick={onPin} 
                  />
                  {(!permissions || permissions.canForward !== false) && (
                    <MoreOption icon={<Forward size={18} className="text-white/60" />} label="Forward" onClick={onForward} />
                  )}
                  <div className="h-px bg-white/[0.06] my-1" />
                  <MoreOption icon={<Info size={18} className="text-white/60" />} label="Message Details" onClick={onDetails} />
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const FullEmojiPickerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}> = ({ isOpen, onClose, onSelect }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[120]" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[75vh] bg-black rounded-t-[20px] z-[121] overflow-hidden flex flex-col shadow-2xl border-t border-white/10"
          >
            <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto my-3 shrink-0" />
            <div className="flex-1 w-full relative bg-black flex justify-center">
              <style dangerouslySetInnerHTML={{__html: `
                em-emoji-picker {
                  width: 100vw !important;
                  max-width: 100vw !important;
                  height: 100% !important;
                  --em-rgb-color: 255, 255, 255;
                  --em-color-border: transparent;
                  --em-bg-color: #000000;
                  background: #000000 !important;
                  border: none !important;
                  border-radius: 0 !important;
                }
                /* Hide native scrollbar but allow scrolling */
                em-emoji-picker::part(scroll), 
                em-emoji-picker::part(list),
                em-emoji-picker::part(scroll-container) {
                  scrollbar-width: none !important;
                  -ms-overflow-style: none !important;
                }
                em-emoji-picker::part(scroll)::-webkit-scrollbar,
                em-emoji-picker::part(list)::-webkit-scrollbar,
                em-emoji-picker::part(scroll-container)::-webkit-scrollbar {
                  display: none !important;
                  width: 0 !important;
                  height: 0 !important;
                }
              `}} />
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <Picker 
                  data={data} 
                  onEmojiSelect={(emoji: any) => onSelect(emoji.native)} 
                  theme="dark"
                  previewPosition="none"
                  skinTonePosition="none"
                  perLine={9}
                  style={{ width: '100%', maxWidth: '100%', border: 'none' }}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Sub-components
const ActionButton = ({ icon, label, onClick, color }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 active:scale-95 transition-transform p-2 w-[64px]">
    <div className="mb-0.5" style={{ color: color }}>
      {icon}
    </div>
    <span className="text-[11px] font-medium text-white">{label}</span>
  </button>
);

const MoreOption = ({ icon, label, onClick }: any) => (
  <button onClick={onClick} className="flex items-center gap-4 w-full px-6 py-3.5 hover:bg-white/5 active:bg-white/10 transition-colors">
    <div className="text-[#888888]">
      {icon}
    </div>
    <span className="text-[15px] font-medium text-white">{label}</span>
  </button>
);
