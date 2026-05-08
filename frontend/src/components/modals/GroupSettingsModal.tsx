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

interface GroupSettingsModalProps {
  groupId: string;
  groupData: any;
  userRole: string; // 'owner', 'admin', 'moderator', 'member'
  onClose: () => void;
  onUpdate: () => void;
}

export default function GroupSettingsModal({ groupId, groupData, userRole, onClose, onUpdate }: GroupSettingsModalProps) {
  const isAdmin = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator';
  const isOwner = userRole === 'owner';

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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xl p-0 sm:p-4" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#fdf2f4] w-full h-full sm:h-[90vh] sm:max-w-6xl sm:rounded-[48px] shadow-2xl overflow-hidden flex flex-col md:flex-row"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Sidebar Navigation */}
        <aside className={`
          flex-shrink-0 bg-white border-r border-gray-100 flex flex-col transition-all duration-300
          ${isMobileMenuOpen ? 'w-full md:w-80' : 'hidden md:flex md:w-80'}
        `}>
          <div className="p-8 md:p-10 h-full flex flex-col">
             <div className="flex items-center justify-between mb-12">
                <div>
                   <h2 className="text-3xl font-black text-gray-900 italic tracking-tight uppercase leading-none">Circle</h2>
                   <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-2">Management Hub</p>
                </div>
                <button onClick={onClose} className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
                   <X size={24} />
                </button>
             </div>

             <nav className="space-y-2">
                {visibleMenuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-5 p-5 rounded-[24px] font-black text-sm transition-all group
                      ${activeTab === item.id 
                        ? 'bg-primary text-white shadow-2xl shadow-primary/30 scale-[1.02]' 
                        : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'}
                    `}
                  >
                    <item.icon size={22} strokeWidth={2.5} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.count ? (
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black ${activeTab === item.id ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
                        {item.count}
                      </span>
                    ) : (
                      <ChevronRight size={16} className={`opacity-0 group-hover:opacity-100 transition-all ${activeTab === item.id ? 'opacity-0' : ''}`} />
                    )}
                  </button>
                ))}
             </nav>

             <div className="mt-auto pt-10">
                <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Your Authority</p>
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary">
                         <Shield size={20} />
                      </div>
                      <div>
                         <p className="font-black text-gray-900 text-sm italic tracking-tight">{userRole.toUpperCase()}</p>
                         <p className="text-[10px] font-bold text-gray-400 uppercase">System Clearance</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col min-w-0 bg-transparent ${isMobileMenuOpen ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto p-8 md:p-12 lg:p-16 no-scrollbar">
             {activeTab === 'profile' && (
                <div className="max-w-3xl space-y-12">
                   <header>
                      <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter mb-4">Circle Identity</h3>
                      <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Visual presence and manifesto</p>
                   </header>

                   <section className="space-y-10">
                      {/* Cover Photo */}
                      <div className="space-y-4">
                         <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Cover Aesthetic</label>
                         <div className="relative group rounded-[32px] overflow-hidden h-48 bg-gray-200 border-4 border-white shadow-xl">
                            <img src={getMediaUrl(coverPreview)} className="w-full h-full object-cover" alt="" />
                            {isAdmin && (
                               <button 
                                onClick={() => coverInputRef.current?.click()}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white gap-3 font-black text-sm uppercase tracking-widest"
                               >
                                  <Camera size={24} /> Change Cover
                               </button>
                            )}
                            <input ref={coverInputRef} type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'cover')} />
                         </div>
                      </div>

                      <div className="flex flex-col md:flex-row gap-10">
                         {/* Icon/PFP */}
                         <div className="space-y-4 shrink-0">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Icon Seal</label>
                            <div className="relative group w-32 h-32 rounded-[40px] overflow-hidden bg-gray-100 border-4 border-white shadow-xl">
                               <img src={getAvatarUrl(iconPreview)} className="w-full h-full object-cover" alt="" />
                               {isAdmin && (
                                  <button 
                                    onClick={() => iconInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white"
                                  >
                                     <Camera size={24} />
                                  </button>
                               )}
                               <input ref={iconInputRef} type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'icon')} />
                            </div>
                         </div>

                         {/* Name */}
                         <div className="flex-1 space-y-4">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Frequency Name</label>
                            <input 
                              type="text" 
                              value={name}
                              onChange={e => setName(e.target.value)}
                              disabled={!isAdmin}
                              className="w-full bg-white border-none rounded-[28px] px-8 py-6 font-black text-gray-900 text-xl shadow-xl shadow-gray-200/50 focus:ring-8 focus:ring-primary/5 transition-all disabled:opacity-60"
                            />
                         </div>
                      </div>

                      <div className="space-y-4">
                         <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Mission / Manifesto</label>
                         <textarea 
                           value={description}
                           onChange={e => setDescription(e.target.value)}
                           disabled={!isAdmin}
                           rows={5}
                           className="w-full bg-white border-none rounded-[32px] px-8 py-7 font-bold text-gray-700 leading-relaxed shadow-xl shadow-gray-200/50 focus:ring-8 focus:ring-primary/5 transition-all resize-none disabled:opacity-60"
                         />
                      </div>
                   </section>

                   {isAdmin && (
                      <button 
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="w-full py-8 bg-gray-900 hover:bg-black text-white rounded-[32px] font-black text-lg uppercase tracking-widest transition-all shadow-2xl shadow-gray-300 flex items-center justify-center gap-4 active:scale-95"
                      >
                         {saving ? <Loader2 className="animate-spin" size={24} /> : <>Update Circle Profile <Check size={24} strokeWidth={3} /></>}
                      </button>
                   )}
                </div>
             )}

             {activeTab === 'access' && isAdmin && (
                <div className="max-w-2xl space-y-12">
                   <header>
                      <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter mb-4">Access Control</h3>
                      <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Entry protocols and contribution rights</p>
                   </header>

                   <div className="space-y-6">
                      <ToggleCard title="Public Discovery" active={isPublic} onToggle={() => setIsPublic(!isPublic)} icon={Globe} desc="Make this circle visible in search results." />
                      <ToggleCard title="Vetting Protocol" active={requiresApproval} onToggle={() => setRequiresApproval(!requiresApproval)} icon={Shield} desc="Manual approval for new members." />
                      <ToggleCard title="Open Contribution" active={allowPosts} onToggle={() => setAllowPosts(!allowPosts)} icon={PenSquare} desc="Allow all members to create posts." />
                      <ToggleCard title="Moderated Posts" active={requirePostApproval} onToggle={() => setRequirePostApproval(!requirePostApproval)} icon={ShieldAlert} desc="Approve posts before they go live." />
                   </div>

                   <button 
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full py-8 bg-gray-900 hover:bg-black text-white rounded-[32px] font-black text-lg uppercase tracking-widest transition-all shadow-2xl shadow-gray-300 flex items-center justify-center gap-4 active:scale-95"
                  >
                     {saving ? <Loader2 className="animate-spin" size={24} /> : <>Sync Security Rules <Check size={24} strokeWidth={3} /></>}
                  </button>
                </div>
             )}

             {activeTab === 'members' && (
                <div className="space-y-10">
                   <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter mb-2">Squad Members</h3>
                        <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Direct member management and hierarchy</p>
                      </div>
                   </header>

                   {loading ? (
                      <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>
                   ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {members.map(member => (
                            <div key={member.user_id} className="bg-white p-6 rounded-[32px] shadow-xl shadow-gray-200/40 border border-gray-50 flex items-center justify-between group hover:shadow-2xl transition-all">
                               <div className="flex items-center gap-5">
                                  <img 
                                    src={getAvatarUrl(member.avatar, member.username)} 
                                    className="w-16 h-16 rounded-[24px] object-cover ring-4 ring-gray-50 shadow-sm" 
                                    alt="" 
                                  />
                                  <div>
                                     <p className="font-black text-gray-900 italic tracking-tight">{member.name || member.username} {member.muted ? '🔇' : ''} {member.banned ? '🚫' : ''}</p>
                                     <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1 italic">{member.role}</p>
                                  </div>
                               </div>

                               {isAdmin && member.role !== 'owner' && (
                                  <div className="flex items-center gap-2">
                                     {isOwner && (
                                        <button 
                                          onClick={() => handleMemberAction(member.user_id, member.role === 'admin' ? 'demote' : 'promote')}
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
                <div className="space-y-10">
                   <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter">Admission Gate</h3>
                   {requests.length === 0 ? (
                      <div className="py-24 bg-white rounded-[48px] border-2 border-dashed border-gray-100 flex flex-col items-center gap-6">
                         <UserCheck size={40} className="text-gray-300" />
                         <p className="text-sm font-bold text-gray-400 uppercase tracking-widest italic">No pending applications</p>
                      </div>
                   ) : (
                      <div className="space-y-6">
                         {requests.map(req => (
                            <div key={req.id} className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 flex items-center justify-between gap-8 hover:shadow-2xl transition-all">
                               <div className="flex items-center gap-6">
                                  <img src={getAvatarUrl(req.avatar, req.username)} className="w-20 h-20 rounded-[32px] object-cover shadow-lg" alt="" />
                                  <p className="text-2xl font-black text-gray-900 italic tracking-tight">{req.name || req.username}</p>
                               </div>
                               <div className="flex items-center gap-3">
                                  <button onClick={() => handleRequestAction(req.id, 'approve')} className="h-14 px-8 bg-primary text-white rounded-[20px] font-black text-sm uppercase tracking-widest">Admit</button>
                                  <button onClick={() => handleRequestAction(req.id, 'reject')} className="h-14 px-8 bg-gray-100 text-gray-500 rounded-[20px] font-black text-sm uppercase tracking-widest">Deny</button>
                               </div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             )}

             {activeTab === 'moderation' && (
                <div className="space-y-10">
                   <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter">Mod Queue</h3>
                   {pendingPosts.length === 0 ? (
                      <div className="py-24 bg-white rounded-[48px] border-2 border-dashed border-gray-100 flex flex-col items-center gap-6">
                         <MessageSquare size={40} className="text-gray-300" />
                         <p className="text-sm font-bold text-gray-400 uppercase tracking-widest italic">Queue is empty</p>
                      </div>
                   ) : (
                      <div className="space-y-6">
                         {pendingPosts.map(post => (
                            <div key={post.post_id} className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 space-y-6">
                               <div className="flex items-center gap-4">
                                  <img src={getAvatarUrl(post.avatar_url, post.username)} className="w-12 h-12 rounded-2xl object-cover" alt="" />
                                  <div>
                                     <p className="font-black text-gray-900">{post.name || post.username}</p>
                                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(post.created_at).toLocaleString()}</p>
                                  </div>
                               </div>
                               <p className="text-gray-700 font-bold leading-relaxed">{post.content}</p>
                               <div className="flex gap-3">
                                  <button onClick={() => handlePostAction(post.post_id, 'approve')} className="flex-1 h-14 bg-green-500 text-white rounded-[20px] font-black text-sm uppercase tracking-widest">Approve</button>
                                  <button onClick={() => handlePostAction(post.post_id, 'reject')} className="flex-1 h-14 bg-red-50 text-red-500 rounded-[20px] font-black text-sm uppercase tracking-widest">Reject</button>
                               </div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             )}

             {activeTab === 'danger' && (
                <div className="max-w-2xl space-y-12">
                   <header>
                      <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter mb-4">Danger Zone</h3>
                      <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Irreversible circle actions</p>
                   </header>

                   <div className="space-y-6">
                      <div className="p-10 bg-white rounded-[40px] border border-red-50 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
                         <div>
                            <p className="text-2xl font-black text-red-600 italic tracking-tight mb-2 uppercase">Leave Circle</p>
                            <p className="text-sm font-bold text-gray-400">You will lose access to member-only content.</p>
                         </div>
                         <button onClick={handleLeaveCircle} className="h-16 px-10 bg-red-50 text-red-600 rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">Leave Circle</button>
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
    <div className="group p-8 bg-white rounded-[40px] border border-transparent shadow-xl transition-all hover:shadow-2xl">
       <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-6">
             <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center transition-all ${active ? 'bg-primary text-white' : 'bg-gray-50 text-gray-300'}`}>
                <Icon size={28} strokeWidth={2.5} />
             </div>
             <div>
                <p className="text-2xl font-black text-gray-900 italic tracking-tight mb-1">{title}</p>
                <p className="text-sm font-bold text-gray-400 leading-relaxed max-w-sm">{desc}</p>
             </div>
          </div>
          <button 
            onClick={onToggle}
            className={`flex-shrink-0 w-20 h-11 rounded-full transition-all relative mt-2 ${active ? 'bg-primary' : 'bg-gray-200 shadow-inner'}`}
          >
            <div className={`absolute top-1.5 w-8 h-8 bg-white rounded-full transition-all shadow-lg ${active ? 'left-10' : 'left-2'}`} />
          </button>
       </div>
    </div>
  );
}
