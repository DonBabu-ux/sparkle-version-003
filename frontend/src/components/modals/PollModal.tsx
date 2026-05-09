import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Plus, 
  Trash2, 
  BarChart3, 
  Sparkles, 
  Zap, 
  ArrowRight, 
  Globe, 
  Shield, 
  Clock,
  Layers
} from 'lucide-react';
import api from '../../api/api';
import Spinner from '../ui/Spinner';

interface PollModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function PollModal({ onClose, onSuccess }: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expiresIn, setExpiresIn] = useState('24h');
  const [allowInvites, setAllowInvites] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, '']);
    }
  };

  const updateOption = (index: number, val: string) => {
    const newOpts = [...options];
    newOpts[index] = val;
    setOptions(newOpts);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOpts = options.filter((_, i) => i !== index);
      setOptions(newOpts);
    }
  };

  const handleSubmit = async () => {
    const validOptions = options.map(o => o.trim()).filter(o => o !== '');
    if (!question.trim() || validOptions.length < 2) {
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/polls', {
        question,
        options: validOptions,
        is_anonymous: isAnonymous,
        expires_in: expiresIn,
        allow_invites: allowInvites
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Poll creation failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="w-full max-w-2xl bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_40px_120px_-20px_rgba(225,29,72,0.15)] border border-white/60 overflow-hidden relative"
    >
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-48 h-48 bg-amber-400/5 rounded-full blur-[60px] pointer-events-none" />

      {/* Header */}
      <div className="p-8 md:p-10 flex items-center justify-between border-b border-gray-50 relative z-10">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20">
            <BarChart3 size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-none uppercase">Create Poll</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mt-2">Start a conversation</p>
          </div>
        </div>
        <button 
          className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/5 transition-all active:scale-90" 
          onClick={onClose}
        >
          <X size={20} strokeWidth={3} />
        </button>
      </div>

      <div className="p-8 md:p-10 space-y-10 relative z-10 max-h-[70vh] overflow-y-auto no-scrollbar">
        {/* Question Area */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <Zap size={14} className="text-primary" />
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Poll Question</label>
          </div>
          <textarea
            className="w-full p-8 bg-gray-50/50 border-2 border-transparent rounded-2xl outline-none font-bold text-xl text-gray-900 placeholder:text-gray-300 focus:bg-white focus:border-primary/20 focus:shadow-xl focus:shadow-primary/5 transition-all min-h-[140px] resize-none leading-tight"
            placeholder="What should the collective decide?..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        {/* Options Area */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
             <Layers size={14} className="text-primary" />
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Poll Options</label>
          </div>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {options.map((opt, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex gap-3 items-center group"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder={`Option ${i + 1}`}
                      className="w-full p-5 bg-gray-50/50 border-2 border-transparent rounded-xl outline-none font-bold text-[15px] text-gray-800 placeholder:text-gray-300 focus:bg-white focus:border-primary/20 transition-all"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                    />
                    <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-1 h-6 bg-primary/20 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  </div>
                  {options.length > 2 && (
                    <button 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all" 
                      onClick={() => removeOption(i)}
                    >
                      <Trash2 size={20} strokeWidth={2.5} />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {options.length < 5 && (
              <button 
                className="w-full p-5 border-2 border-dashed border-gray-100 rounded-xl text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-center gap-3 hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all group" 
                onClick={addOption}
              >
                <Plus size={16} strokeWidth={3} className="group-hover:rotate-90 transition-transform" />
                Add Option
              </button>
            )}
          </div>
        </div>

        {/* Configurations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
           {/* Duration */}
           <div className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                 <Clock size={14} className="text-primary" />
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Voting Time</label>
              </div>
              <div className="flex flex-wrap gap-2">
                 {['1h', '12h', '24h', '3d', '7d'].map(time => (
                   <button
                     key={time}
                     onClick={() => setExpiresIn(time)}
                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border-2 ${expiresIn === time ? 'bg-gray-900 border-gray-900 text-white shadow-lg scale-105' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}
                   >
                     {time}
                   </button>
                 ))}
              </div>
           </div>

           {/* Settings Toggles */}
           <div className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                 <Shield size={14} className="text-primary" />
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Settings</label>
              </div>
              <div className="space-y-2">
                 <div 
                   className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl cursor-pointer hover:bg-gray-100/50 transition-all"
                   onClick={() => setIsAnonymous(!isAnonymous)}
                 >
                   <span className="text-[11px] font-bold text-gray-600 uppercase">Anonymous Poll</span>
                   <div className={`w-10 h-5 rounded-full transition-all flex items-center p-1 ${isAnonymous ? 'bg-primary' : 'bg-gray-200'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-all shadow-sm ${isAnonymous ? 'translate-x-5' : 'translate-x-0'}`} />
                   </div>
                 </div>
                 <div 
                   className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl cursor-pointer hover:bg-gray-100/50 transition-all"
                   onClick={() => setAllowInvites(!allowInvites)}
                 >
                   <span className="text-[11px] font-bold text-gray-600 uppercase">Allow Sharing</span>
                   <div className={`w-10 h-5 rounded-full transition-all flex items-center p-1 ${allowInvites ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-all shadow-sm ${allowInvites ? 'translate-x-5' : 'translate-x-0'}`} />
                   </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Submit Button */}
        <button 
          className="w-full py-6 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 hover:scale-[1.02] hover:shadow-primary/50 transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4 group mt-4 relative overflow-hidden" 
          onClick={handleSubmit} 
          disabled={submitting || !question.trim() || options.filter(o => o.trim()).length < 2}
        >
          <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          {submitting ? <Spinner size="medium" color="text-white" /> : (
            <>
                Create Poll
                <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-2 transition-transform" />
            </>
          )}
        </button>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </motion.div>
  );
}
