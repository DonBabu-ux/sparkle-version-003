import { useState } from 'react';
import { X, Plus, Trash2, Loader2, BarChart3, Orbit, Sparkles, Zap, ArrowRight } from 'lucide-react';
import api from '../../api/api';

interface PollModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function PollModal({ onClose, onSuccess }: PollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
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
      alert('Question and at least 2 options required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/polls', {
        question,
        options: validOptions,
        is_anonymous: isAnonymous
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Poll creation failed:', err);
      alert('Failed to launch poll.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col bg-white rounded-[64px] border-4 border-black shadow-[0_40px_120px_rgba(0,0,0,0.2)] overflow-hidden relative lowercase">
      <div className="absolute top-0 right-0 p-12 text-black/[0.01] pointer-events-none">
          <Orbit size={240} strokeWidth={1} className="animate-spin-slow" />
      </div>

      <div className="p-10 flex items-center justify-between border-b-4 border-black/5 bg-white relative z-10">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-white shadow-2xl">
            <BarChart3 size={24} strokeWidth={3} />
          </div>
          <div>
            <h3 className="font-heading font-black text-3xl text-black tracking-tighter uppercase italic leading-none">Pulse Poll</h3>
            <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] mt-2 italic">Seed Collective Consensus</p>
          </div>
        </div>
        <button 
          className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center text-black/10 hover:text-black hover:bg-black/10 transition-all active:rotate-90" 
          onClick={onClose}
        >
          <X size={24} strokeWidth={4} />
        </button>
      </div>

      <div className="p-10 space-y-12 relative z-10 max-h-[75vh] overflow-y-auto no-scrollbar">
        <div className="space-y-6">
          <div className="flex items-center gap-4 px-2">
            <Zap size={14} className="text-primary animate-pulse" />
            <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.3em] font-heading italic">Mission Statement</label>
          </div>
          <textarea
            className="w-full p-10 bg-black/5 border-4 border-transparent rounded-[40px] outline-none font-black text-2xl text-black placeholder:text-black/5 focus:bg-white focus:border-black transition-all min-h-[160px] resize-none uppercase italic tracking-tighter leading-tight"
            placeholder="WHAT IS THE CORE QUERY?..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 px-2">
             <Sparkles size={14} className="text-primary" />
             <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.3em] font-heading italic">Domain Parameters</label>
          </div>
          <div className="space-y-4">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-4 items-center group relative">
                <input
                  type="text"
                  placeholder={`PARAMETER ${i + 1}`}
                  className="flex-1 p-6 bg-black/5 border-2 border-transparent rounded-[24px] outline-none font-black text-[15px] text-black placeholder:text-black/10 focus:bg-white focus:border-black transition-all uppercase italic tracking-tighter"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                />
                {options.length > 2 && (
                  <button className="p-4 text-black/10 hover:text-red-500 transition-colors" onClick={() => removeOption(i)}>
                    <Trash2 size={22} strokeWidth={3} />
                  </button>
                )}
              </div>
            ))}
            
            {options.length < 5 && (
              <button 
                className="w-full p-6 border-4 border-dashed border-black/5 rounded-[24px] text-[11px] font-black text-black/20 uppercase tracking-[0.4em] flex items-center justify-center gap-4 hover:border-black hover:text-black transition-all font-heading italic group" 
                onClick={addOption}
              >
                <Plus size={18} strokeWidth={4} className="group-hover:rotate-180 transition-transform duration-500" />
                EXPAND SPECTRUM
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-8 bg-black/[0.02] rounded-[32px] border-4 border-black/5">
          <div className="flex flex-col">
             <span className="text-[11px] font-black text-black uppercase tracking-[0.2em] font-heading italic">Stealth Protocol</span>
             <span className="text-[9px] font-black text-black/20 uppercase tracking-[0.1em] mt-1">Hide Identity Metadata</span>
          </div>
          <div 
            className={`w-16 h-8 flex items-center p-1 rounded-full cursor-pointer transition-all duration-700 ${isAnonymous ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-black/10'}`} 
            onClick={() => setIsAnonymous(!isAnonymous)}
          >
            <div className={`w-6 h-6 bg-white rounded-full transition-all duration-500 shadow-xl ${isAnonymous ? 'translate-x-8' : 'translate-x-0'}`}></div>
          </div>
        </div>

        <button 
          className="w-full py-8 mt-4 rounded-[40px] bg-black text-white font-black text-[15px] uppercase tracking-[0.5em] shadow-2xl hover:bg-primary transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-6 group font-heading italic" 
          onClick={handleSubmit} 
          disabled={submitting}
        >
          {submitting ? <Loader2 className="animate-spin" /> : (
            <>
                LAUNCH SPECTRUM 
                <ArrowRight size={24} strokeWidth={4} className="group-hover:translate-x-3 transition-transform duration-500" />
            </>
          )}
        </button>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 40s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
