import React, { useState } from 'react';
import { MoreHorizontal, Repeat2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/api';
import { Link } from 'react-router-dom';
import { useModalStore } from '../store/modalStore';
import { useUserStore } from '../store/userStore';
import MentionInput from './MentionInput';
import { formatCount } from '../utils/format';

import type { Post } from '../types/post';

interface PostCardProps {
  post: Post;
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const { setActiveModal } = useModalStore();
  const { user: currentUser } = useUserStore();
  
  const [isSparked, setIsSparked] = useState(post.is_sparked);
  const [isReshared, setIsReshared] = useState(post.is_reshared);
  const [isSaved, setIsSaved] = useState(post.is_saved || false);
  const [isPinned, setIsPinned] = useState(post.is_pinned || false);
  const [sparkCount, setSparkCount] = useState(post.spark_count || 0);
  const [reshareCount, setReshareCount] = useState(post.reshare_count || 0);
  const [myThought, setMyThought] = useState(post.repost_comment || '');
  const [isSavingThought, setIsSavingThought] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isTruncated, setIsTruncated] = useState((post.content || '').length > 150);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const timeAgo = post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : 'recently';

  const handleSpark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const originalSparked = isSparked;
    const originalCount = sparkCount;
    
    // Optimistic Update
    setIsSparked(!originalSparked);
    setSparkCount(prev => originalSparked ? prev - 1 : prev + 1);

    try {
      await api.post(`/posts/${post.post_id}/spark`);
    } catch (err) {
      // Revert on failure
      setIsSparked(originalSparked);
      setSparkCount(originalCount);
      console.error('Failed to spark post:', err);
    }
  };

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }

    if (translatedText) {
      setShowTranslated(true);
      return;
    }

    setIsTranslating(true);
    try {
      const res = await api.get(`/posts/${post.post_id}/translate`);
      setTranslatedText(res.data.translatedText);
      setShowTranslated(true);
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleReshare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Optimistic toggle
    const originalReshared = isReshared;
    const originalCount = reshareCount;
    
    setIsReshared(!originalReshared);
    setReshareCount(prev => originalReshared ? Math.max(0, prev - 1) : prev + 1);
    
    try {
      // Toggle on DB
      await api.post(`/posts/${post.post_id}/reshare`);
    } catch (err) {
      setIsReshared(originalReshared);
      setReshareCount(originalCount);
      console.error('Reshare toggle failed:', err);
    }
  };

  const handleThoughtSave = async () => {
    if (!isReshared) return;
    setIsSavingThought(true);
    try {
      await api.patch(`/posts/${post.post_id}/reshare/comment`, { comment: myThought });
    } catch (err) {
      console.error('Failed to save thought:', err);
    } finally {
      setIsSavingThought(false);
    }
  };

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/posts/${post.post_id}/pin`);
      setIsPinned(!isPinned);
    } catch (err) {
      console.error('Pin failed:', err);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const originalSaved = isSaved;
    setIsSaved(!originalSaved);
    try {
      await api.post(`/posts/${post.post_id}/save`);
    } catch (err) {
      setIsSaved(originalSaved);
      console.error('Save failed:', err);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use Web Share API if available, otherwise open a modal
    if (navigator.share) {
      navigator.share({
        title: 'Check out this post on Sparkle',
        text: post.content,
        url: window.location.href,
      }).catch(console.error);
    } else {
      setActiveModal('share', null, { post });
    }
  };

  const handleCommentSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      await api.post(`/posts/${post.post_id}/comments`, { content: newComment });
      setNewComment('');
      // Optionally trigger a refresh or success callback
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const isVideo = post.media_url?.match(/\.(mp4|webm|ogg|mov)$/i);
  const isTextOnly = !post.media_url || post.media_url === 'undefined' || post.media_url === 'null' || post.media_url.trim() === '';

  return (
    <div className={`post-card animate-fade-in ${isTextOnly ? 'text-only' : ''}`} style={{ background: '#fff', color: '#262626', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.05)', position: 'relative', width: '100%', boxSizing: 'border-box' }}>
      {/* Ghost Repost Header */}
      {post.reposter_username && (
        <div className="repost-header" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(0,0,0,0.03)', background: 'rgba(0,0,0,0.01)' }}>
          <img 
            src={post.reposter_avatar || '/uploads/avatars/default.png'} 
            style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} 
            alt=""
          />
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#8e8e8e' }}>
            <Link to={`/profile/${post.reposter_username}`} style={{ color: 'inherit', fontWeight: '800' }}>{post.reposter_username}</Link> reposted
          </span>
          {post.reposter_username === currentUser?.username && (
             <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">You</span>
          )}
        </div>
      )}

      {/* Self-Repost Indicator (for original posts) */}
      {!post.reposter_username && isReshared && (
        <div className="px-4 py-1.5 bg-green-50/50 flex items-center gap-2 border-b border-green-100/50">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
           <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">You reposted this</span>
        </div>
      )}

      <div className="post-header" style={{ padding: '12px 16px', background: '#fff' }}>
        <Link to={`/profile/${post.username}`} className="post-avatar-wrapper group" style={{ position: 'relative' }}>
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#FF3D6D] to-[#FF8E53] group-hover:scale-105 transition-transform duration-300">
            <img 
              src={post.avatar_url || '/uploads/avatars/default.png'} 
              className="post-avatar border-2 border-white"
              style={{ width: '42px', height: '42px', borderRadius: '50%' }}
              alt={post.username}
            />
          </div>
        </Link>
        <div className="post-info" style={{ marginLeft: '4px' }}>
          <div className="post-author-name" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link to={`/profile/${post.username}`} style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: '800', color: '#262626' }}>
                {post.name || post.username}
              </Link>
              <span style={{ color: '#8e8e8e', fontSize: '12px' }}>•</span>
              <span style={{ color: '#8e8e8e', fontSize: '12px' }}>{timeAgo.replace('about ', '')}</span>
            </div>
            {post.name && post.name !== post.username && (
              <span style={{ color: '#8e8e8e', fontSize: '12px', marginTop: '-2px' }}>@{post.username}</span>
            )}
          </div>
          <div className="post-meta" style={{ color: '#8e8e8e', fontSize: '12px', fontWeight: '400', marginTop: '-2px' }}>
            {post.campus || 'Main Campus'}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button 
            className="post-options" 
            style={{ color: '#262626', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              const isOwner = currentUser?.user_id === post.user_id || currentUser?.id === post.user_id || currentUser?.username === post.username;
              
              if (isOwner) {
                const action = window.confirm(isPinned ? "Unpin this post from your profile?" : "Pin this post to the top of your profile?");
                if (action) handlePin(e);
              } else {
                if (window.confirm("Do you want to report this post to the admins?")) {
                  api.post(`/posts/${post.post_id}/report`, { reason: 'inappropriate' })
                    .then(() => alert('Post reported to admins.'))
                    .catch(err => console.error('Failed to report:', err));
                }
              }
            }}
          >
            {isPinned && <span className="mr-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded">Pinned</span>}
            <MoreHorizontal size={24} />
          </button>
        </div>
      </div>

      {/* Main Media Section */}
      {!isTextOnly && post.media_url && (
        <div className="post-media relative" style={{ background: '#f8f9fa', maxHeight: 'none' }} onDoubleClick={handleSpark}>
          {isVideo ? (
            <video src={post.media_url} autoPlay loop muted playsInline className="w-full h-auto object-contain" />
          ) : (
            <img src={post.media_url} loading="lazy" alt="Post content" className="w-full h-auto object-contain" />
          )}          {/* Floating "Social Stack" bubble (Visible if reshared by me or followings) */}
          {(isReshared || (post.resharers && post.resharers.length > 0)) && (
            <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2 z-30">
              {/* The Social Stack */}
              <div className="flex items-center gap-2 pointer-events-none">
                <div className="flex -space-x-4 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); }}>
                  {/* My avatar if I reshared */}
                  {isReshared && (
                    <div className="relative z-30 transform hover:translate-y-[-2px] transition-transform">
                      <img 
                        src={currentUser?.avatar_url || '/uploads/avatars/default.png'} 
                        className="w-10 h-10 rounded-full border-2 border-white shadow-lg object-cover"
                        alt="You"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-[#17bf63] rounded-full p-1 border border-white">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                      </div>
                    </div>
                  )}
                  {/* Other resharers from the social stack */}
                  {post.resharers?.filter(r => r.username !== currentUser?.username).slice(0, 3).map((r, i) => (
                    <img 
                      key={i}
                      src={r.avatar || '/uploads/avatars/default.png'} 
                      className="w-10 h-10 rounded-full border-2 border-white shadow-lg object-cover transform hover:translate-y-[-2px] transition-transform"
                      style={{ zIndex: 20 - i }}
                      alt={r.username}
                    />
                  ))}
                  {post.resharers && post.resharers.length > 3 && (
                    <div className="w-10 h-10 rounded-full border-2 border-white shadow-lg bg-black/60 backdrop-blur-md flex items-center justify-center text-white text-[10px] font-black z-0">
                      +{post.resharers.length - 3}
                    </div>
                  )}
                </div>

                {/* Primary Note (Editable if it's mine, or showing the most recent followed one) */}
                <div 
                  className="pointer-events-auto min-w-[140px] z-40 relative group"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute -top-2 -right-2 bg-[#17bf63] rounded-full p-1.5 border border-white shadow-lg z-50 animate-bounce-subtle">
                    <Repeat2 size={10} color="white" strokeWidth={3} />
                  </div>
                  <MentionInput
                    value={isReshared ? myThought : (post.resharers?.[0]?.comment || "")}
                    onChange={(val) => {
                      if (isReshared) setMyThought(val);
                    }}
                    onBlur={handleThoughtSave}
                    className={`bg-black/60 backdrop-blur-xl text-white px-4 py-2 rounded-2xl text-sm font-semibold border border-white/30 shadow-2xl outline-none w-full transition-all focus:ring-2 focus:ring-indigo-400 focus:scale-105 ${isSavingThought ? 'opacity-50' : ''}`}
                    placeholder={isReshared ? "Add a thought..." : ""}
                    autoFocus={false}
                  />
                </div>
              </div>

              {/* Expanded Notes View (Option C) */}
              {showNotes && (post.resharers?.length || 0) + (isReshared ? 1 : 0) > 1 && (
                <div className="pointer-events-auto bg-white/90 backdrop-blur-2xl rounded-2xl p-3 shadow-2xl border border-white/50 max-w-[280px] animate-in fade-in zoom-in duration-200">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex justify-between items-center">
                    <span>Friend's Thoughts</span>
                    <button onClick={() => setShowNotes(false)} className="hover:text-slate-600 transition-colors">Close</button>
                  </div>
                  <div className="flex flex-col gap-3 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                    {/* My note if exists */}
                    {isReshared && (
                      <div className="flex gap-2">
                        <img src={currentUser?.avatar_url || '/uploads/avatars/default.png'} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />
                        <div className="bg-indigo-50/80 rounded-xl p-2 text-xs font-medium text-slate-700">
                          <span className="font-bold text-indigo-600 block mb-0.5">You</span>
                          {myThought || "Reshared this post"}
                        </div>
                      </div>
                    )}
                    {/* Others notes */}
                    {post.resharers?.filter(r => r.username !== currentUser?.username).map((r, i) => (
                      <div key={i} className="flex gap-2">
                        <img src={r.avatar || '/uploads/avatars/default.png'} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />
                        <div className="bg-slate-100/80 rounded-xl p-2 text-xs font-medium text-slate-700">
                          <span className="font-bold text-slate-900 block mb-0.5">{r.username}</span>
                          {r.comment || "Reshared this post"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="post-content" style={{ padding: '0 16px 12px', background: '#fff' }}>
        {post.content && (
          <div className="post-text" style={{ fontSize: '14px', color: '#262626', lineHeight: '1.4' }}>
            {showTranslated && translatedText ? translatedText : (isTruncated ? post.content.substring(0, 150) : post.content)}
            {isTruncated && !showTranslated && <span style={{ color: '#8e8e8e', cursor: 'pointer' }} onClick={() => setIsTruncated(false)}> ... more</span>}
          </div>
        )}

        <div style={{ marginTop: '8px' }}>
          <button 
            onClick={handleTranslate}
            disabled={isTranslating}
            style={{ background: 'none', border: 'none', padding: '0', color: '#8e8e8e', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
          >
            {isTranslating ? 'Translating...' : (showTranslated ? 'See Original' : 'See Translation')}
          </button>
        </div>
      </div>

      <div className="post-actions" style={{ padding: '12px 16px', background: '#fff', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="actions-left" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {/* Heart Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={handleSpark} style={{ background: 'none', border: 'none', padding: '0', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <svg aria-label="Like" color={isSparked ? '#FF3D6D' : '#262626'} fill={isSparked ? '#FF3D6D' : 'none'} height="24" role="img" viewBox="0 0 24 24" width="24">
                <path d="M16.792 3.904A4.989 4.989 0 0121.5 9.122c0 3.072-2.652 4.959-5.197 7.221-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.077 2.5 12.194 2.5 9.122a4.989 4.989 0 014.708-5.218 4.21 4.21 0 013.675 1.941c.325.487.627 1.011.917 1.596.332-.614.653-1.161.992-1.65a4.21 4.21 0 013.675-1.941z" stroke="currentColor" strokeWidth="2"></path>
              </svg>
            </button>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#262626' }}>{formatCount(sparkCount)}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              onClick={() => setActiveModal('post_comments', null, { post })}
              style={{ background: 'none', border: 'none', padding: '0', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
              <svg aria-label="Comment" color="#262626" fill="none" height="24" role="img" viewBox="0 0 24 24" width="24">
                <path d="M20.656 17.008a9.993 9.993 0 10-3.59 3.615L22 22z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
            </button>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#262626' }}>{formatCount(post.comment_count || 0)}</span>
          </div>

          {/* Reshare Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={handleReshare} style={{ background: 'none', border: 'none', padding: '0', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <svg aria-label="Reshare" color={isReshared ? '#17bf63' : '#262626'} fill="none" height="24" role="img" viewBox="0 0 24 24" width="24">
                <path d="M17 2l4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={isReshared ? 3 : 2}></path>
                <path d="M3 11V9a4 4 0 014-4h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={isReshared ? 3 : 2}></path>
                <path d="M7 22l-4-4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={isReshared ? 3 : 2}></path>
                <path d="M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={isReshared ? 3 : 2}></path>
              </svg>
            </button>
            <div className="flex items-center -space-x-2 mr-1">
              {post.resharer_avatars?.slice(0, 3).map((avatar, idx) => (
                <img 
                  key={idx}
                  src={avatar || '/uploads/avatars/default.png'} 
                  className="w-5 h-5 rounded-full border-2 border-white object-cover" 
                  alt="" 
                />
              ))}
            </div>
            <span style={{ fontSize: '14px', fontWeight: '600', color: isReshared ? '#17bf63' : '#262626' }}>
              {reshareCount > 3 ? `+${formatCount(reshareCount - 3)}` : formatCount(reshareCount || 0)}
            </span>
          </div>

          {/* Share Icon */}
          <button 
            onClick={handleShare}
            style={{ background: 'none', border: 'none', padding: '0', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <svg aria-label="Share Post" color="#262626" fill="none" height="24" role="img" viewBox="0 0 24 24" width="24">
              <line fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" x1="22" x2="9.218" y1="3" y2="10.083"></line>
              <polygon fill="none" points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></polygon>
            </svg>
          </button>
        </div>
        
        {/* Bookmark Icon */}
        <div className="actions-right">
          <button 
            onClick={handleSave}
            style={{ background: 'none', border: 'none', padding: '0', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <svg aria-label="Save" color={isSaved ? '#3897f0' : '#262626'} fill={isSaved ? '#3897f0' : 'none'} height="24" role="img" viewBox="0 0 24 24" width="24">
              <path d="M20 21l-8-7.56L4 21V3h16v18z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Direct Comment Input with Mentions */}
      <div className="px-4 py-3 border-t border-slate-50 relative z-50">
        <form onSubmit={handleCommentSubmit} className="flex items-center gap-3">
          <img src={currentUser?.avatar_url || '/uploads/avatars/default.png'} className="w-8 h-8 rounded-full object-cover" alt="" />
          <div className="flex-1">
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              className="w-full text-sm border-none outline-none py-1 bg-transparent placeholder:text-slate-400 font-medium"
              placeholder="Add a comment..."
            />
          </div>
          {newComment.trim() && (
            <button 
              type="submit" 
              disabled={isSubmittingComment}
              className="text-[#0095f6] font-bold text-sm disabled:opacity-50 active:scale-95 transition-transform"
            >
              Post
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default PostCard;
