import { useState, useEffect, useCallback } from 'react';
import { X, Check, Orbit, Trash2, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../api/api';
import Spinner from '../ui/Spinner';
import { logger } from '../../utils/logger';
import { showSuccess, showError } from '../../utils/toast';
import { useModalA11y } from '../../hooks/useModalA11y';

/** A story the owner owns (archive rows and highlight rows share this shape). */
interface OwnedStory {
  id: string;
  media_url: string;
  media_type: string;
  caption?: string;
  created_at: string;
}

interface HighlightEditModalProps {
  isOpen: boolean;
  highlightId: string | null;
  initialTitle: string;
  onClose: () => void;
  /** Lets the caller refresh the highlight rail after a successful write. */
  onSaved: () => void;
}

const isVideoUrl = (url?: string) => !!url && /\.(mp4|webm|ogg|mov)$/i.test(url);

export default function HighlightEditModal({
  isOpen,
  highlightId,
  initialTitle,
  onClose,
  onSaved,
}: HighlightEditModalProps) {
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [highlightStories, setHighlightStories] = useState<OwnedStory[]>([]);
  const [archive, setArchive] = useState<OwnedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const a11yRef = useModalA11y(isOpen, onClose);

  const loadData = useCallback(async () => {
    if (!highlightId) return;
    setLoading(true);
    try {
      const [detail, archiveRes] = await Promise.all([
        api.get(`/highlights/${highlightId}`),
        api.get('/highlights/archive').catch(() => ({ data: [] })),
      ]);
      setHighlightStories(Array.isArray(detail.data?.stories) ? detail.data.stories : []);
      setArchive(Array.isArray(archiveRes.data) ? archiveRes.data : []);
      setCoverUrl(detail.data?.cover_url || '');
    } catch (err) {
      logger.error('Failed to load highlight for editing:', err);
      showError('Could not load this highlight');
    } finally {
      setLoading(false);
    }
  }, [highlightId]);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialTitle);
    setPendingIds(new Set());
    void loadData();
  }, [isOpen, initialTitle, loadData]);

  const withSave = async (work: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    try {
      await work();
      showSuccess(successMessage);
      onSaved();
    } catch (err) {
      logger.error('Highlight edit failed:', err);
      showError('Could not update this highlight');
    } finally {
      setSaving(false);
    }
  };

  const saveTitle = () => {
    const next = title.trim();
    if (!next || !highlightId) return;
    return withSave(async () => {
      await api.put(`/highlights/${highlightId}`, { title: next });
    }, 'Highlight renamed');
  };

  const chooseCover = (story: OwnedStory) => {
    if (!highlightId) return;
    setCoverUrl(story.media_url);
    return withSave(async () => {
      await api.put(`/highlights/${highlightId}`, { cover_url: story.media_url });
    }, 'Cover updated');
  };

  const toggleArchive = (id: string) => {
    setPendingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = () => {
    if (!highlightId || pendingIds.size === 0) return;
    const storyIds = Array.from(pendingIds);
    return withSave(async () => {
      await api.post(`/highlights/${highlightId}/stories`, { story_ids: storyIds });
      setPendingIds(new Set());
      await loadData();
    }, `Added ${storyIds.length} ${storyIds.length === 1 ? 'story' : 'stories'}`);
  };

  const removeStory = (storyId: string) => {
    if (!highlightId) return;
    return withSave(async () => {
      await api.delete(`/highlights/${highlightId}/stories/${storyId}`);
      setHighlightStories(prev => prev.filter(s => s.id !== storyId));
    }, 'Story removed from highlight');
  };

  if (!isOpen || !highlightId) return null;

  const archiveOptions = archive.filter(story => !highlightStories.some(s => s.id === story.id));

  return (
    <div ref={a11yRef} role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-[10003] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative bg-[#1a1a1a] w-full h-auto max-h-[90vh] rounded-t-[2.5rem] sm:rounded-2xl sm:max-w-md flex flex-col overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <h2 className="text-white font-bold text-base">Edit highlight</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Spinner size="medium" color="text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-8">
            {/* Rename */}
            <section className="space-y-3">
              <label className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] ml-2">Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={30}
                  placeholder="Highlight name"
                  className="flex-1 h-12 bg-[#2a2a2a] text-white rounded-2xl px-5 text-[15px] font-bold outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-white/20"
                />
                <button
                  onClick={() => void saveTitle()}
                  disabled={saving || !title.trim() || title.trim() === initialTitle}
                  className="h-12 px-5 bg-blue-500 text-white rounded-2xl font-black uppercase text-[12px] active:scale-95 transition-all disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </section>

            {/* Cover */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-white/40" />
                <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Cover</h3>
                {coverUrl && (
                  <img src={coverUrl} alt="" className="ml-auto w-10 h-10 rounded-full object-cover border-2 border-blue-500/40" />
                )}
              </div>
              <p className="text-white/30 text-[11px]">Pick any of your archived stories as the cover.</p>
              {archive.length === 0 ? (
                <p className="text-white/40 text-[12px]">No archived stories yet.</p>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {archive.map(story => (
                    <button
                      key={`cover-${story.id}`}
                      onClick={() => void chooseCover(story)}
                      aria-label="Use as cover"
                      className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all active:scale-95 ${
                        coverUrl === story.media_url ? 'border-blue-500' : 'border-transparent'
                      }`}
                    >
                      {isVideoUrl(story.media_url) ? (
                        <video src={story.media_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={story.media_url} alt="" className="w-full h-full object-cover" />
                      )}
                      {coverUrl === story.media_url && (
                        <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                          <Check size={18} className="text-white" strokeWidth={4} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Stories in the highlight */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">In this highlight</h3>
              {highlightStories.length === 0 ? (
                <p className="text-white/40 text-[12px]">Nothing here yet — add stories from your archive below.</p>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {highlightStories.map(story => (
                    <div key={`in-${story.id}`} className="relative aspect-square overflow-hidden rounded-lg">
                      {isVideoUrl(story.media_url) ? (
                        <video src={story.media_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={story.media_url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => void removeStory(story.id)}
                        disabled={saving}
                        aria-label="Remove from highlight"
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Add from archive */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Add stories</h3>
              {archiveOptions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-white/40">
                  <Orbit size={32} strokeWidth={1} />
                  <p className="text-[12px]">No archived stories available to add.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-1">
                    {archiveOptions.map(story => {
                      const selected = pendingIds.has(story.id);
                      return (
                        <button
                          key={`add-${story.id}`}
                          onClick={() => toggleArchive(story.id)}
                          className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all active:scale-95 ${
                            selected ? 'border-blue-500' : 'border-transparent'
                          }`}
                        >
                          {isVideoUrl(story.media_url) ? (
                            <video src={story.media_url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={story.media_url} alt="" className="w-full h-full object-cover" />
                          )}
                          <div className={`absolute inset-0 transition-all ${selected ? 'bg-blue-500/30' : 'bg-transparent'}`} />
                          <div className={`absolute top-1 right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            selected ? 'bg-blue-500 border-blue-500' : 'border-white/60 bg-black/40'
                          }`}>
                            {selected && <Check size={13} className="text-white" strokeWidth={4} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => void addSelected()}
                    disabled={saving || pendingIds.size === 0}
                    className="w-full h-12 bg-blue-500 text-white rounded-2xl font-black uppercase tracking-tighter active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    Add {pendingIds.size > 0 ? `(${pendingIds.size})` : ''}
                  </button>
                </>
              )}
            </section>
          </div>
        )}
      </motion.div>
    </div>
  );
}
