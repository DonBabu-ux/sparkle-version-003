import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Camera, Film, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

export default function CreateMoment() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isVideo, setIsVideo] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsVideo(f.type.startsWith('video/'));
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('media', file);
      fd.append('caption', caption);
      fd.append('type', isVideo ? 'video' : 'image');
      await api.post('/moments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate('/moments');
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="cm-content">
        <main className="cm-container">
          <button className="cm-back-btn" onClick={() => navigate('/moments')}>
            <ArrowLeft size={16} /> Back to Moments
          </button>

          <div className="cm-card">
            <div className="cm-header">
              <Camera size={24} className="cm-header-icon" />
              <div>
                <h1>Share a Moment</h1>
                <p>Capture and share what's happening on campus</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Upload Zone */}
              {!preview ? (
                <div className="cm-upload-zone" onClick={() => fileRef.current?.click()}>
                  <div className="cm-upload-inner">
                    <div className="cm-upload-icons">
                      <Camera size={32} />
                      <Film size={32} />
                    </div>
                    <p className="cm-upload-title">Tap to upload photo or video</p>
                    <p className="cm-upload-sub">Supports MP4, JPG, PNG, WEBM up to 100MB</p>
                    <button type="button" className="cm-upload-btn">
                      <Upload size={16} /> Choose File
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={handleFile} />
                </div>
              ) : (
                <div className="cm-preview-wrap">
                  <button type="button" className="cm-remove-btn" onClick={() => { setFile(null); setPreview(null); }}>
                    <X size={16} />
                  </button>
                  {isVideo ? (
                    <video src={preview} className="cm-preview-media" controls />
                  ) : (
                    <img src={preview} className="cm-preview-media" alt="Preview" />
                  )}
                </div>
              )}

              {/* Caption */}
              <div className="cm-field">
                <label>Caption</label>
                <textarea
                  rows={3}
                  placeholder="Say something about this moment..."
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                />
                <div className="cm-char-count">{caption.length}/280</div>
              </div>

              <div className="cm-actions">
                <button type="button" className="cm-cancel-btn" onClick={() => navigate('/moments')}>Cancel</button>
                <button type="submit" className="cm-submit-btn" disabled={!file || uploading}>
                  {uploading ? 'Uploading...' : '✦ Share Moment'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: #0a0a0f; min-height: 100vh; }
        .cm-content { flex: 1; overflow-y: auto; }
        .cm-container { max-width: 600px; margin: 0 auto; padding: 28px 20px 80px; }
        .cm-back-btn { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); padding: 10px 18px; border-radius: 12px; font-weight: 700; font-size: 14px; color: rgba(255,255,255,0.7); cursor: pointer; margin-bottom: 20px; transition: 0.2s; }
        .cm-back-btn:hover { background: rgba(255,255,255,0.12); color: white; }

        .cm-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 28px; padding: 36px; }
        .cm-header { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
        .cm-header-icon { color: #FF6B8B; flex-shrink: 0; }
        .cm-header h1 { font-size: 1.4rem; font-weight: 900; color: white; margin: 0 0 4px; }
        .cm-header p { font-size: 0.85rem; color: rgba(255,255,255,0.5); margin: 0; }

        .cm-upload-zone { border: 2px dashed rgba(255,255,255,0.15); border-radius: 20px; padding: 50px 20px; text-align: center; cursor: pointer; transition: 0.3s; margin-bottom: 24px; }
        .cm-upload-zone:hover { border-color: #FF6B8B; background: rgba(255,107,139,0.05); }
        .cm-upload-inner { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .cm-upload-icons { display: flex; gap: 16px; color: rgba(255,255,255,0.3); }
        .cm-upload-title { color: white; font-weight: 700; font-size: 1rem; margin: 0; }
        .cm-upload-sub { color: rgba(255,255,255,0.4); font-size: 13px; margin: 0; }
        .cm-upload-btn { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.1); color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; margin-top: 4px; transition: 0.2s; }
        .cm-upload-btn:hover { background: rgba(255,255,255,0.15); }

        .cm-preview-wrap { position: relative; margin-bottom: 24px; border-radius: 20px; overflow: hidden; max-height: 480px; }
        .cm-preview-media { width: 100%; height: 100%; object-fit: contain; display: block; max-height: 480px; background: #000; }
        .cm-remove-btn { position: absolute; top: 12px; right: 12px; z-index: 10; background: rgba(0,0,0,0.6); border: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; transition: 0.2s; }
        .cm-remove-btn:hover { background: rgba(239,68,68,0.8); }

        .cm-field { margin-bottom: 20px; }
        .cm-field label { display: block; font-weight: 700; font-size: 0.88rem; color: rgba(255,255,255,0.7); margin-bottom: 10px; }
        .cm-field textarea { width: 100%; padding: 14px 16px; border: 2px solid rgba(255,255,255,0.1); border-radius: 16px; font-size: 0.95rem; color: white; background: rgba(255,255,255,0.05); transition: 0.2s; box-sizing: border-box; font-family: inherit; resize: none; }
        .cm-field textarea:focus { border-color: #FF6B8B; outline: none; background: rgba(255,107,139,0.05); }
        .cm-char-count { font-size: 12px; color: rgba(255,255,255,0.3); text-align: right; margin-top: 6px; font-weight: 600; }

        .cm-actions { display: flex; gap: 14px; }
        .cm-cancel-btn { flex: 1; padding: 15px; border-radius: 16px; background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.6); border: none; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .cm-cancel-btn:hover { background: rgba(255,255,255,0.12); }
        .cm-submit-btn { flex: 2; padding: 15px; border-radius: 16px; background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; border: none; font-weight: 800; font-size: 1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 6px 20px rgba(255,61,109,0.35); }
        .cm-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cm-submit-btn:not(:disabled):hover { opacity: 0.9; transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
