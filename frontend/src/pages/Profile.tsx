import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import FollowListModal from '../components/modals/FollowListModal';
import type { User } from '../types/user';
import type { Post } from '../types/post';
import { 
  Grid, 
  Bookmark, 
  UserSquare, 
  Clapperboard, 
  Settings as SettingsIcon, 
  Link as LinkIcon, 
  MessageSquare, 
  Sparkles, 
  Orbit, 
  Heart, 
  MapPin,
  GraduationCap,
  Plus
} from 'lucide-react';

export default function Profile() {
  const { username } = useParams();
  const { user: currentUser } = useUserStore();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'tagged'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [modalType, setModalType] = useState<'Followers' | 'Following' | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setActiveTab('posts'); 
    try {
      const endpoint = username === 'me' ? '/users/me' : `/users/${username}`;
      const profileRes = await api.get(endpoint);
      if (profileRes.data) {
        const profileData = profileRes.data;
        setProfile(profileData);
        setIsFollowing(profileData.is_followed_by_me);
        setIsRequested(profileData.is_requested_by_me);

        const postsRes = await api.get(`/users/${profileData.id || profileData.user_id}/posts`);
        if (postsRes.data && Array.isArray(postsRes.data)) {
          const allPosts = postsRes.data.sort((a: Post, b: Post) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
          setPosts(allPosts);
          setReels(allPosts.filter((p: Post) => p.media_type === 'video' || (p.media_url && p.media_url.match(/\.(mp4|webm|ogg|mov)$/i))));
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [username]);

  const fetchSaved = useCallback(async () => {
    try {
      const res = await api.get('/posts/saved');
      setSavedPosts(res.data || []);
    } catch (err) {
      console.error('Failed to fetch saved posts:', err);
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchProfile();
  }, [fetchProfile, currentUser]);

  useEffect(() => {
    const currentId = currentUser?.id || currentUser?.user_id;
    const profileId = profile?.id || profile?.user_id;
    const ownProfile = !!currentId && !!profileId && String(currentId) === String(profileId);
    if (activeTab === 'saved' && ownProfile) {
      fetchSaved();
    }
  }, [activeTab, currentUser, profile, fetchSaved]);

  const handleFollowToggle = async () => {
    if (!profile || isRequested) return;
    const targetId = profile.user_id || profile.id;
    try {
      const res = await api.post(`/users/${targetId}/follow`);
      if (res.data.status === 'requested') setIsRequested(true);
      else if (res.data.status === 'following') setIsFollowing(true);
      else if (res.data.status === 'unfollowed') setIsFollowing(false);
      
      setProfile((prev: User | null) => prev ? {
        ...prev,
        followers_count: res.data.status === 'following' ? ((prev.followers_count || 0) + 1) : 
                         res.data.status === 'unfollowed' ? ((prev.followers_count || 0) - 1) : 
                         (prev.followers_count || 0)
      } : prev);
    } catch (err) {
      console.error('Follow toggle failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 transition-all">
          <Orbit className="w-12 h-12 text-primary animate-spin-slow mb-6" />
          <p className="text-[10px] font-black italic text-black/20 uppercase tracking-[0.4em] animate-pulse">Synchronizing Identity</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 text-center p-12 animate-fade-in">
           <Orbit size={120} strokeWidth={1} className="text-black/5" />
           <h2 className="text-5xl font-black text-black mt-8 mb-6 tracking-tighter italic uppercase">Signal Lost.</h2>
           <p className="text-sm font-bold text-black/40 max-w-sm mx-auto mb-10 uppercase tracking-widest leading-loose">This signature does not exist in our village directory.</p>
           <button onClick={() => navigate('/')} className="px-12 py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 italic">Go Home</button>
        </div>
      </div>
    );
  }

  const currentId = currentUser?.id || currentUser?.user_id;
  const profileId = profile?.id || profile?.user_id;
  const isOwnProfile = !!currentId && !!profileId && String(currentId) === String(profileId);
  const isMeAlias = username === 'me';
  const showOwnerActions = isOwnProfile || isMeAlias;

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />
      
      {/* Background Orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 relative z-10 w-full pt-20 lg:pt-12">
        <div className="max-w-4xl mx-auto">
          <header className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-16 mb-10 animate-fade-in w-full">
            {/* Avatar Column */}
            <div className="relative shrink-0 mb-4 md:mb-0 cursor-pointer">
              <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full shadow-xl ${profile?.has_story ? 'p-1 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500' : ''}`}>
                <div className={`w-full h-full rounded-full ${profile?.has_story ? 'p-1 bg-[#fdf2f4]' : ''}`}>
                  <img 
                    src={profile?.avatar_url || '/uploads/avatars/default.png'} 
                    alt="" 
                    className="w-full h-full rounded-full object-cover border border-black/5" 
                  />
                </div>
              </div>
              <div className="absolute top-0 left-0 bg-[#333] text-white text-[10px] px-3 py-1 rounded-2xl rounded-bl-sm font-medium shadow-md">Note...</div>
            </div>

            {/* Info Column */}
            <div className="flex-1 flex flex-col items-center md:items-start w-full">
              
              {/* Row 1: Username & Settings */}
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-xl md:text-2xl font-bold text-black">{profile?.username}</h1>
                {profile?.is_verified && <Sparkles size={18} className="text-primary fill-primary" />}
                {showOwnerActions && (
                  <button onClick={() => navigate('/settings')} className="text-black hover:text-black/70 transition-colors">
                    <SettingsIcon size={20} />
                  </button>
                )}
              </div>

              {/* Row 2: Name */}
              <h2 className="text-[15px] font-semibold text-black mb-2">{profile?.name || profile?.username}</h2>

              {/* Row 3: Stats */}
              <div className="flex items-center gap-6 mb-3 text-[14px] text-black">
                <div><span className="font-semibold">{posts.length}</span> posts</div>
                <div className="cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setModalType('Followers')}><span className="font-semibold">{profile?.followers_count || 0}</span> followers</div>
                <div className="cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setModalType('Following')}><span className="font-semibold">{profile?.following_count || 0}</span> following</div>
              </div>

              {/* Row 4: Category/Campus */}
              {(profile?.campus || profile?.major) && (
                <div className="text-[13px] text-black/50 mb-1">
                  {[profile.campus, profile.major].filter(Boolean).join(' • ')}
                </div>
              )}

              {/* Row 5: Bio (multiline support) */}
              <div className="text-[14px] text-black leading-snug whitespace-pre-wrap mb-2 text-center md:text-left">
                {profile?.bio || (showOwnerActions ? 'Add a bio to your profile.' : '')}
              </div>

              {/* Row 6: Website Link */}
              {profile?.website && (
                <a href={`https://${profile.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[14px] font-medium text-[#00376b] hover:underline mb-4">
                  <LinkIcon size={14} />
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}

              {/* Action Buttons (Below Bio) */}
              <div className="flex w-full md:w-auto gap-2 mt-4 md:mt-2">
                {showOwnerActions ? (
                  <>
                    <button onClick={() => navigate('/settings')} className="flex-1 md:flex-none md:px-8 py-1.5 bg-black/5 hover:bg-black/10 rounded-lg text-sm font-semibold text-black transition-colors">
                      Edit Profile
                    </button>
                    <button className="flex-1 md:flex-none md:px-8 py-1.5 bg-black/5 hover:bg-black/10 rounded-lg text-sm font-semibold text-black transition-colors">
                      View archive
                    </button>
                  </>
                ) : (
                  <>
                    {isFollowing ? (
                      <button onClick={handleFollowToggle} className="flex-1 md:flex-none md:px-8 py-1.5 bg-black/5 hover:bg-black/10 rounded-lg text-sm font-semibold text-black transition-colors">
                        Following
                      </button>
                    ) : isRequested ? (
                      <button className="flex-1 md:flex-none md:px-8 py-1.5 bg-black/5 rounded-lg text-sm font-semibold text-black/50 cursor-default">
                        Requested
                      </button>
                    ) : (
                      <button onClick={handleFollowToggle} className="flex-1 md:flex-none md:px-8 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-semibold text-white transition-colors">
                        Follow
                      </button>
                    )}
                    <button onClick={() => navigate(`/messages/${profile?.user_id || profile?.id}`)} className="flex-1 md:flex-none md:px-8 py-1.5 bg-black/5 hover:bg-black/10 rounded-lg text-sm font-semibold text-black transition-colors">
                      Message
                    </button>
                  </>
                )}
              </div>

            </div>
          </header>

          {/* Story Highlights Section */}
          <div className="flex gap-4 md:gap-8 overflow-x-auto no-scrollbar w-full mb-10 pb-2 px-2 md:px-0">
            {/* Mock Highlight */}
            <div className="flex flex-col items-center gap-2 cursor-pointer group shrink-0">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full p-0.5 bg-black/10 group-hover:bg-black/20 transition-colors">
                <div className="w-full h-full bg-white rounded-full p-0.5">
                  <img src={profile?.avatar_url || '/uploads/avatars/default.png'} className="w-full h-full rounded-full object-cover" />
                </div>
              </div>
              <span className="text-xs font-medium text-black">Highlights</span>
            </div>
            {/* New Highlight */}
            {showOwnerActions && (
              <div className="flex flex-col items-center gap-2 cursor-pointer group shrink-0">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-black/20 flex items-center justify-center group-hover:bg-black/5 transition-colors">
                  <Plus size={24} className="text-black/50" />
                </div>
                <span className="text-xs font-medium text-black">New</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-12 border-t border-black/10 w-full mb-4">
            {([
              { id: 'posts',  label: 'POSTS',  icon: Grid },
              { id: 'reels',  label: 'REELS',  icon: Clapperboard },
              ...(showOwnerActions ? [{ id: 'saved', label: 'SAVED', icon: Bookmark }] : []),
              { id: 'tagged', label: 'TAGGED', icon: UserSquare }
            ] as const).map(tab => (
              <button 
                key={tab.id}
                className={`flex items-center gap-2 py-4 border-t font-semibold text-[12px] tracking-widest transition-all ${activeTab === tab.id ? 'border-black text-black' : 'border-transparent text-black/50 hover:text-black/70'}`} 
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          {/* Grid Section */}
          <div className="grid grid-cols-3 gap-1 pb-32 animate-fade-in w-full">
            {(activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : []).length > 0 ? (
              (activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : []).map((post) => (
                <div 
                  key={post.post_id} 
                  className="relative aspect-square bg-gray-100 overflow-hidden group cursor-pointer" 
                  onClick={() => navigate(`/post/${post.post_id}`)}
                >
                  <div className="w-full h-full relative">
                    {post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
                      <video src={post.media_url} className="w-full h-full object-cover" />
                    ) : (post.media_url || post.image_url) ? (
                      <img src={post.media_url || post.image_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex flex-col justify-center items-center p-4 text-center text-black">
                         <p className="font-medium text-[10px] md:text-xs italic opacity-60 leading-snug break-words line-clamp-4">
                           {post.content || 'No Media'}
                         </p>
                      </div>
                    )}
                    
                    {/* Media Badge */}
                    {(post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|ogg|mov)$/i))) && (
                       <div className="absolute top-2 right-2 flex items-center justify-center text-white drop-shadow-md">
                          <Clapperboard size={16} fill="white" className="text-white" />
                       </div>
                    )}
                  </div>
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-6 text-white z-10 hidden md:flex">
                     <div className="flex items-center gap-2 font-bold text-base">
                          <Heart size={20} fill="currentColor" strokeWidth={0} />
                          <span>{formatCount(post.spark_count || 0)}</span>
                     </div>
                     <div className="flex items-center gap-2 font-bold text-base">
                          <MessageSquare size={20} fill="currentColor" strokeWidth={0} />
                          <span>{formatCount(post.comment_count || 0)}</span>
                     </div>
                  </div>
                </div>
            ))
          ) : (
            <div className="col-span-full py-32 flex flex-col items-center text-center gap-8 animate-fade-in opacity-40">
               <Orbit size={80} strokeWidth={1.5} className="text-black animate-spin-slow" />
               <div className="space-y-4">
                  <h3 className="text-2xl font-black text-black italic uppercase tracking-tighter">
                     {activeTab === 'posts' ? 'Static Void.' : activeTab === 'reels' ? 'Motion Blank.' : 'Vault Empty.'}
                  </h3>
                   <p className="text-[9px] font-black text-black uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
                     {activeTab === 'posts' ? 'No signals captured in this frequency.' : activeTab === 'reels' ? 'This frequency lacks visual motion.' : 'Empty memory space detected.'}
                   </p>
               </div>
            </div>
          )}
        </div>

        <footer className="py-16 text-center border-t border-black/[0.03] relative">
          <div className="flex flex-wrap items-center justify-center gap-12 text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-12 italic">
            {['Village', 'Privacy', 'Safety', 'Terms', 'Connect'].map(item => (
                <span key={item} className="hover:text-primary transition-colors cursor-pointer">{item}</span>
            ))}
          </div>
          <div className="space-y-4">
            <div className="text-[9px] font-black text-black/10 tracking-[0.5em] uppercase italic">Sparkle Hub Network — High Frequency Village — © 2025</div>
          </div>
        </footer>
        </div>
      </main>

      {modalType && (
        <FollowListModal 
          isOpen={!!modalType} 
          onClose={() => setModalType(null)} 
          title={modalType} 
          profileId={profile?.id || profile?.user_id || ''} 
        />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        @media (max-width: 768px) {
           .aspect-square { aspect-ratio: 1/1; }
        }
      `}</style>
    </div>
  );
}

function formatCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}
