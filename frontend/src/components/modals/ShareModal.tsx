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
  const modalPayload = modalData as { post?: Post, isAnonymous?: boolean, contentUrl?: string } | null;
  const post = modalPayload?.post || null;
  const isAnonymous = modalPayload?.isAnonymous || false;
  const resolvedContentUrl = contentUrl || modalPayload?.contentUrl || `${window.location.origin}/post/${post?.post_id}`;

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
    navigator.clipboard.writeText(resolvedContentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareToFriend = async (friend: User) => {
    try {
      await api.post('/messages', {
        receiver_id: friend.user_id,
        content: `Check this out: ${resolvedContentUrl}`
      });
      onClose();
    } catch (err) {
      console.error('Failed to share to friend', err);
    }
  };

  const handleSavePost = async () => {
    if (!post && !isAnonymous) return;
    try {
      if (post) await api.post(`/posts/${post.post_id}/save`);
      setIsSaved(true);
      setTimeout(onClose, 1000);
    } catch (err) {
      console.error('Failed to save post', err);
    }
  };

  const handleRepublish = () => {
    if (!post) return;
    setActiveModal('reshare', null, { post: post });
  };

  const handleAddToStory = () => {
    navigate('/afterglow/create');
    onClose();
  };

  const shareToExternal = (platform: string) => {
    const url = encodeURIComponent(resolvedContentUrl);
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
    <div className="bg-white dark:bg-[#101217] rounded-xl w-full max-w-[450px] overflow-hidden shadow-2xl animate-scale-in border border-black/5 dark:border-white/10">
      <div className="p-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between relative bg-white dark:bg-[#101217]">
        <h3 className="text-[17px] font-bold text-black dark:text-white mx-auto">Share</h3>
        <button onClick={onClose} className="absolute right-4 p-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-full transition-colors text-black/40 dark:text-white/40">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 bg-white dark:bg-[#101217]">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20 dark:text-white/20" size={16} />
          <input 
            type="text" 
            placeholder="Search for friends..."
            className="w-full pl-10 pr-4 py-2 bg-black/5 dark:bg-white/5 rounded-full text-[14px] text-black dark:text-white focus:bg-white dark:focus:bg-white/10 border border-transparent focus:border-primary/50 outline-none transition-all placeholder:text-black/30 dark:placeholder:text-white/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Recipients */}
        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar min-h-[90px]">
          {loading ? (
            <div className="flex items-center justify-center w-full text-black/20 dark:text-white/20 font-bold text-xs uppercase tracking-widest">Loading...</div>
          ) : filteredRecipients.length > 0 ? (
            filteredRecipients.map(r => (
              <button 
                key={r.user_id} 
                onClick={() => handleShareToFriend(r)}
                className="flex flex-col items-center gap-1 group cursor-pointer min-w-[70px] active:scale-95 transition-transform"
              >
                <div className="relative">
                    <img src={r.avatar_url || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-full object-cover border border-black/5 dark:border-white/10 shadow-sm" />
                    {r.is_online && <div className="absolute bottom-0 right-0 bg-green-500 w-3 h-3 rounded-full border-2 border-white dark:border-black"></div>}
                </div>
                <span className="text-[11px] font-semibold text-black/60 dark:text-white/60 truncate w-16">{r.username}</span>
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center w-full py-4 text-black/20 dark:text-white/20 gap-2">
                <Send size={24} className="opacity-20" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">No friends found</span>
            </div>
          )}
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-5 gap-2 py-4 border-t border-black/5 dark:border-white/10">
           <button onClick={() => shareToExternal('whatsapp')} className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 flex items-center justify-center hover:bg-green-100 dark:hover:bg-green-900/30 transition-all border border-green-100 dark:border-green-900/20">
                 <MessageCircle size={20} />
              </div>
              <span className="text-[11px] font-semibold text-black/40 dark:text-white/40">WhatsApp</span>
           </button>
           <button onClick={() => shareToExternal('twitter')} className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 text-black dark:text-white flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/10">
                 <Share2 size={18} />
              </div>
              <span className="text-[11px] font-semibold text-black/40 dark:text-white/40">X</span>
           </button>
           <button onClick={() => shareToExternal('telegram')} className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-500 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all border border-blue-100 dark:border-blue-900/20">
                 <Send size={18} />
              </div>
              <span className="text-[11px] font-semibold text-black/40 dark:text-white/40">Telegram</span>
           </button>
           <button onClick={handleCopyLink} className="flex flex-col items-center gap-2 group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border ${copied ? 'bg-green-500 text-white border-green-500' : 'bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10 border-black/5 dark:border-white/10'}`}>
                 <Link size={18} />
              </div>
              <span className="text-[11px] font-semibold text-black/40 dark:text-white/40">{copied ? 'Copied' : 'Copy'}</span>
           </button>
           <button className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/10">
                 <MoreHorizontal size={18} />
              </div>
              <span className="text-[11px] font-semibold text-black/40 dark:text-white/40">More</span>
           </button>
        </div>

        {/* Secondary Options */}
        <div className="flex flex-col gap-1 pt-3 border-t border-black/5 dark:border-white/10">
            {!isAnonymous && (
              <button 
                onClick={handleAddToStory}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors w-full text-left group"
              >
                  <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40"><PlusCircle size={20}/></div>
                  <div>
                      <div className="text-[14px] font-bold text-black dark:text-white">Add to story</div>
                      <div className="text-[12px] text-black/40 dark:text-white/40">Share this to your story</div>
                  </div>
              </button>
            )}
            
            <button 
              onClick={handleSavePost}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors w-full text-left group"
            >
                <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60 flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-white/20"><Bookmark size={20}/></div>
                <div>
                    <div className="text-[14px] font-bold text-black dark:text-white">{isSaved ? 'Saved' : 'Save post'}</div>
                    <div className="text-[12px] text-black/40 dark:text-white/40">Add this to your saved items</div>
                </div>
            </button>
            
            {!isAnonymous && (
              <button 
                onClick={handleRepublish}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors w-full text-left group"
              >
                  <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60 flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-white/20"><Repeat size={20}/></div>
                  <div>
                      <div className="text-[14px] font-bold text-black dark:text-white">Republish</div>
                      <div className="text-[12px] text-black/40 dark:text-white/40">Share to your followers' feed</div>
                  </div>
              </button>
            )}
        </div>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
