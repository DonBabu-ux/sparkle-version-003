import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Users, Settings, Shield, Plus, MoreHorizontal, 
  Share2, Flag, LogOut, Camera, Globe, Info, 
  Lock, Check, UserPlus, Image as ImageIcon, Activity, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { getAvatarUrl, getMediaUrl } from '../utils/imageUtils';
import PostCard from '../components/PostCard';
import Avatar from '../components/Avatar';
import GroupSettingsModal from '../components/modals/GroupSettingsModal';
import GroupInviteModal from '../components/modals/GroupInviteModal';
import GroupPostModal from '../components/modals/GroupPostModal';
import type { Group, GroupMember } from '../types/group';
import type { Post } from '../types/post';
import Spinner from '../components/ui/Spinner';

type Tab = 'posts' | 'about' | 'members' | 'media';

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [pendingJoin, setPendingJoin] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postModalView, setPostModalView] = useState<'post' | 'feeling'>('post');

  const iconInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGroupData();
  }, [id, user?.user_id]);

  const fetchGroupData = useCallback(async () => {
    if (!id) return;
    try {
      const [groupRes, membersRes, postsRes] = await Promise.all([
        api.get(`/groups/${id}`),
        api.get(`/groups/${id}/members`),
        api.get(`/groups/${id}/posts`)
      ]);
      
      const g = groupRes.data.group || groupRes.data;
      setGroup(g);
      setMembers(membersRes.data.members || membersRes.data || []);
      setPosts(postsRes.data.posts || postsRes.data || []);
      
      // Use roles directly from backend for maximum authority
      const apiRole = g.userRole;
      const apiStatus = g.memberStatus;
      const isCreator = g.creator_id === user?.user_id;

      console.log('Group Detail Permissions:', { apiRole, apiStatus, isCreator, userId: user?.user_id });
      
      setIsMember(apiStatus === 'active' || isCreator);
      setIsOwner(apiRole === 'owner' || isCreator);
      setIsAdmin(apiRole === 'admin' || apiRole === 'owner' || apiRole === 'moderator' || isCreator);
      
      if (apiStatus !== 'active' && !isCreator) {
        const reqRes = await api.get(`/groups/${id}/my-request`);
        setPendingJoin(reqRes.data?.status === 'pending');
      }
    } catch (err) {
      console.error('Failed to fetch group data:', err);
    } finally {
      setLoading(false);
    }
  }, [id, user?.user_id]);

  const handleJoin = async () => {
    if (!id || joining) return;
    setJoining(true);
    try {
      const res = await api.post(`/groups/${id}/join`);
      if (res.data.status === 'active') {
        setIsMember(true);
        fetchGroupData();
      } else {
        setPendingJoin(true);
      }
    } catch (err) {
      console.error('Join failed:', err);
    } finally {
      setJoining(false);
    }
  };

  const handleJoinLeave = async () => {
    if (isMember) {
      if (!window.confirm('Leave this circle?')) return;
      try {
        await api.delete(`/groups/${id}/leave`);
        setIsMember(false);
        setIsAdmin(false);
        setIsOwner(false);
        fetchGroupData();
      } catch (err) {
        console.error('Leave failed:', err);
      }
    } else {
      handleJoin();
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'icon' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    const fd = new FormData();
    fd.append(type === 'icon' ? 'icon' : 'cover', file);

    try {
      await api.put(`/groups/${id}/branding`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchGroupData();
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#fafafa]">
      <Spinner size="medium" color="text-primary" />
    </div>
  );

  if (!group) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-2xl font-black text-gray-900 italic tracking-tighter uppercase">Circle not found</h2>
      <button onClick={() => navigate('/groups')} className="px-6 py-2 bg-primary text-white rounded-xl font-black text-sm uppercase">Go Back</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] pb-20">
      {/* HEADER SECTION */}
      <div className="bg-white shadow-sm overflow-hidden border-b border-gray-100">
        <div className="relative h-36 sm:h-64 w-full bg-gray-100 overflow-hidden">
          <img 
            src={getMediaUrl(group.cover_image)} 
            className="w-full h-full object-cover" 
            alt="Circle Cover" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          
          <button 
            onClick={() => navigate('/groups')}
            className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center bg-black/20 backdrop-blur-md text-white rounded-full hover:bg-black/40 transition-all active:scale-90 border border-white/10 z-10"
          >
            <ArrowLeft size={20} />
          </button>
          {isAdmin && (
            <button 
              onClick={() => coverInputRef.current?.click()}
              className="absolute bottom-3 right-3 w-8 h-8 flex items-center justify-center bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-all active:scale-90 border border-white/30"
            >
              <Camera size={14} />
            </button>
          )}
        </div>

        <div className="relative -mt-12 mb-4 px-4">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3">
                <div className="w-24 h-24 rounded-[32px] border-[5px] border-white shadow-2xl overflow-hidden bg-white ring-1 ring-gray-100">
                  <img 
                    src={getAvatarUrl(group.icon_url)} 
                    className="w-full h-full object-cover" 
                    alt="Circle Icon" 
                  />
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => iconInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-white rounded-xl shadow-lg border-2 border-white flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <Camera size={12} />
                  </button>
                )}
              </div>
              
              <div className="space-y-1 mb-4">
                <div className="flex items-center justify-center gap-1.5">
                  <h1 className="text-xl font-black text-gray-900 italic tracking-tighter uppercase leading-tight">
                    {group.name}
                  </h1>
                  {group.verified && (
                    <div className="w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                      <Check size={8} className="text-white" strokeWidth={5} />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <Globe size={11} className="text-primary" />
                  <span>{group.is_public ? 'Public circle' : 'Private circle'}</span>
                  <span className="text-gray-200">|</span>
                  <Users size={11} className="text-primary" />
                  <span>{group.member_count?.toLocaleString() || 0} Members</span>
                </div>
              </div>

              {/* Action Bar - Clean Row */}
              <div className="flex items-center gap-2 w-full max-w-sm mt-6">
                {isAdmin && (
                   <button 
                    onClick={() => setShowSettingsModal(true)}
                    className="flex-1 h-9 bg-primary/10 text-primary rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-primary/20 hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm shadow-primary/5"
                   >
                      <Settings size={14} />
                      Manage
                   </button>
                )}

                {isMember ? (
                  <div className="flex-1 h-9 bg-black/5 text-black/40 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border border-black/5">
                      <Check size={12} strokeWidth={4} className="text-primary" /> Joined
                  </div>
                ) : (
                  <button 
                    onClick={handleJoin}
                    disabled={joining || pendingJoin}
                    className="flex-1 h-9 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                  >
                    {joining ? 'Harmonizing...' : pendingJoin ? 'Sync Pending' : 'Join Circle'}
                  </button>
                )}

                <button 
                  onClick={() => setShowInviteModal(true)}
                  className="w-9 h-9 flex items-center justify-center bg-white border border-gray-100 text-primary rounded-xl hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
                >
                  <UserPlus size={16} />
                </button>
              </div>
            </div>
        </div>

        <div className="border-t border-gray-100 pt-1">
          <div className="flex items-center justify-center gap-1 px-4 overflow-x-auto no-scrollbar">
            {(['posts', 'about', 'members', 'media'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-4 text-[11px] font-black uppercase tracking-widest relative transition-colors ${
                  activeTab === t ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t}
                {activeTab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_0_8px_rgba(255,105,180,0.6)]" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-[10px] shadow-sm border border-gray-200 p-4">
              <h3 className="text-base font-black text-gray-900 uppercase tracking-tighter italic mb-4">About</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-6 font-medium">
                {group.description || 'Welcome to our community!'}
              </p>
              <div className="space-y-4 border-t border-gray-50 pt-4">
                <div className="flex items-center gap-3 text-sm text-gray-700 font-bold">
                  <Globe size={18} className="text-primary" />
                  <div>
                    <p className="text-[13px]">{group.is_public ? 'Public Circle' : 'Private Circle'}</p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider leading-none mt-1">
                      {group.is_public ? 'Anyone can see content' : 'Approved members only'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700 font-bold">
                  <Info size={18} className="text-primary" />
                  <div>
                    <p className="text-[13px]">{group.category || 'General'} Topic</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[10px] shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tighter italic">Members</h3>
                <button onClick={() => setActiveTab('members')} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">See all</button>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center -space-x-2.5">
                  {members.slice(0, 5).map((m, i) => (
                    <Avatar key={i} src={m.avatar} name={m.username} size="sm" className="ring-2 ring-white" />
                  ))}
                </div>
                {group.member_count > 5 && (
                  <span className="text-[10px] text-gray-400 font-black tracking-widest ml-1">+{group.member_count - 5} MORE</span>
                )}
              </div>
              <button 
                onClick={() => setShowInviteModal(true)}
                className="w-full py-2.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <UserPlus size={14} className="text-primary" /> Invite to Circle
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            {activeTab === 'posts' && (
              <>
                {isMember || group.is_public ? (
                  <>
                    {isMember && (
                      <div className="bg-white rounded-[10px] shadow-sm border border-gray-100 p-4 overflow-hidden">
                        <div className="flex items-center gap-3 mb-4">
                          <Avatar 
                            src={user?.avatar_url} 
                            name={user?.username} 
                            size="md" 
                            className="rounded-xl ring-2 ring-gray-50"
                          />
                          <button 
                            onClick={() => { setPostModalView('post'); setShowPostModal(true); }}
                            className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-400 text-left px-4 py-3 rounded-[10px] font-bold text-sm transition-all"
                          >
                            What's on your mind?
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => { setPostModalView('post'); setShowPostModal(true); }} className="flex flex-col items-center justify-center gap-1 py-2.5 bg-gray-50 hover:bg-primary/5 rounded-[10px] transition-all group/btn border border-transparent hover:border-primary/20">
                            <ImageIcon size={16} className="text-primary" />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover/btn:text-primary">Photo</span>
                          </button>
                          <button onClick={() => setShowInviteModal(true)} className="flex flex-col items-center justify-center gap-1 py-2.5 bg-gray-50 hover:bg-primary/5 rounded-[10px] transition-all group/btn border border-transparent hover:border-primary/20">
                            <UserPlus size={16} className="text-primary" />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover/btn:text-primary">Invite</span>
                          </button>
                          <button onClick={() => { setPostModalView('feeling'); setShowPostModal(true); }} className="flex flex-col items-center justify-center gap-1 py-2.5 bg-gray-50 hover:bg-primary/5 rounded-[10px] transition-all group/btn border border-transparent hover:border-primary/20">
                            <Activity size={16} className="text-primary" />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover/btn:text-primary">Feeling</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {posts && posts.length > 0 ? posts.map(post => (
                        <PostCard key={post.post_id} post={post} />
                      )) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                          No posts yet
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center space-y-6">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-primary">
                      <Lock size={32} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase italic">This Circle is Private</h3>
                    <p className="text-gray-500 font-medium max-w-sm mx-auto text-sm">Join this circle to view posts, participate in discussions, and connect with the community.</p>
                    <button 
                      onClick={handleJoin}
                      className="px-10 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-105 transition-all"
                    >
                      Join Circle
                    </button>
                  </div>
                )}
              </>
            )}

            {activeTab === 'members' && (
              <div className="bg-white rounded-[10px] shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50">
                   <h3 className="text-base font-black text-gray-900 uppercase tracking-tighter italic">Members ({members.length})</h3>
                   <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest">
                      <Plus size={14} /> Invite New
                   </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {members.map(member => (
                    <div key={member.user_id} className="flex items-center justify-between p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar src={member.avatar} name={member.username} size="md" />
                        <div>
                          <p className="text-[13px] font-bold text-gray-900 leading-none mb-1">{member.name || member.username}</p>
                          <p className="text-[10px] text-gray-400 font-semibold leading-none">@{member.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.role === 'owner' || member.role === 'admin' ? (
                          <div className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[9px] font-black uppercase tracking-wider italic">Admin</div>
                        ) : null}
                        {isAdmin && member.user_id !== user?.user_id && (
                           <button 
                             onClick={(e) => { e.stopPropagation(); setShowSettingsModal(true); }}
                             className="p-2 hover:bg-gray-200 rounded-lg text-primary"
                           >
                              <Shield size={16} />
                           </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'about' && (
               <div className="bg-white rounded-[10px] shadow-sm border border-gray-200 p-6 space-y-8 text-center sm:text-left">
                  <div>
                     <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 leading-none">The Manifesto</h4>
                     <p className="text-base text-gray-600 leading-relaxed font-medium">
                        {group.description || 'No description provided.'}
                     </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-4 bg-gray-50 rounded-xl">
                        <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Created By</h5>
                        <p className="text-sm font-bold text-gray-900">{group.creator_name || 'Original Member'}</p>
                     </div>
                     <div className="p-4 bg-gray-50 rounded-xl">
                        <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Born On</h5>
                        <p className="text-sm font-bold text-gray-900">{new Date(group.created_at).toLocaleDateString()}</p>
                     </div>
                  </div>
               </div>
            )}
          </div>
        </div>
      </div>

      <input 
        type="file" 
        ref={iconInputRef} 
        onChange={(e) => handleUpload(e, 'icon')} 
        hidden 
        accept="image/*" 
      />
      <input 
        type="file" 
        ref={coverInputRef} 
        onChange={(e) => handleUpload(e, 'cover')} 
        hidden 
        accept="image/*" 
      />

      {group && showSettingsModal && (
        <GroupSettingsModal 
          isOpen={showSettingsModal} 
          onClose={() => setShowSettingsModal(false)} 
          groupId={id as string}
          groupData={group}
          userRole={isOwner ? 'owner' : isAdmin ? 'admin' : 'member'}
          onUpdate={fetchGroupData}
        />
      )}

      {group && showInviteModal && (
        <GroupInviteModal 
          groupId={id as string}
          groupName={group.name}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {group && showPostModal && (
        <GroupPostModal 
          groupId={id as string}
          groupName={group.name}
          initialView={postModalView}
          onClose={() => setShowPostModal(false)}
          onSuccess={fetchGroupData}
        />
      )}
    </div>
  );
}
