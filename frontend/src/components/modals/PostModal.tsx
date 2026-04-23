import { useState, useRef } from 'react';
import { X, Image as ImageIcon, MapPin, Globe, Users, Ghost, Loader2, Sparkles } from 'lucide-react';
import api from '../../api/api';
import MentionInput from '../MentionInput';

interface PostModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function PostModal({ onClose, onSuccess }: PostModalProps) {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('public');
  const [location, setLocation] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles([...files, ...selected]);
    const newPreviews = selected.map(f => URL.createObjectURL(f));
    setPreviews([...previews, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    const newPreviews = [...previews];
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setFiles(newFiles);
    setPreviews(newPreviews);
  };

  const handleSubmit = async () => {
    if (!content.trim() && files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('content', content);
      fd.append('post_type', postType);
      fd.append('location', location);
      files.forEach(f => fd.append('media', f));

      await api.post('/posts', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Post creation failed:', err);
      alert('Failed to spark post. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-inner">
      <div className="modal-header">
        <div className="modal-title italic uppercase">
          <Sparkles size={20} strokeWidth={3} className="text-black" /> Create New Post
        </div>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="modal-body">
        <MentionInput
          value={content}
          onChange={setContent}
          className="post-input"
          placeholder="What's happening on campus?"
          autoFocus={true}
        />

        {previews.length > 0 && (
          <div className="media-preview-grid">
            {previews.map((p, i) => (
              <div key={i} className="preview-item">
                <img src={p} alt="" />
                <button className="remove-media" onClick={() => removeFile(i)}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="upload-btn-zone" onClick={() => fileRef.current?.click()}>
          <ImageIcon size={20} />
          <span className="text-[10px] uppercase font-black tracking-widest">Add Photos / Video</span>
          <input type="file" ref={fileRef} hidden multiple accept="image/*,video/*" onChange={handleFileChange} />
        </div>

        <div className="post-options-grid">
          <div className="option-group">
            <label className="text-[10px] uppercase font-black tracking-widest"><Globe size={14} /> Visibility</label>
            <div className="type-chips">
              <div className={`type-chip ${postType === 'public' ? 'active' : ''}`} onClick={() => setPostType('public')}>
                <Globe size={14} /> <span className="text-[10px] uppercase font-black tracking-widest">Public</span>
              </div>
              <div className={`type-chip ${postType === 'campus_only' ? 'active' : ''}`} onClick={() => setPostType('campus_only')}>
                <Users size={14} /> <span className="text-[10px] uppercase font-black tracking-widest">Campus</span>
              </div>
              <div className={`type-chip ${postType === 'anonymous' ? 'active' : ''}`} onClick={() => setPostType('anonymous')}>
                <Ghost size={14} /> <span className="text-[10px] uppercase font-black tracking-widest">Ghost</span>
              </div>
            </div>
          </div>

          <div className="option-group">
            <label className="text-[10px] uppercase font-black tracking-widest"><MapPin size={14} /> Where are you?</label>
            <input 
              type="text" 
              placeholder="Library, Student Center..." 
              className="tag-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <button className="submit-premium-btn" onClick={handleSubmit} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <>Spark It! <Sparkles size={16} strokeWidth={3} /></>}
        </button>
      </div>

      <style>{`
        .modal-inner { display: flex; flex-direction: column; height: 100%; border-radius: 32px; background: white; overflow: hidden; border: 1px solid rgba(0,0,0,0.05); }
        .modal-header { padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.05); background: rgba(0,0,0,0.01); }
        .modal-title { font-weight: 900; font-size: 1.2rem; display: flex; align-items: center; gap: 12px; color: black; letter-spacing: -0.02em; }
        .close-btn { background: none; border: none; color: rgba(0,0,0,0.2); cursor: pointer; padding: 4px; transition: 0.2s; }
        .close-btn:hover { color: black; transform: rotate(90deg); }
        .modal-body { padding: 32px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto; }
        
        .post-input { width: 100%; min-height: 120px; border: none; font-size: 1.2rem; font-family: inherit; outline: none; background: transparent; padding: 0; resize: none; color: black; font-weight: 600; }
        .post-input::placeholder { color: rgba(0,0,0,0.1); font-weight: 600; }

        .media-preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
        .preview-item { position: relative; aspect-ratio: 1; border-radius: 16px; overflow: hidden; background: rgba(0,0,0,0.05); }
        .preview-item img { width: 100%; height: 100%; object-fit: cover; }
        .remove-media { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.8); color: white; border: none; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .remove-media:hover { transform: scale(1.1); }

        .upload-btn-zone { display: flex; align-items: center; gap: 12px; padding: 20px; border: 1px dashed rgba(0,0,0,0.1); border-radius: 20px; color: rgba(0,0,0,0.3); cursor: pointer; transition: 0.2s; font-weight: 800; }
        .upload-btn-zone:hover { border-color: black; background: black; color: white; }

        .post-options-grid { display: flex; flex-direction: column; gap: 24px; }
        .option-group label { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; font-weight: 900; color: rgba(0,0,0,0.2); margin-bottom: 12px; }
        
        .type-chips { display: flex; gap: 10px; flex-wrap: wrap; }
        .type-chip { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 16px; background: rgba(0,0,0,0.03); color: rgba(0,0,0,0.3); font-size: 0.75rem; font-weight: 800; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
        .type-chip:hover { background: rgba(0,0,0,0.05); }
        .type-chip.active { background: black; color: white; border-color: black; }

        .tag-input { width: 100%; padding: 16px 20px; border-radius: 16px; border: 1px solid rgba(0,0,0,0.05); background: rgba(0,0,0,0.02); font-family: inherit; outline: none; transition: 0.2s; box-sizing: border-box; font-weight: 600; color: black; }
        .tag-input:focus { border-color: black; background: white; }
        .tag-input::placeholder { color: rgba(0,0,0,0.1); }

        .submit-premium-btn { width: 100%; padding: 20px; border-radius: 20px; background: #e11d48; color: white; border: none; font-weight: 900; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; transition: 0.2s; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.1em; box-shadow: 0 15px 35px rgba(225, 29, 72, 0.2); }
        .submit-premium-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 20px 40px rgba(225, 29, 72, 0.3); }
        .submit-premium-btn:active { transform: translateY(0); }
        .submit-premium-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
