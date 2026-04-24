import { useState, useEffect } from 'react';
import { X, Search, Send, Link, MessageCircle, Share2, MoreHorizontal, PlusCircle, Bookmark, Repeat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { useModalStore } from '../../store/modalStore';

import type { User } from '../../types/user';
import type { Post } from '../../types/post';

interface ShareModalProps {
  onClose: () => void;
  contentUrl?: string;
  onSuccess?: () => void;
}

export default function ShareModal({ onClose, contentUrl }: ShareModalProps) {
  const navigate = useNavigate();
  const { modalData, setActiveModal } = useModalStore();
  const post = modalData as { post: Post } | null;

  const [search, setSearch] = useState('');
  const [recipients, setRecipients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await api.get('/users/following');
        setRecipients(res.data.following || res.data || []);
      } catch (err) {
        console.error('Failed to fetch recipients', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, []);

  const handleCopyLink = () => {
    const url = contentUrl || `${window.location.origin}/post/${post?.post.post_id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareToFriend = async (friend: User) => {
    try {
      const url = contentUrl || `${window.location.origin}/post/${post?.post.post_id}`;
      await api.post('/messages', {
        receiver_id: friend.user_id,
        content: `Check this out: ${url}`
      });
      onClose();
    } catch (err) {
      console.error('Failed to share to friend', err);
    }
  };

  const handleSavePost = async () => {
    if (!post) return;
    try {
      await api.post(`/posts/${post.post.post_id}/save`);
      setIsSaved(true);
      setTimeout(onClose, 1000);
    } catch (err) {
      console.error('Failed to save post', err);
    }
  };

  const handleRepublish = () => {
    if (!post) return;
    setActiveModal('reshare', null, { post: post.post });
  };

  const handleAddToStory = () => {
    navigate('/afterglow/create');
    onClose();
  };

  const shareToExternal = (platform: string) => {
    const url = encodeURIComponent(contentUrl || `${window.location.origin}/post/${post?.post.post_id}`);
    const text = encodeURIComponent('Check this out on Sparkle!');
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

  return (
    <div className="bg-white rounded-xl w-full max-w-[450px] overflow-hidden shadow-2xl animate-scale-in border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between relative">
        <h3 className="text-[17px] font-bold text-gray-900 mx-auto">Share</h3>
        <button onClick={onClose} className="absolute right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
          <X size={20} />
        </button>
      </div>

      <div className="p-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search for friends..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-[14px] focus:bg-white border border-transparent focus:border-blue-500 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Recipients */}
        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar min-h-[90px]">
          {loading ? (
            <div className="flex items-center justify-center w-full text-gray-300 font-bold text-xs uppercase tracking-widest">Loading...</div>
          ) : filteredRecipients.length > 0 ? (
            filteredRecipients.map(r => (
              <button 
                key={r.user_id} 
                onClick={() => handleShareToFriend(r)}
                className="flex flex-col items-center gap-1 group cursor-pointer min-w-[70px] active:scale-95 transition-transform"
              >
                <div className="relative">
                    <img src={r.avatar_url || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-full object-cover border border-gray-200 shadow-sm" />
                    {r.is_online && <div className="absolute bottom-0 right-0 bg-green-500 w-3 h-3 rounded-full border-2 border-white"></div>}
                </div>
                <span className="text-[11px] font-semibold text-gray-700 truncate w-16">{r.username}</span>
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center w-full py-4 text-slate-300 gap-2">
                <Send size={24} className="opacity-20" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">No friends found</span>
            </div>
          )}
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-5 gap-2 py-4 border-t border-gray-100">
           <button onClick={() => shareToExternal('whatsapp')} className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-all border border-green-100">
                 <MessageCircle size={20} />
              </div>
              <span className="text-[11px] font-semibold text-gray-600">WhatsApp</span>
           </button>
           <button onClick={() => shareToExternal('twitter')} className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-900 flex items-center justify-center hover:bg-gray-200 transition-all border border-gray-200">
                 <Share2 size={18} />
              </div>
              <span className="text-[11px] font-semibold text-gray-600">X</span>
           </button>
           <button onClick={() => shareToExternal('telegram')} className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-all border border-blue-100">
                 <Send size={18} />
              </div>
              <span className="text-[11px] font-semibold text-gray-600">Telegram</span>
           </button>
           <button onClick={handleCopyLink} className="flex flex-col items-center gap-2 group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border ${copied ? 'bg-green-500 text-white border-green-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200'}`}>
                 <Link size={18} />
              </div>
              <span className="text-[11px] font-semibold text-gray-600">{copied ? 'Copied' : 'Copy'}</span>
           </button>
           <button className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-all border border-gray-200">
                 <MoreHorizontal size={18} />
              </div>
              <span className="text-[11px] font-semibold text-gray-600">More</span>
           </button>
        </div>

        {/* Secondary Options */}
        <div className="flex flex-col gap-1 pt-3 border-t border-gray-100">
            <button 
              onClick={handleAddToStory}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left group"
            >
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100"><PlusCircle size={20}/></div>
                <div>
                    <div className="text-[14px] font-bold text-gray-900">Add to story</div>
                    <div className="text-[12px] text-gray-500">Share this to your story</div>
                </div>
            </button>
            <button 
              onClick={handleSavePost}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left group"
            >
                <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center group-hover:bg-gray-200"><Bookmark size={20}/></div>
                <div>
                    <div className="text-[14px] font-bold text-gray-900">{isSaved ? 'Saved' : 'Save post'}</div>
                    <div className="text-[12px] text-gray-500">Add this to your saved items</div>
                </div>
            </button>
            <button 
              onClick={handleRepublish}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left group"
            >
                <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center group-hover:bg-gray-200"><Repeat size={20}/></div>
                <div>
                    <div className="text-[14px] font-bold text-gray-900">Republish</div>
                    <div className="text-[12px] text-gray-500">Share to your followers' feed</div>
                </div>
            </button>
        </div>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
