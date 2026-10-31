import React, { useState } from 'react';
import { Camera, Check, Plus, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Spinner from '../ui/Spinner';
import { showError } from '../../utils/toast';
import { storyStickerApi } from '../../services/storyStickerApi';

interface AddYoursStickerProps {
  config: {
    prompt: string;
    responses_count?: number;
    avatars?: string[];
  };
  /** Layer id of this sticker inside the story_layers payload (the prompt id). */
  stickerId?: string;
  /** Story the sticker lives on. Without it a response cannot be recorded. */
  storyId?: string;
  onInteract?: (data: { action: 'respond'; content?: string }) => void;
}

const AddYoursSticker: React.FC<AddYoursStickerProps> = ({ config, stickerId, storyId, onInteract }) => {
  const [promptOpen, setPromptOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  // A response is stored against a story, so it only leaves the device when the
  // renderer handed us the story the sticker belongs to (the composer has none).
  const canRespond = Boolean(storyId && stickerId);

  const openPrompt = () => {
    onInteract?.({ action: 'respond' });
    if (!canRespond) return;
    setSent(false);
    setPromptOpen(true);
  };

  const closePrompt = () => {
    setPromptOpen(false);
    setDraft('');
  };

  const submitResponse = async () => {
    const content = draft.trim();
    if (!content || pending || !storyId || !stickerId) return;
    setPending(true);
    try {
      await storyStickerApi.respond(storyId, stickerId, content);
      onInteract?.({ action: 'respond', content });
      setDraft('');
      setPromptOpen(false);
      setSent(true);
    } catch {
      showError('Could not send your response');
    } finally {
      setPending(false);
    }
  };

  return (
    <motion.div 
      className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 min-w-[240px] max-w-[300px] flex flex-col items-center gap-5 cursor-grab active:cursor-grabbing group relative overflow-hidden"
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-3xl rounded-full -mr-12 -mt-12" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full -ml-12 -mb-12" />

      {/* Prompt Section */}
      <div className="flex flex-col items-center text-center relative z-10">
        <h3 className="text-[20px] font-black italic uppercase tracking-tighter text-[#18181b] dark:text-white leading-none px-4 mb-5 pointer-events-none drop-shadow-sm">
          {config.prompt || 'Add yours'}
        </h3>
        
        {/* Avatars Stack (Premium Circular icons) */}
        <div className="flex items-center justify-center -space-x-4 mb-2 pointer-events-auto">
          <div
            onClick={(e) => { e.stopPropagation(); openPrompt(); }}
            onPointerDownCapture={(e) => e.stopPropagation()}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-500 to-rose-600 flex items-center justify-center border-4 border-white text-white shadow-xl z-30 cursor-pointer hover:scale-110 active:scale-90 transition-all group/cam"
          >
             <Camera size={20} strokeWidth={3} className="group-hover/cam:rotate-12 transition-transform" />
          </div>
          {(config.avatars || []).slice(0, 3).map((av, i) => (
            <div key={i} className="w-12 h-12 rounded-full border-4 border-white overflow-hidden shadow-xl bg-gray-100 dark:bg-[#101217]" style={{ zIndex: 20 - i }}>
               <img 
                src={av || '/uploads/avatars/no-profile.png'}
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
      <AnimatePresence initial={false} mode="wait">
        {promptOpen ? (
          <motion.div
            key="response-prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="w-full flex flex-col gap-3"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitResponse();
                }
              }}
              placeholder="Type your response..."
              className="w-full resize-none bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-100 dark:border-rose-500/20 rounded-[20px] p-3 text-[13px] font-bold text-[#18181b] dark:text-white placeholder-rose-300 outline-none focus:border-rose-300 transition-all"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={closePrompt}
                className="flex-1 h-11 rounded-full bg-black/5 dark:bg-white/10 text-[11px] font-black italic uppercase tracking-widest text-black/50 dark:text-white/50 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={submitResponse}
                disabled={!draft.trim() || pending}
                className="flex-1 h-11 bg-primary text-white rounded-full flex items-center justify-center gap-2 text-[11px] font-black italic uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40"
              >
                {pending ? <Spinner size="small" color="#ffffff" /> : <><Send size={14} strokeWidth={3} /> Send</>}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex justify-center">
            <button
              onClick={(e) => { e.stopPropagation(); openPrompt(); }}
              onPointerDownCapture={(e) => e.stopPropagation()}
              className="flex items-center gap-3 py-2 px-6 bg-rose-50 hover:bg-rose-100 rounded-full transition-all active:scale-95 z-10"
            >
              {sent ? <Check size={18} strokeWidth={4} className="text-emerald-500" /> : <Plus size={18} strokeWidth={4} className="text-rose-500" />}
              <span className={`text-[13px] font-black italic uppercase tracking-widest ${sent ? 'text-emerald-500' : 'text-rose-500'}`}>
                {sent ? 'Sent' : 'Add yours'}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
