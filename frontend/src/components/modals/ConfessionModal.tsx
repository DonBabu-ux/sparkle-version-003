import { useState } from 'react';
import { X, Flame, Snowflake, Ghost, Send, Loader2 } from 'lucide-react';
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
    fire: { icon: <Flame size={20} />, label: 'Hot Take', color: '#ff9800', bg: 'rgba(255,152,0,0.1)' },
    ice: { icon: <Snowflake size={20} />, label: 'Cold Truth', color: '#03a9f4', bg: 'rgba(3,169,244,0.1)' },
    ghost: { icon: <Ghost size={20} />, label: 'Deep Secret', color: '#9c27b0', bg: 'rgba(156,39,176,0.1)' }
  };

  return (
    <div className="modal-inner">
      <div className="modal-header">
        <div className="modal-title">
          <i className="fas fa-fire" style={{color: themes[subType].color}}></i> Anonymous Confessions
        </div>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="modal-body" style={{background: themes[subType].bg}}>
        <div className="theme-selector">
          {(Object.keys(themes) as Array<keyof typeof themes>).map(t => (
            <button 
              key={t} 
              className={`theme-btn ${subType === t ? 'active' : ''}`}
              onClick={() => setSubType(t)}
              style={{'--theme-color': themes[t].color} as React.CSSProperties}
            >
              {themes[t].icon}
              <span>{themes[t].label}</span>
            </button>
          ))}
        </div>

        <textarea
          className="confession-input"
          placeholder={`Share your ${themes[subType].label.toLowerCase()}... (Completely Anonymous)`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
        />

        <div className="anonymous-badge">
          <Ghost size={14} />
          <span>Your identity is 100% protected. No one will know it was you.</span>
        </div>

        <button 
          className="submit-confession-btn" 
          onClick={handleSubmit} 
          disabled={submitting}
          style={{background: themes[subType].color}}
        >
          {submitting ? <Loader2 className="animate-spin" /> : <>Ignite Confession <Send size={18} /></>}
        </button>
      </div>

      <style>{`
        .modal-inner { display: flex; flex-direction: column; height: 100%; border-radius: 28px; background: white; overflow: hidden; }
        .modal-header { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.05); background: white; z-index: 10; }
        .modal-title { font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; }
        .close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; }
        
        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; flex: 1; transition: background 0.3s ease; }
        
        .theme-selector { display: flex; gap: 10px; }
        .theme-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 16px; border: 2px solid transparent; background: white; color: #64748b; font-weight: 700; font-size: 0.75rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
        .theme-btn.active { border-color: var(--theme-color); color: var(--theme-color); transform: translateY(-2px); box-shadow: 0 10px 15px rgba(0,0,0,0.05); }

        .confession-input { width: 100%; padding: 20px; border-radius: 20px; border: 1px solid rgba(0,0,0,0.05); background: white; font-family: inherit; font-size: 1.1rem; resize: none; box-sizing: border-box; outline: none; transition: 0.2s; min-height: 200px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
        .confession-input:focus { box-shadow: inset 0 2px 8px rgba(0,0,0,0.05); }

        .anonymous-badge { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(0,0,0,0.05); border-radius: 12px; color: #64748b; font-size: 0.8rem; font-weight: 600; line-height: 1.4; }

        .submit-confession-btn { width: 100%; padding: 16px; border-radius: 16px; color: white; border: none; font-weight: 800; font-size: 1.05rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s; box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
        .submit-confession-btn:hover { transform: translateY(-2px); opacity: 0.9; }
        .submit-confession-btn:disabled { opacity: 0.7; }
      `}</style>
    </div>
  );
}
