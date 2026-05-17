import { useState, useRef } from 'react';
import {
  X, Image as ImageIcon, MapPin, Globe, Ghost, Lock,
  Loader2, Smile, Tag, ChevronDown, Check, Users, Sparkles
} from 'lucide-react';
import api from '../../api/api';
import MentionInput from '../MentionInput';
import { useUserStore } from '../../store/userStore';
import { useModalStore } from '../../store/modalStore';
import Spinner from '../ui/Spinner';
import FeelingActivitySelector from './FeelingActivitySelector';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface PostModalProps {
  onClose: () => void;
  onSuccess: () => void;
  editPost?: any;
}

const SpyIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M17 10c.5-1.5 0-3-1-4l-1-1h-6l-1 1c-1 1-1.5 2.5-1 4" />
    <path d="M3 10h18l-1.5 3H4.5L3 10z" />
    <circle cx="8.5" cy="17" r="2.5" />
    <circle cx="15.5" cy="17" r="2.5" />
    <path d="M11 17h2" />
  </svg>
);

const POST_TYPES = [
  { value: 'public', label: 'Public', icon: Globe, color: 'text-blue-500' },
  { value: 'private', label: 'Private', icon: Lock, color: 'text-gray-600 dark:text-gray-400' },
  { value: 'friends', label: 'Incognito', icon: SpyIcon, color: 'text-purple-500' },
];



export default function PostModal({ onClose, onSuccess, editPost }: PostModalProps) {
  const { user } = useUserStore();
  const { modalData } = useModalStore();
  const initialFiles = (modalData as any)?.initialFiles || [];

  const [content, setContent] = useState(editPost?.content || '');
  const [postType, setPostType] = useState(editPost?.post_type || 'public');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [location, setLocation] = useState(editPost?.location || '');
  const [showLocationInput, setShowLocationInput] = useState(!!editPost?.location);
  const [showEmojiHint, setShowEmojiHint] = useState(false);
  
  const [showSelector, setShowSelector] = useState(false);
  const initialSelections = (modalData as any)?.initialSelections;
  const [selections, setSelections] = useState<{ 
    feeling: any | null, 
    activity: any | null,
    subOption: string | null,
    taggedUsers: any[] 
  }>({ 
    feeling: initialSelections?.feeling || (editPost?.feeling ? { name: editPost.feeling } : null), 
    activity: initialSelections?.activity || (editPost?.activity ? { name: editPost.activity } : null), 
    subOption: initialSelections?.subOption || null, 
    taggedUsers: initialSelections?.taggedUsers || [] 
  });
  const [selectorTab, setSelectorTab] = useState<'feeling' | 'activity' | 'tag'>('feeling');
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [previews, setPreviews] = useState<string[]>(
    editPost?.media_url ? editPost.media_url.split(',') : initialFiles.map((f: File) => URL.createObjectURL(f))
  );
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
      if (selections.feeling) {
        fd.append('feeling', selections.feeling.name);
      }
      if (selections.activity) {
        const activityValue = selections.subOption 
          ? `${selections.activity.name} ${selections.subOption}` 
          : selections.activity.name;
        fd.append('activity', activityValue);
      }
      files.forEach(f => fd.append('media', f));
      
      if (editPost) {
        await api.patch(`/posts/${editPost.post_id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Post operation failed:', err);
      alert('Failed to save post.');
    } finally {
      setUploading(false);
    }
  };

  const canPost = (content.trim().length > 0 || files.length > 0) && !uploading;

  return (
    <div
      className="fixed inset-0 z-[99999] bg-white dark:bg-zinc-950 text-black dark:text-white flex flex-col overflow-hidden safe-area-top safe-area-bottom animate-in slide-in-from-bottom duration-300"
    >
        {showSelector && (
          <FeelingActivitySelector 
            initialSelection={selections}
            initialTab={selectorTab}
            onSelect={(newSelections) => {
              setSelections(newSelections);
              setShowSelector(false);
            }}
            onClose={() => setShowSelector(false)}
          />
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/10">
          <div className="w-8" /> {/* spacer */}
          <h2 className="text-[17px] font-black text-gray-900 dark:text-white tracking-tight uppercase italic">
            {editPost ? 'Edit Post' : 'Create Post'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X size={18} className="text-gray-600 dark:text-white/60" strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">

          {/* User row + post type */}
          <div className="flex items-center gap-3 px-5 py-4">
            <img
              src={user?.avatar_url || '/uploads/avatars/default.png'}
              className="w-11 h-11 rounded-full object-cover border border-black/5 dark:border-white/10 shrink-0"
              alt=""
            />
            <div>
              <div className="flex items-center flex-wrap gap-x-1 gap-y-0.5">
                <p className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight">
                  {user?.name || user?.username}
                </p>
                
                {(selections.feeling || selections.activity || selections.taggedUsers.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selections.feeling && (
                      <span className="inline-flex items-center gap-1 py-1 px-2.5 rounded-full font-black text-[11px] uppercase tracking-wider bg-pink-500/10 dark:bg-pink-500/20 backdrop-blur-md text-pink-600 dark:text-pink-300 border border-pink-500/20 dark:border-pink-500/10 shadow-sm animate-fade-in shrink-0">
                        {selections.feeling.icon && <selections.feeling.icon size={12} className="text-pink-500" />}
                        <span>feeling {selections.feeling.name}</span>
                        <button 
                          onClick={() => setSelections(prev => ({ ...prev, feeling: null }))}
                          className="ml-1.5 w-3.5 h-3.5 rounded-full bg-pink-500/20 dark:bg-pink-500/30 flex items-center justify-center hover:bg-pink-500/30 dark:hover:bg-pink-500/40 transition-colors shrink-0"
                          title="Remove feeling"
                        >
                          <X size={9} className="text-pink-600 dark:text-pink-300" />
                        </button>
                      </span>
                    )}
                    
                    {selections.activity && (
                      <span className="inline-flex items-center gap-1 py-1 px-2.5 rounded-full font-black text-[11px] uppercase tracking-wider bg-pink-500/10 dark:bg-pink-500/20 backdrop-blur-md text-pink-600 dark:text-pink-300 border border-pink-500/20 dark:border-pink-500/10 shadow-sm animate-fade-in shrink-0">
                        {selections.activity.icon && <selections.activity.icon size={12} className="text-pink-500" />}
                        <span>{selections.activity.name}{selections.subOption ? `: ${selections.subOption}` : ''}</span>
                        <button 
                          onClick={() => setSelections(prev => ({ ...prev, activity: null, subOption: null }))}
                          className="ml-1.5 w-3.5 h-3.5 rounded-full bg-pink-500/20 dark:bg-pink-500/30 flex items-center justify-center hover:bg-pink-500/30 dark:hover:bg-pink-500/40 transition-colors shrink-0"
                          title="Remove activity"
                        >
                          <X size={9} className="text-pink-600 dark:text-pink-300" />
                        </button>
                      </span>
                    )}

                    {selections.taggedUsers.length > 0 && (
                      <span className="inline-flex items-center gap-1 py-1 px-2.5 rounded-full font-black text-[11px] uppercase tracking-wider bg-pink-500/10 dark:bg-pink-500/20 backdrop-blur-md text-pink-600 dark:text-pink-300 border border-pink-500/20 dark:border-pink-500/10 shadow-sm animate-fade-in shrink-0">
                        <Users size={12} className="text-pink-500" />
                        <span>with {selections.taggedUsers[0].name || selections.taggedUsers[0].username}{selections.taggedUsers.length > 1 ? ` +${selections.taggedUsers.length - 1}` : ''}</span>
                        <button 
                          onClick={() => setSelections(prev => ({ ...prev, taggedUsers: [] }))}
                          className="ml-1.5 w-3.5 h-3.5 rounded-full bg-pink-500/20 dark:bg-pink-500/30 flex items-center justify-center hover:bg-pink-500/30 dark:hover:bg-pink-500/40 transition-colors shrink-0"
                          title="Remove tagged friends"
                        >
                          <X size={9} className="text-pink-600 dark:text-pink-300" />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Post type selector */}
              <div className="relative mt-1">
                <button
                  onClick={() => setShowTypeDropdown(p => !p)}
                  className="flex items-center gap-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-2.5 py-1 rounded-lg transition-colors border border-transparent dark:border-white/5"
                >
                  <TypeIcon size={13} className={selectedType.color} />
                  <span className="text-[12px] font-semibold text-gray-700 dark:text-white/70 capitalize">
                    {selectedType.label}
                  </span>
                  <ChevronDown size={12} className="text-gray-500 dark:text-white/30" />
                </button>

                {showTypeDropdown && (
                  <div className="absolute top-8 left-0 w-44 bg-white dark:bg-black rounded-xl shadow-2xl border border-black/5 dark:border-white/10 z-50 overflow-hidden animate-scale-in">
                    {POST_TYPES.map(t => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.value}
                          onClick={() => { setPostType(t.value); setShowTypeDropdown(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <Icon size={16} className={t.color} />
                          <span className="text-[13px] font-semibold text-gray-800 dark:text-white/90">{t.label}</span>
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
              className="w-full min-h-[100px] text-[18px] outline-none placeholder:text-gray-300 dark:placeholder:text-white/20 text-black dark:text-white resize-none border-none bg-transparent"
              placeholder={`What's on your mind, ${user?.name?.split(' ')[0] || ''}?`}
              autoFocus={true}
            />
          </div>

          {/* Emoji Picker */}
          {showEmojiHint && (
            <div className="mx-5 mb-4 border border-black/5 dark:border-white/10 rounded-[8px] overflow-hidden shadow-xl flex flex-col relative z-20">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-900 border-b border-black/5 dark:border-white/10">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/40">Select Emoji</span>
                <button onClick={() => setShowEmojiHint(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
              <div className="w-full overflow-hidden bg-white dark:bg-zinc-950">
                <Picker 
                  data={data} 
                  onEmojiSelect={(emoji: any) => {
                    setContent(prev => prev + emoji.native);
                  }} 
                  theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                  previewPosition="none"
                  skinTonePosition="none"
                  perLine={9}
                  width="100%"
                  dynamicWidth={true}
                />
              </div>
            </div>
          )}

          {/* Location input */}
          {showLocationInput && (
            <div className="mx-5 mb-3 flex items-center gap-2 border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2">
              <MapPin size={16} className="text-blue-500 shrink-0" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Add a location..."
                className="flex-1 bg-transparent text-[14px] font-semibold text-blue-700 dark:text-blue-400 placeholder:text-blue-300 dark:placeholder:text-blue-900/50 outline-none"
                autoFocus
              />
              <button
                onClick={() => { setShowLocationInput(false); setLocation(''); }}
                className="text-blue-400 hover:text-blue-600 dark:text-blue-600/60 dark:hover:text-blue-400"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Media previews */}
          {previews.length > 0 && (
            <div className="mx-5 mb-3 border border-black/5 dark:border-white/10 rounded-xl overflow-hidden">
              <div className={`grid gap-1 ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {previews.map((p, i) => (
                  <div key={i} className="relative aspect-square bg-black/5 dark:bg-white/5">
                    <img src={p} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors border border-white/20"
                    >
                      <X size={12} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
              {/* Clear all */}
              <button
                onClick={() => { setFiles([]); setPreviews([]); }}
                className="w-full py-2 text-[12px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                Remove all media
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 pb-5 pt-3 border-t border-black/5 dark:border-white/10 space-y-3">

          {/* Add to post row */}
          <div className="flex items-center justify-between border border-black/5 dark:border-white/10 rounded-xl px-4 py-2.5 bg-black/5 dark:bg-white/5">
            <span className="text-[14px] font-semibold text-gray-600 dark:text-white/50">Add to your post</span>
            <div className="flex items-center gap-0.5">

              {/* Photo/Video */}
              <button
                onClick={() => fileRef.current?.click()}
                title="Photo / Video"
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors group"
              >
                <ImageIcon size={22} className="text-[#45bd62] group-hover:scale-110 transition-transform" />
              </button>

              {/* Tag */}
              <button
                onClick={() => { setSelectorTab('tag'); setShowSelector(true); }}
                title="Tag people"
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors group"
              >
                <Tag size={22} className="text-[#1877F2] group-hover:scale-110 transition-transform" />
              </button>

              {/* Feeling / Activity */}
              <button
                onClick={() => { setSelectorTab('feeling'); setShowSelector(true); }}
                title="Feeling / Activity"
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors group"
              >
                <Sparkles size={22} className="text-[#a855f7] group-hover:scale-110 transition-transform" />
              </button>

              {/* Emoji Picker */}
              <button
                onClick={() => setShowEmojiHint(p => !p)}
                title="Insert Emojis"
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors group"
              >
                <Smile size={22} className="text-[#f7b928] group-hover:scale-110 transition-transform" />
              </button>

              {/* Location */}
              <button
                onClick={() => setShowLocationInput(p => !p)}
                title="Check in"
                className={`p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors group ${showLocationInput ? 'bg-blue-100/50 dark:bg-blue-900/30' : ''}`}
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
              disabled:bg-black/5 dark:disabled:bg-white/5 disabled:text-black/20 dark:disabled:text-white/20 disabled:cursor-not-allowed
              bg-primary hover:bg-primary/90 active:scale-[0.98] text-white shadow-lg shadow-primary/20"
          >
            {uploading
              ? <Spinner size="medium" color="text-white" />
              : (editPost ? 'Save Changes' : 'Post')}
          </button>
        </div>
      </div>
  );
}
