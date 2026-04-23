import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
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
  GraduationCap
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

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-6xl mx-auto w-full pt-20 lg:pt-12">
        <header className="flex flex-col md:flex-row items-center md:items-start gap-12 md:gap-24 mb-12 lg:mb-24 animate-fade-in">
          {/* Avatar Column */}
          <div className="relative shrink-0 group">
            <div className="p-1 bg-white/80 backdrop-blur-3xl rounded-[56px] shadow-2xl shadow-primary/5 transition-all duration-700 overflow-hidden border border-white/65">
              <img 
                src={profile?.avatar_url || '/uploads/avatars/default.png'} 
                alt="" 
                className="w-56 h-56 md:w-72 md:h-72 rounded-[48px] object-cover transition-transform duration-1000" 
              />
            </div>
            {profile?.is_online && (
              <div className="absolute bottom-8 right-8 w-10 h-10 bg-emerald-500 border-8 border-[#fdf2f4] rounded-full shadow-lg z-20 transition-all"></div>
            )}
          </div>

          {/* Info Column */}
          <div className="flex-1 flex flex-col items-center md:items-start pt-6 w-full">
            <div className="flex flex-col md:flex-row items-center md:items-center gap-8 mb-12 w-full">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl md:text-6xl font-black text-black tracking-tighter leading-none italic uppercase">@{profile?.username}</h1>
                {profile?.is_verified && (
                    <Sparkles size={32} className="text-primary fill-primary animate-pulse" />
                )}
              </div>
              
              <div className="flex items-center gap-4">
                {showOwnerActions ? (
                  <>
                    <button onClick={() => navigate('/settings')} className="px-10 py-4 bg-black text-white rounded-[22px] font-black text-xs uppercase tracking-widest hover:bg-primary shadow-2xl shadow-black/10 active:scale-95 transition-all italic">
                      Tune Profile
                    </button>
                    <button onClick={() => navigate('/settings')} className="p-4 bg-white/80 backdrop-blur-3xl border border-white rounded-[22px] text-black shadow-lg hover:shadow-xl transition-all active:scale-90">
                      <SettingsIcon size={20} strokeWidth={3} />
                    </button>
                  </>
                ) : (
                  <>
                    {isFollowing ? (
                      <button onClick={handleFollowToggle} className="px-10 py-4 bg-white/60 text-black/30 border border-white rounded-[22px] font-black text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all active:scale-95 shadow-sm italic">
                        Synchronized
                      </button>
                    ) : isRequested ? (
                      <button className="px-10 py-4 bg-white/40 text-black/10 border border-white/60 rounded-[22px] font-black text-xs uppercase tracking-widest cursor-default italic">
                        Sync Pending
                      </button>
                    ) : (
                      <button onClick={handleFollowToggle} className="px-10 py-4 bg-primary text-white rounded-[22px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-all hover:scale-[1.05] italic">
                        Synchronize
                      </button>
                    )}
                    <button 
                      onClick={() => navigate(`/messages/${profile?.user_id || profile?.id}`)} 
                      className="p-4 bg-white/80 backdrop-blur-3xl border border-white rounded-[22px] text-black shadow-lg hover:shadow-xl transition-all active:scale-90"
                    >
                      <MessageSquare size={20} strokeWidth={3} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-16 w-full py-10 border-y border-black/[0.03] mb-12">
              <div className="flex flex-col items-center md:items-start group/stat cursor-default">
                <span className="text-4xl font-black text-black leading-none transition-transform">{posts.length}</span>
                <span className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mt-3 italic">Signals Transmitted</span>
              </div>
              <div className="flex flex-col items-center md:items-start group/stat cursor-default">
                <span className="text-4xl font-black text-black leading-none transition-transform">{profile?.followers_count || 0}</span>
                <span className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mt-3 italic">Sync Receivers</span>
              </div>
              <div className="flex flex-col items-center md:items-start group/stat cursor-default">
                <span className="text-4xl font-black text-black leading-none transition-transform">{profile?.following_count || 0}</span>
                <span className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mt-3 italic">Active Syncs</span>
              </div>
            </div>

            <div className="text-center md:text-left space-y-8 w-full max-w-2xl">
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-black tracking-tight uppercase leading-none">{profile?.name || profile?.username}</h2>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                    {profile?.campus && (
                        <div className="inline-flex items-center gap-2 px-5 py-2 bg-primary/10 rounded-full text-[10px] font-black text-primary uppercase tracking-widest italic border border-primary/5">
                            <MapPin size={14} strokeWidth={3.5} />
                            {profile.campus}
                        </div>
                    )}
                    {profile?.major && (
                        <div className="inline-flex items-center gap-2 px-5 py-2 bg-black/5 rounded-full text-[10px] font-black text-black/40 uppercase tracking-widest italic border border-black/5">
                            <GraduationCap size={14} strokeWidth={3.5} />
                            {profile.major}
                        </div>
                    )}
                </div>
              </div>
              
              <p className="text-lg font-bold text-black leading-relaxed italic pr-4">
                {profile?.bio || (showOwnerActions ? 'Establish your signal frequency.' : 'This signal is silent.')}
              </p>

              {profile?.website && (
                <a href={`https://${profile.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-4 px-8 py-4 bg-white/80 backdrop-blur-3xl border border-white rounded-[24px] text-sm font-black text-black hover:text-primary shadow-xl hover:shadow-2xl transition-all uppercase tracking-widest italic">
                  <LinkIcon size={16} strokeWidth={4} className="text-primary" />
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex items-center justify-center md:justify-start gap-12 md:gap-20 border-t border-black/[0.03] mb-12 pt-px sticky top-0 bg-[#fdf2f4]/80 backdrop-blur-3xl z-50 overflow-x-auto no-scrollbar py-2">
          {([
            { id: 'posts',  label: 'Transmissions',  icon: Grid },
            { id: 'reels',  label: 'Moments',  icon: Clapperboard },
            ...(showOwnerActions ? [{ id: 'saved', label: 'Vault', icon: Bookmark }] : []),
            { id: 'tagged', label: 'Tagged', icon: UserSquare }
          ] as const).map(tab => (
            <button 
              key={tab.id}
              className={`flex items-center gap-4 py-8 border-t-2 font-black text-[11px] tracking-[0.3em] transition-all uppercase italic ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-black/20 hover:text-black'}`} 
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={20} strokeWidth={activeTab === tab.id ? 4 : 3} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Grid Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-10 pb-48 animate-fade-in px-2">
          {(activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : []).length > 0 ? (
            (activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : []).map((post) => (
              <div 
                key={post.post_id} 
                className="relative aspect-square bg-white border border-white rounded-[48px] overflow-hidden group/item cursor-pointer transition-all duration-700 shadow-xl hover:shadow-2xl active:scale-95 group" 
                onClick={() => navigate(`/post/${post.post_id}`)}
              >
                <div className="p-1 w-full h-full">
                   <div className="w-full h-full rounded-[42px] overflow-hidden relative">
                    {post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
                      <video src={post.media_url} className="w-full h-full object-cover transition-transform duration-1000 group-hover/item:scale-110" />
                    ) : (post.media_url || post.image_url) ? (
                      <img src={post.media_url || post.image_url} className="w-full h-full object-cover transition-transform duration-1000" alt="" />
                    ) : (
                      <div className="w-full h-full bg-white flex flex-col justify-center items-center p-6 text-center shadow-inner text-black border border-black/5">
                         <p className="font-bold text-sm italic opacity-60 leading-relaxed truncate whitespace-normal break-words max-h-[80%]">
                           {post.content ? (post.content.length > 80 ? post.content.substring(0, 80) + '...' : post.content) : 'No Media'}
                         </p>
                      </div>
                    )}
                    
                    {/* Media Badge */}
                    {(post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|ogg|mov)$/i))) && (
                       <div className="absolute top-6 right-6 w-10 h-10 bg-black/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-white border border-white/20">
                          <Clapperboard size={18} strokeWidth={3} />
                       </div>
                    )}
                   </div>
                </div>
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-8 text-white backdrop-blur-[4px] z-10">
                   <div className="flex items-center gap-10">
                        <div className="flex flex-col items-center gap-3 scale-0 group-hover/item:scale-100 transition-transform duration-500 delay-100">
                             <Heart size={32} fill="currentColor" strokeWidth={0} className="text-primary drop-shadow-xl" />
                             <span className="font-black text-lg tracking-tighter">{formatCount(post.spark_count || 0)}</span>
                        </div>
                        <div className="flex flex-col items-center gap-3 scale-0 group-hover/item:scale-100 transition-transform duration-500 delay-200">
                             <MessageSquare size={32} fill="currentColor" strokeWidth={0} className="text-white drop-shadow-xl" />
                             <span className="font-black text-lg tracking-tighter">{formatCount(post.comment_count || 0)}</span>
                        </div>
                   </div>
                   <div className="absolute bottom-10 px-8 w-full">
                      <p className="text-[10px] font-black italic uppercase tracking-[0.4em] text-center text-white/60 line-clamp-1">{post.content?.split('\n')[0]}</p>
                   </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-48 flex flex-col items-center text-center gap-12 animate-fade-in opacity-40">
               <Orbit size={140} strokeWidth={1} className="text-black animate-spin-slow" />
               <div className="space-y-6">
                  <h3 className="text-4xl font-black text-black italic uppercase tracking-tighter">
                     {activeTab === 'posts' ? 'Static Void.' : activeTab === 'reels' ? 'Motion Blank.' : 'Vault Empty.'}
                  </h3>
                   <p className="text-[10px] font-black text-black uppercase tracking-[0.3em] max-w-xs mx-auto leading-loose">
                     {activeTab === 'posts' ? 'No signals captured in this frequency.' : activeTab === 'reels' ? 'This frequency lacks visual motion.' : 'Empty memory space detected.'}
                   </p>
               </div>
            </div>
          )}
        </div>

        <footer className="py-32 text-center border-t border-black/[0.03] relative">
          <div className="flex flex-wrap items-center justify-center gap-12 text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-12 italic">
            {['Village', 'Privacy', 'Safety', 'Terms', 'Connect'].map(item => (
                <span key={item} className="hover:text-primary transition-colors cursor-pointer">{item}</span>
            ))}
          </div>
          <div className="space-y-4">
            <div className="text-[9px] font-black text-black/10 tracking-[0.5em] uppercase italic">Sparkle Hub Network — High Frequency Village — © 2025</div>
          </div>
        </footer>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        @media (max-width: 768px) {
           .grid-cols-2 { grid-template-columns: 1fr; }
           .aspect-square { aspect-ratio: 4/5; }
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
