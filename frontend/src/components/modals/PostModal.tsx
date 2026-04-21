import { useState, useRef } from 'react';
import { X, Image as ImageIcon, MapPin, Globe, Users, Ghost, Loader2 } from 'lucide-react';
import api from '../../api/api';

interface PostModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

import MentionInput from '../MentionInput';

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
        <div className="modal-title">
          <i className="fas fa-plus-circle"></i> Create New Post
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
          <span>Add Photos / Video</span>
          <input type="file" ref={fileRef} hidden multiple accept="image/*,video/*" onChange={handleFileChange} />
        </div>

        <div className="post-options-grid">
          <div className="option-group">
            <label><Globe size={14} /> Visibility</label>
            <div className="type-chips">
              <div className={`type-chip ${postType === 'public' ? 'active' : ''}`} onClick={() => setPostType('public')}>
                <Globe size={14} /> Public
              </div>
              <div className={`type-chip ${postType === 'campus_only' ? 'active' : ''}`} onClick={() => setPostType('campus_only')}>
                <Users size={14} /> Campus
              </div>
              <div className={`type-chip ${postType === 'anonymous' ? 'active' : ''}`} onClick={() => setPostType('anonymous')}>
                <Ghost size={14} /> Ghost
              </div>
            </div>
          </div>

          <div className="option-group">
            <label><MapPin size={14} /> Where are you?</label>
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
          {uploading ? <Loader2 className="animate-spin" /> : <>Spark It! <i className="fas fa-bolt"></i></>}
        </button>
      </div>

      <style>{`
        .modal-inner { display: flex; flex-direction: column; height: 100%; border-radius: 28px; background: white; overflow: hidden; }
        .modal-header { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #efefef; }
        .modal-title { font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; color: var(--primary); }
        .close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; }
        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
        
        .post-input { width: 100%; min-height: 100px; border: none; font-size: 1.15rem; font-family: inherit; outline: none; background: transparent; padding: 0; resize: none; color: #1e293b; }
        .post-input::placeholder { color: #94a3b8; }

        .media-preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; }
        .preview-item { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #f1f5f9; }
        .preview-item img { width: 100%; height: 100%; object-fit: cover; }
        .remove-media { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; border: none; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }

        .upload-btn-zone { display: flex; align-items: center; gap: 12px; padding: 16px; border: 2px dashed #e2e8f0; border-radius: 16px; color: #64748b; cursor: pointer; transition: 0.2s; font-weight: 600; }
        .upload-btn-zone:hover { border-color: var(--primary); background: rgba(255,107,139,0.05); color: var(--primary); }

        .post-options-grid { display: flex; flex-direction: column; gap: 20px; }
        .option-group label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 700; color: #64748b; margin-bottom: 10px; }
        
        .type-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .type-chip { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; background: #f1f5f9; color: #64748b; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .type-chip.active { background: var(--primary-gradient); color: white; }

        .tag-input { width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: inherit; outline: none; transition: 0.2s; box-sizing: border-box; }
        .tag-input:focus { border-color: var(--primary); }

        .submit-premium-btn { width: 100%; padding: 16px; border-radius: 16px; background: var(--primary-gradient); color: white; border: none; font-weight: 800; font-size: 1.05rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 20px rgba(255, 61, 109, 0.3); transition: 0.2s; margin-top: 10px; }
        .submit-premium-btn:hover:not(:disabled) { transform: translateY(-2px); opacity: 0.95; }
        .submit-premium-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
