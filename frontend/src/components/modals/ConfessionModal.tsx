import { useState } from 'react';
import { X, Flame, Snowflake, Ghost, Loader2, Orbit, Sparkles, ArrowRight } from 'lucide-react';
import api from '../../api/api';

interface ConfessionModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConfessionModal({ onClose, onSuccess }: ConfessionModalProps) {
  const [content, setContent] = useState('');
  const [subType, setSubType] = useState<'fire' | 'ice' | 'ghost'>('fire');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/confessions', { 
        content, 
        sub_type: subType,
        is_anonymous: true // Confessions are always anonymous by design
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Confession failed:', err);
      alert('Failed to share confession.');
    } finally {
      setSubmitting(false);
    }
  };

  const themes = {
    fire: { icon: <Flame size={20} />, label: 'HOT TAKE', color: 'text-primary' },
    ice: { icon: <Snowflake size={20} />, label: 'COLD TRUTH', color: 'text-black' },
    ghost: { icon: <Ghost size={20} />, label: 'DEEP SECRET', color: 'text-black/50' }
  };

  return (
    <div className="flex flex-col bg-white rounded-[64px] border-4 border-black shadow-[0_40px_120px_rgba(0,0,0,0.2)] overflow-hidden relative lowercase">
      <div className="absolute top-0 right-0 p-12 text-black/[0.01] pointer-events-none">
          <Orbit size={240} strokeWidth={1} className="animate-spin-slow" />
      </div>

      <div className="p-10 flex items-center justify-between border-b-4 border-black/5 bg-white relative z-10">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-white shadow-2xl">
            <Ghost size={24} strokeWidth={3} />
          </div>
          <div>
            <h3 className="font-heading font-black text-3xl text-black tracking-tighter uppercase italic leading-none">Whisper Vault</h3>
            <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] mt-2 italic">ZERO KNOWLEDGE PROXY</p>
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
        <div className="flex gap-4">
          {(Object.keys(themes) as Array<keyof typeof themes>).map(t => (
            <button 
              key={t} 
              className={`flex-1 flex flex-col items-center gap-4 p-6 rounded-[32px] border-4 transition-all duration-500 group ${subType === t ? 'border-primary bg-primary text-white shadow-2xl shadow-primary/30 scale-105' : 'border-black/5 bg-black/5 text-black/30 hover:border-black/10'}`}
              onClick={() => setSubType(t)}
            >
              <div className={`transition-transform duration-500 ${subType === t ? 'scale-125' : 'group-hover:scale-110'}`}>
                 {themes[t].icon}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-[0.3em] font-heading italic ${subType === t ? 'text-white' : ''}`}>{themes[t].label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 px-2">
            <Sparkles size={14} className="text-primary animate-pulse" />
            <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.3em] font-heading italic">ENCRYPTED PAYLOAD</label>
          </div>
          <textarea
            className="w-full p-10 bg-black/5 border-4 border-transparent rounded-[40px] outline-none font-black text-2xl text-black placeholder:text-black/5 focus:bg-white focus:border-black transition-all min-h-[220px] resize-none uppercase italic tracking-tighter leading-tight"
            placeholder={`SHARE YOUR ${themes[subType].label}...`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-6 p-8 bg-black/[0.02] rounded-[32px] border-4 border-black/5">
          <div className="w-12 h-12 bg-black/5 rounded-[18px] flex items-center justify-center text-black/20">
             <Ghost size={20} strokeWidth={3} />
          </div>
          <span className="text-[10px] font-black text-black/40 uppercase tracking-[0.4em] leading-relaxed italic">
            Identity shielded by 256-bit anonymity layer.
          </span>
        </div>

        <button 
          className="w-full py-8 mt-4 rounded-[40px] bg-black text-white font-black text-[15px] uppercase tracking-[0.5em] shadow-2xl hover:bg-primary transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-6 group font-heading italic"
          onClick={handleSubmit} 
          disabled={submitting}
        >
          {submitting ? <Loader2 className="animate-spin" /> : (
            <>
                FIRE FRAGMENT 
                <ArrowRight size={24} strokeWidth={4} className="group-hover:translate-x-3 transition-transform duration-500" />
            </>
          )}
        </button>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 45s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
