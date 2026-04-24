import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, BarChart3, Smile, Users, HelpCircle } from 'lucide-react';

interface StickerPickerProps {
  onSelect: (type: string, config: any) => void;
  onClose: () => void;
}

const StickerPicker: React.FC<StickerPickerProps> = ({ onSelect, onClose }) => {
  const stickerTypes = [
    { type: 'add_yours', icon: Camera, label: 'Add Yours', color: 'bg-primary', desc: 'Start a viral thread' },
    { type: 'poll', icon: BarChart3, label: 'Poll', color: 'bg-indigo-500', desc: 'Ask a question' },
    { type: 'reaction', icon: Smile, label: 'Reaction', color: 'bg-amber-500', desc: 'Quick feedback' },
    { type: 'avatar_loop', icon: Users, label: 'Activity', color: 'bg-black', desc: 'Show who is here' },
    { type: 'quiz', icon: HelpCircle, label: 'Quiz', color: 'bg-rose-500', desc: 'Test your friends' },
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative bg-white w-full sm:max-w-[420px] rounded-t-[40px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Immersive Header */}
        <div className="p-5 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-10">
           <div className="w-10 h-10" /> {/* Balance */}
           <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
           <button 
             onClick={onClose}
             className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-black hover:bg-gray-200 transition-all active:scale-90"
           >
             <X size={20} strokeWidth={3} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 grid grid-cols-2 gap-4 border-b border-gray-50">
            {stickerTypes.map((s) => (
              <button
                key={s.type}
                onClick={() => {
                  let config = {};
                  if (s.type === 'add_yours') config = { prompt: 'Add Yours', avatars: [], responses_count: 0 };
                  if (s.type === 'poll') config = { question: 'Ask a question...', options: ['Yes', 'No'], votes: [0, 0] };
                  if (s.type === 'reaction') config = { emoji: '🔥', count: 0 };
                  if (s.type === 'avatar_loop') config = { avatars: [], label: 'Active Now' };
                  if (s.type === 'quiz') config = { question: 'Quiz Title', options: ['A', 'B'], correct: 0 };
                  
                  onSelect(s.type, config);
                }}
                className="flex flex-col items-center gap-3 p-6 rounded-[24px] hover:bg-gray-50 transition-all border-2 border-transparent hover:border-black/5 active:scale-95 group"
              >
                <div className={`w-14 h-14 ${s.color} rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/10 group-hover:scale-110 transition-transform`}>
                  <s.icon size={28} strokeWidth={2.5} />
                </div>
                <div className="text-center">
                  <span className="text-[14px] font-black italic uppercase tracking-tight block">{s.label}</span>
                  <span className="text-[9px] font-bold text-black/30 uppercase tracking-widest">{s.desc}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="p-6 pb-12">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20 mb-6 px-2 italic">Big Emojis</p>
            <div className="grid grid-cols-4 gap-4 px-2">
              {[
                '🔥', '❤️', '😂', '😍', '✨', '🙌', '💯', '🚀', '🌈', '🍕',
                '💎', '🎉', '🌟', '🦄', '👻', '🍦', '🍩', '🥑', '🍍', '👑',
                '🦋', '🌸', '🌊', '⚡️', '🪐', '🎨', '🎸', '🕹️', '💸', '🧬',
                '🧸', '🎈', '🧿', '🍀', '🍄', '🍓', '🍿', '🥤', '🛹', '📸'
              ].map(emoji => (
                <button 
                  key={emoji}
                  onClick={() => onSelect('emoji', { emoji })}
                  className="text-4xl aspect-square flex items-center justify-center hover:bg-gray-100 rounded-2xl transition-all active:scale-50 hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StickerPicker;
