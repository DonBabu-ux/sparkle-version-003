import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, BarChart3, Smile, Users, HelpCircle, TrendingUp, History, Zap } from 'lucide-react';
import InteractiveStickerSheet from './InteractiveStickerSheet';
import { isInteractiveStickerType, type InteractiveStickerType } from './interactiveStickers';
import GifPicker, { type GifItem } from './GifPicker';

/** A sticker the author already placed in this composing session. */
export interface RecentSticker {
  type: string;
  config: Record<string, unknown>;
}

interface StickerPickerProps {
  onSelect: (type: string, config: any) => void;
  onClose: () => void;
  /**
   * Stickers placed earlier in this session. Optional so every existing caller
   * compiles unchanged; absent/empty renders an honest empty state rather than
   * a fabricated list.
   */
  recentStickers?: RecentSticker[];
}

const StickerPicker: React.FC<StickerPickerProps> = ({ onSelect, onClose, recentStickers = [] }) => {
  const [activeCategory, setActiveCategory] = useState<'trending' | 'recent' | 'gifs'>('trending');
  const [editingType, setEditingType] = useState<InteractiveStickerType | null>(null);

  const categories = [
    { id: 'trending', label: 'Trending', icon: TrendingUp },
    { id: 'recent', label: 'Recent', icon: History },
    { id: 'gifs', label: 'GIFs', icon: Zap },
  ];

  const stickerTypes = [
    { type: 'add_yours', icon: Camera, label: 'Add Yours', color: 'bg-primary', desc: 'Start a viral thread' },
    { type: 'poll', icon: BarChart3, label: 'Poll', color: 'bg-indigo-500', desc: 'Ask a question' },
    { type: 'reaction', icon: Smile, label: 'Reaction', color: 'bg-amber-500', desc: 'Quick feedback' },
    { type: 'avatar_loop', icon: Users, label: 'Activity', color: 'bg-black', desc: 'Show who is here' },
    { type: 'quiz', icon: HelpCircle, label: 'Quiz', color: 'bg-rose-500', desc: 'Test your friends' },
  ];

  // Glyph shown for a recently placed sticker: its emoji when it has one,
  // otherwise a short badge for the sticker type.
  const RECENT_GLYPHS: Record<string, string> = {
    emoji: '😀',
    text: 'T',
    mention: '@',
    poll: '📊',
    quiz: '❓',
    add_yours: '📸',
    reaction: '🔥',
    avatar_loop: '👥',
    location: '📍',
    gif: 'GIF',
  };

  const recentGlyph = (sticker: RecentSticker): string => {
    const emoji = sticker.config?.emoji;
    if (typeof emoji === 'string' && emoji) return emoji;
    return RECENT_GLYPHS[sticker.type] ?? '•';
  };

  return (
    <div className="fixed inset-0 z-(--z-toast) flex items-end sm:items-center justify-center p-0 sm:p-4">
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
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white dark:bg-[#1b1b24] w-full sm:max-w-[440px] rounded-t-[40px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Mobile Handle */}
        <div className="p-4 flex flex-col items-center border-b border-gray-50 bg-white dark:bg-[#1b1b24] sticky top-0 z-10">
           <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />
           <div className="flex items-center justify-between w-full px-4">
              <h3 className="text-[16px] font-black italic uppercase tracking-tighter">Stickers</h3>
              <button 
                onClick={onClose}
                className="w-8 h-8 bg-gray-100 dark:bg-[#101217] rounded-full flex items-center justify-center text-[#18181b] dark:text-white active:scale-90"
              >
                <X size={16} strokeWidth={3} />
              </button>
           </div>
        </div>

        {/* Category Tabs */}
        <div className="flex px-6 py-4 gap-2 border-b border-gray-50 bg-gray-50/50 overflow-x-auto no-scrollbar">
           {categories.map((cat) => (
             <button
               key={cat.id}
               onClick={() => setActiveCategory(cat.id as any)}
               className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[11px] font-black italic uppercase tracking-tight transition-all whitespace-nowrap ${
                 activeCategory === cat.id 
                 ? 'bg-white text-primary shadow-sm border border-black/5' 
                 : 'text-black/40 hover:text-black/60'
               }`}
             >
               <cat.icon size={14} strokeWidth={3} />
               {cat.label}
             </button>
           ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeCategory === 'trending' && (
            <div className="p-6 grid grid-cols-2 gap-4">
              {stickerTypes.map((s) => (
                <button
                  key={s.type}
                  onClick={() => {
                    if (isInteractiveStickerType(s.type)) {
                      setEditingType(s.type);
                      return;
                    }

                    let config = {};
                    if (s.type === 'reaction') config = { emoji: '🔥', count: 0 };
                    if (s.type === 'avatar_loop') config = { avatars: [], label: 'Active Now' };

                    onSelect(s.type, config);
                  }}
                  className="flex flex-col items-center gap-3 p-6 rounded-[24px] bg-gray-50/50 hover:bg-gray-50 transition-all border-2 border-transparent hover:border-primary/10 active:scale-95 group"
                >
                  <div className={`w-14 h-14 ${s.color} rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/10 group-hover:scale-110 transition-transform`}>
                    <s.icon size={28} strokeWidth={2.5} />
                  </div>
                    <div className="text-center">
                      <span className="text-[14px] font-black italic uppercase tracking-tight block">{s.label}</span>
                      <span className="text-[11px] font-bold text-black/30 uppercase tracking-widest">{s.desc}</span>
                    </div>
                </button>
              ))}
            </div>
          )}

          {activeCategory === 'gifs' && (
            <GifPicker
              onClose={() => setActiveCategory('trending')}
              onSelect={(gif: GifItem) => {
                // Sticker payload mirrors GifPicker's shape: the animation url
                // plus the still frame, so the renderer never has to re-fetch.
                onSelect('gif', {
                  url: gif.url,
                  still: gif.still,
                  width: gif.width,
                  height: gif.height,
                  title: gif.title,
                });
                onClose();
              }}
            />
          )}

          {activeCategory === 'recent' && (
            <div className="p-6">
              {recentStickers.length === 0 ? (
                <div className="py-16 text-center opacity-40 flex flex-col items-center gap-4">
                  <History size={56} strokeWidth={2} className="opacity-40" />
                  <p className="font-black italic uppercase text-[12px]">Nothing placed yet</p>
                  <p className="text-[11px] font-bold normal-case tracking-normal max-w-[240px]">
                    Stickers you place in this session collect here so you can reuse them.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {recentStickers.map((sticker, i) => (
                    <button
                      key={`recent-${i}`}
                      onClick={() => {
                        onSelect(sticker.type, sticker.config);
                        onClose();
                      }}
                      className="aspect-square flex items-center justify-center rounded-2xl bg-gray-50/50 hover:bg-gray-100 active:scale-90 transition-all border border-black/5 dark:border-white/5"
                    >
                      <span className="text-3xl">{recentGlyph(sticker)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-6 pb-20">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-black/20 mb-6 px-2 italic">Standard Emojis</p>
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

      {/* Interactive sticker composer (poll / quiz / add yours) */}
      <AnimatePresence>
        {editingType && (
          <InteractiveStickerSheet
            key={`compose-${editingType}`}
            type={editingType}
            onCancel={() => setEditingType(null)}
            onConfirm={(config) => {
              onSelect(editingType, config);
              setEditingType(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StickerPicker;
