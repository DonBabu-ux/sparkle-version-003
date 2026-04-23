import { useState } from 'react';
import { X, Calendar, MapPin, Users, Clock, Loader2, Orbit, Sparkles, ArrowRight } from 'lucide-react';
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
    <div className="flex flex-col bg-white rounded-[64px] border-4 border-black shadow-[0_40px_120px_rgba(0,0,0,0.2)] overflow-hidden relative lowercase">
      <div className="absolute top-0 right-0 p-12 text-black/[0.01] pointer-events-none">
          <Orbit size={240} strokeWidth={1} className="animate-spin-slow" />
      </div>

      <div className="p-10 flex items-center justify-between border-b-4 border-black/5 bg-white relative z-10">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-white shadow-2xl">
            <Calendar size={24} strokeWidth={3} />
          </div>
          <div>
            <h3 className="font-heading font-black text-3xl text-black tracking-tighter uppercase italic leading-none">Temporal rift</h3>
            <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] mt-2 italic">Schedule Collective Assembly</p>
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
            <Sparkles size={14} className="text-primary animate-pulse" />
            <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.3em] font-heading italic">Signal Label</label>
          </div>
          <input 
            type="text" 
            placeholder="EVENT DESIGNATION..." 
            className="w-full p-8 bg-black/5 border-4 border-transparent rounded-[32px] outline-none font-black text-2xl text-black placeholder:text-black/5 focus:bg-white focus:border-black transition-all uppercase italic tracking-tighter" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 px-2">
            <Orbit size={14} className="text-primary" />
            <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.3em] font-heading italic">Mission Briefing</label>
          </div>
          <textarea 
            placeholder="TELL THE TRIBES WHAT'S HAPPENING..." 
            className="w-full p-10 bg-black/5 border-4 border-transparent rounded-[40px] outline-none font-black text-xl text-black placeholder:text-black/5 focus:bg-white focus:border-black transition-all min-h-[160px] resize-none uppercase italic tracking-tighter leading-tight" 
            value={desc} 
            onChange={(e) => setDesc(e.target.value)} 
            rows={3} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4 px-2">
               <Clock size={14} className="text-primary" />
               <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.3em] font-heading italic">Time Coordinates</label>
            </div>
            <input 
              type="datetime-local" 
              className="w-full p-6 bg-black/5 border-2 border-transparent rounded-[24px] outline-none font-black text-[14px] text-black focus:bg-white focus:border-black transition-all uppercase" 
              value={start} 
              onChange={(e) => setStart(e.target.value)} 
            />
          </div>
          <div className="space-y-6">
            <div className="flex items-center gap-4 px-2">
               <MapPin size={14} className="text-primary" />
               <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.3em] font-heading italic">Spatial Node</label>
            </div>
            <input 
              type="text" 
              placeholder="WHERE IN THE GRID?" 
              className="w-full p-6 bg-black/5 border-2 border-transparent rounded-[24px] outline-none font-black text-[14px] text-black placeholder:text-black/10 focus:bg-white focus:border-black transition-all uppercase italic tracking-tighter" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 px-2">
             <Users size={14} className="text-primary" />
             <label className="text-[10px] font-black text-black/40 uppercase tracking-[0.3em] font-heading italic">Occupancy Target</label>
          </div>
          <div className="relative group">
            <input 
              type="number" 
              placeholder="UNLIMITED BANDWIDTH" 
              className="w-full p-8 bg-black/5 border-4 border-transparent rounded-[32px] outline-none font-black text-2xl text-black placeholder:text-black/5 focus:bg-white focus:border-black transition-all uppercase italic tracking-tighter" 
              value={capacity === 0 ? '' : capacity} 
              onChange={(e) => setCapacity(parseInt(e.target.value) || 0)} 
            />
            {!capacity && (
                <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Sparkles size={24} className="text-black/5" />
                </div>
            )}
          </div>
        </div>

        <button 
          className="w-full py-8 mt-4 rounded-[40px] bg-black text-white font-black text-[15px] uppercase tracking-[0.5em] shadow-2xl hover:bg-primary transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-6 group font-heading italic" 
          onClick={handleSubmit} 
          disabled={submitting}
        >
          {submitting ? <Loader2 className="animate-spin" /> : (
            <>
                BROADCAST SPECTRUM 
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
