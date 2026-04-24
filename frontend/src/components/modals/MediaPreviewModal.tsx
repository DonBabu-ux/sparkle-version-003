import React, { useState } from 'react';
import { X, MoreHorizontal, Bookmark, EyeOff, AlertTriangle, ChevronDown } from 'lucide-react';
import { useModalStore } from '../../store/modalStore';
import type { Post } from '../../types/post';

export default function MediaPreviewModal() {
  const { modalData, closeModal } = useModalStore();
  const [showMenu, setShowMenu] = useState(false);

  if (!modalData) return null;

  // Handle both { post: Post } and { url: string } structures
  const data = modalData as any;
  const mediaUrl = data.post?.media_url || data.url;
  const mediaType = data.post?.media_type || 'image';

  if (!mediaUrl) return null;

  const isVideo = mediaType === 'video' || mediaUrl.match(/\.(mp4|webm|ogg|mov|quicktime)$/i);

  const handleDownload = async () => {
    if (!mediaUrl) return;
    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = mediaUrl.split('/').pop() || 'sparkle-media';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      window.open(mediaUrl, '_blank');
    }
  };

  const handleHide = () => {
    if (data.post) {
      const hidden = JSON.parse(localStorage.getItem('hiddenPostIds') || '[]');
      hidden.push(data.post.post_id);
      localStorage.setItem('hiddenPostIds', JSON.stringify(hidden));
      closeModal();
      window.dispatchEvent(new Event('postHidden')); 
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center animate-fade-in overflow-hidden">
      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-50 bg-gradient-to-b from-black/60 to-transparent">
        <button 
          onClick={closeModal}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
        >
          <X size={24} />
        </button>
        
        {data.post && (
          <button 
            onClick={() => setShowMenu(true)}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <MoreHorizontal size={24} />
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="w-full h-full flex items-center justify-center p-2">
        {isVideo ? (
          <video src={mediaUrl} controls autoPlay className="max-w-full max-h-full object-contain" />
        ) : (
          <img src={mediaUrl} className="max-w-full max-h-full object-contain shadow-2xl" alt="" />
        )}
      </div>

      {/* Bottom Menu (Action Modal) */}
      {showMenu && (
        <div className="absolute inset-0 z-[60] flex flex-col justify-end animate-fade-in">
           <div className="absolute inset-0 bg-black/40" onClick={() => setShowMenu(false)} />
           <div className="relative bg-white rounded-t-2xl p-4 animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" onClick={() => setShowMenu(false)} />
              
              <div className="space-y-1">
                <button 
                  onClick={handleDownload}
                  className="w-full flex items-center gap-4 p-3 hover:bg-gray-100 rounded-xl transition-colors text-left group"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-white transition-colors">
                    <Bookmark size={20} className="text-gray-700" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-gray-900">Save to device</p>
                    <p className="text-[12px] text-gray-500">Download this to your storage</p>
                  </div>
                </button>

                <button 
                  onClick={handleHide}
                  className="w-full flex items-center gap-4 p-3 hover:bg-gray-100 rounded-xl transition-colors text-left group"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-white transition-colors">
                    <EyeOff size={20} className="text-gray-700" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-gray-900">I don't want to see this</p>
                    <p className="text-[12px] text-gray-500">Hide this post from your feed</p>
                  </div>
                </button>

                <button className="w-full flex items-center gap-4 p-3 hover:bg-gray-100 rounded-xl transition-colors text-left group">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-white transition-colors">
                    <AlertTriangle size={20} className="text-gray-700" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-gray-900">Find support or report video</p>
                    <p className="text-[12px] text-gray-500">I'm concerned about this post</p>
                  </div>
                </button>
              </div>

              <button 
                onClick={() => setShowMenu(false)}
                className="w-full mt-4 py-3 bg-gray-100 font-bold text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
           </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
