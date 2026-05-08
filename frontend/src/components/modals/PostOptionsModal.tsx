import React from 'react';
import { X, Bookmark, Link as LinkIcon, PlusCircle, MinusCircle, Flag, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const isGroupAdmin = post.group_id && (post.user_role === 'admin' || post.user_role === 'owner' || post.user_role === 'moderator');
  const canDelete = isOwner || isGroupAdmin || currentUser?.role === 'admin';

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      if (post.group_id) {
        await api.delete(`/groups/${post.group_id}/posts/${post.post_id}`);
      } else {
        await api.delete(`/posts/${post.post_id}`);
      }
      onClose();
      triggerRefresh();
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert('Failed to delete post.');
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
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center sm:items-center overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 450 }}
        className="bg-white w-full sm:max-w-xs rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden relative z-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center p-3 border-b border-gray-50 relative bg-white">
          <div className="w-10 h-1 bg-gray-100 rounded-full sm:hidden" />
          <button 
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-50 rounded-full transition-colors active:scale-90"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="p-1.5 overflow-y-auto bg-white pb-safe">
          <button
            onClick={async () => { 
              try {
                await api.post(`/posts/${post.post_id}/save`);
                alert('Saved to bookmarks');
                onClose();
              } catch (err) {
                console.error('Failed to save post', err);
                alert('Failed to save');
              }
            }}
            className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-xl group"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <Bookmark size={18} className="text-slate-600" strokeWidth={2} />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-semibold text-gray-900">Save post</p>
              <p className="text-[11px] font-medium text-gray-500">Add to your collection</p>
            </div>
          </button>

          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-xl group"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <LinkIcon size={18} className="text-gray-600" strokeWidth={2} />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-semibold text-gray-900">Copy link</p>
              <p className="text-[11px] font-medium text-gray-500">Share this spark</p>
            </div>
          </button>

          {!isOwner && (
            <>
              <button
                onClick={async () => { 
                  onClose(); 
                  if (currentUser) {
                    try { await api.post(`/posts/${post.post_id}/action`, { action_type: 'click' }); } catch(e){}
                  }
                  alert('Noted! We will show more like this.'); 
                }}
                className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-xl group"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                  <PlusCircle size={18} className="text-gray-600" strokeWidth={2} />
                </div>
                <div className="text-left">
                  <p className="text-[14px] font-semibold text-gray-900">Interested</p>
                  <p className="text-[11px] font-medium text-gray-500">Show more like this</p>
                </div>
              </button>

              <button
                onClick={async () => { 
                  onClose(); 
                  if (currentUser) {
                    try { await api.post(`/posts/${post.post_id}/action`, { action_type: 'dislike' }); } catch(e){}
                  }
                  window.dispatchEvent(new CustomEvent('hidePost', { detail: post.post_id }));
                  alert('Hidden. We will show less of this.'); 
                }}
                className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-xl group"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                  <MinusCircle size={18} className="text-gray-600" strokeWidth={2} />
                </div>
                <div className="text-left">
                  <p className="text-[14px] font-semibold text-gray-900">Not interested</p>
                  <p className="text-[11px] font-medium text-gray-500">Hide from my feed</p>
                </div>
              </button>

              <button
                onClick={handleReport}
                className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-rose-50/50 active:bg-rose-100 transition-colors rounded-xl group"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                  <Flag size={18} className="text-rose-500" strokeWidth={2} />
                </div>
                <div className="text-left">
                  <p className="text-[14px] font-semibold text-rose-600">Report post</p>
                  <p className="text-[11px] font-medium text-rose-400">Flag for moderation</p>
                </div>
              </button>
            </>
          )}

          {(isOwner || canDelete) && (
            <>
              <div className="h-px bg-gray-50 mx-6 my-1" />

              {isOwner && (
                <button
                  onClick={() => { onClose(); setActiveModal('post', null, { editPost: post }); }}
                  className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-xl group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                    <Pencil size={18} className="text-gray-600" strokeWidth={2} />
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-semibold text-gray-900">Edit post</p>
                    <p className="text-[11px] font-medium text-gray-500">Modify your spark</p>
                  </div>
                </button>
              )}

              {canDelete && (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-rose-50/50 active:bg-rose-100 transition-colors rounded-xl group"
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                    <Trash2 size={18} className="text-rose-500" strokeWidth={2} />
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-semibold text-rose-600">Delete post</p>
                    <p className="text-[11px] font-medium text-rose-400">Remove permanently</p>
                  </div>
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PostOptionsModal;
