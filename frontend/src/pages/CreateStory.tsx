import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  X, Zap, Settings, ChevronLeft, Send, Sparkles, 
  Smile, Camera, Music, Search, Bookmark, Mic2, LayoutGrid,
  Plus, History, TrendingUp, Music2, Infinity, Type, 
  AtSign, Palette, Timer, Gauge, Wand2, Image as ImageIcon,
  RotateCw, Check, Layers, UserPlus, Pencil, Music4, ChevronDown,
  MapPin, AlignLeft, ArrowRightLeft, MousePointer2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import StickerPicker from '../components/stories/StickerPicker';
import StickerRenderer from '../components/stories/StickerRenderer';
import { CameraService } from '../services/CameraService';

type Phase = 'entry' | 'camera' | 'editor' | 'music_picker' | 'template_picker';
type Mode = 'post' | 'story' | 'reel' | 'live';

const MOCK_PROMPTS = [
  { id: 1, prompt: 'Anything from your Gallery 😊', count: '+413K' },
  { id: 2, prompt: 'Mention your favorite people...', count: '+171K' },
  { id: 3, prompt: 'Music that saves you', count: '+90K' },
  { id: 4, prompt: 'Current mood in 1 pic', count: '+220K' },
];

export default function CreateStory() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUserStore();
  
  const searchParams = new URLSearchParams(location.search);
  const parentId = searchParams.get('parent');

  const [phase, setPhase] = useState<Phase>('entry');
  const [mode, setMode] = useState<Mode>('story');
  const [isRecording, setIsRecording] = useState(false);
  const [flash, setFlash] = useState(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Editor States
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickers, setStickers] = useState<any[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showEditMenu, setShowEditMenu] = useState(false);
  
  // Reel Mode States
  const [showMagicMenu, setShowMagicMenu] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pressTimer = useRef<any>(null);

  useEffect(() => {
    if (parentId) {
      setPhase('camera');
      setMode('story');
    }
  }, [parentId]);

  // --- HANDLERS ---
  const handleCapture = async () => {
      try {
          const photo = await CameraService.takePhoto();
          if (photo?.webPath) {
              setPreviewUrl(photo.webPath);
              const blob = await CameraService.convertUriToBlob(photo.webPath);
              setFile(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
              setPhase('editor');
              if (parentId && stickers.length === 0) {
                  setStickers([{
                      id: 'chain-' + Date.now(),
                      type: 'add_yours',
                      config: { prompt: 'Add Yours', avatars: [user?.avatar_url || ''], responses_count: 1 },
                      x: 50, y: 35, scale: 1, rotation: 0
                  }]);
              }
          }
      } catch (e) {
          console.error('Capture failed', e);
      }
  };

  const handleTemplateSelect = (template: any) => {
    setStickers([{ 
        id: 'st-' + Date.now(), 
        type: 'add_yours', 
        config: { prompt: template.prompt, avatars: [], responses_count: template.count },
        x: 50, y: 35, scale: 1, rotation: 0 
    }]);
    setPhase('camera');
  };

  const handleMusicSelect = (music: any) => {
    setSelectedMusic(music);
    setPhase('entry');
  };

  const handlePress = () => {
    pressTimer.current = setTimeout(() => setIsRecording(true), 500);
  };

  const handleRelease = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      if (isRecording) {
        setIsRecording(false);
      } else {
        handleCapture();
      }
    }
  };

  const handleSubmit = async () => {
      if (!file && !selectedMusic) return;
      setUploading(true);
      try {
          const formData = new FormData();
          if (file) formData.append('media', file);
          formData.append('type', mode);
          formData.append('stickers', JSON.stringify(stickers));
          formData.append('parent_story_id', parentId || '');
          if (selectedMusic) formData.append('music_info', JSON.stringify(selectedMusic));
          
          await api.post('/stories', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          navigate('/dashboard');
      } catch (e) {
          console.error('Upload failed', e);
      } finally {
          setUploading(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none safe-area-top safe-area-bottom">
      
      <AnimatePresence mode="wait">
          {/* 1. ENTRY PHASE */}
          {phase === 'entry' && (
              <motion.div key="entry" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-0 bg-white text-black z-[200] flex flex-col">
                  <div className="p-6 flex items-center justify-between border-b border-gray-100">
                      <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-black/30"><X size={28} strokeWidth={3} /></button>
                      <h2 className="text-[14px] font-black italic uppercase tracking-[0.2em] flex-1 text-center">New Story</h2>
                      <button className="text-[12px] font-black italic uppercase text-primary px-4 py-2 bg-primary/5 rounded-full flex items-center gap-2">Recents <ChevronDown size={14} /></button>
                  </div>

                  <div className="p-6 flex gap-4 overflow-x-auto no-scrollbar border-b border-gray-50">
                      <button onClick={() => setPhase('template_picker')} className="entry-action-card bg-amber-500/10 text-amber-600"><div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg"><TrendingUp size={24} /></div><span>Templates</span></button>
                      <button onClick={() => setPhase('music_picker')} className="entry-action-card bg-rose-500/10 text-rose-600"><div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-lg"><Music2 size={24} /></div><span>Music</span></button>
                      <button onClick={() => { setPhase('camera'); setMode('story'); }} className="entry-action-card bg-blue-500/10 text-blue-600"><div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg"><LayoutGrid size={24} /></div><span>Layout</span></button>
                      <button className="entry-action-card bg-purple-500/10 text-purple-600"><div className="w-12 h-12 rounded-2xl bg-purple-500 flex items-center justify-center text-white shadow-lg"><History size={24} /></div><span>Memories</span></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                      <div className="grid grid-cols-3 gap-3">
                          <button onClick={() => setPhase('camera')} className="row-span-2 col-span-1 rounded-[24px] bg-gray-100 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200">
                              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg"><Camera size={32} className="text-black" /></div>
                              <span className="text-[10px] font-black uppercase italic tracking-widest text-black/40">Camera</span>
                          </button>
                          {[...Array(15)].map((_, i) => (
                              <div key={i} className={`rounded-[24px] bg-gray-50 relative overflow-hidden active:scale-95 transition-transform ${i === 0 ? 'aspect-[3/4]' : 'aspect-square'}`} />
                          ))}
                      </div>
                  </div>
              </motion.div>
          )}

          {/* 2. TEMPLATE PICKER MODAL (Requirement 12) */}
          {phase === 'template_picker' && (
              <motion.div key="templates" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-0 bg-white text-black z-[300] flex flex-col">
                  <div className="p-8 flex items-center justify-between bg-white sticky top-0 z-10 border-b border-gray-100">
                      <button onClick={() => setPhase('entry')} className="text-black/30"><ChevronLeft size={28} strokeWidth={3} /></button>
                      <h2 className="text-[14px] font-black italic uppercase tracking-[0.2em]">Templates</h2>
                      <button onClick={() => setPhase('camera')} className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"><Plus size={24} strokeWidth={3} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                      {/* Section 1: Standard Stickers */}
                      <div className="p-8">
                          <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-black/20 mb-6 px-2">Essential Stickers</h3>
                          <div className="grid grid-cols-2 gap-4">
                              <button onClick={() => handleTemplateSelect({ prompt: 'Ask me anything', count: '5k' })} className="template-mini-card bg-indigo-50 text-indigo-600">
                                  <Smile size={24} />
                                  <span>Add Yours</span>
                              </button>
                              <button onClick={() => setShowStickerPicker(true)} className="template-mini-card bg-purple-50 text-purple-600">
                                  <Sparkles size={24} />
                                  <span>Stickers</span>
                              </button>
                          </div>
                      </div>

                      {/* Section 2: Trending Prompts (Vertical Scroll) */}
                      <div className="p-8 bg-gray-50/50">
                          <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-black/20 mb-6 px-2 flex items-center gap-2">
                              <TrendingUp size={14} /> Trending Prompts
                          </h3>
                          <div className="flex flex-col gap-6">
                              {MOCK_PROMPTS.map(p => (
                                  <button 
                                      key={p.id} 
                                      onClick={() => handleTemplateSelect(p)} 
                                      className="w-full bg-white p-8 rounded-[40px] border-[3px] border-primary/20 hover:border-primary active:scale-95 transition-all shadow-xl shadow-primary/5 flex flex-col items-center text-center relative overflow-hidden group"
                                  >
                                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors" />
                                      <p className="text-[20px] font-black italic uppercase tracking-tighter mb-4 text-black leading-tight drop-shadow-sm">{p.prompt}</p>
                                      <div className="px-6 py-2 bg-primary/10 rounded-full">
                                          <span className="text-[11px] font-black text-primary uppercase italic tracking-widest">{p.count} joined</span>
                                      </div>
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Section 3: Trending Templates */}
                      <div className="p-8">
                          <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-black/20 mb-6 px-2">Fresh Layouts</h3>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="aspect-[3/4] bg-gray-100 rounded-[24px] border-2 border-dashed border-gray-200" />
                              <div className="aspect-[3/4] bg-gray-100 rounded-[24px] border-2 border-dashed border-gray-200" />
                          </div>
                      </div>
                  </div>
              </motion.div>
          )}

          {/* 3. CAMERA PHASE */}
          {phase === 'camera' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[250] flex flex-col bg-black">
                  <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-[100] pt-14">
                      <button onClick={() => setPhase('entry')} className="w-12 h-12 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white"><X size={24} strokeWidth={3} /></button>
                      <button onClick={() => setFlash(!flash)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${flash ? 'bg-yellow-400 text-black' : 'bg-black/20 text-white'}`}><Zap size={20} fill={flash ? "currentColor" : "none"} strokeWidth={3} /></button>
                  </div>

                  <div className="flex-1 relative">
                      <div className="absolute inset-0 flex items-center justify-center"><Camera size={64} className="text-white/5 animate-pulse" /></div>
                      
                      {/* GENIUS PLACEMENT: Add Yours Sticker in Center while snapping */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <StickerRenderer stickers={stickers} isEditing={false} />
                      </div>

                      <div className="absolute bottom-32 left-0 right-0 flex items-center justify-center gap-14 z-50">
                          <div onClick={() => setPhase('entry')} className="w-12 h-12 rounded-xl bg-white/10 border-2 border-white/20"></div>
                          <button onMouseDown={handlePress} onMouseUp={handleRelease} className="relative w-24 h-24 flex items-center justify-center group">
                              <div className={`absolute inset-0 rounded-full border-[6px] border-white transition-all ${isRecording ? 'scale-150 border-rose-500' : ''}`} />
                              <div className={`w-18 h-18 rounded-full bg-white transition-all ${isRecording ? 'scale-50 rounded-2xl bg-rose-500' : ''}`} />
                          </button>
                          <button onClick={() => setCameraType(cameraType === 'back' ? 'front' : 'back')} className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center text-white"><RotateCw size={22} /></button>
                      </div>
                  </div>
              </motion.div>
          )}

          {/* 4. EDITOR PHASE (Requirement 12 Refined) */}
          {phase === 'editor' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[300] bg-[#0A0A0A]">
                  <img src={previewUrl!} className="w-full h-full object-cover" alt="Preview" />
                  
                  {/* TOP X */}
                  <div className="absolute top-14 left-6 z-[350]">
                      <button onClick={() => setPhase('camera')} className="w-12 h-12 bg-black/20 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center text-white"><X size={24} strokeWidth={3} /></button>
                  </div>

                  {/* RIGHT TOOLBAR (Requirement 12) */}
                  <div className="absolute top-1/2 -translate-y-1/2 right-6 flex flex-col gap-6 z-[350]">
                      <button onClick={() => setActiveTool('text')} className="editor-tool-btn"><Type size={20} /><span>Text</span></button>
                      <button onClick={() => setShowStickerPicker(true)} className="editor-tool-btn"><Smile size={20} /><span>Stickers</span></button>
                      <button onClick={() => setActiveTool('music')} className="editor-tool-btn"><Music4 size={20} /><span>Music</span></button>
                      <button onClick={() => setActiveTool('mention')} className="editor-tool-btn"><AtSign size={20} /><span>Mention</span></button>
                      <button onClick={() => setActiveTool('magic')} className="editor-tool-btn"><Wand2 size={20} /><span>Magic</span></button>
                      <button onClick={() => setShowEditMenu(!showEditMenu)} className="editor-tool-btn"><Settings size={20} className={showEditMenu ? 'text-primary' : ''} /><span>Edit</span></button>
                  </div>

                  {/* EDIT SUB-MENU (Requirement 12: Font, Layout, Direction, Location) */}
                  <AnimatePresence>
                      {showEditMenu && (
                          <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="absolute right-24 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[32px] p-4 flex flex-col gap-4 z-[350]">
                              <button className="edit-sub-btn"><Type size={16} /><span>Font</span></button>
                              <button className="edit-sub-btn"><LayoutGrid size={16} /><span>Layout</span></button>
                              <button className="edit-sub-btn"><ArrowRightLeft size={16} /><span>Direction</span></button>
                              <button className="edit-sub-btn"><MapPin size={16} /><span>Location</span></button>
                          </motion.div>
                      )}
                  </AnimatePresence>

                  <StickerRenderer 
                      stickers={stickers} isEditing={true}
                      onDelete={(id) => setStickers(stickers.filter(s => s.id !== id))}
                      onUpdate={(id, updates) => setStickers(stickers.map(s => s.id === id ? { ...s, ...updates } : s))}
                  />

                  {/* PUSH TO STORY BUTTON (Requirement 12) */}
                  <div className="absolute bottom-12 left-0 right-0 px-10 flex items-center justify-between z-[350]">
                      <button onClick={() => navigate('/dashboard')} className="h-16 w-16 bg-white/10 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center text-white active:scale-90 transition-all"><ChevronLeft size={24} /></button>
                      <button onClick={handleSubmit} disabled={uploading} className="h-16 flex-1 ml-6 bg-white text-black rounded-full flex items-center justify-center gap-3 active:scale-95 transition-all shadow-2xl font-black italic uppercase tracking-tight">
                          {uploading ? <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" /> : <><span className="text-[15px]">Push to Story</span><Send size={18} strokeWidth={3} /></>}
                      </button>
                  </div>
              </motion.div>
          )}

          {/* MUSIC PICKER */}
          {phase === 'music_picker' && (
              <motion.div key="music" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-0 bg-[#0A0A0A] text-white z-[400] flex flex-col">
                  <div className="p-8 pt-14 flex items-center gap-4"><button onClick={() => setPhase('entry')} className="text-white/30"><ChevronLeft size={28} strokeWidth={3} /></button><div className="flex-1 relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} /><input placeholder="Search Music..." className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-12 pr-6 text-[14px] font-bold outline-none focus:border-rose-500" /></div></div>
                  <div className="flex-1 p-8 space-y-4 overflow-y-auto no-scrollbar">
                      {MOCK_MUSIC.map(m => (
                          <button key={m.id} onClick={() => handleMusicSelect(m)} className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-[24px] border border-white/5 hover:bg-white/10 transition-all"><div className="w-14 h-14 bg-rose-500 rounded-[18px] flex items-center justify-center text-[24px] shadow-lg">{m.cover}</div><div className="flex-1 text-left"><h4 className="text-[15px] font-black italic uppercase">{m.title}</h4><p className="text-[11px] font-bold text-white/40">{m.artist}</p></div></button>
                      ))}
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {showStickerPicker && (
              <StickerPicker onClose={() => setShowStickerPicker(false)} onSelect={(type, config) => { setStickers([...stickers, { id: 'st-' + Date.now(), type, config, x: 50, y: 50, scale: 1, rotation: 0 }]); setShowStickerPicker(false); }} />
          )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .entry-action-card { min-width: 80px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; border-radius: 20px; transition: all 0.3s; }
        .template-mini-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 20px; border-radius: 24px; transition: all 0.3s; }
        .template-mini-card span { font-size: 11px; font-weight: 900; text-transform: uppercase; font-style: italic; }
        .editor-tool-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; color: white; transition: all 0.3s; }
        .editor-tool-btn span { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6; font-style: italic; }
        .edit-sub-btn { display: flex; items-center; gap: 12px; color: white; padding: 8px 12px; border-radius: 16px; transition: all 0.2s; }
        .edit-sub-btn:active { background: rgba(255,255,255,0.1); }
        .edit-sub-btn span { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
        .toolbar-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; color: white; transition: all 0.3s; opacity: 0.8; }
        .toolbar-btn:active { transform: scale(0.8); opacity: 0.5; }
        .toolbar-btn span { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; opacity: 0.5; font-style: italic; }
      `}</style>
    </div>
  );
}

const MOCK_MUSIC = [
  { id: 1, title: 'On Fire', artist: 'Andy Bumuntu', duration: '3:17', cover: '🔥' },
  { id: 2, title: 'LA PLI SI TOL', artist: 'Mikado', duration: '2:03', cover: '🏠' },
  { id: 3, title: 'The Nights', artist: 'Avicii', duration: '2:56', cover: '🌌' },
];
