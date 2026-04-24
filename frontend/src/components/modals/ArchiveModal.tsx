import React, { useState, useEffect } from 'react';
import { X, Orbit, Trash2, ExternalLink, ArrowLeft } from 'lucide-react';
import api from '../../api/api';

interface Story {
  id: string;
  media_url: string;
  media_type: string;
  created_at: string;
}

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ArchiveModal: React.FC<ArchiveModalProps> = ({ isOpen, onClose }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchArchive();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const fetchArchive = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stories/archive');
      setStories(res.data.stories || []);
    } catch (err) {
      console.error('Failed to fetch archive:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (storyId: string) => {
    if (!window.confirm('Delete this story from your archive forever?')) return;
    try {
      await api.delete(`/stories/${storyId}`);
      setStories(stories.filter(s => s.id !== storyId));
      setSelectedStory(null);
    } catch (err) {
      console.error('Failed to delete story:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] bg-[#0a0a0a] flex flex-col animate-fade-in">
      {/* Full Page Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors flex items-center gap-2 text-white/50 hover:text-white"
          >
            <ArrowLeft size={24} />
            <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Cancel</span>
          </button>
          <div className="h-8 w-px bg-white/10 mx-2" />
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase italic leading-none">The Vault</h2>
            <p className="text-[10px] font-bold text-white/30 tracking-widest uppercase mt-1">Archived Afterglows</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end mr-4">
            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">{stories.length} Items</span>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors group">
            <X size={20} className="text-white/40 group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar bg-[#0a0a0a]">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="relative">
              <Orbit className="animate-spin text-blue-500" size={60} strokeWidth={1.5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            </div>
            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] animate-pulse">Accessing Archive...</span>
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-10 gap-8">
            <div className="w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center rotate-12">
              <Orbit size={48} className="text-white/10" strokeWidth={1} />
            </div>
            <div className="max-w-xs">
              <h3 className="text-white text-xl font-black uppercase italic tracking-tighter mb-2">Vault Empty</h3>
              <p className="text-white/30 text-sm leading-relaxed">Your stories are automatically archived here 24 hours after being posted. Come back later.</p>
            </div>
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/10"
            >
              Return to Profile
            </button>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto w-full p-0.5 sm:p-6">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0.5 sm:gap-4">
              {stories.map(story => (
                <div 
                  key={story.id} 
                  className="relative aspect-[3/4] cursor-pointer overflow-hidden bg-[#111] sm:rounded-2xl group transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                  onClick={() => setSelectedStory(story)}
                >
                  {story.media_type === 'video' || story.media_url?.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                    <video src={story.media_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <img src={story.media_url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  )}
                  
                  {/* Selection Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="absolute bottom-4 left-4 flex flex-col gap-0.5 translate-y-2 group-hover:translate-y-0 transition-transform">
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">
                      {new Date(story.created_at).toLocaleDateString(undefined, { month: 'long' })}
                    </span>
                    <span className="text-xl font-black text-white tracking-tighter italic leading-none">
                      {new Date(story.created_at).getDate()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Safe Area Spacer */}
            <div className="h-20 sm:h-10" />
          </div>
        )}
      </div>

      {/* Story Preview Overlay (Full Screen) */}
      {selectedStory && (
        <div className="fixed inset-0 z-[10002] bg-black flex flex-col animate-scale-in">
          <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
            <button 
              onClick={() => setSelectedStory(null)} 
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft size={24} />
              <span className="text-xs font-black uppercase tracking-widest">Back to Vault</span>
            </button>
            <div className="flex items-center gap-4">
               <button 
                onClick={() => window.open(selectedStory.media_url, '_blank')}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors"
                title="Open Raw"
              >
                <ExternalLink size={20} className="text-white" />
              </button>
              <button 
                onClick={() => setSelectedStory(null)} 
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center bg-[#050505]">
            {selectedStory.media_type === 'video' || selectedStory.media_url?.match(/\.(mp4|webm|ogg|mov)$/i) ? (
              <video 
                src={selectedStory.media_url} 
                controls 
                className="max-w-full max-h-screen sm:rounded-2xl shadow-2xl" 
                autoPlay 
              />
            ) : (
              <img 
                src={selectedStory.media_url} 
                alt="" 
                className="max-w-full max-h-screen sm:rounded-2xl shadow-2xl object-contain" 
              />
            )}
          </div>

          <div className="p-8 sm:p-12 pb-[calc(2rem+env(safe-area-inset-bottom))] flex flex-col sm:flex-row items-center justify-center gap-4 bg-gradient-to-t from-black to-transparent shrink-0">
            <div className="flex flex-col items-center sm:items-start mr-auto mb-4 sm:mb-0">
              <span className="text-white font-black uppercase italic text-2xl tracking-tighter">Archived Afterglow</span>
              <span className="text-white/40 text-xs font-bold tracking-[0.2em] uppercase">
                Captured {new Date(selectedStory.created_at).toLocaleString()}
              </span>
            </div>
            <button 
              onClick={() => handleDelete(selectedStory.id)}
              className="w-full sm:w-auto px-10 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs border border-red-500/20"
            >
              <Trash2 size={18} /> Delete Forever
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default ArchiveModal;
