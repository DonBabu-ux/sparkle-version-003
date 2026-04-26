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
      className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 min-w-[240px] max-w-[300px] flex flex-col items-center gap-5 cursor-grab active:cursor-grabbing group relative overflow-hidden"
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-3xl rounded-full -mr-12 -mt-12" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full -ml-12 -mb-12" />

      {/* Prompt Section */}
      <div className="flex flex-col items-center text-center relative z-10">
        <h3 className="text-[20px] font-black italic uppercase tracking-tighter text-black leading-none px-4 mb-5 pointer-events-none drop-shadow-sm">
          {config.prompt || 'Add yours'}
        </h3>
        
        {/* Avatars Stack (Premium Circular icons) */}
        <div className="flex items-center justify-center -space-x-4 mb-2 pointer-events-auto">
          <div 
            onClick={(e) => { e.stopPropagation(); onInteract?.({ action: 'respond' }); }}
            onPointerDownCapture={(e) => e.stopPropagation()}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-500 to-rose-600 flex items-center justify-center border-4 border-white text-white shadow-xl z-30 cursor-pointer hover:scale-110 active:scale-90 transition-all group/cam"
          >
             <Camera size={20} strokeWidth={3} className="group-hover/cam:rotate-12 transition-transform" />
          </div>
          {(config.avatars || []).slice(0, 3).map((av, i) => (
            <div key={i} className="w-12 h-12 rounded-full border-4 border-white overflow-hidden shadow-xl z-[20-i] bg-gray-100">
               <img 
                src={av || '/uploads/avatars/default.png'} 
                className="w-full h-full object-cover" 
                alt=""
              />
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-[1px] bg-black/5" />

      {/* Action Footer (Instagram-like interaction) */}
      <button 
        onClick={(e) => { e.stopPropagation(); onInteract?.({ action: 'respond' }); }}
        onPointerDownCapture={(e) => e.stopPropagation()}
        className="flex items-center gap-3 py-2 px-6 bg-rose-50 hover:bg-rose-100 rounded-full transition-all active:scale-95 z-10"
      >
         <Plus size={18} strokeWidth={4} className="text-rose-500" />
         <span className="text-[13px] font-black italic uppercase tracking-widest text-rose-500">Add yours</span>
      </button>

      {/* Response Count Overlay */}
      {config.responses_count !== undefined && config.responses_count > 0 && (
        <div className="absolute top-2 right-4 text-[10px] font-black text-black/20 italic uppercase tracking-widest">
           {config.responses_count >= 1000 ? (config.responses_count/1000).toFixed(1).replace('.0', '') + 'k' : config.responses_count} members
        </div>
      )}
    </motion.div>
  );
};

export default AddYoursSticker;
