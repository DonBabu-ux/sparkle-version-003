import { useState, useEffect } from 'react';
import { 
  X, Settings, Users, UserCheck, Shield, ChevronRight, Check, Loader2, 
  Trash2, ShieldAlert, ArrowLeft, Globe, Lock, PenSquare, 
  UserMinus, UserPlus, Info, Bell, LogOut
} from 'lucide-react';
import api from '../../api/api';

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

  const [activeTab, setActiveTab] = useState<'profile' | 'access' | 'rules' | 'members' | 'requests' | 'danger'>('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(true); // Start with menu open on mobile

  // Settings State
  const [name, setName] = useState(groupData.name || '');
  const [description, setDescription] = useState(groupData.description || '');
  const [isPublic, setIsPublic] = useState(groupData.is_public === 1);
  const [requiresApproval, setRequiresApproval] = useState(groupData.requires_approval === 1);
  const [allowPosts, setAllowPosts] = useState(groupData.allow_posts === 1);

  // Members & Requests
  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'members') fetchMembers();
    if (activeTab === 'requests') fetchRequests();
    // Auto-close menu on desktop
    if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
  }, [activeTab]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/groups/${groupId}/members`);
      setMembers(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/groups/${groupId}/requests`);
      setRequests(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.post(`/groups/${groupId}/update`, {
        name,
        description,
        is_public: isPublic ? 1 : 0,
        requires_approval: requiresApproval ? 1 : 0,
        allow_posts: allowPosts ? 1 : 0
      });
      onUpdate();
      // Optional: Show toast or feedback
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleMemberAction = async (userId: string, action: 'remove' | 'promote' | 'demote') => {
    const confirmMsg = action === 'remove' ? 'Remove this member from the circle?' : `Change member role to ${action === 'promote' ? 'Admin' : 'Member'}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const endpoint = action === 'remove' 
        ? `/groups/${groupId}/users/${userId}/remove`
        : `/groups/${groupId}/users/${userId}/role`;
      
      const payload = action !== 'remove' ? { role: action === 'promote' ? 'admin' : 'member' } : {};
      
      await api.post(endpoint, payload);
      fetchMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      await api.post(`/groups/requests/${requestId}/${action}`);
      setRequests(prev => prev.filter(r => r.id !== requestId));
      if (action === 'approve') fetchMembers();
    } catch (err) {
      console.error(err);
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

  const menuItems = [
    { id: 'profile', label: 'Circle Profile', icon: Info, adminOnly: false },
    { id: 'access', label: 'Access Control', icon: Shield, adminOnly: true },
    { id: 'rules', label: 'Community Rules', icon: Bell, adminOnly: true },
    { id: 'members', label: 'Members', icon: Users, adminOnly: false },
    { id: 'requests', label: 'Join Requests', icon: UserCheck, adminOnly: true, count: requests.length },
    { id: 'danger', label: 'Danger Zone', icon: ShieldAlert, adminOnly: false },
  ];

  const visibleMenuItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xl" onClick={onClose}>
      <div 
        className="bg-[#fdf2f4] w-full h-full md:w-[95%] md:h-[90vh] md:max-w-6xl md:rounded-[48px] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-500"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Sidebar Navigation */}
        <aside className={`
          flex-shrink-0 bg-white border-r border-gray-100 flex flex-col transition-all duration-300
          ${isMobileMenuOpen ? 'w-full md:w-80' : 'hidden md:flex md:w-80'}
        `}>
          <div className="p-8 md:p-10">
             <div className="flex items-center justify-between mb-12">
                <div>
                   <h2 className="text-3xl font-black text-gray-900 italic tracking-tight uppercase leading-none">Circle</h2>
                   <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-2">Management Hub</p>
                </div>
                <button onClick={onClose} className="md:hidden w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                   <X size={24} />
                </button>
             </div>

             <nav className="space-y-3">
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
          </div>

          <div className="mt-auto p-10 hidden md:block">
             <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Current Status</p>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary">
                      <Shield size={20} />
                   </div>
                   <div>
                      <p className="font-black text-gray-900 text-sm italic">{userRole.toUpperCase()}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Authorized Access</p>
                   </div>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col min-w-0 bg-transparent ${isMobileMenuOpen ? 'hidden md:flex' : 'flex'}`}>
          {/* Mobile Tab Header */}
          <div className="md:hidden flex items-center gap-5 p-8 border-b border-gray-100 bg-white sticky top-0 z-20">
             <button onClick={() => setIsMobileMenuOpen(true)} className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                <ArrowLeft size={24} />
             </button>
             <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tight">
                {menuItems.find(m => m.id === activeTab)?.label}
             </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-8 md:p-16 no-scrollbar">
             {activeTab === 'profile' && (
                <div className="max-w-2xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <header>
                      <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter mb-4">Circle Profile</h3>
                      <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Public identity and appearance</p>
                   </header>

                   <section className="space-y-8">
                      <div className="space-y-3">
                         <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Display Name</label>
                         <div className="relative group">
                            <PenSquare className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors" size={20} />
                            <input 
                              type="text" 
                              value={name}
                              onChange={e => setName(e.target.value)}
                              disabled={!isAdmin}
                              className="w-full bg-white border-2 border-transparent rounded-[28px] px-8 py-6 font-black text-gray-900 text-xl shadow-xl shadow-gray-200/50 focus:outline-none focus:border-primary/20 focus:ring-8 focus:ring-primary/5 transition-all disabled:opacity-60"
                              placeholder="Circle Name"
                            />
                         </div>
                      </div>

                      <div className="space-y-3">
                         <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">About / Manifesto</label>
                         <textarea 
                           value={description}
                           onChange={e => setDescription(e.target.value)}
                           disabled={!isAdmin}
                           rows={6}
                           className="w-full bg-white border-2 border-transparent rounded-[32px] px-8 py-7 font-bold text-gray-700 leading-relaxed shadow-xl shadow-gray-200/50 focus:outline-none focus:border-primary/20 focus:ring-8 focus:ring-primary/5 transition-all resize-none disabled:opacity-60"
                           placeholder="What is this frequency about?"
                         />
                      </div>
                   </section>

                   {isAdmin && (
                      <button 
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="w-full py-8 bg-gray-900 hover:bg-black text-white rounded-[32px] font-black text-lg uppercase tracking-widest transition-all shadow-2xl shadow-gray-300 flex items-center justify-center gap-4 active:scale-95 disabled:bg-gray-200"
                      >
                         {saving ? <Loader2 className="animate-spin" size={24} /> : <>Update Configuration <Check size={24} strokeWidth={3} /></>}
                      </button>
                   )}
                </div>
             )}

             {activeTab === 'access' && isAdmin && (
                <div className="max-w-2xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <header>
                      <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter mb-4">Access Control</h3>
                      <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Visibility and entry regulations</p>
                   </header>

                   <div className="space-y-6">
                      <ToggleCard 
                        title="Public Discovery"
                        desc="Anyone on Sparkle can find this circle in search. If off, it remains hidden."
                        icon={Globe}
                        active={isPublic}
                        onToggle={() => setIsPublic(!isPublic)}
                      />
                      <ToggleCard 
                        title="Manual Approval"
                        desc="New members must be vetted and approved by an administrator before entry."
                        icon={Shield}
                        active={requiresApproval}
                        onToggle={() => setRequiresApproval(!requiresApproval)}
                      />
                      <ToggleCard 
                        title="Open Contribution"
                        desc="Allow any member to share sparks. If off, only admins can broadcast posts."
                        icon={PenSquare}
                        active={allowPosts}
                        onToggle={() => setAllowPosts(!allowPosts)}
                      />
                   </div>

                   <button 
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full py-8 bg-gray-900 hover:bg-black text-white rounded-[32px] font-black text-lg uppercase tracking-widest transition-all shadow-2xl shadow-gray-300 flex items-center justify-center gap-4 active:scale-95"
                  >
                     {saving ? <Loader2 className="animate-spin" size={24} /> : <>Save Access Rules <Check size={24} strokeWidth={3} /></>}
                  </button>
                </div>
             )}

             {activeTab === 'members' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter mb-2">The Squad</h3>
                        <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Manage the core community members</p>
                      </div>
                      <div className="px-6 py-2 bg-primary/10 rounded-full border border-primary/20 self-start">
                         <span className="text-[11px] font-black text-primary uppercase tracking-widest">{members.length} ACTIVE</span>
                      </div>
                   </header>

                   {loading ? (
                      <div className="py-24 flex flex-col items-center gap-6">
                         <Loader2 className="animate-spin text-primary" size={40} />
                         <p className="text-[11px] font-black text-gray-300 uppercase tracking-[0.3em] italic">Synchronizing Member Feed...</p>
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {members.map(member => (
                            <div key={member.user_id} className="bg-white p-6 rounded-[32px] shadow-xl shadow-gray-200/40 border border-gray-50 flex items-center justify-between group transition-all hover:shadow-2xl">
                               <div className="flex items-center gap-5">
                                  <div className="relative">
                                     <img 
                                       src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || member.username)}&background=random&color=fff`} 
                                       className="w-16 h-16 rounded-[22px] object-cover ring-4 ring-gray-50 shadow-sm" 
                                       alt="" 
                                     />
                                     <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white shadow-md ${member.role === 'owner' ? 'bg-yellow-500' : member.role === 'admin' ? 'bg-primary' : 'bg-blue-500'}`}>
                                        <Shield size={12} strokeWidth={3} />
                                     </div>
                                  </div>
                                  <div>
                                     <p className="font-black text-gray-900 italic tracking-tight">{member.name || member.username}</p>
                                     <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">{member.role}</p>
                                  </div>
                               </div>

                               {isAdmin && member.user_id !== groupData.creator_id && member.role !== 'owner' && (
                                  <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                                     {isOwner && (
                                        <button 
                                          onClick={() => handleMemberAction(member.user_id, member.role === 'admin' ? 'demote' : 'promote')}
                                          className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center border border-gray-100"
                                          title={member.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                                        >
                                           {member.role === 'admin' ? <UserMinus size={18} /> : <UserPlus size={18} />}
                                        </button>
                                     )}
                                     <button 
                                       onClick={() => handleMemberAction(member.user_id, 'remove')}
                                       className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center border border-gray-100"
                                       title="Remove Member"
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

             {activeTab === 'requests' && isAdmin && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <header>
                      <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter mb-2">Gatekeeper</h3>
                      <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Verify and admit new circle members</p>
                   </header>

                   {loading ? (
                      <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>
                   ) : requests.length > 0 ? (
                      <div className="space-y-4">
                         {requests.map(req => (
                            <div key={req.id} className="bg-white p-8 rounded-[40px] shadow-xl shadow-gray-200/40 border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-8 hover:shadow-2xl transition-all">
                               <div className="flex items-center gap-6 w-full">
                                  <img 
                                    src={req.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.name || req.username)}&background=random&color=fff`} 
                                    className="w-20 h-20 rounded-[28px] object-cover shadow-lg ring-8 ring-gray-50" 
                                    alt="" 
                                  />
                                  <div>
                                     <p className="text-2xl font-black text-gray-900 italic tracking-tight mb-1">{req.name || req.username}</p>
                                     <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest px-2 py-1 bg-primary/5 rounded-md">Join Request</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requested {new Date(req.created_at).toLocaleDateString()}</span>
                                     </div>
                                  </div>
                               </div>
                               <div className="flex items-center gap-3 w-full md:w-auto">
                                  <button 
                                    onClick={() => handleRequestAction(req.id, 'approve')}
                                    className="flex-1 md:flex-none h-14 px-8 bg-primary text-white rounded-[20px] font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
                                  >
                                     Approve
                                  </button>
                                  <button 
                                    onClick={() => handleRequestAction(req.id, 'reject')}
                                    className="flex-1 md:flex-none h-14 px-8 bg-gray-100 text-gray-500 rounded-[20px] font-black text-sm uppercase tracking-widest hover:bg-gray-200 active:scale-95 transition-all"
                                  >
                                     Decline
                                  </button>
                               </div>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="py-24 bg-white rounded-[48px] border-2 border-dashed border-gray-100 flex flex-col items-center gap-6">
                         <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                            <UserCheck size={40} />
                         </div>
                         <div className="text-center">
                            <p className="text-xl font-black text-gray-900 italic">Gate is Clear</p>
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-2">No pending access requests</p>
                         </div>
                      </div>
                   )}
                </div>
             )}

             {activeTab === 'danger' && (
                <div className="max-w-2xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <header>
                      <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter mb-4">Danger Zone</h3>
                      <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Irreversible circle actions</p>
                   </header>

                   <div className="space-y-6">
                      <div className="p-10 bg-white rounded-[40px] border border-red-50 shadow-xl shadow-red-100/20 group hover:border-red-100 transition-all">
                         <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="text-center md:text-left">
                               <p className="text-2xl font-black text-red-600 italic tracking-tight mb-2">Leave Circle</p>
                               <p className="text-sm font-bold text-gray-400 leading-relaxed">You will lose access to member-only content. You can rejoin later if the circle is public.</p>
                            </div>
                            <button 
                              onClick={handleLeaveCircle}
                              className="w-full md:w-auto h-16 px-10 bg-red-50 text-red-600 rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-red-600 hover:text-white shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-3 active:scale-95"
                            >
                               <LogOut size={20} strokeWidth={3} /> Leave Circle
                            </button>
                         </div>
                      </div>

                      {isOwner && (
                         <div className="p-10 bg-red-600 rounded-[40px] shadow-2xl shadow-red-200 group overflow-hidden relative">
                            <ShieldAlert className="absolute -bottom-10 -right-10 text-white/10" size={240} />
                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-white">
                               <div className="text-center md:text-left">
                                  <p className="text-2xl font-black italic tracking-tight mb-2">Terminate Circle</p>
                                  <p className="text-sm font-bold text-white/60 leading-relaxed">This will permanently delete the circle and all associated sparks. This cannot be undone.</p>
                               </div>
                               <button className="w-full md:w-auto h-16 px-10 bg-white text-red-600 rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center justify-center gap-3 active:scale-95">
                                  Delete Permanently
                               </button>
                            </div>
                         </div>
                      )}
                   </div>
                </div>
             )}
          </div>
        </main>

        <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </div>
    </div>
  );
}

function ToggleCard({ title, desc, icon: Icon, active, onToggle }: any) {
  return (
    <div className="group p-8 bg-white rounded-[40px] border border-transparent shadow-xl shadow-gray-200/40 transition-all hover:shadow-2xl hover:border-gray-100">
       <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-6">
             <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center transition-all ${active ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'bg-gray-50 text-gray-300'}`}>
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
