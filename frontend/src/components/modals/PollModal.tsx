import { useState } from 'react';
import { X, Plus, Trash2, Rocket, Loader2 } from 'lucide-react';
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
    <div className="modal-inner">
      <div className="modal-header">
        <div className="modal-title">
          <i className="fas fa-poll" style={{color: '#9c27b0'}}></i> Create New Poll
        </div>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="modal-body">
        <div className="input-group">
          <label>Poll Question</label>
          <textarea
            className="poll-textarea"
            placeholder="Ask a question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <div className="options-list">
          <label>Options (Max 5)</label>
          {options.map((opt, i) => (
            <div key={i} className="option-row">
              <input
                type="text"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
              />
              {options.length > 2 && (
                <button className="remove-opt" onClick={() => removeOption(i)}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          
          {options.length < 5 && (
            <button className="add-opt-btn" onClick={addOption}>
              <Plus size={16} /> Add Option
            </button>
          )}
        </div>

        <div className="footer-options">
          <label className="switch-label">
            <div className={`switch-pill ${isAnonymous ? 'on' : ''}`} onClick={() => setIsAnonymous(!isAnonymous)}>
              <div className="switch-knob"></div>
            </div>
            <span>Post Anonymously</span>
          </label>
        </div>

        <button className="submit-poll-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <>Launch Poll <Rocket size={18} /></>}
        </button>
      </div>

      <style>{`
        .modal-inner { display: flex; flex-direction: column; height: 100%; border-radius: 28px; background: white; overflow: hidden; }
        .modal-header { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #efefef; }
        .modal-title { font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; color: #9c27b0; }
        .close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; }
        
        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        
        .input-group label, .options-list label { display: block; font-size: 0.85rem; font-weight: 700; color: #64748b; margin-bottom: 8px; }
        .poll-textarea { width: 100%; min-height: 80px; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: inherit; font-size: 1rem; resize: none; box-sizing: border-box; outline: none; transition: 0.2s; }
        .poll-textarea:focus { border-color: #9c27b0; background: rgba(156,39,176,0.02); }

        .options-list { display: flex; flex-direction: column; gap: 10px; }
        .option-row { display: flex; gap: 8px; align-items: center; }
        .option-row input { flex: 1; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; outline: none; font-family: inherit; transition: 0.2s; }
        .option-row input:focus { border-color: #9c27b0; }
        .remove-opt { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 5px; }
        .remove-opt:hover { color: #f43f5e; }

        .add-opt-btn { background: none; border: 1px dashed #cbd5e1; color: #64748b; padding: 10px; border-radius: 10px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: 0.2s; }
        .add-opt-btn:hover { border-color: #9c27b0; color: #9c27b0; background: rgba(156,39,176,0.05); }

        .footer-options { padding-top: 10px; }
        .switch-label { display: flex; align-items: center; gap: 12px; cursor: pointer; }
        .switch-label span { font-size: 0.9rem; font-weight: 600; color: #475569; }
        .switch-pill { width: 44px; height: 22px; background: #e2e8f0; border-radius: 20px; position: relative; transition: 0.3s; }
        .switch-pill.on { background: #9c27b0; }
        .switch-knob { width: 18px; height: 18px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .switch-pill.on .switch-knob { left: 24px; }

        .submit-poll-btn { width: 100%; padding: 16px; border-radius: 16px; background: linear-gradient(135deg, #9c27b0, #7b1fa2); color: white; border: none; font-weight: 800; font-size: 1.05rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 20px rgba(123, 31, 162, 0.3); transition: 0.2s; }
        .submit-poll-btn:hover { transform: translateY(-2px); opacity: 0.95; }
        .submit-poll-btn:disabled { opacity: 0.7; }
      `}</style>
    </div>
  );
}
