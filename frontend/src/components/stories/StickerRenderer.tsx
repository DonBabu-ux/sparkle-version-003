import React, { useRef, FC } from 'react';
import { motion } from 'framer-motion';
import AddYoursSticker from './AddYoursSticker';
import PollSticker from './PollSticker';
import ReactionSticker from './ReactionSticker';
import AvatarLoopSticker from './AvatarLoopSticker';

interface Sticker {
  id: string;
  type: 'add_yours' | 'poll' | 'reaction' | 'avatar_loop' | 'quiz' | 'slider' | 'emoji';
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
}

const StickerRenderer: FC<StickerRendererProps> = ({ 
  stickers, 
  isEditing = false,
  onInteract,
  onUpdate 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
      {stickers.map((sticker) => (
        <motion.div 
          key={sticker.id} 
          drag={isEditing}
          dragConstraints={containerRef}
          dragElastic={0.1}
          onDragEnd={(_, info) => {
            if (!isEditing || !containerRef.current) return;
            const container = containerRef.current.getBoundingClientRect();
            
            // Calculate percentage position within the container
            const x = ((info.point.x - container.left) / container.width) * 100;
            const y = ((info.point.y - container.top) / container.height) * 100;
            
            onUpdate?.(sticker.id, { x, y });
          }}
          initial={false}
          animate={{ 
            left: `${sticker.x}%`, 
            top: `${sticker.y}%`,
            scale: sticker.scale, 
            rotate: sticker.rotation 
          }}
          style={{
            position: 'absolute',
            x: "-50%",
            y: "-50%",
            pointerEvents: 'auto',
            touchAction: 'none',
          }}
          className={isEditing ? 'cursor-grab active:cursor-grabbing' : ''}
        >
          <div className="relative group">
            {renderStickerContent(sticker, onInteract)}
            {isEditing && (
              <div className="absolute -top-4 -right-4 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                ✕
              </div>
            )}
          </div>
        </motion.div>
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
    case 'emoji':
      return <div className="text-[80px] drop-shadow-2xl select-none">{sticker.config.emoji}</div>;
    default:
      return null;
  }
};

export default StickerRenderer;
