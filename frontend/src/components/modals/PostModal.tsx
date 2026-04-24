import { useState, useRef } from 'react';
import {
  X, Image as ImageIcon, MapPin, Globe, Ghost, Lock,
  Loader2, Smile, Tag, ChevronDown, Check
} from 'lucide-react';
import api from '../../api/api';
import MentionInput from '../MentionInput';
import { useUserStore } from '../../store/userStore';

interface PostModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const POST_TYPES = [
  { value: 'public', label: 'Public', icon: Globe, color: 'text-blue-500' },
  { value: 'private', label: 'Private', icon: Lock, color: 'text-gray-600' },
  { value: 'friends', label: 'Friends', icon: Ghost, color: 'text-purple-500' },
];

export default function PostModal({ onClose, onSuccess }: PostModalProps) {
  const { user } = useUserStore();

  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('public');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [location, setLocation] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [showEmojiHint, setShowEmojiHint] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedType = POST_TYPES.find(t => t.value === postType) || POST_TYPES[0];
  const TypeIcon = selectedType.icon;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selected]);
    const newPreviews = selected.map(f => URL.createObjectURL(f));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('content', content);
      fd.append('post_type', postType);
      if (location) fd.append('location', location);
      files.forEach(f => fd.append('media', f));
      await api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Post creation failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const canPost = (content.trim().length > 0 || files.length > 0) && !uploading;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal Card */}
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="w-8" /> {/* spacer */}
          <h2 className="text-[17px] font-black text-gray-900 tracking-tight uppercase italic">
            Create Post
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Close"
          >
            <X size={18} className="text-gray-600" strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* User row + post type */}
          <div className="flex items-center gap-3 px-5 py-4">
            <img
              src={user?.avatar_url || '/uploads/avatars/default.png'}
              className="w-11 h-11 rounded-full object-cover border border-gray-100 shrink-0"
              alt=""
            />
            <div>
              <p className="text-[15px] font-bold text-gray-900 leading-tight">
                {user?.name || user?.username}
              </p>

              {/* Post type selector */}
              <div className="relative mt-1">
                <button
                  onClick={() => setShowTypeDropdown(p => !p)}
                  className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <TypeIcon size={13} className={selectedType.color} />
                  <span className="text-[12px] font-semibold text-gray-700 capitalize">
                    {selectedType.label}
                  </span>
                  <ChevronDown size={12} className="text-gray-500" />
                </button>

                {showTypeDropdown && (
                  <div className="absolute top-8 left-0 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    {POST_TYPES.map(t => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.value}
                          onClick={() => { setPostType(t.value); setShowTypeDropdown(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                          <Icon size={16} className={t.color} />
                          <span className="text-[13px] font-semibold text-gray-800">{t.label}</span>
                          {postType === t.value && <Check size={14} className="text-primary ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Text input */}
          <div className="px-5 pb-3">
            <MentionInput
              value={content}
              onChange={setContent}
              className="w-full min-h-[100px] text-[18px] outline-none placeholder:text-gray-300 resize-none border-none bg-transparent"
              placeholder={`What's on your mind, ${user?.name?.split(' ')[0] || ''}?`}
              autoFocus={true}
            />
          </div>

          {/* Emoji hint */}
          {showEmojiHint && (
            <div className="mx-5 mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-[13px] text-yellow-700 font-semibold flex items-center justify-between">
              😊 Emoji picker coming soon — type emojis directly in your post!
              <button onClick={() => setShowEmojiHint(false)}><X size={14} /></button>
            </div>
          )}

          {/* Location input */}
          {showLocationInput && (
            <div className="mx-5 mb-3 flex items-center gap-2 border border-blue-200 bg-blue-50 rounded-xl px-3 py-2">
              <MapPin size={16} className="text-blue-500 shrink-0" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Add a location..."
                className="flex-1 bg-transparent text-[14px] font-semibold text-blue-700 placeholder:text-blue-300 outline-none"
                autoFocus
              />
              <button
                onClick={() => { setShowLocationInput(false); setLocation(''); }}
                className="text-blue-400 hover:text-blue-600"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Media previews */}
          {previews.length > 0 && (
            <div className="mx-5 mb-3 border border-gray-200 rounded-xl overflow-hidden">
              <div className={`grid gap-1 ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {previews.map((p, i) => (
                  <div key={i} className="relative aspect-square bg-gray-100">
                    <img src={p} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X size={12} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
              {/* Clear all */}
              <button
                onClick={() => { setFiles([]); setPreviews([]); }}
                className="w-full py-2 text-[12px] font-bold text-red-500 hover:bg-red-50 transition-colors"
              >
                Remove all media
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-3">

          {/* Add to post row */}
          <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-2.5">
            <span className="text-[14px] font-semibold text-gray-600">Add to your post</span>
            <div className="flex items-center gap-0.5">

              {/* Photo/Video */}
              <button
                onClick={() => fileRef.current?.click()}
                title="Photo / Video"
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors group"
              >
                <ImageIcon size={22} className="text-[#45bd62] group-hover:scale-110 transition-transform" />
              </button>

              {/* Tag */}
              <button
                onClick={() => alert('Tag people — coming soon!')}
                title="Tag people"
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors group"
              >
                <Tag size={22} className="text-[#1877F2] group-hover:scale-110 transition-transform" />
              </button>

              {/* Feeling / Emoji */}
              <button
                onClick={() => setShowEmojiHint(true)}
                title="Feeling / Emoji"
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors group"
              >
                <Smile size={22} className="text-[#f7b928] group-hover:scale-110 transition-transform" />
              </button>

              {/* Location */}
              <button
                onClick={() => setShowLocationInput(p => !p)}
                title="Check in"
                className={`p-2 hover:bg-gray-100 rounded-xl transition-colors group ${showLocationInput ? 'bg-blue-50' : ''}`}
              >
                <MapPin size={22} className={`group-hover:scale-110 transition-transform ${showLocationInput ? 'text-blue-600' : 'text-[#f02849]'}`} />
              </button>

            </div>
            <input
              type="file"
              ref={fileRef}
              hidden
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
            />
          </div>

          {/* Post button */}
          <button
            onClick={handleSubmit}
            disabled={!canPost}
            className="w-full py-3 rounded-xl font-black text-[15px] tracking-tight transition-all
              disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
              bg-primary hover:bg-primary/90 active:scale-[0.98] text-white shadow-lg shadow-primary/20"
          >
            {uploading
              ? <Loader2 size={20} className="animate-spin mx-auto" />
              : 'Post'}
          </button>
        </div>

      </div>
    </div>
  );
}
