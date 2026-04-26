import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  X, Zap, Settings, ChevronLeft, Send, Sparkles, 
  Smile, Camera, Music, Search, Bookmark, Mic2, LayoutGrid,
  Plus, History, TrendingUp, Music2, Infinity, Type, 
  AtSign, Palette, Timer, Gauge, Wand2, Image as ImageIcon,
  RotateCw, Check, Layers, UserPlus, Pencil, Music4, ChevronDown,
  MapPin, AlignLeft, ArrowRightLeft, MousePointer2, AlignCenter,
  AlignRight, CaseUpper, Sparkle, Type as TypeIcon, Pipette,
  CheckCircle2, Radio, Play, Clapperboard, Timer as TimerIcon, 
  ZapOff, Ghost, Grid3X3, Maximize, Layers2, Scan,
  Square, RectangleHorizontal, Minus, PlusCircle, Pause, Volume2, VolumeX,
  Languages, Navigation, Map
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import StickerPicker from '../components/stories/StickerPicker';
import StickerRenderer from '../components/stories/StickerRenderer';
import { CameraService } from '../services/CameraService';

type Phase = 'entry' | 'camera' | 'editor' | 'music_picker' | 'template_picker' | 'text_story';
type Mode = 'post' | 'story' | 'reel' | 'live';

const PALETTES = [
  { name: 'Sunset Sparkle', bg: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)', text: '#FFFFFF' },
  { name: 'Midnight Neon', bg: 'linear-gradient(135deg, #000428 0%, #004e92 100%)', text: '#00F2FF' },
  { name: 'Spring Bloom', bg: 'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)', text: '#FFFFFF' },
  { name: 'Luxury Gold', bg: 'linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)', text: '#FFD700' },
  { name: 'Candy Cloud', bg: 'linear-gradient(135deg, #e94057 0%, #f27121 100%)', text: '#FFFFFF' },
  { name: 'Deep Sea', bg: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)', text: '#E0E0E0' },
];

const FONTS = [
  { id: 'classic', name: 'Classic', class: 'font-sans font-medium' },
  { id: 'modern', name: 'Modern', class: 'font-black italic uppercase tracking-tighter' },
  { id: 'neon', name: 'Neon', class: 'font-mono uppercase tracking-[0.2em] drop-shadow-[0_0_8px_currentColor]' },
  { id: 'elegant', name: 'Elegant', class: 'font-serif italic' },
  { id: 'strong', name: 'Strong', class: 'font-sans font-black uppercase text-[1.2em]' },
  { id: 'typewriter', name: 'Writer', class: 'font-mono font-bold' },
  { id: 'rounded', name: 'Rounded', class: 'font-sans rounded-lg px-4 py-1' },
  { id: 'signature', name: 'Script', class: 'font-serif italic tracking-wide text-[1.1em]' },
];

const TEXT_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Neon Blue', value: '#00F2FF' },
  { name: 'Gold', value: '#FFD700' },
  { name: 'Hot Pink', value: '#FF007F' },
  { name: 'Lime', value: '#32FF00' },
  { name: 'Violet', value: '#8A2BE2' },
  { name: 'Orange', value: '#FF8C00' },
];

const MOCK_PROMPTS = [
  { id: 1, prompt: 'Anything from your Gallery 😊', count: '+413K' },
  { id: 2, prompt: 'Mention your favorite people...', count: '+171K' },
  { id: 3, prompt: 'Music that saves you', count: '+90K' },
  { id: 4, prompt: 'Current mood in 1 pic', count: '+220K' },
];

const MODES: Mode[] = ['post', 'story', 'reel', 'live'];

export default function CreateStory() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUserStore();
  
  const searchParams = new URLSearchParams(location.search);
  const parentId = searchParams.get('parent');

  const [phase, setPhase] = useState<Phase>('entry');
  const [returnPhase, setReturnPhase] = useState<Phase>('entry');
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
  const [isPlayingMusic, setIsPlayingMusic] = useState(true);
  const [isPreviewingMusic, setIsPreviewingMusic] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [editorText, setEditorText] = useState('');
  
  // Text Story States
  const [textStoryContent, setTextStoryContent] = useState('');
  const [activePalette, setActivePalette] = useState(0);
  const [activeFont, setActiveFont] = useState(0);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [selectedTextColor, setSelectedTextColor] = useState<string | null>(null);
  const [textHighlight, setTextHighlight] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Camera Features States
  const [cameraSpeed, setCameraSpeed] = useState<'1x' | '2x' | '0.5x'>('1x');
  const [cameraTimer, setCameraTimer] = useState<0 | 3 | 10>(0);
  const [cameraLayout, setCameraLayout] = useState<'standard' | 'grid' | 'split'>('standard');
  const [isMagicOn, setIsMagicOn] = useState(false);
  const [isWideAspect, setIsWideAspect] = useState(false);

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
      if (cameraTimer > 0) {
        await new Promise(resolve => setTimeout(resolve, cameraTimer * 1000));
      }
      try {
          const photo = await CameraService.takePhoto();
          if (photo?.webPath) {
              setPreviewUrl(photo.webPath);
              const blob = await CameraService.convertUriToBlob(photo.webPath);
              setFile(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
              setPhase('editor');
          }
      } catch (e) {
          console.error('Capture failed', e);
      }
  };

  const handleGalleryClick = () => fileInputRef.current?.click();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrl(event.target?.result as string);
        setPhase('editor');
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setStickers([{ id: 'st-' + Date.now(), type: 'add_yours', config: { prompt: template.prompt, avatars: [], responses_count: template.count }, x: 50, y: 35, scale: 1, rotation: 0 }]);
    setPhase('camera');
  };

  const openMusicPicker = (fromPhase: Phase) => {
    setReturnPhase(fromPhase);
    setPhase('music_picker');
    setIsPreviewingMusic(false);
  };

  const handleMusicClick = (music: any) => {
    setSelectedMusic(music);
    setIsPreviewingMusic(true);
    setIsPlayingMusic(true);
  };

  const handleMusicConfirm = () => {
    setPhase(returnPhase);
    setIsPreviewingMusic(false);
  };

  const handleAddTextSticker = (content: string, type: 'text' | 'mention' = 'text') => {
    if (!content.trim()) return;
    const cleanContent = type === 'mention' && !content.startsWith('@') ? `@${content}` : content;
    setStickers([...stickers, { 
      id: 'st-' + Date.now(), 
      type: 'text', 
      config: { text: cleanContent, color: '#FFFFFF', font: FONTS[0] }, 
      x: 50, 
      y: 50, 
      scale: 1, 
      rotation: 0 
    }]);
    setEditorText('');
    setActiveTool(null);
  };

  const handlePress = () => {
    pressTimer.current = setTimeout(() => setIsRecording(true), 500);
  };

  const handleRelease = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      if (isRecording) setIsRecording(false);
      else handleCapture();
    }
  };

  const handleSubmit = async () => {
      if (!file && !selectedMusic && phase !== 'text_story') return;
      setUploading(true);
      try {
          const formData = new FormData();
          if (file) formData.append('media', file);
          if (phase === 'text_story') {
              formData.append('text_content', textStoryContent);
              formData.append('text_config', JSON.stringify({ palette: PALETTES[activePalette], font: FONTS[activeFont], align: textAlign, color: selectedTextColor || PALETTES[activePalette].text, highlight: textHighlight }));
          }
          formData.append('type', mode);
          formData.append('stickers', JSON.stringify(stickers));
          formData.append('parent_story_id', parentId || '');
          if (selectedMusic) formData.append('music_info', JSON.stringify(selectedMusic));
          await api.post('/stories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          navigate('/dashboard');
      } catch (e) {
          console.error('Upload failed', e);
      } finally {
          setUploading(false);
      }
  };

  // --- GENIUS COMPONENTS ---
  const MusicIndicator = () => (
    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-16 left-1/2 -translate-x-1/2 z-[400] flex items-center justify-center pointer-events-none">
        <div className="bg-black/20 backdrop-blur-3xl border border-white/10 rounded-full py-2.5 px-5 flex items-center gap-4 pointer-events-auto active:scale-95 transition-all shadow-2xl" onClick={() => openMusicPicker(phase)}>
            <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-[16px] shadow-lg">
                {isPlayingMusic ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>{selectedMusic.cover}</motion.div> : selectedMusic.cover}
            </div>
            <div className="flex flex-col max-w-[120px]">
                <span className="text-[11px] font-black italic uppercase tracking-tight text-white truncate">{selectedMusic.title}</span>
                <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest truncate">{selectedMusic.artist}</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setIsPlayingMusic(!isPlayingMusic); }} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white active:bg-white/10">
                {isPlayingMusic ? <Volume2 size={14} /> : <VolumeX size={14} className="text-white/40" />}
            </button>
        </div>
    </motion.div>
  );

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none safe-area-top safe-area-bottom">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
      
      {/* Universal Music Pill */}
      {selectedMusic && phase !== 'music_picker' && phase !== 'entry' && phase !== 'template_picker' && <MusicIndicator />}

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
                      <button onClick={() => openMusicPicker('entry')} className="entry-action-card bg-rose-500/10 text-rose-600"><div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-lg"><Music2 size={24} /></div><span>Music</span></button>
                      <button onClick={() => { setPhase('camera'); setMode('story'); }} className="entry-action-card bg-blue-500/10 text-blue-600"><div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg"><LayoutGrid size={24} /></div><span>Layout</span></button>
                      <button onClick={() => setPhase('text_story')} className="entry-action-card bg-gradient-to-tr from-purple-500 to-rose-500 text-purple-600">
                          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-lg"><Type size={24} strokeWidth={3} /></div>
                          <span className="text-transparent bg-clip-text bg-gradient-to-tr from-purple-600 to-rose-600">Text Story</span>
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                      <div className="grid grid-cols-3 gap-3">
                          <button onClick={() => { setPhase('camera'); setMode('post'); }} className="row-span-2 col-span-1 rounded-[24px] bg-gray-100 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200"><div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg"><Camera size={32} className="text-black" /></div><span className="text-[10px] font-black uppercase italic tracking-widest text-black/40">Camera</span></button>
                          {[...Array(15)].map((_, i) => (
                              <div key={i} className={`rounded-[24px] bg-gray-50 relative overflow-hidden active:scale-95 transition-transform ${i === 0 ? 'aspect-[3/4]' : 'aspect-square'}`} />
                          ))}
                      </div>
                  </div>
              </motion.div>
          )}

          {/* 2. TEXT STORY PHASE */}
          {phase === 'text_story' && (
              <motion.div key="text_story" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[500] flex flex-col" style={{ background: PALETTES[activePalette].bg }}>
                  <div className="p-10 pt-16 flex items-center justify-between z-10">
                      <button onClick={() => setPhase('entry')} className="w-12 h-12 bg-black/10 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white"><X size={24} strokeWidth={3} /></button>
                      <div className="flex items-center gap-3">
                          {!selectedMusic && (
                            <button onClick={() => openMusicPicker('text_story')} className="w-12 h-12 rounded-full flex items-center justify-center bg-black/10 text-white border border-white/10"><Music size={20} /></button>
                          )}
                          <button onClick={() => setShowColorPicker(true)} className="h-12 px-6 bg-black/10 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3 text-white"><div className="w-4 h-4 rounded-full border border-white" style={{ background: selectedTextColor || PALETTES[activePalette].text }} /><span className="text-[10px] font-black uppercase italic">Color</span></button>
                          <button onClick={() => setTextAlign(textAlign === 'left' ? 'center' : textAlign === 'center' ? 'right' : 'left')} className="w-12 h-12 bg-black/10 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white">{textAlign === 'left' ? <AlignLeft size={20} /> : textAlign === 'center' ? <AlignCenter size={20} /> : <AlignRight size={20} />}</button>
                          <button onClick={() => setTextHighlight(!textHighlight)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${textHighlight ? 'bg-white text-black' : 'bg-black/10 text-white border border-white/10'}`}><CaseUpper size={20} strokeWidth={textHighlight ? 4 : 2} /></button>
                      </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-10 overflow-hidden"><textarea autoFocus placeholder="Start typing..." value={textStoryContent} onChange={(e) => setTextStoryContent(e.target.value)} className={`w-full bg-transparent border-none outline-none text-center resize-none placeholder-white/30 transition-all duration-300 ${FONTS[activeFont].class} ${textStoryContent.length > 50 ? 'text-[28px]' : 'text-[42px]'} ${textHighlight ? 'px-6 py-2 bg-black/20 rounded-[20px]' : ''}`} style={{ color: selectedTextColor || PALETTES[activePalette].text, textAlign: textAlign }} /></div>
                  <div className="px-6 z-20"><div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-4 px-2">{FONTS.map((font, i) => (<button key={font.id} onClick={() => setActiveFont(i)} className={`min-w-fit px-6 py-3 rounded-full transition-all border-2 flex items-center justify-center whitespace-nowrap shadow-xl ${activeFont === i ? 'bg-white text-black border-white scale-110' : 'bg-black/20 text-white border-white/10 opacity-60'}`}><span className={`text-[12px] ${font.class}`}>{font.name}</span></button>))}</div></div>
                  <div className="p-8 pb-16 flex flex-col gap-6 z-10"><div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2">{PALETTES.map((p, i) => (<button key={i} onClick={() => setActivePalette(i)} className={`min-w-[44px] h-11 rounded-2xl border-2 transition-all ${activePalette === i ? 'border-white scale-110 shadow-lg' : 'border-white/20'}`} style={{ background: p.bg }} />))}</div><div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-[10px] font-black uppercase italic text-white/40 tracking-widest">Story Vibe</span><span className="text-[12px] font-black italic uppercase text-white">{PALETTES[activePalette].name}</span></div><button onClick={handleSubmit} disabled={uploading || !textStoryContent} className="h-16 px-10 bg-white text-black rounded-full flex items-center gap-3 active:scale-95 transition-all shadow-2xl font-black italic uppercase tracking-tighter">{uploading ? <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" /> : <><span className="text-[15px]">Push to Story</span><Send size={18} strokeWidth={3} /></>}</button></div></div>
                  <AnimatePresence>{showColorPicker && (<motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="absolute inset-x-6 bottom-40 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 z-[600] shadow-2xl"><div className="flex items-center justify-between mb-8"><h4 className="text-[10px] font-black uppercase italic tracking-widest text-white/40">Choose Text Color</h4><button onClick={() => setShowColorPicker(false)} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white active:scale-75 transition-all"><X size={16} /></button></div><div className="grid grid-cols-5 gap-4"><button onClick={() => { setSelectedTextColor(null); setShowColorPicker(false); }} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${selectedTextColor === null ? 'border-white' : 'border-white/10'}`}><Pipette size={20} /></button>{TEXT_COLORS.map(c => (<button key={c.value} onClick={() => { setSelectedTextColor(c.value); setShowColorPicker(false); }} className={`w-12 h-12 rounded-2xl border-2 transition-all ${selectedTextColor === c.value ? 'border-white scale-110 shadow-lg' : 'border-white/10'}`} style={{ background: c.value }} />))}</div><button onClick={() => setShowColorPicker(false)} className="w-full mt-8 h-14 bg-white text-black rounded-2xl font-black italic uppercase text-[12px] flex items-center justify-center gap-2">Done <CheckCircle2 size={16} /></button></motion.div>)}</AnimatePresence>
              </motion.div>
          )}

          {/* 3. CAMERA PHASE */}
          {phase === 'camera' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[250] flex flex-col bg-black">
                  <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-[100] pt-14">
                      <button onClick={() => setPhase('entry')} className="w-12 h-12 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white"><X size={24} strokeWidth={3} /></button>
                      <button onClick={() => setFlash(!flash)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${flash ? 'bg-yellow-400 text-black' : 'bg-black/20 text-white'}`}><Zap size={20} fill={flash ? "currentColor" : "none"} strokeWidth={3} /></button>
                  </div>

                  <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-6 z-[100]">
                    <AnimatePresence mode="wait">
                      {mode === 'reel' && (
                        <motion.div key="reel-tools" initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="flex flex-col gap-6">
                          {!selectedMusic && (
                            <button onClick={() => openMusicPicker('camera')} className="camera-tool-btn"><Music size={20} /><span>Audio</span></button>
                          )}
                          <button onClick={() => setCameraTimer(t => t === 0 ? 3 : t === 3 ? 10 : 0)} className={`camera-tool-btn ${cameraTimer > 0 ? 'text-yellow-400' : ''}`}><div className="relative"><TimerIcon size={20} />{cameraTimer > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[8px] px-1 rounded-full font-black">{cameraTimer}</span>}</div><span>Timer</span></button>
                          <button onClick={() => setCameraSpeed(s => s === '1x' ? '2x' : s === '2x' ? '0.5x' : '1x')} className={`camera-tool-btn ${cameraSpeed !== '1x' ? 'text-blue-400' : ''}`}><Gauge size={20} /><span>{cameraSpeed}</span></button>
                          <button onClick={() => setCameraLayout(l => l === 'standard' ? 'grid' : 'standard')} className={`camera-tool-btn ${cameraLayout === 'grid' ? 'text-primary' : ''}`}><LayoutGrid size={20} /><span>Grid</span></button>
                          <button onClick={() => setIsMagicOn(!isMagicOn)} className={`camera-tool-btn ${isMagicOn ? 'text-purple-400' : ''}`}><Sparkles size={20} fill={isMagicOn ? "currentColor" : "none"} /><span>Magic</span></button>
                        </motion.div>
                      )}
                      {mode === 'post' && (
                        <motion.div key="post-tools" initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="flex flex-col gap-8">
                           <button onClick={() => setCameraLayout(l => l === 'grid' ? 'standard' : 'grid')} className={`camera-tool-btn ${cameraLayout === 'grid' ? 'text-blue-400' : ''}`}><Grid3X3 size={20} /><span>Grid</span></button>
                           <button onClick={() => setIsWideAspect(!isWideAspect)} className={`camera-tool-btn ${isWideAspect ? 'text-amber-400' : ''}`}>{isWideAspect ? <RectangleHorizontal size={20} /> : <Square size={20} />}<span>Ratio</span></button>
                           <button className="camera-tool-btn"><PlusCircle size={20} /><span>Multi</span></button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex-1 relative flex flex-col items-center justify-center">
                      {cameraLayout === 'grid' && (<div className="absolute inset-0 z-10 pointer-events-none opacity-40"><div className="absolute inset-y-0 left-1/3 w-px bg-white" /><div className="absolute inset-y-0 left-2/3 w-px bg-white" /><div className="absolute inset-x-0 top-1/3 h-px bg-white" /><div className="absolute inset-x-0 top-2/3 h-px bg-white" /></div>)}
                      <div className="absolute top-32 px-4 py-1.5 bg-white/10 backdrop-blur-3xl border border-white/10 rounded-full z-50"><span className="text-[9px] font-black uppercase italic tracking-[0.3em] text-white/60">{mode} Mode</span></div>
                      <div className="absolute inset-0 flex items-center justify-center">{isMagicOn && <motion.div animate={{ opacity: [0.1, 0.3, 0.1] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 mix-blend-overlay" />}<Camera size={64} className={`text-white/5 animate-pulse ${isMagicOn ? 'text-purple-400/20' : ''}`} /></div>
                      <div className="absolute bottom-0 left-0 right-0 p-10 pb-20 flex flex-col items-center gap-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                          <div className="flex items-center gap-14 z-50">
                            <button onClick={handleGalleryClick} className="w-12 h-12 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center active:scale-90 transition-all"><ImageIcon size={20} className="text-white/40" /></button>
                            <button onMouseDown={handlePress} onMouseUp={handleRelease} className="relative w-24 h-24 flex items-center justify-center group"><div className={`absolute inset-0 rounded-full border-[6px] border-white transition-all ${isRecording ? 'scale-125 border-rose-500' : ''}`} /><div className={`w-18 h-18 rounded-full bg-white transition-all ${isRecording ? 'scale-50 rounded-2xl bg-rose-500' : ''}`} /></button>
                            <button onClick={() => setCameraType(cameraType === 'back' ? 'front' : 'back')} className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center text-white"><RotateCw size={22} /></button>
                          </div>
                          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2 px-24 mask-fade-edges relative">{MODES.map(m => (<button key={m} onClick={() => setMode(m)} className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${mode === m ? 'text-white scale-125' : 'text-white/30'}`}>{m}</button>))}</div>
                      </div>
                  </div>
              </motion.div>
          )}

          {/* 4. MUSIC PICKER PHASE */}
          {phase === 'music_picker' && (
              <motion.div key="music" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-0 bg-[#0A0A0A] text-white z-[600] flex flex-col">
                  <div className="p-8 pt-14 flex items-center justify-between">
                      <button onClick={() => setPhase(returnPhase)} className="text-white/30 p-2"><ChevronLeft size={32} strokeWidth={3} /></button>
                      <h2 className="text-[14px] font-black italic uppercase tracking-[0.2em]">Music</h2>
                      {selectedMusic && isPreviewingMusic ? (
                          <button onClick={handleMusicConfirm} className="px-6 py-2 bg-white text-black rounded-full font-black italic uppercase text-[12px] shadow-2xl active:scale-90 transition-all">Done</button>
                      ) : <div className="w-12" />}
                  </div>
                  {!isPreviewingMusic ? (
                    <>
                      <div className="px-8 pb-4"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} /><input placeholder="Search tracks..." className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-12 pr-6 text-[14px] font-bold outline-none focus:border-rose-500 transition-all" /></div></div>
                      <div className="flex-1 p-8 space-y-4 overflow-y-auto no-scrollbar pb-20">
                          {MOCK_MUSIC.map(m => (
                              <button key={m.id} onClick={() => handleMusicClick(m)} className="w-full flex items-center gap-4 p-5 bg-white/5 rounded-[32px] border border-white/5 hover:bg-white/10 transition-all group">
                                  <div className="w-16 h-16 bg-rose-500 rounded-[24px] flex items-center justify-center text-[32px] shadow-xl group-hover:scale-105 transition-transform">{m.cover}</div>
                                  <div className="flex-1 text-left"><h4 className="text-[16px] font-black italic uppercase tracking-tight">{m.title}</h4><p className="text-[12px] font-bold text-white/40 italic">{m.artist}</p></div>
                                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><Play size={16} className="text-white/40" /></div>
                              </button>
                          ))}
                      </div>
                    </>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center p-10">
                        <div className="w-64 h-64 bg-rose-500 rounded-[64px] flex items-center justify-center text-[120px] shadow-2xl shadow-rose-500/20 mb-10 relative">
                            {isPlayingMusic && <div className="absolute inset-0 rounded-[64px] border-[10px] border-white/10 animate-ping opacity-20" />}
                            {selectedMusic?.cover}
                        </div>
                        <h3 className="text-[28px] font-black italic uppercase tracking-tighter mb-2 text-center">{selectedMusic?.title}</h3>
                        <p className="text-[14px] font-black text-rose-500 uppercase italic tracking-widest mb-12">{selectedMusic?.artist}</p>
                        <div className="w-full max-w-xs flex flex-col gap-4">
                            <div className="h-2 w-full bg-white/10 rounded-full relative overflow-hidden">
                                {isPlayingMusic && <motion.div animate={{ x: ['-100%', '0%'] }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 bg-rose-500" />}
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/40 tracking-widest"><span>0:15</span><div className="flex gap-1">{[...Array(20)].map((_, i) => (<div key={i} className={`w-1 rounded-full ${i > 5 && i < 15 ? 'h-6 bg-rose-500' : 'h-3 bg-white/20'}`} />))}</div><span>0:30</span></div>
                        </div>
                        <div className="flex gap-4 mt-12">
                            <button onClick={() => setIsPlayingMusic(!isPlayingMusic)} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl active:scale-90 transition-all">
                                {isPlayingMusic ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                            </button>
                            <button onClick={() => setIsPreviewingMusic(false)} className="h-16 px-8 bg-white/5 border border-white/10 rounded-full flex items-center gap-3 text-[11px] font-black uppercase italic tracking-widest active:bg-white/10 transition-all"><ArrowRightLeft size={16} /> Change Track</button>
                        </div>
                    </motion.div>
                  )}
              </motion.div>
          )}

          {/* 5. EDITOR PHASE (Requirement: Functional Side Icons) */}
          {phase === 'editor' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[300] bg-[#0A0A0A]">
                  {/* The Media Content */}
                  <img src={previewUrl!} className={`w-full h-full object-cover transition-all duration-700 ${isMagicOn ? 'sepia-[0.4] saturate-[1.2] contrast-[1.1]' : ''}`} alt="Preview" />
                  
                  {/* Magic Layer */}
                  {isMagicOn && <div className="absolute inset-0 bg-purple-500/10 pointer-events-none mix-blend-overlay" />}

                  {/* Top Bar */}
                  <div className="absolute top-14 left-6 z-[350]">
                    <button onClick={() => setPhase('camera')} className="w-12 h-12 bg-black/20 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center text-white"><X size={24} strokeWidth={3} /></button>
                  </div>

                  {/* Functional Side Icons */}
                  <div className="absolute top-1/2 -translate-y-1/2 right-6 flex flex-col gap-6 z-[350]">
                      <button onClick={() => setActiveTool('text')} className={`editor-tool-btn ${activeTool === 'text' ? 'text-primary' : ''}`}><Type size={20} /><span>Text</span></button>
                      <button onClick={() => setShowStickerPicker(true)} className="editor-tool-btn"><Smile size={20} /><span>Stickers</span></button>
                      {!selectedMusic && (
                        <button onClick={() => openMusicPicker('editor')} className="editor-tool-btn"><Music4 size={20} /><span>Music</span></button>
                      )}
                      <button onClick={() => setActiveTool('mention')} className={`editor-tool-btn ${activeTool === 'mention' ? 'text-primary' : ''}`}><AtSign size={20} /><span>Mention</span></button>
                      <button onClick={() => setIsMagicOn(!isMagicOn)} className={`editor-tool-btn ${isMagicOn ? 'text-purple-400' : ''}`}><Wand2 size={20} fill={isMagicOn ? "currentColor" : "none"} /><span>Magic</span></button>
                      <button onClick={() => setShowEditMenu(!showEditMenu)} className={`editor-tool-btn ${showEditMenu ? 'text-primary' : ''}`}><Settings size={20} /><span>Edit</span></button>
                  </div>

                  {/* Sticker Layer */}
                  <StickerRenderer 
                    stickers={stickers} 
                    isEditing={true} 
                    onDelete={(id) => setStickers(stickers.filter(s => s.id !== id))} 
                    onUpdate={(id, updates) => setStickers(stickers.map(s => s.id === id ? { ...s, ...updates } : s))} 
                  />

                  {/* Text/Mention Tool Overlay (Genius Input) */}
                  <AnimatePresence>
                      {(activeTool === 'text' || activeTool === 'mention') && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[500] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-10">
                            <input 
                                autoFocus
                                value={editorText}
                                onChange={(e) => setEditorText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTextSticker(editorText, activeTool === 'mention' ? 'mention' : 'text')}
                                placeholder={activeTool === 'mention' ? '@Username' : 'Type something...'}
                                className="w-full bg-transparent border-none outline-none text-center text-white text-[42px] font-black italic uppercase placeholder-white/20"
                            />
                            <div className="mt-10 flex gap-4">
                                <button onClick={() => setActiveTool(null)} className="h-14 px-8 bg-white/10 rounded-full font-black uppercase text-[12px]">Cancel</button>
                                <button onClick={() => handleAddTextSticker(editorText, activeTool === 'mention' ? 'mention' : 'text')} className="h-14 px-10 bg-white text-black rounded-full font-black uppercase text-[12px]">Add</button>
                            </div>
                        </motion.div>
                      )}
                  </AnimatePresence>

                  {/* Edit Sub-Menu Overlay */}
                  <AnimatePresence>
                    {showEditMenu && (
                      <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="absolute right-24 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[32px] p-4 flex flex-col gap-2 z-[350]">
                         <button className="edit-sub-btn"><Languages size={18} /><span>Translate</span></button>
                         <button className="edit-sub-btn"><Navigation size={18} /><span>Direction</span></button>
                         <button onClick={() => setStickers([...stickers, { id: 'loc-'+Date.now(), type: 'location', config: { name: 'Current Location' }, x: 50, y: 30, scale: 1, rotation: 0 }])} className="edit-sub-btn"><MapPin size={18} /><span>Location</span></button>
                         <button className="edit-sub-btn"><Layers size={18} /><span>Layout</span></button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bottom Bar */}
                  <div className="absolute bottom-12 left-0 right-0 px-10 flex items-center justify-between z-[350]">
                      <button onClick={() => setPhase('camera')} className="h-16 w-16 bg-white/10 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center text-white active:scale-90 transition-all"><ChevronLeft size={24} /></button>
                      <button onClick={handleSubmit} disabled={uploading} className="h-16 flex-1 ml-6 bg-white text-black rounded-full flex items-center justify-center gap-3 active:scale-95 transition-all shadow-2xl font-black italic uppercase tracking-tight">
                          {uploading ? <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" /> : <><span className="text-[15px]">Push to Story</span><Send size={18} strokeWidth={3} /></>}
                      </button>
                  </div>
              </motion.div>
          )}

          {/* ... TEMPLATES REMAIN UNCHANGED ... */}
          {phase === 'template_picker' && (
              <motion.div key="templates" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-0 bg-white text-black z-[300] flex flex-col"><div className="p-8 flex items-center justify-between bg-white sticky top-0 z-10 border-b border-gray-100"><button onClick={() => setPhase('entry')} className="text-black/30"><ChevronLeft size={28} strokeWidth={3} /></button><h2 className="text-[14px] font-black italic uppercase tracking-[0.2em]">Templates</h2><button onClick={() => setPhase('camera')} className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"><Plus size={24} strokeWidth={3} /></button></div><div className="flex-1 overflow-y-auto no-scrollbar pb-20"><div className="p-8"><h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-black/20 mb-6 px-2">Essential Stickers</h3><div className="grid grid-cols-2 gap-4"><button onClick={() => handleTemplateSelect({ prompt: 'Ask me anything', count: '5k' })} className="template-mini-card bg-indigo-50 text-indigo-600"><Smile size={24} /><span>Add Yours</span></button><button onClick={() => setShowStickerPicker(true)} className="template-mini-card bg-purple-50 text-purple-600"><Sparkles size={24} /><span>Stickers</span></button></div></div><div className="p-8 bg-gray-50/50"><h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-black/20 mb-6 px-2 flex items-center gap-2"><TrendingUp size={14} /> Trending Prompts</h3><div className="flex flex-col gap-6">{MOCK_PROMPTS.map(p => (<button key={p.id} onClick={() => handleTemplateSelect(p)} className="w-full bg-white p-8 rounded-[40px] border-[3px] border-primary/20 hover:border-primary active:scale-95 transition-all shadow-xl shadow-primary/5 flex flex-col items-center text-center relative overflow-hidden group"><div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors" /><p className="text-[20px] font-black italic uppercase tracking-tighter mb-4 text-black leading-tight drop-shadow-sm">{p.prompt}</p><div className="px-6 py-2 bg-primary/10 rounded-full"><span className="text-[11px] font-black text-primary uppercase italic tracking-widest">{p.count} joined</span></div></button>))}</div></div></div></motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>{showStickerPicker && (<StickerPicker onClose={() => setShowStickerPicker(false)} onSelect={(type, config) => { setStickers([...stickers, { id: 'st-' + Date.now(), type, config, x: 50, y: 50, scale: 1, rotation: 0 }]); setShowStickerPicker(false); }} />)}</AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .mask-fade-edges { mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent); }
        .camera-tool-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; color: white; transition: all 0.2s; min-height: 48px; }
        .camera-tool-btn:active { transform: scale(0.9); opacity: 0.7; }
        .camera-tool-btn span { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.7; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        .entry-action-card { min-width: 80px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; border-radius: 20px; transition: all 0.3s; }
        .template-mini-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 20px; border-radius: 24px; transition: all 0.3s; }
        .template-mini-card span { font-size: 11px; font-weight: 900; text-transform: uppercase; font-style: italic; }
        .editor-tool-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; color: white; transition: all 0.3s; }
        .editor-tool-btn span { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6; font-style: italic; }
        .edit-sub-btn { display: flex; align-items: center; gap: 12px; color: white; padding: 12px 20px; border-radius: 24px; transition: all 0.2s; min-width: 140px; }
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
