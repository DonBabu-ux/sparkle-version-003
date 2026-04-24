import { useState, useEffect } from 'react';
import { X, Search, Send, Link, MessageCircle, Share2, MoreHorizontal, PlusCircle, Bookmark, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';
import type { User } from '../../types/user';
import type { Moment } from '../../types/moment';

interface MomentShareModalProps {
  moment: Moment;
  onClose: () => void;
  onDownload: (moment: Moment) => void;
}

export default function MomentShareModal({ moment, onClose, onDownload }: MomentShareModalProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [recipients, setRecipients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(moment.is_saved || false);

  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [storyCaption, setStoryCaption] = useState('');
  const [sharingStory, setSharingStory] = useState(false);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await api.get('/users/following');
        let data = res.data.following || res.data || [];
        // Prioritize online friends
        data.sort((a: any, b: any) => (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0));
        setRecipients(data);
      } catch (err) {
        console.error('Failed to fetch recipients', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, []);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/moments/${moment.moment_id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareToFriend = async (friend: User) => {
    try {
      const url = `${window.location.origin}/moments/${moment.moment_id}`;
      await api.post('/messages', {
        receiver_id: friend.user_id,
        content: `Check out this Moment: ${url}`
      });
      onClose();
    } catch (err) {
      console.error('Failed to share to friend', err);
    }
  };

  const handleDownload = () => {
    onDownload(moment);
  };

  const handleNativeShare = async () => {
    const url = `${window.location.origin}/moments/${moment.moment_id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Sparkle Moment',
          text: `Check out this Moment by @${moment.username} on Sparkle!`,
          url: url,
        });
      } catch (err) {
        console.error('Native share failed', err);
      }
    } else {
      handleCopyLink();
    }
  };

  const handleAddToStory = () => {
    setShowStoryComposer(true);
  };

  const submitStory = async () => {
    setSharingStory(true);
    try {
      await api.post('/stories', {
        media_url: moment.video_url || moment.media_url,
        thumbnail_url: moment.thumbnail_url,
        caption: storyCaption.trim() || undefined,
        media_type: moment.media_type || 'video'
      });
      setSharingStory(false);
      onClose();
    } catch (err) {
      console.error('Failed to post story', err);
      setSharingStory(false);
    }
  };

  const shareToExternal = (platform: string) => {
    const url = encodeURIComponent(`${window.location.origin}/moments/${moment.moment_id}`);
    const text = encodeURIComponent('Check out this Moment on Sparkle!');
    let shareUrl = '';

    switch(platform) {
        case 'whatsapp': shareUrl = `https://wa.me/?text=${text}%20${url}`; break;
        case 'twitter': shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`; break;
        case 'telegram': shareUrl = `https://t.me/share/url?url=${url}&text=${text}`; break;
    }
    
    if(shareUrl) window.open(shareUrl, '_blank');
  };

  const filteredRecipients = recipients.filter(r => 
    (r.username || '').toLowerCase().includes(search.toLowerCase()) || 
    (r.name && r.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (showStoryComposer) {
    return (
      <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative bg-white w-full sm:max-w-[420px] rounded-t-[40px] sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 mb-0 sm:mb-0 pb-safe">
          <div className="h-1.5 w-12 bg-gray-200 rounded-full mx-auto mt-4 mb-1 sm:hidden" />
          <div className="p-4 pt-2 border-b border-gray-100 flex items-center justify-between">
            <button onClick={() => setShowStoryComposer(false)} className="absolute left-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-[17px] font-bold text-gray-900 mx-auto">Add to Story</h3>
          </div>
          
          <div className="p-6">
             <div className="w-32 h-48 bg-black rounded-2xl mx-auto mb-6 overflow-hidden relative shadow-lg shadow-black/10">
                <img src={moment.thumbnail_url || moment.media_url} className="w-full h-full object-cover opacity-90" />
                <div className="absolute inset-0 border border-black/10 rounded-2xl pointer-events-none" />
             </div>
             
             <input 
                type="text"
                placeholder="Add a caption..."
                value={storyCaption}
                onChange={e => setStoryCaption(e.target.value)}
                className="w-full h-12 bg-gray-100 rounded-xl px-4 text-[14px] font-medium text-gray-900 focus:bg-white border border-transparent focus:border-blue-500 outline-none transition-all text-center mb-6"
             />
             
             <button 
               onClick={submitStory}
               disabled={sharingStory}
               className="w-full h-12 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
             >
               {sharingStory ? 'Sharing...' : 'Share to Story'}
               {!sharingStory && <Send size={18} />}
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white w-full sm:max-w-[420px] rounded-t-[40px] sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 mb-0 sm:mb-0 pb-safe">
        <div className="h-1.5 w-12 bg-gray-200 rounded-full mx-auto mt-4 mb-1 sm:hidden" />
        <div className="p-4 pt-2 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-gray-900 mx-auto">Share Moment</h3>
          <button onClick={onClose} className="absolute right-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 px-6">
          <div className="relative mb-5 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors z-10" size={18} />
            <input 
              type="text" 
              placeholder="Search for friends..."
              className="w-full h-11 bg-gray-100 rounded-xl px-12 text-[14px] font-medium text-gray-900 focus:bg-white border border-transparent focus:border-blue-500 outline-none transition-all text-center"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar min-h-[90px]">
            {loading ? (
              <div className="flex items-center justify-center w-full py-4 text-gray-400 text-xs font-bold uppercase tracking-widest">Loading...</div>
            ) : filteredRecipients.length > 0 ? (
              filteredRecipients.map(r => (
                <button 
                  key={r.user_id} 
                  onClick={() => handleShareToFriend(r)}
                  className="flex flex-col items-center gap-1.5 min-w-[70px] active:scale-95 transition-transform"
                >
                  <div className="relative">
                      <img src={r.avatar_url || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-full object-cover border border-gray-100 shadow-sm" />
                      {r.is_online && <div className="absolute bottom-0.5 right-0.5 bg-green-500 w-3 h-3 rounded-full border-2 border-white"></div>}
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600 truncate w-16">{r.username}</span>
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center w-full py-4 text-gray-300 gap-1">
                  <Send size={24} className="opacity-20" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">No signals found</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2 py-5 border-t border-gray-100">
             <button onClick={() => shareToExternal('whatsapp')} className="flex flex-col items-center gap-2">
                <div className="w-11 h-11 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-all border border-green-100 shadow-sm">
                   <MessageCircle size={20} />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">WhatsApp</span>
             </button>
             <button onClick={() => shareToExternal('twitter')} className="flex flex-col items-center gap-2">
                <div className="w-11 h-11 rounded-full bg-gray-50 text-gray-900 flex items-center justify-center hover:bg-gray-100 transition-all border border-gray-100 shadow-sm">
                   <Share2 size={18} />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">X</span>
             </button>
             <button onClick={() => shareToExternal('telegram')} className="flex flex-col items-center gap-2">
                <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-all border border-blue-100 shadow-sm">
                   <Send size={18} />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Telegram</span>
             </button>
             <button onClick={handleCopyLink} className="flex flex-col items-center gap-2">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border shadow-sm ${copied ? 'bg-green-500 text-white border-green-500' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-100'}`}>
                   <Link size={18} />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{copied ? 'Copied' : 'Link'}</span>
             </button>
             <button onClick={handleNativeShare} className="flex flex-col items-center gap-2">
                <div className="w-11 h-11 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition-all border border-gray-100 shadow-sm">
                   <MoreHorizontal size={18} />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">More</span>
             </button>
          </div>

          <div className="flex flex-col gap-1 pt-4 border-t border-gray-100 pb-2">
              <button 
                onClick={handleAddToStory}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-100 transition-colors w-full text-left group"
              >
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors shadow-sm"><PlusCircle size={22}/></div>
                  <div>
                      <div className="text-[15px] font-bold text-gray-900">Add to story</div>
                      <div className="text-[12px] text-gray-500">Share this Moment to your campus story</div>
                  </div>
              </button>
              <button 
                onClick={handleDownload}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-100 transition-colors w-full text-left group"
              >
                  <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center group-hover:bg-gray-200 transition-colors shadow-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </div>
                  <div>
                      <div className="text-[15px] font-bold text-gray-900">Download</div>
                      <div className="text-[12px] text-gray-500">Save this video to your device</div>
                  </div>
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
