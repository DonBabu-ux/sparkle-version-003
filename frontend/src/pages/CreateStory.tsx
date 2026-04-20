import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, Type, Send, ArrowLeft, Smile, AtSign } from 'lucide-react';
import api from '../api/api';

export default function CreateStory() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [phase, setPhase] = useState<'picker' | 'preview'>('picker');
  const [mode, setMode] = useState<'media' | 'text'>('media');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
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

  const handleTextStory = () => {
    setMode('text');
    setPhase('preview');
    setPreviewUrl(null);
    setFile(null);
  };

  const handleBack = () => {
    if (phase === 'preview') {
      setPhase('picker');
      setPreviewUrl(null);
      setFile(null);
      setCaption('');
    } else {
      navigate(-1);
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

      await api.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Show success (perhaps a toast would be better, but navigating for now)
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to share AfterGlow:', err);
      alert('Failed to share AfterGlow. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const isVideo = file?.type.startsWith('video/');

  return (
    <div className="afterglow-root">
      {/* PHASE 1: PICKER */}
      {phase === 'picker' && (
        <div className="picker-phase animate-fade-in">
          <header className="ag-header">
            <button className="close-btn" onClick={() => navigate('/dashboard')}>
              <X size={24} />
            </button>
            <div className="header-text">
              <h1>Create AfterGlow</h1>
              <p>Vanishes in 24 hours ✨</p>
            </div>
          </header>

          <main className="picker-options">
            <div className="option-card media-option" onClick={() => fileInputRef.current?.click()}>
              <div className="icon-circle">
                <Camera size={42} />
              </div>
              <h2>Photo / Video</h2>
              <p>Tap to pick from your gallery</p>
            </div>

            <div className="option-card text-option" onClick={handleTextStory}>
              <div className="icon-circle small">
                <Type size={28} />
              </div>
              <h2>Text Story</h2>
              <p>Share words, no photo needed</p>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              hidden 
              accept="image/*,video/*" 
              onChange={handleFileSelect} 
            />
          </main>
        </div>
      )}

      {/* PHASE 2: PREVIEW */}
      {phase === 'preview' && (
        <div className="preview-phase animate-fade-in">
          <div className="preview-background">
            {mode === 'media' ? (
              isVideo ? (
                <video src={previewUrl!} autoPlay muted loop playsInline className="full-media" />
              ) : (
                <img src={previewUrl!} alt="" className="full-media" />
              )
            ) : (
              <div className="text-bg-gradient"></div>
            )}
          </div>

          <div className="preview-overlay">
            <header className="preview-top-bar">
              <button className="back-btn" onClick={handleBack}>
                <ArrowLeft size={20} />
              </button>
              <span>Preview</span>
            </header>

            {mode === 'text' && (
              <div className="text-story-center">
                <div className="text-display">
                  {caption || 'Type your story...'}
                </div>
              </div>
            )}

            <footer className="preview-bottom-bar">
              <div className="caption-input-wrapper">
                <Smile className="input-icon" />
                <textarea 
                  placeholder={mode === 'text' ? 'Type your story...' : 'Add a caption...'}
                  rows={1}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 100) + 'px';
                  }}
                />
                <AtSign className="input-icon" />
              </div>

              <div className="action-row">
                <div className="my-status-pill" onClick={handleSubmit}>
                  <img src="/uploads/avatars/default.png" alt="" className="mini-avatar" />
                  <span>My AfterGlow</span>
                </div>
                <button 
                  className="send-btn" 
                  onClick={handleSubmit}
                  disabled={uploading}
                >
                  {uploading ? <div className="spinner-small"></div> : <Send size={22} />}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      <style>{`
        .afterglow-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #000;
          color: white;
          font-family: inherit;
        }

        .picker-phase {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #111;
        }

        .ag-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: max(20px, env(safe-area-inset-top)) 16px 16px;
        }

        .close-btn, .back-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
        }

        .close-btn:hover, .back-btn:hover {
          background: rgba(255,255,255,0.1);
        }

        .header-text h1 { font-size: 1.25rem; font-weight: 800; margin: 0; }
        .header-text p { font-size: 0.75rem; color: rgba(255,255,255,0.5); margin: 2px 0 0; }

        .picker-options {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
          padding: 20px;
        }

        .option-card {
          width: 100%;
          max-width: 340px;
          border-radius: 24px;
          padding: 32px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .media-option {
          background: linear-gradient(135deg, #9c27b0, #e91e63);
          box-shadow: 0 8px 30px rgba(156,39,176,0.35);
        }

        .media-option:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 40px rgba(156,39,176,0.5);
        }

        .text-option {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .text-option:hover {
          background: rgba(255,255,255,0.12);
        }

        .icon-circle {
          background: rgba(255,255,255,0.15);
          width: 70px;
          height: 70px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .icon-circle.small { width: 56px; height: 56px; }

        .option-card h2 { font-size: 1.1rem; font-weight: 800; margin: 0; }
        .option-card p { font-size: 0.8rem; opacity: 0.7; margin: 6px 0 0; }

        /* PREVIEW PHASE */
        .preview-phase {
          position: relative;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }

        .preview-background {
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        .full-media {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
        }

        .text-bg-gradient {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899);
        }

        .preview-overlay {
          position: absolute;
          inset: 0;
          z-index: 10;
          display: flex;
          flex-direction: column;
          background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.6) 100%);
        }

        .preview-top-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: max(20px, env(safe-area-inset-top)) 16px 16px;
          font-weight: 700;
        }

        .text-story-center {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .text-display {
          font-size: 2rem;
          font-weight: 800;
          text-align: center;
          text-shadow: 0 2px 10px rgba(0,0,0,0.3);
          word-break: break-word;
          line-height: 1.3;
        }

        .preview-bottom-bar {
          padding: 16px 16px max(24px, env(safe-area-inset-bottom));
        }

        .caption-input-wrapper {
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(16px);
          border-radius: 28px;
          display: flex;
          align-items: flex-end;
          gap: 12px;
          padding: 10px 14px;
          margin-bottom: 12px;
          border: 1px solid rgba(255,255,255,0.15);
        }

        .caption-input-wrapper textarea {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: white;
          font-size: 1rem;
          font-family: inherit;
          resize: none;
          max-height: 100px;
          padding: 4px 0;
        }

        .input-icon {
          color: rgba(255,255,255,0.6);
          padding-bottom: 4px;
          cursor: pointer;
        }

        .action-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .my-status-pill {
          flex: 1;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          border-radius: 28px;
          padding: 12px 18px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 0.9rem;
          border: 1px solid rgba(255,255,255,0.15);
          cursor: pointer;
        }

        .mini-avatar { width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.4); }

        .send-btn {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: linear-gradient(135deg, #9c27b0, #e91e63);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(156,39,176,0.4);
          transition: transform 0.2s;
        }

        .send-btn:hover { transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .spinner-small {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: ag-spin 0.6s linear infinite;
        }

        @keyframes ag-spin { to { transform: rotate(360deg); } }

        @keyframes fade-in { 
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
