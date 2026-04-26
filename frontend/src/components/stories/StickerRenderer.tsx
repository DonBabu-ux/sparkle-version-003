import React, { useRef, FC, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useGesture } from '@use-gesture/react';
import AddYoursSticker from './AddYoursSticker';
import PollSticker from './PollSticker';
import ReactionSticker from './ReactionSticker';
import AvatarLoopSticker from './AvatarLoopSticker';

interface Sticker {
  id: string;
  type: 'add_yours' | 'poll' | 'reaction' | 'avatar_loop' | 'quiz' | 'slider' | 'emoji' | 'mention';
  config: any;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface StickerRendererProps {
  stickers: Sticker[];
  isEditing?: boolean;
  onInteract?: (stickerId: string, data: any) => void;
  onUpdate?: (stickerId: string, updates: any) => void;
  onDelete?: (stickerId: string) => void;
}

const StickerItem: FC<{ 
  sticker: Sticker; 
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
        if (!isEditing) return;
        x.set(dx);
        y.set(dy);
      },
      onPinch: ({ offset: [s, r] }) => {
        if (!isEditing) return;
        scale.set(s);
        rotate.set(r);
      },
      onDragEnd: ({ offset: [dx, dy] }) => {
        if (!isEditing || !containerRef.current) return;
        const container = containerRef.current.getBoundingClientRect();
        
        // Convert to percentage for persistence
        const newX = ((dx + (sticker.x / 100) * container.width) / container.width) * 100;
        const newY = ((dy + (sticker.y / 100) * container.height) / container.height) * 100;
        
        onUpdate?.(sticker.id, { x: newX, y: newY });
      },
      onPinchEnd: ({ offset: [s, r] }) => {
        if (!isEditing) return;
        onUpdate?.(sticker.id, { scale: s, rotation: r });
      }
    },
    {
      drag: { from: () => [0, 0] },
      pinch: { scaleBounds: { min: 0.5, max: 3 }, from: () => [scale.get(), rotate.get()] }
    }
  );

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
        zIndex: active ? 50 : 20,
      }}
      onPointerDown={() => setActive(true)}
      onPointerUp={() => setActive(false)}
      className={`pointer-events-auto ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="relative group">
        {renderStickerContent(sticker, onInteract)}
        
        {isEditing && (
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

const renderStickerContent = (sticker: Sticker, onInteract?: (id: string, data: any) => void) => {
  switch (sticker.type) {
    case 'add_yours':
      return <AddYoursSticker config={sticker.config} onInteract={(data) => onInteract?.(sticker.id, data)} />;
    case 'poll':
      return <PollSticker config={sticker.config} onInteract={(data) => onInteract?.(sticker.id, data)} />;
    case 'reaction':
      return <ReactionSticker config={sticker.config} onInteract={(data) => onInteract?.(sticker.id, data)} />;
    case 'avatar_loop':
      return <AvatarLoopSticker config={sticker.config} />;
    case 'mention':
      return (
        <div className="bg-white/95 backdrop-blur-3xl px-6 py-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 flex items-center gap-2 min-w-[120px] justify-center">
          <span className="text-primary font-black italic uppercase tracking-tighter text-[20px]">@</span>
          <span className="text-black font-black italic uppercase tracking-tighter text-[20px]">{sticker.config.username}</span>
        </div>
      );
    case 'emoji':
      return <div className="text-[80px] drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] select-none leading-none">{sticker.config.emoji}</div>;
    default:
      return null;
  }
};

export default StickerRenderer;
