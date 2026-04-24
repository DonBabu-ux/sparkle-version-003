import { useState, useRef } from 'react';
import { X, Image as ImageIcon, MapPin, Globe, Users, Ghost, Loader2, User, Smile, Tag, MoreHorizontal } from 'lucide-react';
import api from '../../api/api';
import MentionInput from '../MentionInput';
import { useUserStore } from '../../store/userStore';

interface PostModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function PostModal({ onClose, onSuccess }: PostModalProps) {
  const { user } = useUserStore();
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
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fb-modal">
      <div className="fb-modal-header">
        <h2 className="text-[20px] font-bold text-gray-900">Create post</h2>
        <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
          <X size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="p-4 max-h-[500px] overflow-y-auto no-scrollbar">
        {/* User Info */}
        <div className="flex gap-3 items-center mb-4">
          <img 
            src={user?.avatar_url || '/uploads/avatars/default.png'} 
            className="w-10 h-10 rounded-full object-cover" 
            alt="" 
          />
          <div>
            <p className="text-[15px] font-semibold text-gray-900">{user?.name}</p>
            <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md w-fit mt-0.5 cursor-pointer hover:bg-gray-200">
              {postType === 'public' ? <Globe size={12} /> : postType === 'campus_only' ? <Users size={12} /> : <Ghost size={12} />}
              <span className="text-[12px] font-semibold text-gray-700 capitalize">{postType.replace('_', ' ')}</span>
              <span className="text-[10px]">▼</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <MentionInput
          value={content}
          onChange={setContent}
          className="fb-post-input w-full min-h-[120px] text-[24px] outline-none placeholder:text-gray-400 resize-none border-none"
          placeholder={`What's on your mind, ${user?.name?.split(' ')[0] || ''}?`}
          autoFocus={true}
        />

        {/* Media Preview */}
        {previews.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4 relative border border-gray-200 rounded-lg p-2">
            <button 
              onClick={() => { setFiles([]); setPreviews([]); }}
              className="absolute top-4 right-4 z-10 bg-white p-1.5 rounded-full shadow-md border border-gray-200 hover:bg-gray-50"
            >
              <X size={16} />
            </button>
            {previews.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-gray-100">
                <img src={p} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Location display if set */}
        {location && (
          <div className="mt-3 flex items-center gap-2 text-blue-600 font-semibold text-[14px]">
            <MapPin size={16} /> {location}
            <button onClick={() => setLocation('')} className="text-gray-400 ml-auto">✕</button>
          </div>
        )}
      </div>

      {/* Add to your post bar */}
      <div className="p-4 pt-0">
        <div className="border border-gray-300 rounded-lg p-3 flex items-center justify-between shadow-sm">
          <span className="text-[15px] font-semibold text-gray-700">Add to your post</span>
          <div className="flex gap-1">
            <button onClick={() => fileRef.current?.click()} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Photo/video">
              <ImageIcon size={24} className="text-[#45bd62]" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Tag people">
              <Tag size={24} className="text-[#1877F2]" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Feeling/activity">
              <Smile size={24} className="text-[#f7b928]" />
            </button>
            <button onClick={() => setLocation(prompt('Enter location') || '')} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Check in">
              <MapPin size={24} className="text-[#f02849]" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <MoreHorizontal size={24} className="text-gray-500" />
            </button>
          </div>
          <input type="file" ref={fileRef} hidden multiple accept="image/*,video/*" onChange={handleFileChange} />
        </div>

        {/* Post Button */}
        <button 
          onClick={handleSubmit}
          disabled={uploading || (!content.trim() && files.length === 0)}
          className="w-full mt-4 py-2 bg-[#1877F2] hover:bg-[#166fe5] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-md transition-colors text-[16px]"
        >
          {uploading ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Post'}
        </button>
      </div>

      <style>{`
        .fb-modal { background: white; width: 500px; border-radius: 8px; box-shadow: 0 12px 28px 0 rgba(0,0,0,0.2), 0 2px 4px 0 rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: column; }
        .fb-modal-header { padding: 16px; border-bottom: 1px solid #ddd; display: flex; justify-content: center; align-items: center; position: relative; }
        .fb-modal-header h2 { margin: 0; }
        .fb-modal-header button { position: absolute; right: 16px; }
        .fb-post-input { min-height: 100px; border: none; padding: 0; font-family: inherit; }
        .fb-post-input:focus { box-shadow: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

