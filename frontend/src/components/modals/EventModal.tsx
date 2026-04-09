import { useState } from 'react';
import { X, Calendar, MapPin, Users, Clock, Loader2 } from 'lucide-react';
import api from '../../api/api';

interface EventModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function EventModal({ onClose, onSuccess }: EventModalProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [start, setStart] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !start) {
      alert('Title and start time are required');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/events', {
        title,
        description: desc,
        start_time: start,
        location,
        max_attendees: capacity || 0,
        campus: 'Main Campus',
        is_public: true,
        event_type: 'meetup'
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Event creation failed:', err);
      alert('Failed to publish event.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-inner">
      <div className="modal-header">
        <div className="modal-title">
          <i className="fas fa-calendar-plus" style={{color: '#ff5722'}}></i> Create Campus Event
        </div>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="modal-body">
        <div className="input-group">
          <label>Event Title</label>
          <input type="text" placeholder="Give your event a name..." value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="input-group">
          <label>Description</label>
          <textarea placeholder="Tell people what's happening..." value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
        </div>

        <div className="grid-row">
          <div className="input-group">
            <label><Clock size={14} /> Date & Time</label>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="input-group">
            <label><MapPin size={14} /> Location</label>
            <input type="text" placeholder="Where is it?" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>

        <div className="input-group">
          <label><Users size={14} /> Capacity (Optional)</label>
          <input type="number" placeholder="Unlimited" value={capacity === 0 ? '' : capacity} onChange={(e) => setCapacity(parseInt(e.target.value) || 0)} />
          <p className="hint">Leave empty or 0 for unlimited attendees</p>
        </div>

        <button className="submit-event-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <>Publish Event <Calendar size={18} /></>}
        </button>
      </div>

      <style>{`
        .modal-inner { display: flex; flex-direction: column; height: 100%; border-radius: 28px; background: white; overflow: hidden; }
        .modal-header { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #efefef; }
        .modal-title { font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; color: #ff5722; }
        .close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; }
        
        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 18px; }
        
        .input-group label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 700; color: #64748b; margin-bottom: 8px; }
        .input-group input, .input-group textarea { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: inherit; font-size: 0.95rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .input-group textarea { resize: none; }
        .input-group input:focus, .input-group textarea:focus { border-color: #ff5722; background: rgba(255,87,34,0.02); }

        .grid-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }

        .submit-event-btn { width: 100%; padding: 16px; border-radius: 16px; background: linear-gradient(135deg, #ff5722, #f44336); color: white; border: none; font-weight: 800; font-size: 1.05rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 20px rgba(244, 67, 54, 0.3); transition: 0.2s; margin-top: 10px; }
        .submit-event-btn:hover { transform: translateY(-2px); opacity: 0.95; }
        .submit-event-btn:disabled { opacity: 0.7; }
      `}</style>
    </div>
  );
}
