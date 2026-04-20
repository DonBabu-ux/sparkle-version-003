import { useState, useEffect } from 'react';
import { X, Search, Send, Link, MessageCircle, Share2, MoreHorizontal, PlusCircle, Bookmark, Repeat } from 'lucide-react';
import api from '../../api/api';

import type { User } from '../../types/user';

interface ShareModalProps {
  onClose: () => void;
  contentUrl?: string;
  onSuccess?: () => void;
}

export default function ShareModal({ onClose, contentUrl }: ShareModalProps) {
  const [search, setSearch] = useState('');
  const [recipients, setRecipients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await api.get('/users/me/following');
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
    const url = contentUrl || window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToExternal = (platform: string) => {
    const url = encodeURIComponent(contentUrl || window.location.href);
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
    <div className="bg-white rounded-[32px] w-full max-w-[450px] overflow-hidden shadow-2xl animate-scale-in">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between relative">
        <div className="w-12 h-1 bg-slate-200 rounded-full absolute top-2 left-1/2 -translate-x-1/2"></div>
        <h3 className="text-xl font-black text-[#111] mx-auto">Share</h3>
        <button onClick={onClose} className="absolute right-6 text-slate-400 hover:text-rose-500 transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="p-4">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search for people..."
            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-[#FF3D6D] focus:ring-4 focus:ring-[#FF3D6D]/10 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Recipients */}
        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar min-h-[100px]">
          {loading ? (
            <div className="flex items-center justify-center w-full text-slate-300 animate-pulse font-bold text-xs uppercase tracking-widest">Loading friends...</div>
          ) : filteredRecipients.length > 0 ? (
            filteredRecipients.map(r => (
              <div key={r.user_id} className="flex flex-col items-center gap-2 group cursor-pointer min-w-[70px]">
                 <div className="relative">
                    <img src={r.avatar_url || '/uploads/avatars/default.png'} className="w-14 h-14 rounded-full border-2 border-white shadow-md group-hover:scale-110 transition-transform" />
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-4 h-4 rounded-full border-2 border-white"></div>
                 </div>
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight line-clamp-1">{r.username}</span>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center w-full py-4 text-slate-300 gap-2">
                <Send size={24} className="opacity-20" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">No friends found</span>
            </div>
          )}
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-5 gap-4 py-6 border-t border-slate-50">
           <button onClick={() => shareToExternal('whatsapp')} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                 <MessageCircle size={22} fill="currentColor" className="fill-transparent group-hover:fill-white" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">WhatsApp</span>
           </button>
           <button onClick={() => shareToExternal('twitter')} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-2xl bg-black/5 text-slate-900 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                 <Share2 size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">X</span>
           </button>
           <button onClick={() => shareToExternal('telegram')} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition-all shadow-sm">
                 <Send size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Telegram</span>
           </button>
           <button onClick={handleCopyLink} className="flex flex-col items-center gap-2 group">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-600 group-hover:bg-slate-900 group-hover:text-white'}`}>
                 <Link size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{copied ? 'Copied' : 'Copy Link'}</span>
           </button>
           <button className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm font-black">
                 <MoreHorizontal size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">More</span>
           </button>
        </div>

        {/* Secondary Options */}
        <div className="flex flex-col gap-2 pt-4 border-t border-slate-50 mb-2">
            <button className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors w-full text-left group">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform"><PlusCircle size={20}/></div>
                <div>
                    <div className="text-sm font-black text-[#111]">Add to Story</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Share this to your Sparkle AfterGlow</div>
                </div>
            </button>
            <button className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors w-full text-left group">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform"><Bookmark size={20}/></div>
                <div>
                    <div className="text-sm font-black text-[#111]">Save Post</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Keep this in your private collection</div>
                </div>
            </button>
            <button className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors w-full text-left group">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform"><Repeat size={20}/></div>
                <div>
                    <div className="text-sm font-black text-[#111]">Republish</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Share this to your follower's feeds</div>
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
