import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ImageIcon, Type, Settings, ChevronLeft, Send, Sparkles, Smile, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import StickerPicker from '../components/stories/StickerPicker';
import StickerRenderer from '../components/stories/StickerRenderer';
import { useStoryStore } from '../store/storyStore';

export default function CreateStory() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { pendingFile, setPendingFile } = useStoryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  const [phase, setPhase] = useState<'picker' | 'preview'>('picker');
  const [mode, setMode] = useState<'media' | 'text'>('media');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [bgColor, setBgColor] = useState('linear-gradient(135deg, #6366f1, #a855f7, #ec4899)');
  const [uploading, setUploading] = useState(false);
  
  const [stickers, setStickers] = useState<any[]>([]);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [magicEffect, setMagicEffect] = useState(0);

  // Audio States
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<'local' | 'online' | null>(null);
  const [showAudioSearch, setShowAudioSearch] = useState(false);
  const [audioSearchQuery, setAudioSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Add Yours States
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptText, setPromptText] = useState('');

  const magicFilters = [
    'none',
    'contrast(1.2) saturate(1.5)',
    'sepia(0.5) hue-rotate(-30deg)',
    'grayscale(1) contrast(1.1)',
    'invert(1) hue-rotate(180deg)',
    'blur(5px) saturate(2)'
  ];

  const handleMagic = () => {
    setMagicEffect((magicEffect + 1) % magicFilters.length);
  };

  const handleAudioSearch = async () => {
    if (!audioSearchQuery.trim()) return;
    try {
      const res = await api.get(`/audio/search?q=${audioSearchQuery}`);
      setSearchResults(res.data.results);
    } catch (err) {
      console.error('Audio search failed:', err);
    }
  };

  const selectAudio = (track: any) => {
    setAudioUrl(track.audio_url);
    setAudioSource('online');
    setShowAudioSearch(false);
  };

  const handleAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setAudioSource('local');
    }
  };

  const handleAddYoursSubmit = async () => {
    if (!promptText.trim()) return;
    try {
      const res = await api.post('/stickers/add-yours/prompt', { text: promptText });
      const promptId = res.data.prompt_id;
      
      const newSticker = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'add_yours',
        config: { prompt_id: promptId, prompt: promptText, avatars: [user?.avatar_url || '/uploads/avatars/default.png'], responses_count: 0 },
        x: 50,
        y: 50,
        scale: 1,
        rotation: 0
      };
      setStickers([...stickers, newSticker]);
      setShowPromptModal(false);
      setPromptText('');
    } catch (err) {
      console.error('Failed to create prompt:', err);
    }
  };

  useEffect(() => {
    if (phase === 'preview' && mode === 'text' && textAreaRef.current) {
        setTimeout(() => {
            textAreaRef.current?.focus();
            // Move cursor to end
            const length = textAreaRef.current?.value.length || 0;
            textAreaRef.current?.setSelectionRange(length, length);
        }, 100);
    }
  }, [phase, mode]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setMode('media');
      setPhase('preview');
    }
  };

  const handleAddSticker = (type: string, config: any) => {
    if (type === 'add_yours') {
      setShowPromptModal(true);
      setShowStickerPicker(false);
      return;
    }
    const newSticker = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      config,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0
    };
    setStickers([...stickers, newSticker]);
    setShowStickerPicker(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const respondPromptId = params.get('prompt_id');
    const respondPromptText = params.get('prompt_text');

    if (respondPromptId && respondPromptText) {
      api.get(`/stickers/add-yours/${respondPromptId}`).then(res => {
         const data = res.data;
         const existingAvatars = data.responses.map((r: any) => r.avatar_url);
         const count = data.responses.length;
         
         setStickers([{
           id: 'respond-prompt',
           type: 'add_yours',
           config: { 
             prompt_id: respondPromptId, 
             prompt: decodeURIComponent(respondPromptText), 
             avatars: [...existingAvatars, user?.avatar_url], // Add current user to the loop
             responses_count: count 
           },
           x: 50,
           y: 20, // Position it at the top center automatically
           scale: 1,
           rotation: 0
         }]);
      });
      
      if (pendingFile) {
        setFile(pendingFile);
        setPreviewUrl(URL.createObjectURL(pendingFile));
        setMode('media');
        setPhase('preview');
        setPendingFile(null); // Clear after consuming
      } else {
        // Fallback for direct links
        setTimeout(() => {
          fileInputRef.current?.click();
        }, 500);
      }
    }
  }, [pendingFile, setPendingFile, user]);

  const handleSubmit = async () => {
    // Allow submission if there's media, a caption, OR at least one sticker
    const hasContent = caption.trim() !== '' || file !== null || stickers.length > 0;
    
    if (!hasContent) return;

    setUploading(true);
    try {
      const formData = new FormData();
      if (caption) formData.append('caption', caption);
      if (file) formData.append('media', file);
      if (audioFile) formData.append('audio', audioFile);
      if (audioUrl && audioSource === 'online') formData.append('audio_url', audioUrl);
      
      formData.append('type', mode);
      formData.append('background', bgColor);
      formData.append('magic_effect', magicFilters[magicEffect]);
      formData.append('audio_source', audioSource || '');

      const res = await api.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const storyId = res.data.story_id;

      if (stickers.length > 0) {
          await Promise.all(stickers.map(s => api.post('/stickers', {
              story_id: storyId,
              type: s.type,
              config: s.config,
              x: s.x,
              y: s.y,
              scale: s.scale,
              rotation: s.rotation
          })));

          // Handle Add Yours Linkage if this was a response
          const params = new URLSearchParams(window.location.search);
          const respondPromptId = params.get('prompt_id');
          if (respondPromptId) {
             await api.post('/stickers/add-yours/respond', {
                prompt_id: respondPromptId,
                story_id: storyId
             });
          }
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to share story:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fb-story-root">
      {/* GLOBAL HIDDEN INPUTS */}
      <input type="file" ref={fileInputRef} hidden accept="image/*,video/*" onChange={handleFileSelect} />

      <AnimatePresence>
        {showStickerPicker && (
          <StickerPicker onSelect={handleAddSticker} onClose={() => setShowStickerPicker(false)} />
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR (Hidden on small screens) */}
      <div className="hidden sm:flex fb-story-sidebar">
        <div className="p-4 flex items-center justify-between border-b">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-all">
            <X size={24} className="text-gray-700" />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          <h1 className="text-[24px] font-black italic uppercase tracking-tighter mb-8">Story Engine</h1>
          
          {phase === 'preview' ? (
            <div className="space-y-8 animate-fade-in">
               <button 
                 onClick={() => setShowStickerPicker(true)}
                 className="w-full h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center gap-3 font-black italic uppercase tracking-tight text-[14px] hover:bg-primary/20 transition-all active:scale-95 border-2 border-primary/20"
               >
                 <Smile size={24} /> Add Sticker
               </button>

               <div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30 mb-3 italic">Story Message</p>
                 <textarea 
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Broadcast your energy..."
                    className="w-full bg-gray-50 rounded-[24px] p-6 text-[16px] outline-none border-2 border-transparent focus:border-primary/20 min-h-[180px] resize-none transition-all shadow-inner"
                 />
               </div>
               
               {mode === 'text' && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30 mb-4 italic">Background Palette</p>
                    <div className="grid grid-cols-5 gap-3">
                      {[
                        'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', 
                        'linear-gradient(135deg, #1877F2, #00B2FF)', 
                        'linear-gradient(135deg, #f093fb, #f5576c)',
                        'linear-gradient(135deg, #43e97b, #38f9d7)',
                        'linear-gradient(135deg, #ff0844, #ffb199)',
                        '#1c1e21', '#ffffff', '#ff4d4d', '#4dff88', '#4d88ff'
                      ].map(c => (
                        <div 
                          key={c}
                          onClick={() => setBgColor(c)}
                          className={`aspect-square rounded-xl cursor-pointer border-4 transition-all hover:scale-110 ${bgColor === c ? 'border-primary shadow-lg' : 'border-transparent'}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
               )}

               <div className="pt-8 flex flex-col gap-3">
                  <button 
                    onClick={handleSubmit} 
                    disabled={uploading}
                    className="w-full py-5 bg-primary text-white font-black italic uppercase tracking-tight rounded-[24px] hover:brightness-110 transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/20 disabled:opacity-50"
                  >
                    {uploading ? 'Sharing...' : <>Share to Story <Send size={20} /></>}
                  </button>
                  <button onClick={() => { setPhase('picker'); setStickers([]); setCaption(''); }} className="w-full py-4 bg-gray-100 text-gray-500 font-black italic uppercase tracking-tight rounded-[20px] hover:bg-gray-200 transition-all">
                    Discard
                  </button>
               </div>
            </div>
          ) : (
            <div className="text-center py-20 opacity-30">
               <Sparkles size={64} className="mx-auto mb-4" />
               <p className="font-black italic uppercase">Select a type to begin</p>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CANVAS AREA */}
      <div className="fb-story-main">
        
        {/* MOBILE OVERLAYS */}
        <AnimatePresence>
          {phase === 'preview' && (
            <>
              {/* Mobile Header */}
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-6 left-6 right-6 z-[100] flex items-center justify-between sm:hidden"
              >
                <button onClick={() => setPhase('picker')} className="w-12 h-12 bg-black/30 backdrop-blur-2xl rounded-full flex items-center justify-center text-white border border-white/20 active:scale-75 transition-all">
                  <ChevronLeft size={24} strokeWidth={3} />
                </button>
                <div className="flex gap-3">
                   {mode === 'text' && (
                     <button 
                        onClick={() => setShowColorPicker(!showColorPicker)} 
                        className="w-12 h-12 rounded-full border-4 border-white shadow-2xl active:scale-90 transition-all" 
                        style={{ background: bgColor }} 
                     />
                   )}
                   <button 
                     onClick={handleSubmit} 
                     disabled={uploading}
                     className="px-8 h-12 bg-white text-black font-black italic uppercase tracking-tighter rounded-full shadow-2xl active:scale-90 transition-all flex items-center gap-2"
                   >
                     {uploading ? '...' : 'Share'} <Send size={16} strokeWidth={3} />
                   </button>
                </div>
              </motion.div>

              {/* Mobile Toolbar */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-[100] flex flex-col gap-6 sm:hidden"
              >
                <button onClick={() => fileInputRef.current?.click()} className="toolbar-btn">
                  <ImageIcon size={32} strokeWidth={2.5} className="text-emerald-500" />
                  <span>Image</span>
                </button>
                <button onClick={() => setShowStickerPicker(true)} className="toolbar-btn">
                  <Smile size={32} strokeWidth={2.5} className="text-primary" />
                  <span>Stickers</span>
                </button>
                <button onClick={() => setShowAudioSearch(true)} className={`toolbar-btn ${audioUrl ? 'ring-4 ring-blue-500 ring-offset-4' : ''}`}>
                  <Settings size={32} strokeWidth={2.5} className="text-blue-500" />
                  <span>{audioUrl ? 'Track Set' : 'Music'}</span>
                </button>
                <button onClick={() => textAreaRef.current?.focus()} className="toolbar-btn">
                  <Type size={32} strokeWidth={2.5} className="text-indigo-500" />
                  <span>Text</span>
                </button>
                <button onClick={handleMagic} className={`toolbar-btn ${magicEffect > 0 ? 'active-magic' : ''}`}>
                  <Sparkles size={32} strokeWidth={2.5} className="text-amber-500" />
                  <span>Magic</span>
                </button>
              </motion.div>

              {/* Add Yours Prompt Modal */}
              <AnimatePresence>
                {showPromptModal && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white w-full max-w-[340px] rounded-[32px] p-8 shadow-2xl"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <button onClick={() => setShowPromptModal(false)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 active:scale-90 transition-all"><X size={20} /></button>
                        <h3 className="text-[14px] font-black italic uppercase tracking-tighter text-center">Create Prompt</h3>
                        <div className="w-10" />
                      </div>

                      {/* WYSIWYG Sticker Editor */}
                      <div className="bg-white rounded-[24px] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-gray-100 mx-auto flex flex-col items-center gap-4 overflow-hidden mb-8 w-full max-w-[260px]">
                        <div className="flex flex-col items-center text-center w-full">
                          <textarea 
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            placeholder="Type a prompt..."
                            className="text-[18px] font-bold text-black leading-tight px-2 mb-3 w-full text-center outline-none bg-transparent placeholder:text-gray-300 resize-none overflow-hidden"
                            rows={2}
                            autoFocus
                          />
                          
                          <div className="flex items-center justify-center -space-x-3 mb-1">
                            <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center border-4 border-white text-white shadow-lg z-20">
                               <Camera size={18} strokeWidth={3} />
                            </div>
                            <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-full border-4 border-white object-cover shadow-lg z-10" alt="" />
                          </div>
                        </div>

                        <div className="w-full h-[1px] bg-gray-100" />

                        <div className="flex items-center gap-2 py-1 opacity-50 pointer-events-none">
                           <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
                              <Camera size={18} strokeWidth={3} />
                           </div>
                           <span className="text-[14px] font-black italic uppercase tracking-tighter text-blue-500/80">Add yours</span>
                        </div>
                      </div>

                      <button 
                        onClick={handleAddYoursSubmit} 
                        disabled={!promptText.trim()}
                        className="w-full py-5 bg-primary text-white font-black italic uppercase tracking-tight rounded-[24px] shadow-xl shadow-primary/30 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                      >
                        Finish <ChevronLeft className="rotate-180" size={20} />
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Audio Search Modal */}
              <AnimatePresence>
                {showAudioSearch && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-md"
                  >
                    <motion.div 
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      className="bg-white w-full sm:max-w-[400px] rounded-t-[40px] sm:rounded-[32px] p-6 max-h-[80vh] flex flex-col shadow-2xl"
                    >
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
                      <div className="flex gap-3 mb-6">
                        <input 
                          type="text" 
                          value={audioSearchQuery}
                          onChange={(e) => setAudioSearchQuery(e.target.value)}
                          placeholder="Search music..."
                          className="flex-1 bg-gray-50 border-2 border-transparent focus:border-blue-500/20 rounded-2xl p-4 outline-none transition-all font-bold"
                        />
                        <button onClick={handleAudioSearch} className="p-4 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20"><Send size={20} /></button>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-3">
                         <label className="flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-50 transition-all">
                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Settings size={20} /></div>
                            <div className="flex-1">
                               <p className="font-bold text-[14px]">Upload from device</p>
                               <p className="text-[10px] text-gray-400">MP3, WAV, AAC</p>
                            </div>
                            <input type="file" hidden accept="audio/*" onChange={handleAudioFile} />
                         </label>

                         {searchResults.map(track => (
                            <div 
                              key={track.id} 
                              onClick={() => selectAudio(track)}
                              className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 cursor-pointer transition-all border-2 border-transparent hover:border-blue-500/10"
                            >
                               <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-500 font-bold">♫</div>
                               <div className="flex-1">
                                  <p className="font-bold text-[14px]">{track.title}</p>
                                  <p className="text-[10px] text-gray-400">{track.artist}</p>
                               </div>
                            </div>
                         ))}
                      </div>

                      <button onClick={() => setShowAudioSearch(false)} className="mt-6 w-full py-4 bg-gray-100 rounded-2xl font-black uppercase tracking-tighter text-[12px]">Close</button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mobile Color Selection Sheet */}
              <AnimatePresence>
                {showColorPicker && (
                  <motion.div 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    className="absolute inset-x-0 bottom-0 z-[110] bg-white rounded-t-[40px] p-8 pb-12 shadow-[0_-20px_60px_rgba(0,0,0,0.3)] sm:hidden"
                  >
                     <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                     <div className="grid grid-cols-5 gap-4">
                        {[
                          'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', 
                          'linear-gradient(135deg, #1877F2, #00B2FF)', 
                          'linear-gradient(135deg, #f093fb, #f5576c)',
                          'linear-gradient(135deg, #43e97b, #38f9d7)',
                          'linear-gradient(135deg, #fa709a, #fee140)',
                          '#1c1e21', '#ffffff', '#ff4d4d', '#4dff88', '#4d88ff'
                        ].map(c => (
                          <div 
                            key={c} 
                            onClick={() => { setBgColor(c); setShowColorPicker(false); }} 
                            className="aspect-square rounded-2xl border-4 border-gray-100 shadow-sm active:scale-75 transition-all" 
                            style={{ background: c }} 
                          />
                        ))}
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </AnimatePresence>

        <div className="h-full flex items-center justify-center p-0 sm:p-12">
          {phase === 'picker' ? (
            <div className="flex flex-col sm:flex-row items-center justify-center w-full max-w-4xl gap-8 p-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="picker-card bg-gradient-to-br from-[#45bd62] to-[#2ecc71]"
              >
                <div className="icon-box"><ImageIcon size={36} className="text-[#2ecc71]" /></div>
                <span className="label">Photo Story</span>
                <p className="sub">Upload Media</p>
              </div>

              <div 
                onClick={() => { setMode('text'); setPhase('preview'); }}
                className="picker-card bg-gradient-to-br from-[#e91e63] to-[#9c27b0]"
              >
                <div className="icon-box"><Type size={36} className="text-[#e91e63]" /></div>
                <span className="label">Text Story</span>
                <p className="sub">Status Update</p>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full sm:w-[380px] sm:h-[680px] sm:rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden bg-black flex flex-col">
              {/* BACKGROUND LAYER */}
              <div 
                className="absolute inset-0 transition-all duration-700 ease-out" 
                style={{ filter: magicFilters[magicEffect] }}
              >
                {mode === 'media' ? (
                  <img src={previewUrl!} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="absolute inset-0" style={{ background: bgColor }} />
                )}
              </div>
              
              {/* STICKER LAYER */}
              <StickerRenderer 
                stickers={stickers} 
                isEditing={true}
                onInteract={(stickerId, data) => {
                   if (data.action === 'respond') {
                      fileInputRef.current?.click();
                   }
                }}
                onUpdate={(id, updates) => {
                  setStickers(stickers.map(s => s.id === id ? { ...s, ...updates } : s));
                }}
              />

              {/* TEXT ENGINE LAYER */}
              <div className="flex-1 flex items-center justify-center relative z-20 p-8">
                 {/* Invisible Input for Mobile Focus */}
                 {mode === 'text' && (
                    <textarea
                      ref={textAreaRef}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="absolute inset-0 z-30 bg-transparent text-transparent caret-white text-[36px] font-black p-12 text-center outline-none resize-none flex items-center justify-center opacity-0"
                      placeholder=""
                    />
                 )}
                 
                 {/* Visual Display */}
                 <div 
                    className="relative z-10 text-center cursor-text transition-all active:scale-95"
                    onClick={() => textAreaRef.current?.focus()}
                 >
                    {(!caption && stickers.length > 0) ? (
                        /* Show nothing or a very small hint when stickers are present */
                        <div className="h-20" />
                    ) : (
                        <p className={`text-[42px] sm:text-[36px] font-black italic uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)] ${caption ? 'text-white' : 'text-white/30'}`}>
                          {caption || (mode === 'text' ? 'Broadcast Your Energy...' : '')}
                        </p>
                    )}
                    
                    {mode === 'text' && !caption && (
                       <div className="mt-4 animate-pulse">
                          <p className="text-white/20 font-black italic uppercase tracking-[0.4em] text-[10px]">Tap to write</p>
                       </div>
                    )}
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .fb-story-root { display: flex; position: fixed; inset: 0; background: #000; z-index: 9999; }
        
        /* HARD SIDEBAR HIDE ON MOBILE */
        @media (max-width: 639px) {
          .fb-story-sidebar { display: none !important; }
        }

        .fb-story-sidebar { background: #fff; width: 380px; height: 100%; border-right: 1px solid #eee; z-index: 50; display: flex; flex-direction: column; }
        .fb-story-main { flex: 1; height: 100%; position: relative; overflow: hidden; background: #111; }
        
        .picker-card { width: 100%; max-width: 260px; height: 320px; border-radius: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); position: relative; overflow: hidden; border: 4px solid transparent; }
        @media (max-width: 639px) {
          .picker-card { height: 260px; }
        }
        .picker-card:hover { transform: translateY(-10px) scale(1.02); border-color: rgba(255,255,255,0.2); box-shadow: 0 40px 80px rgba(0,0,0,0.4); }
        .picker-card .icon-box { width: 70px; height: 70px; background: #fff; border-radius: 24px; display: flex; items-center; justify-content: center; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); transition: all 0.4s; }
        .picker-card:hover .icon-box { transform: scale(1.1) rotate(5deg); }
        .picker-card .label { color: #fff; font-size: 20px; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -1px; }
        .picker-card .sub { color: rgba(255,255,255,0.6); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }

        .toolbar-btn { width: 70px; height: 70px; background: #fff; border-radius: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #000; box-shadow: 0 15px 40px rgba(0,0,0,0.4); transition: all 0.3s; border: 2px solid transparent; }
        .toolbar-btn:active { transform: scale(0.85); }
        .toolbar-btn span { font-size: 9px; font-weight: 900; text-transform: uppercase; margin-top: 4px; letter-spacing: -0.5px; opacity: 0.6; }
        .active-magic { ring: 4px solid #f59e0b; ring-offset: 4px; }

        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
