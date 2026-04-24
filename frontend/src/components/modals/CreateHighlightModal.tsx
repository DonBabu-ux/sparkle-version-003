import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Orbit } from 'lucide-react';
import api from '../../api/api';

interface ArchivedStory {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  created_at: string;
}

interface CreateHighlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (highlight: { id: string; title: string; cover_url: string; story_count: number }) => void;
}

export default function CreateHighlightModal({ isOpen, onClose, onCreated }: CreateHighlightModalProps) {
  const [step, setStep] = useState<'select' | 'name'>('select');
  const [stories, setStories] = useState<ArchivedStory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelected(new Set());
      setTitle('');
      fetchArchive();
    }
  }, [isOpen]);

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const res = await api.get('/highlights/archive');
      setStories(res.data || []);
    } catch (err) {
      console.error('Failed to fetch archive:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      // Use first selected story's media as cover
      const firstSelectedStory = stories.find(s => selected.has(s.id));
      const cover_url = firstSelectedStory?.media_url;

      const res = await api.post('/highlights', {
        title: title.trim(),
        cover_url,
        story_ids: Array.from(selected),
      });
      onCreated(res.data);
      onClose();
    } catch (err) {
      console.error('Failed to create highlight:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#1a1a1a] w-full h-auto max-h-[85vh] rounded-t-[2.5rem] sm:rounded-2xl sm:max-w-md flex flex-col overflow-hidden animate-slide-up shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        {/* Grabber for mobile */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-3 shrink-0 sm:hidden" />
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          {step === 'name' && (
            <button onClick={() => setStep('select')} className="text-white/70 hover:text-white text-sm">
              Back
            </button>
          )}
          {step === 'select' && <div />}
          <h2 className="text-white font-bold text-base">
            {step === 'select' ? 'New Highlight' : 'Highlight Name'}
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {step === 'select' ? (
          <>
            {/* Story Grid */}
            <div className="flex-1 overflow-y-auto p-1 no-scrollbar">
              {loading ? (
                <div className="flex justify-center p-12">
                  <Orbit className="animate-spin text-white/50" size={24} />
                </div>
              ) : stories.length === 0 ? (
                <div className="flex flex-col items-center p-12 text-white/40 text-sm text-center gap-3">
                  <Orbit size={40} strokeWidth={1} />
                  <p>No archived stories yet.<br />Stories appear here after 24 hours.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-0.5 pb-32 sm:pb-4">
                  {stories.map(story => {
                    const isSelected = selected.has(story.id);
                    return (
                      <div
                        key={story.id}
                        className="relative aspect-[3/4] cursor-pointer overflow-hidden bg-black group"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleSelect(story.id);
                        }}
                      >
                        {story.media_type === 'video' || story.media_url?.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                          <video src={story.media_url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={story.media_url} alt="" className="w-full h-full object-cover" />
                        )}
                        {/* Selection overlay */}
                        <div className={`absolute inset-0 transition-all ${isSelected ? 'bg-blue-500/40' : 'bg-transparent group-hover:bg-white/10'}`} />
                        {/* Checkmark */}
                        <div className={`absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all z-10 ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 scale-110 shadow-lg'
                            : 'border-white/60 bg-black/40 scale-100'
                        }`}>
                          {isSelected && <Check size={16} className="text-white" strokeWidth={4} />}
                        </div>
                      </div>
                    );
                  })}
                  {/* Spacer to ensure last items clear the footer */}
                  <div className="col-span-full h-48 sm:h-0" />
                </div>
              )}
            </div>

            {/* Footer - Fixed to bottom of sheet */}
            <div className="absolute bottom-0 inset-x-0 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] border-t border-white/10 bg-black/90 backdrop-blur-xl z-30">
              <button
                disabled={selected.size === 0}
                onClick={() => setStep('name')}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 uppercase tracking-tighter"
              >
                Next ({selected.size} stories)
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col relative min-h-[300px]">
            <div className="flex-1 p-6 space-y-8 overflow-y-auto pb-48">
              {/* Cover preview */}
              {stories.find(s => selected.has(s.id))?.media_url && (
                <div className="flex justify-center">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-blue-500/20 shadow-2xl animate-scale-in">
                    <img
                      src={stories.find(s => selected.has(s.id))?.media_url}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-2">Highlight Name</label>
                <input
                  type="text"
                  placeholder="e.g. SUMMER VIBES"
                  value={title}
                  onChange={e => setTitle(e.target.value.toUpperCase())}
                  maxLength={30}
                  className="w-full bg-[#2a2a2a] text-white rounded-2xl px-6 py-5 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-white/20 text-lg font-bold shadow-inner"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
                <div className="text-white/20 text-[10px] font-bold text-right tracking-widest">{title.length}/30</div>
              </div>
            </div>

            {/* Footer - Fixed to bottom of sheet */}
            <div className="absolute bottom-0 inset-x-0 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] border-t border-white/10 bg-black/90 backdrop-blur-xl z-30">
              <button
                disabled={!title.trim() || saving}
                onClick={handleCreate}
                className="w-full py-5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all active:scale-[0.95] flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 uppercase tracking-tighter text-lg"
              >
                {saving ? <Orbit className="animate-spin" size={24} /> : null}
                {saving ? 'TRANSMITTING...' : 'ADD TO VAULT'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
