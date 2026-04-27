import React from 'react';
import { X, Bookmark, Link as LinkIcon, BellOff, PlusCircle, MinusCircle, Flag, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/api';
import { useModalStore } from '../../store/modalStore';
import { useUserStore } from '../../store/userStore';
import type { Post } from '../../types/post';

interface PostOptionsModalProps {
  post: Post;
  onClose: () => void;
}

const PostOptionsModal: React.FC<PostOptionsModalProps> = ({ post, onClose }) => {
  const { setActiveModal, triggerRefresh } = useModalStore();
  const { user: currentUser } = useUserStore();

  const isOwner = currentUser?.user_id === post.user_id || currentUser?.username === post.username;

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api.delete(`/posts/${post.post_id}`);
      onClose();
      triggerRefresh();
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  const handleReport = async () => {
    const reason = window.prompt('Why are you reporting this post?', 'Inappropriate content');
    if (!reason) return;
    try {
      await api.post('/moderation/reports', { post_id: post.post_id, reason });
      alert('Post reported.');
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to report post.');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.post_id}`);
    alert('Link copied!');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center sm:items-center bg-black/40 backdrop-blur-[4px] transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full sm:max-w-md rounded-t-[24px] sm:rounded-[24px] shadow-[0_-8px_30px_rgb(0,0,0,0.12)] flex flex-col overflow-hidden animate-slide-up will-change-transform"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center p-4 border-b border-gray-100 relative bg-white">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full sm:hidden" />
          <button 
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        <div className="p-2 overflow-y-auto max-h-[70vh] bg-white pb-safe">
          <button
            onClick={() => { onClose(); setActiveModal('post', null, { editPost: post }); }}
            className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors rounded-xl"
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <Bookmark size={20} className="text-gray-700" />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-semibold text-gray-900">Save Post</p>
              <p className="text-[13px] text-gray-500">Add this to your saved items.</p>
            </div>
          </button>

          <div className="h-px bg-gray-100 mx-4 my-1" />

          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors rounded-xl"
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <LinkIcon size={20} className="text-gray-700" />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-semibold text-gray-900">Copy link</p>
            </div>
          </button>

          {!isOwner && (
            <>
              <div className="h-px bg-gray-100 mx-4 my-1" />
              
              <button
                onClick={async () => { 
                  onClose(); 
                  try { await api.post(`/posts/${post.post_id}/action`, { action_type: 'click' }); } catch(e){}
                  alert('Noted! We will show you more posts like this.'); 
                }}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <PlusCircle size={20} className="text-gray-700" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-semibold text-gray-900">Interested</p>
                  <p className="text-[13px] text-gray-500">Show more posts like this.</p>
                </div>
              </button>

              <button
                onClick={async () => { 
                  onClose(); 
                  try { await api.post(`/posts/${post.post_id}/action`, { action_type: 'dislike' }); } catch(e){}
                  // Dispatch a custom event so the feed hides this post immediately
                  window.dispatchEvent(new CustomEvent('hidePost', { detail: post.post_id }));
                  alert('Hidden. We will show you less of this.'); 
                }}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <MinusCircle size={20} className="text-gray-700" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-semibold text-gray-900">Not interested</p>
                  <p className="text-[13px] text-gray-500">I don't want to see this.</p>
                </div>
              </button>

              <button
                onClick={handleReport}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-red-50 transition-colors rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Flag size={20} className="text-red-600" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-semibold text-red-600">Report Post</p>
                </div>
              </button>
            </>
          )}

          {isOwner && (
            <>
              <div className="h-px bg-gray-100 mx-4 my-1" />

              <button
                onClick={() => { onClose(); setActiveModal('post', null, { editPost: post }); }}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Pencil size={20} className="text-gray-700" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-semibold text-gray-900">Edit Post</p>
                </div>
              </button>

              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-red-50 transition-colors rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 size={20} className="text-red-600" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-semibold text-red-600">Delete Post</p>
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostOptionsModal;
