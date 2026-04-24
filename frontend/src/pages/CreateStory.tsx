import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ImageIcon, Type, Settings, ChevronLeft, Send, Sparkles } from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

export default function CreateStory() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [phase, setPhase] = useState<'picker' | 'preview'>('picker');
  const [mode, setMode] = useState<'media' | 'text'>('media');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [bgColor, setBgColor] = useState('linear-gradient(135deg, #6366f1, #a855f7, #ec4899)');
  const [uploading, setUploading] = useState(false);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setMode('media');
      setPhase('preview');
    }
  };

  const handleSubmit = async () => {
    if (!caption && !file && mode === 'media') return;
    if (!caption && mode === 'text') return;

    setUploading(true);
    try {
      const formData = new FormData();
      if (caption) formData.append('caption', caption);
      if (file) formData.append('media', file);
      formData.append('type', mode);
      formData.append('background', bgColor);

      await api.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to share story:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fb-story-root">
      {/* Sidebar - always visible like FB */}
      <div className="fb-story-sidebar">
        <div className="p-4 flex items-center justify-between border-bottom">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-gray-200 rounded-full">
            <X size={24} className="text-gray-700" />
          </button>
          <div className="flex gap-2">
            <button className="p-2 bg-gray-200 rounded-full"><Settings size={24} className="text-gray-700" /></button>
          </div>
        </div>
        
        <div className="p-4">
          <h1 className="text-[24px] font-bold text-gray-900 mb-6">Your story</h1>
          <div className="flex items-center gap-3 mb-8">
            <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-full border border-gray-200" alt="" />
            <span className="font-bold text-[17px]">{user?.name}</span>
          </div>

          {phase === 'preview' && (
            <div className="animate-fade-in">
               <textarea 
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Start typing..."
                  className="w-full bg-gray-100 rounded-lg p-4 text-[16px] outline-none border border-gray-200 min-h-[150px] resize-none"
               />
               
               {mode === 'text' && (
                  <div className="mt-6">
                    <p className="text-[14px] font-semibold text-gray-500 mb-3 uppercase tracking-wider">Backgrounds</p>
                    <div className="flex flex-wrap gap-2">
                      {['linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', 'linear-gradient(135deg, #1877F2, #00B2FF)', 'linear-gradient(135deg, #f093fb, #f5576c)', '#1c1e21'].map(c => (
                        <div 
                          key={c}
                          onClick={() => setBgColor(c)}
                          className={`w-10 h-10 rounded-full cursor-pointer border-2 ${bgColor === c ? 'border-blue-600' : 'border-transparent'}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
               )}

               <div className="mt-8 flex gap-3">
                  <button onClick={() => setPhase('picker')} className="flex-1 py-2 bg-gray-200 font-bold rounded-lg hover:bg-gray-300">Discard</button>
                  <button 
                    onClick={handleSubmit} 
                    disabled={uploading}
                    className="flex-1 py-2 bg-[#1877F2] text-white font-bold rounded-lg hover:bg-[#166fe5] flex items-center justify-center gap-2"
                  >
                    {uploading ? 'Sharing...' : <>Share to story <Send size={16} /></>}
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="fb-story-main">
        {phase === 'picker' ? (
          <div className="flex items-center justify-center h-full gap-4">
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="w-[200px] h-[330px] bg-gradient-to-br from-[#45bd62] to-[#2ecc71] rounded-xl flex flex-col items-center justify-center cursor-pointer hover:brightness-105 transition-all shadow-lg group"
             >
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform">
                  <ImageIcon size={32} className="text-[#2ecc71]" />
                </div>
                <span className="text-white font-bold text-[17px]">Create a photo story</span>
                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileSelect} />
             </div>

             <div 
               onClick={() => { setMode('text'); setPhase('preview'); }}
               className="w-[200px] h-[330px] bg-gradient-to-br from-[#e91e63] to-[#9c27b0] rounded-xl flex flex-col items-center justify-center cursor-pointer hover:brightness-105 transition-all shadow-lg group"
             >
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform">
                  <Type size={32} className="text-[#e91e63]" />
                </div>
                <span className="text-white font-bold text-[17px]">Create a text story</span>
             </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full p-10">
            <div className="relative w-[340px] h-[600px] rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.3)] overflow-hidden bg-black flex flex-col items-center justify-center">
              {mode === 'media' ? (
                <img src={previewUrl!} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="absolute inset-0" style={{ background: bgColor }} />
              )}
              
              <div className="relative z-10 p-6 text-center">
                <p className={`text-[24px] font-bold text-white break-words ${mode === 'text' ? 'text-shadow' : ''}`}>
                  {caption || (mode === 'text' ? 'Start typing' : '')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .fb-story-root { display: flex; position: fixed; inset: 0; background: #f0f2f5; z-index: 9999; }
        .fb-story-sidebar { width: 360px; background: white; height: 100%; border-right: 1px solid #ddd; box-shadow: 2px 0 5px rgba(0,0,0,0.05); z-index: 10; }
        .fb-story-main { flex: 1; height: 100%; overflow: hidden; background: #18191a; }
        .border-bottom { border-bottom: 1px solid #ddd; }
        .text-shadow { text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

