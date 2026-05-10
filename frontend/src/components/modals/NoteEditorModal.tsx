import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { getAvatarUrl } from '../../utils/imageUtils';
import api from '../../api/api';

interface NoteEditorModalProps {
  initialNote?: string;
  onClose: () => void;
  onSuccess: (note: string | null) => void;
}

export default function NoteEditorModal({ initialNote = '', onClose, onSuccess }: NoteEditorModalProps) {
  const { user } = useUserStore();
  const [note, setNote] = useState(initialNote);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const maxLength = 60;

  const handleShare = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await api.patch('/users/profile/note', { note: note.trim() || null });
      if (res.data.success) {
        onSuccess(note.trim() || null);
      }
    } catch (err) {
      console.error('Failed to share note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50">
          <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-black transition-colors">
            <X size={20} />
          </button>
          <span className="font-black text-xs uppercase tracking-[0.2em] italic text-black/40">New Thought</span>
          <button 
            onClick={handleShare}
            disabled={isSubmitting || (note === initialNote)}
            className={`px-5 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all ${
              isSubmitting || (note === initialNote) 
              ? 'bg-gray-100 text-gray-400' 
              : 'bg-[#FF1F6D] text-white shadow-lg shadow-[#FF1F6D]/30 active:scale-95'
            }`}
          >
            {isSubmitting ? '...' : 'Share'}
          </button>
        </div>

        {/* Editor Area */}
        <div className="p-8 flex flex-col items-center gap-10">
          <div className="relative">
            {/* Thought Bubble */}
            <motion.div 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 z-10"
            >
              <div className="bg-white border border-gray-100 shadow-2xl rounded-[24px] p-4 relative group">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, maxLength))}
                  placeholder="Share what's on your mind..."
                  className="w-full bg-transparent border-none outline-none resize-none text-center text-sm font-bold text-black placeholder:text-black/20 h-12 leading-tight"
                  autoFocus
                />
                {/* Bubble Tail */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-gray-100 rotate-45" />
                
                {/* Character Count */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black text-black/20 uppercase tracking-widest">
                  {note.length} / {maxLength}
                </div>
              </div>
            </motion.div>

            {/* Profile Avatar */}
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#FF1F6D] to-purple-500 shadow-xl">
               <div className="w-full h-full rounded-full border-4 border-white overflow-hidden">
                  <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-full h-full object-cover" alt="" />
               </div>
            </div>
          </div>

          <div className="text-center mt-4">
             <h3 className="text-sm font-black text-black italic uppercase tracking-tight mb-2">Social Frequency</h3>
             <p className="text-[11px] font-medium text-black/40 max-w-[200px] leading-relaxed">
               Your note will be visible to your followers for 24 hours. Keep it short and sharp.
             </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="bg-gray-50/50 p-4 flex items-center justify-center gap-3">
           <Sparkles size={14} className="text-[#FF1F6D]" />
           <span className="text-[9px] font-black uppercase tracking-[0.3em] text-black/30 italic">High Fidelity Sync</span>
        </div>
      </motion.div>
    </div>
  );
}
