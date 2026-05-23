import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowLeft, Users } from 'lucide-react';

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact?: (contactId: string) => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({ isOpen, onClose, onSelectContact }) => {
  const [search, setSearch] = useState('');

  // Mock lists based on the reference image
  const frequentlyContacted = [
    { id: '1', name: 'Evon', status: '' },
    { id: '2', name: 'HEART 💜 SPACE 💖', status: 'Naty Leila, You' },
    { id: '3', name: 'Wanjiku Wangui', status: '' },
    { id: '4', name: '📞🍁eunice🎀🦋', status: '' },
    { id: '5', name: 'Kairo Community Digital Training 2025', status: 'Ajira, Gateri, hivatraders, joycwanjiku2, Naty Leila, Remmy, +...' },
  ];

  const recentChats = [
    { id: '6', name: 'Esther Baby Girl', status: '' },
    { id: '7', name: 'Naty Leila', status: '' },
    { id: '8', name: 'mem Eric', status: '' },
    { id: '9', name: 'KARU BLACK MARKET @## 2025/2026', status: '+254 103 166139, +254 115 285644, +254 115 984880, +254 ...' },
    { id: '10', name: 'NYÜMBA YA MÛMBI (Karatina University)', status: '+254 115 571587, +254 116 386944, +254 705 428668, +254 ...' },
    { id: '11', name: 'Campus Sprite Challenge Team Nelson', status: '+254 108 379091, +254 734 615730, +254 739 745466, +254 ...' },
    { id: '12', name: 'senior49 🗿', status: '' },
    { id: '13', name: 'dazzler🌜', status: '' },
    { id: '14', name: 'SCO COLLECTION', status: '+254 112 863759, +254 707 354751, +254 708 374345, +254 ...' },
    { id: '15', name: '🎧EAR BUDS/HEADPHONES 🎧 PLUG', status: '' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'tween', duration: 0.25 }}
          className="fixed inset-0 bg-[#0b141a] text-white z-[200] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center px-4 h-16 bg-[#0b141a] border-b border-gray-800">
            <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:bg-white/20">
              <ArrowLeft size={24} className="text-white" />
            </button>
            <h2 className="text-xl font-medium ml-4 flex-1">Forward to...</h2>
            <div className="flex items-center gap-4">
              <button className="p-2 rounded-full hover:bg-white/10 active:bg-white/20">
                <Users size={22} className="text-white" />
              </button>
              <button className="p-2 -mr-2 rounded-full hover:bg-white/10 active:bg-white/20">
                <Search size={22} className="text-white" />
              </button>
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto">
            {/* My Status */}
            <div className="px-4 py-3 flex items-center hover:bg-[#111b21] cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center relative flex-shrink-0">
                <div className="w-5 h-5 bg-[#0b141a] rounded-full absolute bottom-0 right-0 flex items-center justify-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[#0b141a] text-xs font-bold">+</div>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-[16px] font-medium text-[#e9edef]">My status</h3>
                <p className="text-[14px] text-[#8696a0]">My contacts +</p>
              </div>
              <div className="w-6 h-6 rounded-full border border-[#8696a0]" />
            </div>

            {/* Frequently Contacted */}
            <div className="px-4 py-2 mt-2">
              <span className="text-[14px] text-[#8696a0] font-medium">Frequently contacted</span>
            </div>
            {frequentlyContacted.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  onSelectContact?.(c.id);
                  onClose();
                }}
                className="px-4 py-3 flex items-center hover:bg-[#111b21] cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0 overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="ml-4 flex-1 overflow-hidden">
                  <h3 className="text-[16px] text-[#e9edef] truncate">{c.name}</h3>
                  {c.status && <p className="text-[14px] text-[#8696a0] truncate">{c.status}</p>}
                </div>
                <div className="w-6 h-6 rounded-full border border-[#8696a0] ml-2 flex-shrink-0" />
              </div>
            ))}

            {/* Recent Chats */}
            <div className="px-4 py-2 mt-2">
              <span className="text-[14px] text-[#8696a0] font-medium">Recent chats</span>
            </div>
            {recentChats.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  onSelectContact?.(c.id);
                  onClose();
                }}
                className="px-4 py-3 flex items-center hover:bg-[#111b21] cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0 overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="ml-4 flex-1 overflow-hidden">
                  <h3 className="text-[16px] text-[#e9edef] truncate">{c.name}</h3>
                  {c.status && <p className="text-[14px] text-[#8696a0] truncate">{c.status}</p>}
                </div>
                <div className="w-6 h-6 rounded-full border border-[#8696a0] ml-2 flex-shrink-0" />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
