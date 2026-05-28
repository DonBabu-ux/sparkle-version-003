import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from '../../hooks/useDebounce';
import { useSelection } from '../../hooks/useSelection';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../hooks/useToast'; // assume toast hook exists
import ForwardHeader from '../components/forward/ForwardHeader';
import ForwardSearchBar from '../components/forward/ForwardSearchBar';
import ForwardSection from '../components/forward/ForwardSection';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { FixedSizeList as List } from 'react-window';

// Mock data - replace with real API call
const mockChats = Array.from({ length: 30 }, (_, i) => ({
  id: `chat-${i}`,
  name: `Chat ${i + 1}`,
  avatar: `https://i.pravatar.cc/40?img=${i + 1}`,
}));

interface ForwardMessageProps {
  isOpen: boolean;
  onClose: () => void;
  /** original message id to forward */
  forwardMessageId: string;
}

export const ForwardMessage: React.FC<ForwardMessageProps> = ({ isOpen, onClose, forwardMessageId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  const { selected, toggleSelect, clearSelection, count } = useSelection();
  const socket = useSocket();
  const toast = useToast();

  const filtered = mockChats.filter((c) => c.name.toLowerCase().includes(debouncedSearch.toLowerCase()));

  const handleForward = async () => {
    if (!count()) return;
    // Optimistic UI
    const ids = selected();
    clearSelection();
    toast.success('Message forwarded');
    try {
      const res = await fetch(`/api/forward/${forwardMessageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetChatIds: ids }),
      });
      if (!res.ok) throw new Error('Failed');
      // server will emit socket events; no further action needed
    } catch (e) {
      toast.error('Forward failed');
    }
  };

  // Listen for presence updates (example usage)
  useEffect(() => {
    if (!socket) return;
    const handlePresence = (data: any) => {
      // could update UI if needed
    };
    socket.on('presence:update', handlePresence);
    return () => {
      socket.off('presence:update', handlePresence);
    };
  }, [socket]);

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
          <div className="flex flex-col w-full max-w-md bg-white/5 backdrop-blur-xl shadow-2xl">
            <ForwardHeader onClose={onClose} selectionCount={count()} />
            <ForwardSearchBar value={searchTerm} onChange={setSearchTerm} />
            <div className="flex-1 overflow-hidden">
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    itemCount={filtered.length}
                    itemSize={60}
                    width={width}
                    itemData={{ items: filtered, selected, toggleSelect }}
                  >
                    {({ index, style, data }) => {
                      const chat = data.items[index];
                      const isSelected = data.selected.has(chat.id);
                      return (
                        <div style={style} key={chat.id} className="flex items-center px-4 py-2 hover:bg-white/5 transition-colors">
                          <img src={chat.avatar} alt={chat.name} className="w-10 h-10 rounded-full mr-3" />
                          <span className="flex-1 text-white truncate">{chat.name}</span>
                          {isSelected && (
                            <svg className="w-5 h-5 text-[#ff1493]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      );
                    }}
                  </List>
                )}
              </AutoSizer>
            </div>
            {count() > 0 && (
              <div className="p-3 border-t border-white/10 bg-white/5 backdrop-blur-sm flex justify-end">
                <button onClick={handleForward} className="px-4 py-2 bg-[#ff1493] text-white rounded-full hover:bg-[#e01482] transition-colors">
                  Forward ({count()})
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
