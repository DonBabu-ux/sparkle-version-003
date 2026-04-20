import { useState } from 'react';
import { X, Repeat2, Loader2 } from 'lucide-react';
import api from '../../api/api';
import { useModalStore } from '../../store/modalStore';

interface ReshareModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReshareModal({ onClose, onSuccess }: ReshareModalProps) {
  const { modalData: originalPost } = useModalStore();
  const [comment, setComment] = useState('');
  const [resharing, setResharing] = useState(false);

  const handleSubmit = async () => {
    if (!originalPost) return;
    setResharing(true);
    try {
      await api.post(`/posts/${originalPost.post_id}/reshare`, { comment });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Reshare failed:', err);
      alert('Failed to reshare post. Please try again.');
    } finally {
      setResharing(false);
    }
  };

  if (!originalPost) return null;

  return (
    <div className="modal-inner">
      <div className="modal-header">
        <div className="modal-title">
          <Repeat2 size={20} className="text-primary" /> Reshare Post
        </div>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="modal-body">
        <textarea
          className="reshare-input"
          placeholder="Add a comment... (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          autoFocus
        />

        <div className="original-post-preview">
          <div className="preview-header">
            <img src={originalPost.avatar_url || '/uploads/avatars/default.png'} alt="" className="preview-avatar" />
            <span className="preview-username">{originalPost.username}</span>
          </div>
          <div className="preview-content">
            {originalPost.content && <p className="preview-text">{originalPost.content}</p>}
            {originalPost.media_url && (
              <div className="preview-media">
                {originalPost.media_type === 'video' ? (
                  <div className="video-placeholder">Video Content</div>
                ) : (
                  <img src={originalPost.media_url} alt="" />
                )}
              </div>
            )}
          </div>
        </div>

        <button className="submit-premium-btn" onClick={handleSubmit} disabled={resharing}>
          {resharing ? <Loader2 className="animate-spin" /> : <>Reshare <Repeat2 size={18} /></>}
        </button>
      </div>

      <style>{`
        .modal-inner { display: flex; flex-direction: column; height: 100%; border-radius: 28px; background: white; overflow: hidden; }
        .modal-header { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #efefef; }
        .modal-title { font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; color: var(--primary); }
        .close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; }
        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
        
        .reshare-input { width: 100%; min-height: 80px; border: none; font-size: 1.1rem; font-family: inherit; outline: none; background: transparent; padding: 0; resize: none; color: #1e293b; }
        .reshare-input::placeholder { color: #94a3b8; }

        .original-post-preview { border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; background: #f8fafc; }
        .preview-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .preview-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
        .preview-username { font-weight: 700; font-size: 0.9rem; color: #1e293b; }
        .preview-text { font-size: 0.9rem; color: #475569; line-height: 1.4; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .preview-media { border-radius: 12px; overflow: hidden; max-height: 200px; background: #e2e8f0; }
        .preview-media img { width: 100%; height: 100%; object-fit: cover; }
        .video-placeholder { padding: 20px; text-align: center; color: #64748b; font-size: 0.8rem; font-weight: 600; }

        .submit-premium-btn { width: 100%; padding: 16px; border-radius: 16px; background: var(--primary-gradient); color: white; border: none; font-weight: 800; font-size: 1.05rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 20px rgba(255, 61, 109, 0.3); transition: 0.2s; margin-top: 10px; }
        .submit-premium-btn:hover:not(:disabled) { transform: translateY(-2px); opacity: 0.95; }
        .submit-premium-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
