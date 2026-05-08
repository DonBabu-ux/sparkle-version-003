import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import { 
  Users, Globe, Layers, MessageSquare, Lock, ArrowLeft, Shield, 
  Sparkles, ChevronRight, Share2, Info, Image as ImageIcon, 
  MoreHorizontal, UserPlus, Heart, MessageCircle, Flag, ShieldAlert,
  Search, Camera, Plus, Activity, Settings, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import GroupPostModal from '../components/modals/GroupPostModal';
import GroupInviteModal from '../components/modals/GroupInviteModal';
import GroupSettingsModal from '../components/modals/GroupSettingsModal';
import { getAvatarUrl, getMediaUrl } from '../utils/imageUtils';
import Avatar from '../components/Avatar';

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
  const [isOwner, setIsOwner] = useState(false);
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
        setIsOwner(groupData.userRole === 'owner');
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
        {/* Sticky Mobile Header */}
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
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <button 
                      onClick={() => setShowSettingsModal(true)}
                      className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-black shadow-lg hover:bg-white transition-all active:scale-95"
                    >
                      <Camera size={18} /> Edit Cover
                    </button>
                    <button 
                      onClick={() => setShowSettingsModal(true)}
                      className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-black shadow-lg hover:bg-primary/90 transition-all active:scale-95"
                    >
                      <Shield size={18} /> Circle Settings
                    </button>
                  </div>
                )}
             </div>

             <div className="px-4 md:px-8 pb-4">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-12 md:-mt-16 mb-6">
                   <div className="relative">
                      <Avatar src={group.icon_url} name={group.name} size="xxl" className="border-4 border-white shadow-md bg-white" />
                      {isAdmin && (
                        <button 
                          onClick={() => setShowSettingsModal(true)}
                          className="absolute bottom-2 right-2 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 hover:bg-gray-200 transition-all active:scale-90"
                        >
                           <Camera size={20} />
                        </button>
                      )}
                   </div>

                   <div className="flex-1 text-center md:text-left mb-2">
                      <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-1">{group.name}</h1>
                      <div className="flex items-center justify-center md:justify-start gap-2 text-gray-500 font-bold text-sm">
                         {group.is_public ? <Globe size={16} /> : <Lock size={16} />}
                         <span>{group.is_public ? 'Public circle' : 'Private circle'}</span>
                         <span>•</span>
                         <span>{group.member_count} members</span>
                      </div>
                   </div>

                    <div className="flex items-center gap-2 mb-2">
                        {/* ADMIN DASHBOARD (Shield) */}
                        {isAdmin && (
                          <button 
                            onClick={() => setShowSettingsModal(true)}
                            title="Admin Dashboard"
                            className="h-10 w-10 bg-primary text-white rounded-lg flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-90"
                          >
                             <Shield size={20} />
                          </button>
                        )}

                        {/* MEMBER SETTINGS (Gear) - if member */}
                        {isMember && (
                          <button 
                            onClick={() => setShowDropdown(!showDropdown)}
                            title="Member Settings"
                            className="h-10 w-10 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90"
                          >
                             <Settings size={20} />
                          </button>
                        )}

                        {/* JOIN / REQUEST BUTTON */}
                        {!isMember && !isAdmin && (
                          <button 
                            onClick={handleJoinLeave}
                            disabled={pendingJoin}
                            className={`h-10 px-8 rounded-lg font-black text-sm flex items-center gap-2 transition-all active:scale-95 ${
                              pendingJoin 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'bg-primary text-white shadow-xl shadow-primary/40 hover:bg-primary/90'
                            }`}
                          >
                             {pendingJoin ? 'Requested' : <><UserPlus size={18} /> Join Circle</>}
                          </button>
                        )}

                        {/* INVITE BUTTON */}
                        {(isMember || isAdmin) && (
                          <button 
                            onClick={() => setShowInviteModal(true)}
                            className="h-10 px-6 bg-gray-100 text-gray-800 rounded-lg font-black text-sm hover:bg-gray-200 transition-all flex items-center gap-2 active:scale-95"
                          >
                             <Plus size={18} /> Invite
                          </button>
                        )}
                      <div className="relative">
                        {!isMember && (
                          <div 
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="h-10 w-10 bg-gray-200 text-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-300 transition-all relative cursor-pointer active:scale-90"
                          >
                             <MoreHorizontal size={20} />
                          </div>
                        )}
                        
                        <AnimatePresence>
                          {showDropdown && (
                            <>
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-40"
                                onClick={() => setShowDropdown(false)}
                              />
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ duration: 0.1, ease: 'easeOut' }}
                                className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 p-2 overflow-hidden"
                              >
                                 <button 
                                   onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link copied!'); setShowDropdown(false); }}
                                   className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-sm font-black text-gray-700 transition-colors"
                                 >
                                   <Share2 size={18} className="text-gray-400" /> Share Circle
                                 </button>
                                 
                                 <button 
                                   onClick={() => { alert('Reported'); setShowDropdown(false); }}
                                   className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-sm font-black text-gray-400 transition-colors"
                                 >
                                   <Flag size={18} className="text-gray-300" /> Report Circle
                                 </button>
 
                                 {isMember && !isOwner && (
                                    <button 
                                      onClick={() => { handleJoinLeave(); setShowDropdown(false); }}
                                      className="w-full flex items-center gap-3 p-3 hover:bg-red-50 rounded-lg text-sm font-black text-red-500 transition-colors border-t border-gray-50 mt-1 pt-3"
                                    >
                                      <LogOut size={18} className="text-red-400" /> Leave Circle
                                    </button>
                                 )}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
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
                 {/* ABOUT SIDEBAR */}
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="text-xl font-black text-gray-900 mb-4">About</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-6 font-medium">
                       {group.description || 'Welcome to our community!'}
                    </p>
                    <div className="space-y-4">
                       <div className="flex items-center gap-3 text-sm text-gray-700 font-bold">
                          <Globe size={20} className="text-gray-400" />
                          <div>
                             <p>{group.is_public ? 'Public' : 'Private'}</p>
                             <p className="text-xs text-gray-500 font-medium">
                                {group.is_public ? 'Anyone can see content and posts.' : 'Only approved members can see content.'}
                             </p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3 text-sm text-gray-700 font-bold">
                          <Info size={20} className="text-gray-400" />
                          <div>
                             <p>{group.category || 'General'} Circle</p>
                          </div>
                       </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('about')} 
                      className="w-full mt-6 py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg font-black text-sm transition-all"
                    >
                       Learn More
                    </button>
                 </div>

                 {/* MEMBER PREVIEW (MEMBER LIST VISIBILITY) */}
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-xl font-black text-gray-900">Members</h3>
                       <button onClick={() => setActiveTab('members')} className="text-sm font-bold text-primary hover:underline">See all</button>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                       <div className="flex items-center -space-x-3">
                          {members.slice(0, 5).map((m, i) => (
                             <Avatar key={i} src={m.avatar} name={m.username} size="md" className="border-2 border-white" />
                          ))}
                       </div>
                       {group.member_count > 5 && (
                          <span className="text-xs text-gray-500 font-black ml-1">+{group.member_count - 5} others</span>
                       )}
                    </div>
                    <button 
                      onClick={() => setShowInviteModal(true)}
                      className="w-full py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-black text-sm transition-all flex items-center justify-center gap-2"
                    >
                       <UserPlus size={18} /> Invite to Circle
                    </button>
                 </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                 {/* VISIBILITY LOGIC: Hidden content for private groups */}
                 {activeTab === 'posts' && (
                    <>
                       {isMember || group.is_public ? (
                          <>
                             {isMember && (
                                <div className="bg-white rounded-[32px] shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden group transition-all hover:shadow-primary/10">
                                   <div className="p-5 md:p-6">
                                      <div className="flex items-center gap-4 mb-6">
                                         <Avatar 
                                           src={user?.avatar_url} 
                                           name={user?.username} 
                                           size="lg" 
                                           className="rounded-2xl ring-4 ring-gray-50"
                                         />
                                         <button 
                                           onClick={() => { setPostModalView('post'); setShowPostModal(true); }}
                                           className="flex-1 bg-gray-50 hover:bg-white hover:ring-2 hover:ring-primary/20 text-gray-400 text-left px-6 py-4 rounded-[20px] font-bold text-base transition-all"
                                         >
                                            What's on your mind?
                                         </button>
                                      </div>
                                      <div className="grid grid-cols-3 gap-3">
                                          <button onClick={() => { setPostModalView('post'); setShowPostModal(true); }} className="flex flex-col md:flex-row items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-green-50 rounded-[20px] transition-all group/btn">
                                             <ImageIcon size={20} className="text-green-500" />
                                             <span className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">Photo</span>
                                          </button>
                                          <button onClick={() => setShowInviteModal(true)} className="flex flex-col md:flex-row items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-blue-50 rounded-[20px] transition-all group/btn">
                                             <UserPlus size={20} className="text-blue-500" />
                                             <span className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">Invite</span>
                                          </button>
                                          <button onClick={() => { setPostModalView('feeling'); setShowPostModal(true); }} className="flex flex-col md:flex-row items-center justify-center gap-2 py-3 bg-gray-50 hover:bg-yellow-50 rounded-[20px] transition-all group/btn">
                                             <Activity size={20} className="text-yellow-500" />
                                             <span className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">Feeling</span>
                                          </button>
                                       </div>
                                   </div>
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
                       ) : (
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center space-y-6">
                             <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                                <Lock size={40} />
                             </div>
                             <h3 className="text-3xl font-black text-gray-900 tracking-tight">This Circle is Private</h3>
                             <p className="text-gray-500 font-medium max-w-sm mx-auto">Join this circle to view posts, participate in discussions, and connect with the community.</p>
                             {!isMember && (
                                <button 
                                  onClick={handleJoinLeave}
                                  className="px-10 py-4 bg-primary text-white rounded-xl font-black text-sm shadow-2xl shadow-primary/40 hover:scale-105 transition-all"
                                >
                                  Join Circle
                                </button>
                             )}
                          </div>
                       )}
                    </>
                 )}

                 {activeTab === 'about' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
                       <h2 className="text-2xl font-black text-gray-900">About this circle</h2>
                       <p className="text-[17px] text-gray-600 leading-relaxed font-medium">
                          {group.description || 'No description provided.'}
                       </p>
                       <div className="pt-8 border-t border-gray-100">
                          <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                             <Shield size={20} className="text-primary" /> Community Rules
                          </h3>
                          <div className="space-y-4">
                             {[
                                { t: 'Be respectful', d: 'Treat everyone with kindness and respect.' },
                                { t: 'No spam', d: 'Do not post promotional content or spam.' },
                                { t: 'Privacy first', d: 'Respect the privacy of all community members.' }
                             ].map((r, i) => (
                                <div key={i} className="p-5 bg-gray-50 border border-gray-100 rounded-2xl">
                                   <p className="font-bold text-gray-900 mb-1">{i+1}. {r.t}</p>
                                   <p className="text-sm text-gray-500 font-medium">{r.d}</p>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 )}

                 {activeTab === 'members' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                       <div className="flex items-center justify-between mb-6">
                          <h2 className="text-2xl font-black text-gray-900">Members</h2>
                          <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-black text-gray-500">{group.member_count} Total</span>
                       </div>
                       
                       <div className="space-y-4">
                          {members.map((m, i) => (
                             <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-all cursor-pointer" onClick={() => navigate(`/profile/${m.username}`)}>
                                <div className="flex items-center gap-4">
                                   <img 
                                     src={getAvatarUrl(m.avatar, m.username)} 
                                     className="w-12 h-12 rounded-xl object-cover" 
                                     alt="" 
                                   />
                                   <div>
                                      <p className="font-bold text-gray-900 flex items-center gap-2">
                                         {m.name}
                                         {m.role === 'owner' && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-600 text-[10px] font-black rounded-full uppercase">Founder</span>}
                                         {m.role === 'admin' && <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-black rounded-full uppercase">Admin</span>}
                                      </p>
                                      <p className="text-xs text-gray-500 font-medium">@{m.username}</p>
                                   </div>
                                </div>
                                {isAdmin && m.user_id !== user?.user_id && (
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); setShowSettingsModal(true); }}
                                     className="p-2 hover:bg-gray-200 rounded-lg text-gray-400"
                                   >
                                      <Shield size={18} />
                                   </button>
                                )}
                             </div>
                          ))}
                          {/* MEMBER LIST VISIBILITY SYSTEM */}
                          {!isAdmin && group.member_count > 20 && (
                             <div className="py-8 text-center border-t border-dashed border-gray-100 mt-4">
                                <p className="text-sm text-gray-400 font-black uppercase tracking-widest">
                                   and {group.member_count - 20} others
                                </p>
                             </div>
                          )}
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </main>

      {/* Modals remain same but handle updated roles */}
      {showPostModal && (
        <GroupPostModal 
          groupId={id!} 
          groupName={group.name} 
          initialView={postModalView}
          onClose={() => setShowPostModal(false)}
          onSuccess={() => { setShowPostModal(false); fetchGroupData(); }}
        />
      )}
      {showInviteModal && <GroupInviteModal groupId={id!} groupName={group.name} onClose={() => setShowInviteModal(false)} />}
      {showSettingsModal && (
        <GroupSettingsModal 
          groupId={id!} 
          groupData={group}
          userRole={userRole}
          onClose={() => setShowSettingsModal(false)}
          onUpdate={() => { setShowSettingsModal(false); fetchGroupData(); }}
        />
      )}
    </div>
  );
}
