import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, Smile, Search, ArrowLeft, ChevronRight } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { getAvatarUrl } from '../../utils/imageUtils';
import api from '../../api/api';

interface NoteEditorModalProps {
  initialNote?: string;
  onClose: () => void;
  onSuccess: (note: string | null) => void;
}

const EMOJIS = ['😀','😂','🥰','😍','😒','😭','😩','😔','😘','☺️','😁','🥳','😎','😡','🤔',
  '👍','❤️','🔥','✨','🙌','💯','🙏','🤝','😊','😅','🤣','😇','🙃','😉','😌',
  '🤩','😏','😞','😟','🙁','😣','😖','😫','😤','😠','🤯','😳','🥵','🥶','😱',
  '😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯',
  '😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷'];

const GIPHY_KEY = 'V4AnAfCCCGEVjlUjiNMWWXCoW1JrAn4p';


type Panel = 'none' | 'emoji' | 'gif' | 'music_error';
type Screen = 'editor' | 'settings' | 'choose_people';
type Audience = 'friends_connections' | 'friends' | 'custom';
type Duration = '24' | '12' | '6' | '3';

export default function NoteEditorModal({ initialNote = '', onClose, onSuccess }: NoteEditorModalProps) {
  const { user } = useUserStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [note, setNote] = useState(initialNote);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [panel, setPanel] = useState<Panel>('none');
  const [screen, setScreen] = useState<Screen>('editor');
  const [audience, setAudience] = useState<Audience>('friends');
  const [duration, setDuration] = useState<Duration>('24');
  const [hiddenFrom, setHiddenFrom] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifSearch, setGifSearch] = useState('');
  const [loadingGifs, setLoadingGifs] = useState(false);
  const maxLength = 60;

  // Hide bottom nav while open via CSS class
  useEffect(() => {
    document.body.classList.add('note-modal-open');
    return () => { document.body.classList.remove('note-modal-open'); };
  }, []);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await api.get('/users/followers');
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
  };

  useEffect(() => {
    if (panel === 'gif') fetchGifs();
  }, [panel]);

  useEffect(() => {
    if (panel === 'gif') {
      const t = setTimeout(() => fetchGifs(gifSearch), 400);
      return () => clearTimeout(t);
    }
  }, [gifSearch]);

  const fetchGifs = async (q = '') => {
    setLoadingGifs(true);
    try {
      const endpoint = q ? 'search' : 'trending';
      const url = `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${GIPHY_KEY}&q=${q}&limit=24&rating=g`;
      const res = await fetch(url);
      const data = await res.json();
      setGifs(data.data || []);
    } catch { setGifs([]); }
    finally { setLoadingGifs(false); }
  };

  const handleShare = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await api.patch('/users/profile/note', { 
        note: note.trim() || null,
        audience,
        duration,
        hidden_from: Array.from(hiddenFrom)
      });
      if (res.data.success || res.status === 200) onSuccess(note.trim() || null);
    } catch (err) { console.error('Failed to share note:', err); }
    finally { setIsSubmitting(false); }
  };

  const canShare = note.trim().length > 0 && note !== initialNote;
  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? 'none' : p);

  const filteredContacts = contacts.filter(c =>
    (c.name || c.username || '').toLowerCase().includes(contactSearch.toLowerCase())
  );

  // Group contacts alphabetically
  const grouped = filteredContacts.reduce((acc: Record<string, any[]>, c) => {
    const name = c.name || c.username || '?';
    const letter = name[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(c);
    return acc;
  }, {});

  // ─────────────────────────────────────────────
  // SCREEN: Choose People
  // ─────────────────────────────────────────────
  if (screen === 'choose_people') {
    return (
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.22 }}
        className="fixed inset-0 z-[10001] bg-black flex flex-col"
      >
        <div className="flex items-center justify-between px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('settings')} className="text-white p-1">
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <span className="text-white font-semibold text-[18px]">Choose people</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-white/60 p-1"><Search size={20} /></button>
            <button
              onClick={() => setScreen('settings')}
              className="text-white font-bold text-[14px] uppercase tracking-wider pr-1"
            >
              APPLY
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* Search bar */}
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-lg px-3 h-9">
              <Search size={14} className="text-white/40" />
              <input
                placeholder="Search"
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-white text-[14px] placeholder:text-white/30"
              />
            </div>
          </div>

          {Object.entries(grouped).sort().map(([letter, contacts]) => (
            <div key={letter}>
              <div className="px-4 py-1.5">
                <span className="text-white/40 text-[12px] font-semibold">{letter}</span>
              </div>
              {contacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => setHiddenFrom(prev => {
                    const next = new Set(prev);
                    next.has(contact.id) ? next.delete(contact.id) : next.add(contact.id);
                    return next;
                  })}
                  className="w-full flex items-center px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden mr-3 shrink-0">
                    <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-white text-[15px] font-medium leading-tight">{contact.name || contact.username}</div>
                    {contact.username && <div className="text-white/40 text-[12px]">@{contact.username}</div>}
                  </div>
                  <div className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center shrink-0 transition-colors ${
                    hiddenFrom.has(contact.user_id || contact.id) ? 'bg-[#4a9eff] border-[#4a9eff]' : 'border-white/30'
                  }`}>
                    {hiddenFrom.has(contact.id) && (
                      <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                        <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────
  // SCREEN: Note Settings
  // ─────────────────────────────────────────────
  if (screen === 'settings') {
    return (
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.22 }}
        className="fixed inset-0 z-[10001] bg-black flex flex-col"
      >
        <div className="flex items-center justify-between px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('editor')} className="text-white p-1">
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <span className="text-white font-semibold text-[18px]">Note settings</span>
          </div>
          <button onClick={() => setScreen('editor')} className="text-white/50 text-[15px] font-semibold pr-1">
            Save
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-2 pb-10 space-y-6">
          {/* Who can see */}
          <div>
            <p className="text-white font-bold text-[15px] mb-3">Who can see your note?</p>
            {[
              { value: 'friends_connections', label: 'Friends and connections', sub: 'Your Sparkle followers and connections' },
              { value: 'friends', label: 'Friends', sub: 'Your Sparkle followers' },
              { value: 'custom', label: 'Custom', sub: 'Choose who can see your note' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setAudience(opt.value as Audience)}
                className="w-full flex items-center gap-4 py-3 text-left"
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  audience === opt.value ? 'border-[#4a9eff]' : 'border-white/30'
                }`}>
                  {audience === opt.value && <div className="w-3 h-3 rounded-full bg-[#4a9eff]" />}
                </div>
                <div>
                  <div className="text-white text-[15px] font-medium">{opt.label}</div>
                  <div className="text-white/40 text-[12px] mt-0.5">{opt.sub}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-white/8" />

          {/* Hide note from */}
          <button
            onClick={() => setScreen('choose_people')}
            className="w-full flex items-center justify-between py-1 group"
          >
            <div>
              <div className="text-white font-bold text-[15px]">Hide note from</div>
              <div className="text-white/40 text-[12px] mt-0.5">{hiddenFrom.size} {hiddenFrom.size === 1 ? 'person' : 'people'}</div>
            </div>
            <ChevronRight size={20} className="text-white/40 group-hover:text-white/60 transition-colors" />
          </button>

          <p className="text-white/40 text-[13px] -mt-3">Your note will be visible on Sparkle.</p>

          {/* Divider */}
          <div className="border-t border-white/8" />

          {/* Show note for */}
          <div>
            <p className="text-white font-bold text-[15px] mb-3">Show note for</p>
            {[
              { value: '24', label: '24 hours' },
              { value: '12', label: '12 hours' },
              { value: '6', label: '6 hours' },
              { value: '3', label: '3 hours' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value as Duration)}
                className="w-full flex items-center gap-4 py-3 text-left"
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  duration === opt.value ? 'border-[#4a9eff]' : 'border-white/30'
                }`}>
                  {duration === opt.value && <div className="w-3 h-3 rounded-full bg-[#4a9eff]" />}
                </div>
                <span className="text-white text-[15px] font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  // ─────────────────────────────────────────────
  // SCREEN: Editor (default)
  // ─────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-black flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 shrink-0">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors">
          <X size={22} strokeWidth={2.5} />
        </button>
        <span className="text-white font-semibold text-[17px]">New note</span>
        <button
          onClick={handleShare}
          disabled={!canShare || isSubmitting}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
            canShare ? 'bg-white/20 text-white hover:bg-white/30 active:scale-95' : 'bg-white/10 text-white/40'
          }`}
        >
          {isSubmitting ? '...' : 'Share'}
        </button>
      </div>

      {/* Center */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <div className="flex flex-col items-center">
          {/* Speech Bubble */}
          <div className="relative mb-3">
            <div className="bg-[#3a3a3a] rounded-[20px] px-5 py-3 min-w-[160px] max-w-[260px] shadow-lg">
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, maxLength))}
                placeholder="Share a thought..."
                className="bg-transparent border-none outline-none text-white text-[15px] font-medium placeholder:text-white/30 text-center w-full caret-white"
              />
            </div>
            <div className="absolute -bottom-[10px] left-[28px]"
              style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '0px solid transparent', borderTop: '10px solid #3a3a3a' }} />
          </div>

          {/* Avatar */}
          <div className="w-[88px] h-[88px] rounded-full overflow-hidden border-2 border-white/10 mt-1 shadow-2xl">
            <img src={getAvatarUrl(user?.avatar_url, user?.username)} alt="" className="w-full h-full object-cover" />
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-6 mt-5">
            <button onClick={() => togglePanel('music_error')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${panel === 'music_error' ? 'bg-white/20 text-white' : 'bg-[#2a2a2a] text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <Music size={18} strokeWidth={2} />
            </button>
            <button onClick={() => togglePanel('gif')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${panel === 'gif' ? 'bg-white/20 text-white' : 'bg-[#2a2a2a] text-white/70 hover:bg-white/10'}`}>
              <span className="text-[12px] font-black tracking-tight">GIF</span>
            </button>
            <button onClick={() => togglePanel('emoji')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${panel === 'emoji' ? 'bg-white/20 text-white' : 'bg-[#2a2a2a] text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <Smile size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Emoji Panel */}
      <AnimatePresence>
        {panel === 'emoji' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 280, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden bg-[#1a1a1a] border-t border-white/10">
            <div className="h-full overflow-y-auto no-scrollbar p-4">
              <div className="grid grid-cols-8 gap-3">
                {EMOJIS.map((e, i) => (
                  <button key={i} onClick={() => setNote(prev => (prev + e).slice(0, maxLength))}
                    className="text-[26px] flex items-center justify-center hover:scale-125 active:scale-90 transition-all">{e}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GIF Panel */}
      <AnimatePresence>
        {panel === 'gif' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 320, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden bg-[#1a1a1a] border-t border-white/10 flex flex-col">
            <div className="px-4 py-2 shrink-0">
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 h-9 border border-white/10">
                <Search size={14} className="text-white/40" />
                <input placeholder="Search GIFs..." value={gifSearch} onChange={e => setGifSearch(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-white/30" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              {loadingGifs ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {gifs.map(gif => (
                    <button key={gif.id} onClick={() => { setNote(gif.title?.slice(0, maxLength) || ''); setPanel('none'); }}
                      className="relative aspect-video bg-white/5 rounded-lg overflow-hidden hover:opacity-80 active:scale-95 transition-all">
                      <img src={gif.images?.fixed_height?.url} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      {panel === 'none' && (
        <div className="pb-6 px-8 text-center shrink-0">
          <p className="text-white/30 text-[12px] leading-relaxed">
            Friends can see your note on Sparkle for {duration} hours.{' '}
            <span className="text-[#4a9eff] font-semibold cursor-pointer" onClick={() => setScreen('settings')}>Change</span>
          </p>
        </div>
      )}

      {/* Music Error Modal — sharp edges */}
      <AnimatePresence>
        {panel === 'music_error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60"
            onClick={() => setPanel('none')}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#d1d1d6] w-[270px] overflow-hidden shadow-2xl"
            >
              <div className="px-6 pt-5 pb-4 text-center">
                <h3 className="text-black font-semibold text-[17px] mb-1.5">Something Went Wrong</h3>
                <p className="text-black/60 text-[13px] leading-relaxed">Music is currently unavailable. Please try again later.</p>
              </div>
              <div className="border-t border-black/15 flex">
                <button onClick={() => setPanel('none')}
                  className="flex-1 py-3 text-[#007AFF] text-[15px] font-normal border-r border-black/15 hover:bg-black/5 transition-colors">
                  Try Again
                </button>
                <button onClick={() => setPanel('none')}
                  className="flex-1 py-3 text-[#007AFF] text-[15px] font-semibold hover:bg-black/5 transition-colors">
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
