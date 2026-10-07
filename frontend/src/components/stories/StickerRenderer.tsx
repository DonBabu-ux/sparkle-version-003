import React, { useRef, FC, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { useGesture } from '@use-gesture/react';
import { Music3 } from 'lucide-react';
import AddYoursSticker from './AddYoursSticker';
import PollSticker from './PollSticker';
import ReactionSticker from './ReactionSticker';
import AvatarLoopSticker from './AvatarLoopSticker';

export interface StoryLayer {
  id: string;
  type: 'text' | 'music' | 'gif' | 'emoji' | 'mention' | 'poll' | 'drawing' | 'reaction' | 'add_yours' | 'avatar_loop' | 'location';
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity?: number;
  zIndex?: number;
  locked?: boolean;
  hidden?: boolean;
  data: any;
}

interface StickerRendererProps {
  stickers: StoryLayer[];
  isEditing?: boolean;
  onInteract?: (stickerId: string, data: any) => void;
  onUpdate?: (stickerId: string, updates: any) => void;
  onDelete?: (stickerId: string) => void;
}

const StickerItem: FC<{ 
  sticker: StoryLayer; 
  isEditing: boolean; 
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate?: (id: string, updates: any) => void;
  onInteract?: (id: string, data: any) => void;
  onDelete?: (id: string) => void;
}> = ({ sticker, isEditing, containerRef, onUpdate, onInteract, onDelete }) => {
  const [active, setActive] = useState(false);
  
  // Motion values for high-performance updates
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(sticker.scale || 1);
  const rotate = useMotionValue(sticker.rotation || 0);

  const bind = useGesture(
    {
      onDrag: ({ offset: [dx, dy] }) => {
        if (!isEditing || sticker.locked) return;
        x.set(dx);
        y.set(dy);
      },
      onPinch: ({ offset: [s, r] }) => {
        if (!isEditing || sticker.locked) return;
        scale.set(s);
        rotate.set(r);
      },
      onDragEnd: ({ offset: [dx, dy] }) => {
        if (!isEditing || sticker.locked || !containerRef.current) return;
        const container = containerRef.current.getBoundingClientRect();
        
        // Convert to percentage for persistence
        const newX = ((dx + (sticker.x / 100) * container.width) / container.width) * 100;
        const newY = ((dy + (sticker.y / 100) * container.height) / container.height) * 100;
        
        onUpdate?.(sticker.id, { x: newX, y: newY });
        // Persisted position now lives in sticker.x/y (left/top %) — clear the
        // transient drag offsets so the two don't double-apply on re-render.
        x.set(0);
        y.set(0);
      },
      onPinchEnd: ({ offset: [s, r] }) => {
        if (!isEditing || sticker.locked) return;
        onUpdate?.(sticker.id, { scale: s, rotation: r });
      }
    },
    {
      drag: { from: () => [0, 0] },
      pinch: { scaleBounds: { min: 0.5, max: 3 }, from: () => [scale.get(), rotate.get()] }
    }
  );

  if (sticker.hidden) return null;

  return (
    <motion.div
      {...(isEditing ? bind() : {})}
      style={{
        position: 'absolute',
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        x,
        y,
        scale,
        rotate,
        touchAction: 'none',
        zIndex: sticker.zIndex || (active ? 50 : 20),
        opacity: sticker.opacity !== undefined ? sticker.opacity : 1,
      }}
      onPointerDown={() => setActive(true)}
      onPointerUp={() => setActive(false)}
      className={`pointer-events-auto ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="relative group">
        {renderStickerContent(sticker, onInteract)}
        
        {isEditing && !sticker.locked && (
          <motion.button 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(sticker.id);
            }}
            className="absolute -top-6 -right-6 w-8 h-8 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white text-[14px] shadow-2xl active:scale-75 transition-all"
          >
            ✕
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

const StickerRenderer: FC<StickerRendererProps> = ({ 
  stickers, 
  isEditing = false,
  onInteract,
  onUpdate,
  onDelete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
      {stickers.map((sticker) => (
        <StickerItem 
          key={sticker.id}
          sticker={sticker}
          isEditing={isEditing}
          containerRef={containerRef}
          onUpdate={onUpdate}
          onInteract={onInteract}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

const renderStickerContent = (sticker: StoryLayer, onInteract?: (id: string, data: any) => void) => {
  const config = sticker.data || {};
  
  switch (sticker.type) {
    case 'add_yours':
      return <AddYoursSticker config={config} onInteract={(data) => onInteract?.(sticker.id, data)} />;
    case 'poll':
      return <PollSticker config={config} onInteract={(data) => onInteract?.(sticker.id, data)} />;
    case 'reaction':
      return <ReactionSticker config={config} onInteract={(data) => onInteract?.(sticker.id, data)} />;
    case 'avatar_loop':
      return <AvatarLoopSticker config={config} />;
    case 'mention': {
      const mentionUser = config.username || config.text || '';
      return (
        <div className="bg-white/95 backdrop-blur-3xl px-6 py-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 flex items-center gap-2 min-w-[120px] justify-center select-none">
          <span className="text-primary font-black italic uppercase tracking-tighter text-[20px]">@</span>
          <span className="text-black font-black italic uppercase tracking-tighter text-[20px]">{mentionUser}</span>
        </div>
      );
    }
    case 'emoji': {
      const emojiVal = config.emoji || config.text || '';
      return <div className="text-[80px] drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] select-none leading-none">{emojiVal}</div>;
    }
    case 'text':
      return (
        <div 
          className={`px-6 py-3 rounded-2xl text-center leading-tight shadow-xl whitespace-pre-wrap select-none ${config.font?.class || 'font-sans font-bold text-[24px]'}`}
          style={{
            color: config.color || '#FFFFFF',
            backgroundColor: config.highlight ? 'rgba(0,0,0,0.5)' : 'transparent',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)'
          }}
        >
          {config.text || ''}
        </div>
      );
    case 'music':
      return (
        <div className="bg-black/60 backdrop-blur-3xl p-4 rounded-3xl border border-white/20 flex items-center gap-3 min-w-[210px] shadow-2xl relative overflow-hidden text-white select-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md overflow-hidden shrink-0">
            {config.thumbnailUrl ? (
              <img src={config.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music3 size={18} className="text-white" />
            )}
          </div>
          <div className="flex flex-col flex-1 min-w-0 pr-2">
            <span className="text-[12px] font-black italic uppercase tracking-tight truncate">{config.title || 'Unknown Track'}</span>
            <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest truncate">{config.artist || 'Unknown Artist'}</span>
          </div>
          {/* Dynamic equalizer decoration */}
          <div className="flex gap-0.5 items-end h-4 pr-1 shrink-0">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-0.5 rounded-full bg-rose-500 animate-pulse"
                style={{
                  height: `${30 + Math.random() * 70}%`,
                  animationDuration: `${0.4 + Math.random() * 0.4}s`
                }}
              />
            ))}
          </div>
        </div>
      );
    case 'location':
      return (
        <div className="bg-white/90 backdrop-blur-3xl px-5 py-2.5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 flex items-center gap-2 select-none text-black font-black uppercase italic text-[12px]">
          📍 {config.name || 'Current Location'}
        </div>
      );
    default:
      return null;
  }
};

export default StickerRenderer;
