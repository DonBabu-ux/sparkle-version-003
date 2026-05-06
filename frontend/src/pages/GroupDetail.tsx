import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import { 
  Users, Globe, Layers, MessageSquare, Lock, ArrowLeft, Shield, 
  Sparkles, ChevronRight, Share2, Info, Image as ImageIcon, 
  MoreHorizontal, UserPlus, Heart, MessageCircle, Flag, ShieldAlert,
  Search, Camera, Plus, Activity
} from 'lucide-react';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import GroupPostModal from '../components/modals/GroupPostModal';
import GroupInviteModal from '../components/modals/GroupInviteModal';
import GroupSettingsModal from '../components/modals/GroupSettingsModal';
import { getAvatarUrl, getMediaUrl } from '../utils/imageUtils';

import type { Post } from '../types/post';
import type { Group } from '../types/group';

type Tab = 'posts' | 'about' | 'members' | 'media';

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUserStore();

  const [group, setGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [pendingJoin, setPendingJoin] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Modal states
  const [showPostModal, setShowPostModal] = useState(false);
  const [postModalView, setPostModalView] = useState<'post' | 'feeling'>('post');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchGroupData = async () => {
    try {
      const response = await api.get(`/groups/${id}`);
      if (response.data.success) {
        const groupData = response.data.group;
        setGroup(groupData);
        setMedia(response.data.media || []);
        setMembers(response.data.members || []);
        
        const backendPosts = response.data.initialPosts || [];
        if (backendPosts.length === 0) {
          const mockPosts: Post[] = [
            {
              post_id: 'd9b2f1e0-3c2b-4b1a-9d8e-7f6a5b4c3d2e',
              user_id: 'admin-1',
              username: 'SparkleBot',
              name: 'Sparkle Official',
              avatar_url: '/uploads/avatars/default.png',
              content: `Welcome to ${groupData.name}! \uD83D\uDE80 This is a community space for sharing ideas, organizing events, and connecting with others. Feel free to start a conversation!`,
              created_at: new Date().toISOString(),
              likes_count: 12,
              comments_count: 5,
              image_url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80'
            }
          ];
          setPosts(mockPosts);
        } else {
          setPosts(backendPosts);
        }

        setIsMember(!!groupData.userRole && groupData.memberStatus === 'active');
        setUserRole(groupData.userRole || '');
        setPendingJoin(groupData.memberStatus === 'pending');
      }
    } catch (err) {
      console.error('Failed to fetch group:', err);
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
  }, [id, navigate]);

  const handleJoinLeave = async () => {
    try {
      if (isMember || pendingJoin) {
        if (!window.confirm('Leave this circle?')) return;
        const res = await api.post(`/groups/${id}/leave`);
        if (res.data.success) {
          setIsMember(false);
          setPendingJoin(false);
          setUserRole('');
        }
      } else {
        const res = await api.post(`/groups/${id}/join`);
        if (res.data.success) {
          if (res.data.status === 'pending') setPendingJoin(true);
          else {
            setIsMember(true);
            fetchGroupData(); 
          }
        }
      }
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen bg-[#F0F2F5] font-sans text-slate-900">
      <Navbar />
      <div className="flex-1 flex items-center justify-center lg:ml-72">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!group) return null;

  const isAdmin = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator';

  return (
    <div className="flex min-h-screen bg-[#F0F2F5] font-sans text-slate-900">
      <Navbar />
      
      <main className="flex-1 lg:ml-72 pb-20 relative">
        {/* Sticky Mobile Header with Back Button */}
        <div className="lg:hidden sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
           <button onClick={() => navigate('/groups')} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 active:scale-95 transition-all">
              <ArrowLeft size={20} />
           </button>
           <h2 className="font-black text-[15px] uppercase tracking-tighter truncate max-w-[200px]">{group.name}</h2>
           <button className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500">
              <Share2 size={18} />
           </button>
        </div>

        {/* Header / Cover Section */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-6xl mx-auto">
             <div className="relative h-[250px] md:h-[350px] lg:h-[400px] w-full md:rounded-b-xl overflow-hidden group">
                <button 
                  onClick={() => navigate('/groups')}
                  className="hidden lg:flex absolute top-6 left-6 w-12 h-12 bg-black/20 backdrop-blur-md rounded-full items-center justify-center text-white border border-white/20 hover:bg-black/40 transition-all z-20 active:scale-95"
                >
                   <ArrowLeft size={24} />
                </button>
                <img 
                   src={group.cover_image || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&q=80'} 
                   className="w-full h-full object-cover" 
                   alt="" 
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-all" />
                {isAdmin && (
                  <button className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg hover:bg-white transition-all">
                    <Camera size={18} /> Edit Cover
                  </button>
                )}
             </div>

             <div className="px-4 md:px-8 pb-4">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-12 md:-mt-16 mb-6">
                   <div className="relative">
                      <img 
                        src={group.icon_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=random&color=fff`} 
                        className="w-32 h-32 md:w-44 md:h-44 rounded-full border-4 border-white shadow-md bg-white object-cover"
                        alt=""
                      />
                      {isAdmin && (
                        <button className="absolute bottom-2 right-2 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 hover:bg-gray-200 transition-all">
                           <Camera size={20} />
                        </button>
                      )}
                   </div>

                   <div className="flex-1 text-center md:text-left mb-2">
                      <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-1">{group.name}</h1>
                      <div className="flex items-center justify-center md:justify-start gap-2 text-gray-500 font-bold text-sm">
                         {group.is_public ? <Globe size={16} /> : <Lock size={16} />}
                         <span>{group.is_public ? 'Public group' : 'Private group'}</span>
                         <span>•</span>
                         <span>{group.member_count} members</span>
                      </div>
                   </div>

                   <div className="flex items-center gap-3 mb-2">
                      <button 
                        onClick={handleJoinLeave}
                        className={`h-10 px-6 rounded-lg font-black text-sm flex items-center gap-2 transition-all ${
                          isMember 
                            ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' 
                            : 'bg-primary text-white shadow-xl shadow-primary/40 hover:bg-primary/90'
                        }`}
                      >
                         {isMember ? <Users size={18} /> : <UserPlus size={18} />}
                         {isMember ? 'Joined' : pendingJoin ? 'Pending' : 'Join Group'}
                      </button>
                      <button 
                        onClick={() => setShowInviteModal(true)}
                        className="h-10 px-6 bg-gray-200 text-gray-800 rounded-lg font-black text-sm hover:bg-gray-300 transition-all flex items-center gap-2"
                      >
                         <Plus size={18} /> Invite
                      </button>
                      <div 
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="h-10 w-10 bg-gray-200 text-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-300 transition-all relative cursor-pointer"
                      >
                         <MoreHorizontal size={20} />
                         {showDropdown && (
                           <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 p-2">
                              <button onClick={() => setShowSettingsModal(true)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-sm font-bold text-gray-700">
                                <Shield size={18} className="text-gray-400" /> Group Settings
                              </button>
                              <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-sm font-bold text-gray-700">
                                <Share2 size={18} className="text-gray-400" /> Share Group
                              </button>
                              <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-sm font-bold text-gray-700">
                                <Flag size={18} className="text-gray-400" /> Report Group
                              </button>
                           </div>
                         )}
                      </div>
                   </div>
                </div>

                <div className="border-t border-gray-100 pt-1">
                   <div className="flex items-center gap-1">
                      {(['posts', 'about', 'members', 'media'] as Tab[]).map(t => (
                        <button
                          key={t}
                          onClick={() => setActiveTab(t)}
                          className={`px-4 py-4 text-sm font-bold relative transition-colors ${
                            activeTab === t ? 'text-primary' : 'text-gray-500 hover:bg-gray-100 rounded-lg'
                          }`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                          {activeTab === t && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
                        </button>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              <div className="lg:col-span-4 space-y-6">
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="text-xl font-black text-gray-900 mb-4">About</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-6 font-medium">
                       {group.description || 'Welcome to our community!'}
                    </p>
                    <div className="space-y-4">
                       <div className="flex items-center gap-3 text-sm text-gray-700 font-bold">
                          <Globe size={20} className="text-gray-400" />
                          <div>
                             <p>Public</p>
                             <p className="text-xs text-gray-500 font-medium">Anyone can see who's in the group and what they post.</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3 text-sm text-gray-700 font-bold">
                          <Users size={20} className="text-gray-400" />
                          <div>
                             <p>Visible</p>
                             <p className="text-xs text-gray-500 font-medium">Anyone can find this group.</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3 text-sm text-gray-700 font-bold">
                          <Info size={20} className="text-gray-400" />
                          <div>
                             <p>{group.category || 'General'} Group</p>
                          </div>
                       </div>
                    </div>
                    <button 
                      onClick={() => {
                        setActiveTab('about');
                        window.scrollTo({ top: 400, behavior: 'smooth' });
                      }} 
                      className="w-full mt-6 py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg font-black text-sm transition-all"
                    >
                       Learn More
                    </button>
                 </div>

                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-xl font-black text-gray-900">Photos</h3>
                       <button onClick={() => setActiveTab('media')} className="text-sm font-bold text-primary hover:underline">See all</button>
                    </div>
                    <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
                       {media.length > 0 ? (
                         media.slice(0, 4).map((item, idx) => (
                           <div key={idx} className="aspect-square bg-gray-100 relative group overflow-hidden cursor-pointer" onClick={() => setActiveTab('media')}>
                             <img 
                               src={item.media_url.startsWith('http') ? item.media_url : `http://localhost:3000/${item.media_url.replace(/\\/g, '/')}`} 
                               className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                               alt="" 
                             />
                             {idx === 3 && media.length > 4 && (
                               <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-xl">
                                 +{media.length - 4}
                               </div>
                             )}
                           </div>
                         ))
                       ) : (
                         [1,2,3,4,5,6].map(i => (
                            <div key={i} className="aspect-square bg-gray-100" />
                         ))
                       )}
                    </div>
                 </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                 {activeTab === 'posts' && (
                    <>
                       {isMember ? (
                          <div className="bg-white rounded-[32px] shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden group transition-all hover:shadow-primary/10">
                             <div className="p-5 md:p-6">
                                <div className="flex items-center gap-4 mb-6">
                                   <div className="relative">
                                      <img 
                                        src={getAvatarUrl(user?.avatar_url, user?.username)} 
                                        className="w-12 h-12 rounded-2xl object-cover ring-4 ring-gray-50 shadow-sm" 
                                        alt="" 
                                      />
                                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full" />
                                   </div>
                                   <button 
                                     onClick={() => { setPostModalView('post'); setShowPostModal(true); }}
                                     className="flex-1 bg-gray-50 hover:bg-white hover:ring-2 hover:ring-primary/20 text-gray-400 text-left px-6 py-4 rounded-[20px] font-bold text-base transition-all"
                                   >
                                      What's on your mind?
                                   </button>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    <button onClick={() => { setPostModalView('post'); setShowPostModal(true); }} className="flex flex-col md:flex-row items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-green-50 rounded-[20px] transition-all group/btn">
                                       <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-green-500 group-hover/btn:scale-110 transition-transform">
                                          <ImageIcon size={20} />
                                       </div>
                                       <span className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">Photo</span>
                                    </button>
                                    <button onClick={() => { setPostModalView('post'); setShowPostModal(true); }} className="flex flex-col md:flex-row items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-blue-50 rounded-[20px] transition-all group/btn">
                                       <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-blue-500 group-hover/btn:scale-110 transition-transform">
                                          <UserPlus size={20} />
                                       </div>
                                       <span className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">Tag</span>
                                    </button>
                                    <button onClick={() => { setPostModalView('feeling'); setShowPostModal(true); }} className="flex flex-col md:flex-row items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-yellow-50 rounded-[20px] transition-all group/btn">
                                       <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-yellow-500 group-hover/btn:scale-110 transition-transform">
                                          <Activity size={20} />
                                       </div>
                                       <span className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">Activity</span>
                                    </button>
                                 </div>
                             </div>
                             <div className="bg-gray-50/50 px-8 py-3 flex items-center justify-between border-t border-gray-100">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Community Spark</span>
                                <div className="flex gap-1">
                                   <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                                   <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                                </div>
                             </div>
                          </div>
                       ) : !group.is_public && (
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
                             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                                <Lock size={32} />
                             </div>
                             <h3 className="text-2xl font-black text-gray-900">This Group is Private</h3>
                             <p className="text-gray-500 font-medium">Join this group to view posts and participate in discussions.</p>
                             <button onClick={handleJoinLeave} className="px-8 py-3 bg-primary text-white rounded-lg font-black text-sm shadow-xl shadow-primary/40">
                                Join Group
                             </button>
                          </div>
                       )}

                       <div className="space-y-6">
                          {posts.length > 0 ? posts.map(post => (
                             <PostCard key={post.post_id} post={post} />
                          )) : (
                             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-sm">
                                No posts yet
                             </div>
                          )}
                       </div>
                    </>
                 )}

                 {activeTab === 'about' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
                       <div className="flex items-center gap-4 mb-2">
                          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
                             <Info size={24} />
                          </div>
                          <h2 className="text-2xl font-black text-gray-900">About this group</h2>
                       </div>
                       <div className="space-y-6 text-gray-600 leading-relaxed font-medium">
                          <p className="text-[17px]">{group.description || 'Welcome to our community! This space is dedicated to sharing ideas, organizing events, and connecting with others.'}</p>
                          <div className="grid grid-cols-2 gap-4 pt-4">
                             <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Members</p>
                                <p className="text-xl font-black text-gray-900">{group.memberCount || 0}</p>
                             </div>
                             <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Created</p>
                                <p className="text-xl font-black text-gray-900">{new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                             </div>
                          </div>
                       </div>
                       <div className="pt-8 border-t border-gray-100">
                          <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                             <Shield size={20} className="text-primary" /> Group rules
                          </h3>
                          <div className="space-y-4">
                             {[
                               { t: 'Be kind and courteous', d: 'We\'re all in this together to create a welcoming environment.' },
                               { t: 'No hate speech or bullying', d: 'Make sure everyone feels safe and respected.' },
                               { t: 'No promotions or spam', d: 'Give more than you take to this community.' },
                               { t: 'Respect privacy', d: 'What\'s shared in the group should stay in the group.' }
                             ].map((r, i) => (
                               <div key={i} className="p-5 bg-white border border-gray-100 rounded-2xl hover:border-primary/40 transition-all group/rule">
                                  <p className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                     <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-black group-hover/rule:bg-primary group-hover/rule:text-white transition-colors">{i+1}</span>
                                     {r.t}
                                  </p>
                                  <p className="text-sm text-gray-500 font-medium pl-8">{r.d}</p>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 )}

                 {activeTab === 'members' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                       <h2 className="text-2xl font-black text-gray-900 mb-6">Members</h2>
                       <div className="relative mb-6">
                          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                            type="text" 
                            placeholder="Find a member" 
                            value={memberSearchQuery}
                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                            className="w-full bg-gray-100 border-none rounded-lg py-2.5 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/40" 
                          />
                       </div>
                       <div className="space-y-4">
                          {members
                           .filter(m => m.name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) || m.username?.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                           .map((m, i) => (
                             <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-all cursor-pointer" onClick={() => navigate(`/profile/${m.username}`)}>
                                <div className="flex items-center gap-4">
                                   <img 
                                     src={getAvatarUrl(m.avatar, m.username)} 
                                     className="w-12 h-12 rounded-xl object-cover" 
                                     alt="" 
                                   />
                                   <div>
                                      <p className="font-bold text-gray-900">{m.name}</p>
                                      <p className="text-xs text-gray-500 font-medium">@{m.username} \u2022 {m.role.charAt(0).toUpperCase() + m.role.slice(1)}</p>
                                   </div>
                                </div>
                                {m.user_id !== user?.user_id && (
                                  <button className={`h-9 px-4 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 ${
                                    m.is_followed 
                                      ? 'bg-primary text-white shadow-primary/30' 
                                      : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white'
                                  }`}>
                                     {m.is_followed ? 'Following' : 'Follow'}
                                  </button>
                                )}
                             </div>
                          ))}
                          {members.length === 0 && (
                            <div className="py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-sm">
                              No members found
                            </div>
                          )}
                       </div>
                    </div>
                 )}

                 {activeTab === 'media' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                       <h2 className="text-2xl font-black text-gray-900 mb-6">Group Media</h2>
                       {media.length > 0 ? (
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                           {media.map((item, i) => (
                             <div key={i} className="aspect-square rounded-xl overflow-hidden group relative cursor-pointer">
                                <img 
                                  src={item.media_url.startsWith('http') ? item.media_url : `http://localhost:3000/${item.media_url.replace(/\\/g, '/')}`} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                  alt="" 
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-sm border-2 border-dashed border-gray-100 rounded-xl">
                            No photos or videos yet
                         </div>
                       )}
                    </div>
                 )}
              </div>
           </div>
        </div>
      </main>

      {showPostModal && (
        <GroupPostModal 
          groupId={id!} 
          groupName={group.name} 
          initialView={postModalView}
          onClose={() => setShowPostModal(false)}
          onSuccess={() => {
            setShowPostModal(false);
            fetchGroupData(); 
          }}
        />
      )}

      {showInviteModal && (
        <GroupInviteModal 
          groupId={id!} 
          groupName={group.name} 
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {showSettingsModal && (
        <GroupSettingsModal 
          groupId={id!} 
          groupData={group}
          userRole={userRole}
          onClose={() => setShowSettingsModal(false)}
          onUpdate={() => {
            setShowSettingsModal(false);
            fetchGroupData();
          }}
        />
      )}
    </div>
  );
}
