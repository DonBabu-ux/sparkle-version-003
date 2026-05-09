import { useState, useEffect, useRef } from 'react';
import { 
  X, Settings, Users, UserCheck, Shield, ChevronRight, Check, Loader2, 
  Trash2, ShieldAlert, ArrowLeft, Globe, Lock, PenSquare, 
  UserMinus, UserPlus, Info, Bell, LogOut, Camera, Image as ImageIcon,
  MessageSquare, VolumeX, Ban
} from 'lucide-react';
import api from '../../api/api';
import { getAvatarUrl, getMediaUrl } from '../../utils/imageUtils';
import { motion, AnimatePresence } from 'framer-motion';
import Spinner from '../ui/Spinner';

interface GroupSettingsModalProps {
  groupId: string;
  groupData: any;
  userRole: string; // 'owner', 'admin', 'moderator', 'member'
  onClose: () => void;
  onUpdate: () => void;
  isOpen: boolean;
}

export default function GroupSettingsModal({ groupId, groupData, userRole, onClose, onUpdate, isOpen }: GroupSettingsModalProps) {
  const isAdmin = userRole === 'owner' || userRole === 'super_admin' || userRole === 'admin' || userRole === 'moderator';
  const isOwner = userRole === 'owner' || userRole === 'super_admin';

  const [activeTab, setActiveTab] = useState<'profile' | 'access' | 'members' | 'requests' | 'moderation' | 'danger'>('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(true);

  // Settings State
  const [name, setName] = useState(groupData.name || '');
  const [description, setDescription] = useState(groupData.description || '');
  const [isPublic, setIsPublic] = useState(groupData.is_public === 1 || groupData.is_public === true);
  const [requiresApproval, setRequiresApproval] = useState(groupData.requires_approval === 1 || groupData.requires_approval === true);
  const [allowPosts, setAllowPosts] = useState(groupData.allow_posts === 1 || groupData.allow_posts === true);
  const [requirePostApproval, setRequirePostApproval] = useState(groupData.require_post_approval === 1 || groupData.require_post_approval === true);

  // Images
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState(groupData.icon_url || '');
  const [coverPreview, setCoverPreview] = useState(groupData.cover_image || '');

  // Members & Requests & Moderation
  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'members') fetchMembers();
    if (activeTab === 'requests' && isAdmin) fetchRequests();
    if (activeTab === 'moderation' && isAdmin) fetchPendingPosts();
    if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
  }, [activeTab]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/groups/${groupId}/members`);
      setMembers(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/groups/${groupId}/requests`);
      setRequests(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchPendingPosts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/groups/${groupId}/pending-posts`);
      setPendingPosts(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('is_public', isPublic ? 'true' : 'false');
      formData.append('requires_approval', requiresApproval ? 'true' : 'false');
      formData.append('allow_posts', allowPosts ? 'true' : 'false');
      formData.append('require_post_approval', requirePostApproval ? 'true' : 'false');
      
      if (iconFile) formData.append('icon', iconFile);
      if (coverFile) formData.append('cover', coverFile);

      await api.post(`/groups/${groupId}/update`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      onUpdate();
      alert('Circle settings updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleMemberAction = async (userId: string, action: 'remove' | 'promote' | 'demote' | 'mute' | 'ban', value?: any) => {
    try {
      let res;
      if (action === 'mute') res = await api.post(`/groups/${groupId}/users/${userId}/mute`, { muted: value });
      else if (action === 'ban') res = await api.post(`/groups/${groupId}/users/${userId}/ban`, { banned: value });
      else res = await api.post(`/groups/${groupId}/users/${userId}/${action}`);
      
      if (res.data.success || res.data) fetchMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostAction = async (postId: string, action: 'approve' | 'reject') => {
    try {
      await api.post(`/groups/posts/${postId}/${action}`);
      setPendingPosts(prev => prev.filter(p => p.post_id !== postId));
    } catch (err) {
      console.error(err);
      alert('Failed to process post.');
    }
  };

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const res = await api.post(`/groups/requests/${requestId}/${action}`);
      if (res.data.success) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
        if (action === 'approve') fetchMembers();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to process request.');
    }
  };

  const handleLeaveCircle = async () => {
    if (!window.confirm('Are you sure you want to leave this circle?')) return;
    try {
      await api.post(`/groups/${groupId}/leave`);
      onClose();
      window.location.href = '/groups';
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'icon' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    if (type === 'icon') {
      setIconFile(file);
      setIconPreview(previewUrl);
    } else {
      setCoverFile(file);
      setCoverPreview(previewUrl);
    }
  };

  const menuItems = [
    { id: 'profile', label: 'Circle Identity', icon: Info, adminOnly: false },
    { id: 'access', label: 'Access Control', icon: Shield, adminOnly: true },
    { id: 'members', label: 'Squad Members', icon: Users, adminOnly: false },
    { id: 'requests', label: 'Admission Gate', icon: UserCheck, adminOnly: true, count: requests.length },
    { id: 'moderation', label: 'Mod Queue', icon: MessageSquare, adminOnly: true, count: pendingPosts.length },
    { id: 'danger', label: 'Danger Zone', icon: ShieldAlert, adminOnly: false },
  ];

  const visibleMenuItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xl p-0 sm:p-4" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#fdf2f4] w-full h-[100dvh] sm:h-[90vh] sm:max-w-5xl sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Sidebar Navigation */}
        <aside className={`
          flex-shrink-0 bg-white border-r border-gray-100 flex flex-col transition-all duration-300
          ${isMobileMenuOpen ? 'w-full md:w-72' : 'hidden md:flex md:w-72'}
        `}>
          <div className="p-6 md:p-8 h-full flex flex-col">
             <div className="flex items-center justify-between mb-8">
                <div>
                   <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                   <p className="text-sm font-medium text-gray-500 mt-1">Manage your circle</p>
                </div>
                <button onClick={onClose} className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-gray-500 active:scale-95 transition-all">
                   <X size={20} />
                </button>
             </div>

             <nav className="space-y-1.5 overflow-y-auto no-scrollbar flex-1">
                {visibleMenuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-4 p-3 rounded-xl font-semibold text-sm transition-all group
                      ${activeTab === item.id 
                        ? 'bg-primary text-white shadow-md' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                    `}
                  >
                    <item.icon size={18} strokeWidth={2.5} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.count ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === item.id ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
                        {item.count}
                      </span>
                    ) : (
                      <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-all ${activeTab === item.id ? 'opacity-0' : ''}`} />
                    )}
                  </button>
                ))}
             </nav>

             <div className="mt-4 pt-6 border-t border-gray-50">
                 <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Your Role</p>
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-primary">
                         <Shield size={16} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm capitalize">{userRole.replace('_', ' ')}</p>
                         <p className="text-xs text-gray-500">Access Level</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col min-w-0 min-h-0 bg-transparent ${isMobileMenuOpen ? 'hidden md:flex' : 'flex'}`}>
          {/* Mobile Back Button */}
          <div className="md:hidden p-4 border-b border-gray-100 bg-white flex items-center gap-3 sticky top-0 z-10">
             <button onClick={() => setIsMobileMenuOpen(true)} className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
                <ArrowLeft size={18} />
             </button>
             <h4 className="font-semibold text-base text-gray-900 capitalize">{activeTab}</h4>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar pb-40">
              {activeTab === 'profile' && (
                <div className="max-w-xl space-y-6">
                   <header>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Circle Identity</h3>
                      <p className="text-gray-500 font-medium text-sm">Visual presence and manifesto</p>
                   </header>

                   <section className="space-y-10">
                      {/* Cover Photo */}
                      <div className="space-y-3">
                         <label className="text-sm font-semibold text-gray-700 ml-1">Cover Image</label>
                         <div className="relative group rounded-2xl overflow-hidden h-48 bg-gray-100 border border-gray-200">
                            <img src={getMediaUrl(coverPreview)} className="w-full h-full object-cover" alt="" />
                            {isAdmin && (
                               <button 
                                onClick={() => coverInputRef.current?.click()}
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white gap-2 font-semibold text-sm"
                               >
                                  <Camera size={20} /> Change Cover
                               </button>
                            )}
                            <input ref={coverInputRef} type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'cover')} />
                         </div>
                      </div>

                      <div className="flex flex-col md:flex-row gap-6">
                         {/* Icon/PFP */}
                         <div className="space-y-3 shrink-0">
                            <label className="text-sm font-semibold text-gray-700 ml-1">Circle Icon</label>
                            <div className="relative group w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
                               <img src={getAvatarUrl(iconPreview)} className="w-full h-full object-cover" alt="" />
                               {isAdmin && (
                                  <button 
                                    onClick={() => iconInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white"
                                  >
                                     <Camera size={20} />
                                  </button>
                               )}
                               <input ref={iconInputRef} type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'icon')} />
                            </div>
                         </div>

                          {/* Name */}
                          <div className="flex-1 space-y-3">
                             <label className="text-sm font-semibold text-gray-700 ml-1">Circle Name</label>
                             <input 
                               type="text" 
                               value={name}
                               onChange={e => setName(e.target.value)}
                               disabled={!isAdmin}
                               className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-semibold text-gray-900 text-sm focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
                             />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label className="text-sm font-semibold text-gray-700 ml-1">Description</label>
                          <textarea 
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            disabled={!isAdmin}
                            rows={4}
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-700 text-sm leading-relaxed focus:ring-2 focus:ring-primary/20 transition-all resize-none disabled:opacity-60"
                          />
                       </div>
                   </section>

                     {isAdmin && (
                       <button 
                         onClick={handleSaveSettings}
                         disabled={saving}
                         className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
                       >
                          {saving ? <Spinner size="small" color="text-primary" /> : <>Save Changes</>}
                       </button>
                    )}
                </div>
             )}

              {activeTab === 'access' && isAdmin && (
                <div className="max-w-xl space-y-6">
                   <header>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Access Control</h3>
                      <p className="text-gray-500 font-medium text-sm">Entry protocols and contribution rights</p>
                   </header>
 
                    <div className="space-y-4">
                       <ToggleCard title="Public Discovery" active={isPublic} onToggle={() => setIsPublic(!isPublic)} icon={Globe} desc="Make this circle visible in search results." />
                       <ToggleCard title="Vetting Protocol" active={requiresApproval} onToggle={() => setRequiresApproval(!requiresApproval)} icon={Shield} desc="Manual approval for new members." />
                       <ToggleCard title="Open Contribution" active={allowPosts} onToggle={() => setAllowPosts(!allowPosts)} icon={PenSquare} desc="Allow all members to create posts." />
                       <ToggleCard title="Moderated Posts" active={requirePostApproval} onToggle={() => setRequirePostApproval(!requirePostApproval)} icon={ShieldAlert} desc="Approve posts before they go live." />
                    </div>
 
                    <button 
                     onClick={handleSaveSettings}
                     disabled={saving}
                     className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98]"
                   >
                      {saving ? <Spinner size="small" color="text-primary" /> : <>Save Settings</>}
                   </button>
                </div>
             )}

             {activeTab === 'members' && (
                <div className="space-y-6">
                   <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">Squad Members</h3>
                        <p className="text-gray-500 font-medium text-sm">Direct member management and hierarchy</p>
                      </div>
                   </header>

                   {loading ? (
                      <div className="py-24 flex justify-center"><Spinner size="medium" color="text-primary" /></div>
                   ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {members.map(member => (
                            <div key={member.user_id} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                               <div className="flex items-center gap-4">
                                  <img 
                                    src={getAvatarUrl(member.avatar, member.username)} 
                                    className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-50 shadow-sm" 
                                    alt="" 
                                  />
                                  <div>
                                     <p className="font-bold text-gray-900 text-sm leading-tight">{member.name || member.username} {member.muted ? '🔇' : ''} {member.banned ? '🚫' : ''}</p>
                                     <p className="text-xs font-semibold text-primary capitalize mt-0.5">{member.role}</p>
                                  </div>
                               </div>

                               {isAdmin && member.role !== 'owner' && (
                                  <div className="flex items-center gap-2">
                                     {isOwner && (
                                        <button 
                                          onClick={() => handleMemberAction(member.user_id, (member.role === 'admin' || member.role === 'moderator') ? 'demote' : 'promote')}
                                          className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:text-primary transition-all flex items-center justify-center border border-gray-100"
                                        >
                                           <Shield size={18} />
                                        </button>
                                     )}
                                     <button 
                                       onClick={() => handleMemberAction(member.user_id, 'mute', !member.muted)}
                                       className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border border-gray-100 ${member.muted ? 'bg-orange-50 text-orange-500' : 'bg-gray-50 text-gray-400 hover:text-orange-500'}`}
                                     >
                                        <VolumeX size={18} />
                                     </button>
                                     <button 
                                       onClick={() => handleMemberAction(member.user_id, 'ban', !member.banned)}
                                       className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border border-gray-100 ${member.banned ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400 hover:text-red-500'}`}
                                     >
                                        <Ban size={18} />
                                     </button>
                                     <button 
                                       onClick={() => handleMemberAction(member.user_id, 'remove')}
                                       className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:text-red-500 transition-all flex items-center justify-center border border-gray-100"
                                     >
                                        <Trash2 size={18} />
                                     </button>
                                  </div>
                               )}
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             )}

             {activeTab === 'requests' && (
                <div className="space-y-6">
                   <h3 className="text-xl font-bold text-gray-900 mb-4">Admission Gate</h3>
                   {requests.length === 0 ? (
                      <div className="py-16 bg-white rounded-2xl border border-gray-100 flex flex-col items-center gap-3">
                         <UserCheck size={32} className="text-gray-300" />
                         <p className="text-sm font-medium text-gray-500">No pending requests</p>
                      </div>
                   ) : (
                      <div className="space-y-4">
                         {requests.map(req => (
                            <div key={req.id} className="bg-white p-5 rounded-xl border border-gray-100 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
                               <div className="flex items-center gap-4">
                                  <img src={getAvatarUrl(req.avatar, req.username)} className="w-12 h-12 rounded-full object-cover" alt="" />
                                  <p className="text-base font-bold text-gray-900">{req.name || req.username}</p>
                               </div>
                               <div className="flex items-center gap-2">
                                  <button onClick={() => handleRequestAction(req.id, 'approve')} className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold text-sm transition-all">Approve</button>
                                  <button onClick={() => handleRequestAction(req.id, 'reject')} className="h-9 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-semibold text-sm transition-all">Reject</button>
                               </div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             )}

             {activeTab === 'moderation' && (
                <div className="space-y-6">
                   <h3 className="text-xl font-bold text-gray-900 mb-4">Mod Queue</h3>
                   {pendingPosts.length === 0 ? (
                      <div className="py-16 bg-white rounded-2xl border border-gray-100 flex flex-col items-center gap-3">
                         <MessageSquare size={32} className="text-gray-300" />
                         <p className="text-sm font-medium text-gray-500">Queue is empty</p>
                      </div>
                   ) : (
                      <div className="space-y-4">
                         {pendingPosts.map(post => (
                            <div key={post.post_id} className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-sm">
                               <div className="flex items-center gap-3">
                                  <img src={getAvatarUrl(post.avatar_url, post.username)} className="w-10 h-10 rounded-full object-cover" alt="" />
                                  <div>
                                     <p className="font-bold text-gray-900 text-sm leading-tight">{post.name || post.username}</p>
                                     <p className="text-xs text-gray-500 font-medium mt-0.5">{new Date(post.created_at).toLocaleString()}</p>
                                  </div>
                               </div>
                               <p className="text-gray-800 font-medium text-sm">{post.content}</p>
                               <div className="flex gap-2">
                                  <button onClick={() => handlePostAction(post.post_id, 'approve')} className="flex-1 h-9 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition-all">Approve</button>
                                  <button onClick={() => handlePostAction(post.post_id, 'reject')} className="flex-1 h-9 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-semibold text-sm transition-all">Reject</button>
                               </div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             )}

             {activeTab === 'danger' && (
                <div className="max-w-xl space-y-6">
                   <header>
                      <h3 className="text-xl font-bold text-red-600 mb-1">Danger Zone</h3>
                      <p className="text-sm text-gray-500 font-medium">Irreversible circle actions</p>
                   </header>

                   <div className="space-y-4">
                      <div className="p-6 bg-white rounded-xl border border-red-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                         <div>
                            <p className="text-lg font-bold text-red-600 mb-1">Leave Circle</p>
                            <p className="text-sm text-gray-500 font-medium">You will lose access to member-only content.</p>
                         </div>
                         <button onClick={handleLeaveCircle} className="w-full md:w-auto h-11 px-6 bg-red-50 text-red-600 rounded-lg font-semibold text-sm hover:bg-red-600 hover:text-white transition-all">Leave Circle</button>
                      </div>
                   </div>
                </div>
             )}
          </div>
        </main>

        <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </motion.div>
    </div>
  );
}

function ToggleCard({ title, desc, icon: Icon, active, onToggle }: any) {
  return (
    <div className="group p-4 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
       <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
             <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${active ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'}`}>
                <Icon size={20} strokeWidth={2.5} />
             </div>
             <div>
                <p className="text-sm font-bold text-gray-900">{title}</p>
                <p className="text-xs font-medium text-gray-500 mt-0.5 max-w-[180px] sm:max-w-xs">{desc}</p>
             </div>
          </div>
          <button 
            onClick={onToggle}
            className={`flex-shrink-0 w-11 h-6 rounded-full transition-all relative ${active ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${active ? 'left-6' : 'left-1'}`} />
          </button>
       </div>
    </div>
  );
}
