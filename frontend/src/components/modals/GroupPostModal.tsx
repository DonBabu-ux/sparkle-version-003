import { useState, useRef } from 'react';
import {
  X, Image as ImageIcon,
  Loader2, Smile, ArrowLeft, Users
} from 'lucide-react';
import api from '../../api/api';
import MentionInput from '../MentionInput';
import { useUserStore } from '../../store/userStore';
import { getAvatarUrl } from '../../utils/imageUtils';
import FeelingActivitySelector from './FeelingActivitySelector';

interface GroupPostModalProps {
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSuccess: () => void;
  initialView?: 'post' | 'feeling';
}

export default function GroupPostModal({ groupId, groupName, onClose, onSuccess, initialView = 'post' }: GroupPostModalProps) {
  const { user } = useUserStore();

  const [content, setContent] = useState('');
  const [showSelector, setShowSelector] = useState(initialView === 'feeling');
  const [selections, setSelections] = useState<{ 
    feeling: any | null, 
    activity: any | null,
    subOption: string | null,
    taggedUsers: any[] 
  }>({ feeling: null, activity: null, subOption: null, taggedUsers: [] });
  
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      if (selections.feeling) {
        fd.append('feeling', selections.feeling.name);
      }
      if (selections.activity) {
        const activityValue = selections.subOption 
          ? `${selections.activity.name} ${selections.subOption}` 
          : selections.activity.name;
        fd.append('activity', activityValue);
      }
      if (selections.taggedUsers.length > 0) {
        fd.append('tagged_users', JSON.stringify(selections.taggedUsers.map(u => ({
          user_id: u.user_id,
          username: u.username,
          name: u.name
        }))));
      }
      
      files.forEach(f => fd.append('image', f));
      await api.post(`/groups/${groupId}/post`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Group post creation failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const canPost = (content.trim().length > 0 || files.length > 0) && !uploading;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[95vh] relative"
        onClick={e => e.stopPropagation()}
      >
        {showSelector && (
          <FeelingActivitySelector 
            initialSelection={selections}
            onSelect={(newSelections) => {
              setSelections(newSelections);
              setShowSelector(false);
            }}
            onClose={() => setShowSelector(false)}
          />
        )}

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="w-8" />
          <h2 className="text-[17px] font-black text-gray-900 tracking-tight uppercase italic">
            Post to {groupName}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X size={18} className="text-gray-600" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 px-5 py-4">
            <img
              src={getAvatarUrl(user?.avatar_url, user?.username)}
              className="w-11 h-11 rounded-full object-cover border border-gray-100 shrink-0"
              alt=""
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-x-1 gap-y-0.5">
                <p className="text-[15px] font-bold text-gray-900 leading-tight">
                  {user?.name || user?.username}
                </p>
                
                {(selections.feeling || selections.activity || selections.taggedUsers.length > 0) && (
                  <div className="flex items-center flex-wrap gap-1 text-[14px] text-gray-500 font-medium">
                    {selections.feeling && (
                      <>
                        <span>is feeling</span>
                        <span className="font-bold text-gray-900 capitalize flex items-center gap-1">
                          {selections.feeling.name}
                          {selections.feeling.icon && <selections.feeling.icon size={14} className="text-primary" />}
                        </span>
                      </>
                    )}
                    
                    {selections.feeling && (selections.activity || selections.taggedUsers.length > 0) && <span>and</span>}
                    
                    {selections.activity && (
                      <>
                        {!selections.feeling && <span>is</span>}
                        <span className="font-bold text-gray-900 capitalize flex items-center gap-1">
                          {selections.activity.name}
                          {selections.subOption && <span className="text-primary ml-0.5">{selections.subOption}</span>}
                          {selections.activity.icon && <selections.activity.icon size={14} className="text-primary" />}
                        </span>
                      </>
                    )}

                    {selections.taggedUsers.length > 0 && (
                      <>
                        <span>with</span>
                        <span className="font-bold text-gray-900">
                          {selections.taggedUsers[0].name || selections.taggedUsers[0].username}
                          {selections.taggedUsers.length > 1 && ` and ${selections.taggedUsers.length - 1} others`}
                        </span>
                        <Users size={14} className="text-primary" />
                      </>
                    )}

                    <button 
                      onClick={() => setSelections({ feeling: null, activity: null, subOption: null, taggedUsers: [] })}
                      className="ml-1 w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100 w-fit">
                <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider italic">Member</span>
              </div>
            </div>
          </div>

          <div className="px-5 pb-3">
            <MentionInput
              value={content}
              onChange={setContent}
              className="w-full min-h-[120px] text-[18px] outline-none placeholder:text-gray-300 resize-none border-none bg-transparent"
              placeholder={`Share something with ${groupName}...`}
              autoFocus={true}
            />
          </div>

          {previews.length > 0 && (
            <div className="mx-5 mb-3 border border-gray-200 rounded-lg overflow-hidden">
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
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-2.5">
            <span className="text-[14px] font-semibold text-gray-600">Add to your post</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                title="Add Photos"
              >
                <ImageIcon size={22} className="text-[#45bd62] group-hover:scale-110 transition-transform" />
              </button>
              <button
                onClick={() => setShowSelector(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                title="Feeling/Activity/Tag"
              >
                <Smile size={22} className="text-[#f7b928] group-hover:scale-110 transition-transform" />
              </button>
            </div>
            <input
              type="file"
              ref={fileRef}
              hidden
              multiple
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canPost}
            className="w-full py-3 rounded-lg font-black text-[15px] tracking-tight transition-all
              disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
              bg-primary hover:bg-primary/90 active:scale-[0.98] text-white shadow-xl shadow-primary/40"
          >
            {uploading ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Post to Circle'}
          </button>
        </div>
      </div>
    </div>
  );
}
