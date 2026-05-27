import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search } from 'lucide-react';

// Mock data - replace with real chat list API
const mockChats = Array.from({ length: 30 }, (_, i) => ({
  id: `chat-${i}`,
  name: `Chat ${i + 1}`,
  avatar: `https://i.pravatar.cc/40?img=${i + 1}`,
}));

interface ForwardMessageProps {
  /**
   * Controls whether the forward page is visible.
   */
  isOpen: boolean;
  /**
   * Called when the user taps the back button or outside the page.
   */
  onClose: () => void;
  /**
   * Called with an array of selected chat ids when the user confirms forwarding.
   */
  onForward: (selectedChatIds: string[]) => void;
}

/**
 * ForwardMessage – a fullscreen slide‑in page that mirrors the forwarding flow of modern messaging apps.
 * It features:
 *   • Header with back button and title (optionally shows selection count).
 *   • Search bar with real‑time filtering.
 *   • Scrollable list of chats with selectable rows.
 *   • Bottom action bar showing the forward button when at least one chat is selected.
 */
export const ForwardMessage: React.FC<ForwardMessageProps> = ({ isOpen, onClose, onForward }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = mockChats.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const handleForward = () => {
    if (selected.size) {
      onForward(Array.from(selected));
      setSelected(new Set());
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed inset-0 z-[200] bg-black/70 flex"
        >
          {/* Main page */}
          <div className="flex flex-col w-full max-w-md bg-[#1e1e1e] shadow-2xl">
            {/* Header */}
            <div className="flex items-center h-14 px-4 bg-[#111111] border-b border-white/10 sticky top-0 z-10">
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                <ArrowLeft size={20} className="text-white" />
              </button>
              <h2 className="flex-1 text-center text-lg font-medium text-white">
                {selected.size ? `Forward to ${selected.size} chat${selected.size > 1 ? 's' : ''}` : 'Forward Message'}
              </h2>
            </div>
            {/* Search */}
            <div className="p-3 bg-[#111111] border-b border-white/10">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                <input
                  type="text"
                  placeholder="Search chats, groups, users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-[#222222] rounded-full text-sm text-white placeholder-white/40 focus:outline-none"
                />
              </div>
            </div>
            {/* Chat list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => toggleSelect(chat.id)}
                  className="flex items-center w-full p-3 hover:bg-white/5 transition-colors"
                >
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    className="w-10 h-10 rounded-full mr-3 flex-shrink-0"
                  />
                  <span className="flex-1 text-left text-white truncate">{chat.name}</span>
                  {selected.has(chat.id) && (
                    <svg
                      className="w-5 h-5 text-[#ff1493]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            {/* Bottom action */}
            {selected.size > 0 && (
              <div className="p-3 border-t border-white/10 bg-[#111111] flex justify-end">
                <button
                  onClick={handleForward}
                  className="px-4 py-2 bg-[#ff1493] text-white rounded-full hover:bg-[#e01482] transition-colors"
                >
                  Forward ({selected.size})
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
