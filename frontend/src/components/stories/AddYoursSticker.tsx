import React from 'react';
import { Camera, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

interface AddYoursStickerProps {
  config: {
    prompt: string;
    responses_count?: number;
    avatars?: string[];
  };
  onInteract?: (data: any) => void;
}

const AddYoursSticker: React.FC<AddYoursStickerProps> = ({ config, onInteract }) => {
  return (
    <motion.div 
      whileTap={{ scale: 0.95 }}
      className="bg-white rounded-[24px] p-5 shadow-2xl border border-black/5 min-w-[220px] max-w-[280px] flex flex-col items-center gap-4 cursor-grab active:cursor-grabbing group relative"
    >
      {/* Prompt Section */}
      <div className="flex flex-col items-center text-center">
        <h3 className="text-[18px] font-bold text-black leading-tight px-2 mb-3 pointer-events-none">
          {config.prompt || 'Add yours'}
        </h3>
        
        {/* Avatars Stack */}
        <div className="flex items-center justify-center -space-x-3 mb-1 pointer-events-auto">
          <div 
            onClick={(e) => { e.stopPropagation(); onInteract?.({ action: 'respond' }); }}
            onPointerDownCapture={(e) => e.stopPropagation()}
            className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center border-4 border-white text-white shadow-lg z-20 cursor-pointer hover:scale-110 transition-all"
          >
             <Camera size={18} strokeWidth={3} />
          </div>
          {(config.avatars || []).slice(0, 2).map((av, i) => (
            <img 
              key={i} 
              src={av || '/uploads/avatars/default.png'} 
              className="w-10 h-10 rounded-full border-4 border-white object-cover shadow-lg z-10" 
              alt=""
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-[1px] bg-gray-100" />

      {/* Action Footer - This is the interactive zone */}
      <div 
        onClick={(e) => { e.stopPropagation(); onInteract?.({ action: 'respond' }); }}
        onPointerDownCapture={(e) => e.stopPropagation()}
        className="flex items-center gap-2 py-1 cursor-pointer w-full justify-center hover:bg-gray-50 rounded-xl transition-all"
      >
         <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
            <Camera size={18} strokeWidth={3} />
         </div>
         <span className="text-[14px] font-black italic uppercase tracking-tighter text-blue-500/80 group-hover:text-blue-500 transition-colors">Add yours</span>
      </div>

      {/* Floating Response Count */}
      {config.responses_count > 0 && (
        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-white font-black text-[12px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] whitespace-nowrap tracking-wider">
           +{config.responses_count >= 1000 ? (config.responses_count/1000).toFixed(1).replace('.0', '') + 'k' : config.responses_count}
        </div>
      )}
    </motion.div>
  );
};

export default AddYoursSticker;
