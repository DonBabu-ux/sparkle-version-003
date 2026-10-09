import { showError } from '../../utils/toast';
import { useState, useRef } from 'react';
import { X, Repeat2, AtSign } from 'lucide-react';
import api from '../../api/api';
import { useModalStore } from '../../store/modalStore';
import Spinner from '../ui/Spinner';
import { logger } from '../../utils/logger';
import { useModalA11y } from '../../hooks/useModalA11y';
import MentionAutocomplete from '../MentionAutocomplete';
import { useMentionSearch } from '../../hooks/useMentionSearch';

export default function ReshareModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { modalData: originalPost } = useModalStore();
  const [comment, setComment] = useState('');
  const [resharing, setResharing] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { options: suggestions, loading } = useMentionSearch(mentionQuery, { minLength: 2 });
  // Store-driven modal: rendered only once the post payload has loaded.
  const a11yRef = useModalA11y(!!originalPost, onClose);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > 500) return;
    const pos = e.target.selectionStart;
    setComment(val);
    setCursorPos(pos);

    const beforeCursor = val.slice(0, pos);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[0]);
    } else {
      setMentionQuery('');
    }
  };

  const selectMention = (username: string) => {
    const beforeMention = comment.slice(0, cursorPos - mentionQuery.length);
    const afterMention = comment.slice(cursorPos);
    const newComment = `${beforeMention}@${username} ${afterMention}`;
    setComment(newComment);
    setMentionQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleSubmit = async () => {
    if (!originalPost) return;
    setResharing(true);
    try {
      await api.post(`/posts/${originalPost.post_id}/reshare`, { comment });
      onSuccess();
      onClose();
    } catch (err) {
      logger.error('Reshare failed:', err);
      showError('Failed to reshare post.');
    } finally {
      setResharing(false);
    }
  };

  if (!originalPost) return null;

  return (
    <div ref={a11yRef} role="dialog" aria-modal="true" tabIndex={-1} className="modal-inner">
      <div className="modal-header border-none">
        <div className="modal-title text-slate-900 font-black">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Repeat2 size={20} className="text-indigo-600" />
          </div>
          Add Your Thoughts
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="modal-body px-6 pb-6 gap-4">
        <div className="relative">
          <textarea
            ref={inputRef}
            className="reshare-input text-lg font-medium min-h-[120px]"
            placeholder="What's on your mind? Mention friends with @..."
            value={comment}
            onChange={handleInputChange}
            autoFocus
          />
          
          <MentionAutocomplete
            options={suggestions}
            loading={loading}
            onSelect={(u) => selectMention(u.username)}
            className="absolute top-full left-0 w-full z-50 mt-1 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2"
          />
        </div>

        <div className="original-post-preview group hover:border-indigo-200 transition-colors">
          <div className="preview-header">
            <img src={originalPost.avatar_url || '/uploads/avatars/default.png'} alt="" className="preview-avatar" />
            <span className="preview-username">{originalPost.username}</span>
            <span className="text-slate-400 text-xs font-medium ml-auto">Original Post</span>
          </div>
          <div className="preview-content">
            {originalPost.content && <p className="preview-text text-slate-600 italic">{originalPost.content}</p>}
            {originalPost.media_url && (
              <div className="preview-media grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500">
                {originalPost.media_type === 'video' ? (
                  <div className="video-placeholder bg-slate-100 flex items-center justify-center gap-2 py-8">
                    <Spinner size="small" color="text-primary" />
                    <span className="text-slate-500 font-bold">Video Clip</span>
                  </div>
                ) : (
                  <img src={originalPost.media_url} alt="" />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
           <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-400">
                 <AtSign size={14} />
                 <span className="text-[10px] font-bold">Press @ to mention</span>
              </div>
              <span className={`text-[10px] font-black ${comment.length > 450 ? 'text-red-500' : 'text-slate-300'}`}>
                {comment.length} / 500
              </span>
           </div>
           <button 
             className="px-8 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
             onClick={handleSubmit} 
             disabled={resharing}
           >
             {resharing ? <Spinner size="medium" color="text-primary" /> : <>Post <Repeat2 size={18} /></>}
           </button>
        </div>
      </div>

      <style>{`
        .modal-inner { display: flex; flex-direction: column; height: auto; max-height: 90vh; border-radius: 32px; background: white; overflow: hidden; width: 100%; max-width: 500px; }
        .reshare-input { width: 100%; border: none; font-family: inherit; outline: none; background: transparent; padding: 0; resize: none; color: #1e293b; }
        .reshare-input::placeholder { color: #cbd5e1; }
        .original-post-preview { border: 2px dashed #f1f5f9; border-radius: 20px; padding: 16px; background: #fcfdfe; }
        .preview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .preview-avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
        .preview-username { font-weight: 800; font-size: 0.85rem; color: #1e293b; }
        .preview-text { font-size: 0.85rem; color: #64748b; line-height: 1.5; margin-bottom: 8px; }
        .preview-media { border-radius: 12px; overflow: hidden; max-height: 140px; }
        .preview-media img { width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </div>
  );
}
