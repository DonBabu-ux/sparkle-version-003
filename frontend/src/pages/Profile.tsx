import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import PostCard from '../components/PostCard';
import Navbar from '../components/Navbar';

export default function Profile() {
  const { username } = useParams();
  const { user: currentUser } = useUserStore();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const targetUsername = username === 'me' ? (currentUser?.username || '') : username;
        const response = await api.get(`/profile/${targetUsername}`);
        if (response.data.success) {
          setProfile(response.data.profile);
          setPosts(response.data.posts);
          setIsFollowing(response.data.profile.is_followed);
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };
    if (currentUser) fetchProfile();
  }, [username, currentUser]);

  const handleFollowToggle = async () => {
    const originalFollowing = isFollowing;
    const oldFollowersCount = profile.followers_count;
    
    // Optimistic Update
    setIsFollowing(!originalFollowing);
    setProfile((prev: any) => ({
      ...prev,
      followers_count: originalFollowing ? prev.followers_count - 1 : prev.followers_count + 1
    }));

    try {
      await api.post(`/social/follow/${profile.user_id}`);
    } catch (err) {
      // Revert on failure
      setIsFollowing(originalFollowing);
      setProfile((prev: any) => ({
        ...prev,
        followers_count: oldFollowersCount
      }));
      console.error('Follow action failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning Bio-Signatures...</p>
      </div>
    );
  }

  const isOwnProfile = profile?.user_id === currentUser?.id || profile?.user_id === currentUser?.user_id;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-4 pb-20">
        {/* Profile Header Card */}
        <div className="premium-card bg-white border-white/60 shadow-2xl shadow-slate-200 overflow-hidden p-0 mb-8">
          <div className="h-48 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
            <div className="absolute inset-0 bg-black/10"></div>
          </div>
          
          <div className="px-8 pb-8 flex flex-col md:flex-row items-end gap-6 -mt-16 relative z-10">
            <div className="relative group">
              <img 
                src={profile?.avatar_url || '/uploads/avatars/default.png'} 
                className="w-32 h-32 rounded-3xl object-cover ring-8 ring-white shadow-2xl bg-white" 
                alt={profile?.name} 
              />
              {isOwnProfile && (
                <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-xl flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-colors border border-slate-100">📸</button>
              )}
            </div>
            
            <div className="flex-1 space-y-1 mb-2">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">{profile?.name}</h1>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">@{profile?.username}</span>
              </div>
              <p className="text-slate-400 font-bold text-sm">{profile?.campus} • {profile?.major || 'Undecided'}</p>
            </div>

            <div className="flex gap-3 mb-2 w-full md:w-auto">
              {isOwnProfile ? (
                 <button onClick={() => navigate('/settings')} className="flex-1 md:flex-none px-8 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95">Edit Presence</button>
              ) : (
                <>
                  <button 
                    onClick={handleFollowToggle}
                    className={`flex-1 md:flex-none px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${
                      isFollowing 
                      ? 'bg-white text-slate-600 border border-slate-200 shadow-slate-100' 
                      : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                    }`}
                  >
                    {isFollowing ? 'Resonance active' : 'Synchronize'}
                  </button>
                  <button className="p-3.5 bg-white text-slate-600 rounded-2xl border border-slate-200 shadow-xl shadow-slate-100 hover:bg-slate-50 transition-all">✉️</button>
                </>
              )}
            </div>
          </div>

          <div className="px-8 pb-8 pt-4 border-t border-slate-50 flex flex-wrap gap-8">
             <div className="flex flex-col">
               <span className="text-xl font-black text-slate-800 leading-none">{posts.length}</span>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Energies</span>
             </div>
             <div className="flex flex-col">
               <span className="text-xl font-black text-slate-800 leading-none">{profile?.followers_count || 0}</span>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Resonating With</span>
             </div>
             <div className="flex flex-col">
               <span className="text-xl font-black text-slate-800 leading-none">{profile?.following_count || profile?.followingCount || 0}</span>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Synced To</span>
             </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Info Sidebar */}
           <aside className="lg:col-span-4 space-y-6">
              <div className="premium-card">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Bio-Signature</h3>
                <p className="text-slate-600 font-medium leading-relaxed italic">"{profile?.bio || 'This user is currently adrift in the cosmic silence. No transmission available.'}"</p>
                
                <div className="mt-6 space-y-4 pt-6 border-t border-slate-50">
                   <div className="flex items-center gap-3">
                     <span className="text-lg">🎂</span>
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{profile?.birthday_formatted || 'Private Orbital Event'}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="text-lg">🎓</span>
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{profile?.year_of_study || 'Unknown Galaxy Cycle'}</span>
                   </div>
                </div>
              </div>

              {/* Badges/Achievements would go here */}
              <div className="premium-card bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100">
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4">Cosmic Rank</h3>
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-lg border border-indigo-100">🌟</div>
                   <div>
                      <p className="text-xs font-black text-indigo-600 uppercase tracking-widest leading-none">Novice Explorer</p>
                      <p className="text-[10px] font-bold text-indigo-400 mt-1">Collecting first sparks...</p>
                   </div>
                </div>
              </div>
           </aside>

           {/* Feed/Tabs Content */}
           <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="flex items-center gap-2 p-2 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-100 border border-white">
                 <button 
                  onClick={() => setActiveTab('posts')}
                  className={`flex-1 py-3 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'posts' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   Archive
                 </button>
                 <button 
                  onClick={() => setActiveTab('saved')}
                  className={`flex-1 py-3 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'saved' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   Stored
                 </button>
              </div>

              <div className="flex flex-col gap-6">
                {activeTab === 'posts' ? (
                  posts.length > 0 ? (
                    posts.map(post => <PostCard key={post.post_id} post={post} />)
                  ) : (
                    <div className="py-20 flex flex-col items-center justify-center glass-panel border-dashed p-10 bg-white/30">
                       <div className="text-4xl mb-4 opacity-30">🌑</div>
                       <h4 className="text-sm font-bold text-slate-500 uppercase tracking-tighter italic">Total eclipse of the feed...</h4>
                    </div>
                  )
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center glass-panel border-dashed p-10 bg-white/30">
                     <div className="text-4xl mb-4 opacity-30">🔒</div>
                     <h4 className="text-sm font-bold text-slate-500 uppercase tracking-tighter italic">Secured archives...</h4>
                  </div>
                )}
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}
