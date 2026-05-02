import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import { Users, Globe, Layers, MessageSquare, Lock, ArrowLeft, Shield, Sparkles, Compass, ChevronRight, Share2, Info } from 'lucide-react';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';

import type { Post } from '../types/post';
import type { Group } from '../types/group';

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  useUserStore();

  const [group, setGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [pendingJoin, setPendingJoin] = useState(false);

  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        const response = await api.get(`/groups/${id}`);
        if (response.data.success) {
          setGroup(response.data.group);
          setPosts(response.data.initialPosts || []);
          setIsMember(!!response.data.userRole && response.data.memberStatus === 'active');
          setIsOwner(response.data.userRole === 'owner');
          setPendingJoin(response.data.memberStatus === 'pending');
        }
      } catch (err) {
        console.error('Failed to fetch group:', err);
        navigate('/groups');
      } finally {
        setLoading(false);
      }
    };
    fetchGroupData();
  }, [id, navigate]);

  const handleJoinLeave = async () => {
    try {
      if (isMember || pendingJoin) {
        const res = await api.post(`/groups/${id}/leave`);
        if (res.data.success) {
          setIsMember(false);
          setPendingJoin(false);
        }
      } else {
        const res = await api.post(`/groups/${id}/join`);
        if (res.data.success) {
          if (res.data.status === 'pending') setPendingJoin(true);
          else setIsMember(true);
        }
      }
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen font-sans" style={{ background: 'linear-gradient(135deg, #fff0f4 0%, #fff9fa 60%, #fef0f5 100%)' }}>
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 gap-6">
        <div className="w-16 h-16 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(255,61,109,0.2)', borderTopColor: '#FF3D6D' }} />
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Loading Circle...</p>
      </div>
    </div>
  );

  if (!group) return null;

  return (
    <div className="flex min-h-screen font-sans" style={{ background: 'linear-gradient(135deg, #fff0f4 0%, #fff9fa 60%, #fef0f5 100%)' }}>
      <Navbar />
      <div className="fixed top-[-80px] right-[-80px] w-[420px] h-[420px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,61,109,0.18) 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-60px] left-[-60px] w-[360px] h-[360px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,100,150,0.14) 0%, transparent 70%)' }} />

      <main className="flex-1 lg:ml-72 p-6 lg:p-10 relative z-10 max-w-7xl mx-auto w-full pt-20">
        <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button 
            onClick={() => navigate('/groups')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:bg-slate-50 transition-all">
              <ArrowLeft size={18} />
            </div>
            <span className="text-sm">Back to Circles</span>
          </button>

          <button className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm text-slate-500 hover:text-slate-900 transition-all">
            <Share2 size={18} />
          </button>
        </div>

        <header className="mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-4">
                <img 
                  src={group.icon_url || '/uploads/avatars/default.png'}
                  className="w-24 h-24 rounded-3xl object-cover shadow-2xl border-4 border-white"
                  alt=""
                />
                <div>
                   <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-2" style={{ background: 'rgba(255,61,109,0.12)', border: '1px solid rgba(255,61,109,0.25)' }}>
                    <Compass size={14} className="fill-current" style={{ color: '#FF3D6D' }} />
                     <span style={{ fontSize: '10px', fontWeight: 800, color: '#FF3D6D', letterSpacing: '0.12em', textTransform: 'uppercase', fontStyle: 'normal' }}>Social Circle</span>
                  </div>
                   <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 3.2rem)', fontWeight: 900, letterSpacing: '-0.03em', color: '#1a1a2e', fontStyle: 'normal', textTransform: 'none', lineHeight: 1.05 }}>
                     {group.name}
                   </h1>
                </div>
              </div>
              <p className="text-lg text-slate-500 max-w-2xl font-medium leading-relaxed">
                 {group.description || 'A space for members to connect and share updates...'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <button
                onClick={handleJoinLeave}
                style={{ height: '52px', padding: '0 32px', borderRadius: '16px', fontWeight: 800, fontSize: '13px', border: 'none', cursor: 'pointer', fontStyle: 'normal', textTransform: 'none', transition: 'all 0.2s', background: isMember ? 'rgba(255,61,109,0.08)' : pendingJoin ? 'rgba(148,163,184,0.1)' : 'linear-gradient(135deg, #FF3D6D, #e01f55)', color: isMember ? '#FF3D6D' : pendingJoin ? '#94a3b8' : '#fff', boxShadow: (!isMember && !pendingJoin) ? '0 8px 24px rgba(255,61,109,0.3)' : 'none' }}
              >
                {isMember ? 'Member' : pendingJoin ? 'Request Pending' : 'Join Circle'}
              </button>
              {isOwner && (
                 <button onClick={() => navigate(`/groups/${id}/settings`)} className="h-14 px-8 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:border-primary hover:text-primary transition-all active:scale-95 flex items-center justify-center gap-3 shadow-sm">
                    <Shield size={18} /> Manage
                 </button>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 pb-32">
           {/* Sidebar Info */}
           <aside className="lg:col-span-4 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-8 rounded-[28px] flex flex-col items-center justify-center text-center" style={{ background: 'rgba(255,255,255,0.92)', border: '1.5px solid rgba(255,61,109,0.12)', boxShadow: '0 2px 16px rgba(255,61,109,0.05)' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 900, color: '#1a1a2e', lineHeight: 1, fontStyle: 'normal', textTransform: 'none' }}>{group.member_count || 0}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0', fontStyle: 'normal' }}>Members</span>
                    <Users size={16} style={{ color: 'rgba(255,61,109,0.5)' }} />
                 </div>
                 <div className="p-8 rounded-[28px] flex flex-col items-center justify-center text-center" style={{ background: 'rgba(255,255,255,0.92)', border: '1.5px solid rgba(255,61,109,0.12)', boxShadow: '0 2px 16px rgba(255,61,109,0.05)' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 900, color: '#1a1a2e', lineHeight: 1, fontStyle: 'normal', textTransform: 'none' }}>{posts.length}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '6px 0', fontStyle: 'normal' }}>Posts</span>
                    <Sparkles size={16} style={{ color: 'rgba(255,61,109,0.5)' }} />
                 </div>
              </div>

              <div className="p-8 bg-white border border-slate-200/60 rounded-[32px] shadow-sm space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">About Circle</h3>
                    <Info size={14} className="text-slate-300" />
                 </div>
                 <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                           <Globe size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Campus</p>
                          <span className="text-sm font-bold text-slate-900">{group.campus?.toUpperCase()}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                           <Layers size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Category</p>
                          <span className="text-sm font-bold text-slate-900">{group.category?.toUpperCase() || 'GENERAL'}</span>
                        </div>
                    </div>
                 </div>
              </div>
           </aside>

           {/* Content Area */}
           <div className="lg:col-span-8 space-y-8">
              {isMember ? (
                <>
                  <div className="p-8 bg-white border border-slate-200 rounded-[32px] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm group hover:border-primary/20 transition-all">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-primary transition-colors">
                            <MessageSquare size={22} />
                         </div>
                         <p className="text-lg font-bold text-slate-300 italic">Share something with the circle...</p>
                      </div>
                      <button className="w-full sm:w-auto h-12 px-8 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-primary transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2">
                        Post <ChevronRight size={16} />
                      </button>
                  </div>
                  
                  <div className="space-y-8">
                    {posts.length > 0 ? posts.map(post => (
                      <PostCard key={post.post_id} post={post} />
                    )) : (
                      <div className="py-32 text-center bg-white border border-slate-100 rounded-[40px] flex flex-col items-center gap-6 shadow-sm">
                         <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                            <MessageSquare size={32} />
                         </div>
                         <div className="space-y-2">
                            <h3 className="text-xl font-bold text-slate-900">No Posts Yet</h3>
                            <p className="text-sm text-slate-400 max-w-xs mx-auto font-medium">Be the first one to start a conversation in this circle.</p>
                         </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-24 flex flex-col items-center justify-center text-center gap-8 rounded-[40px] relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d18 100%)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(255,61,109,0.18) 0%, transparent 70%)' }} />
                    <div className="w-24 h-24 rounded-3xl flex items-center justify-center relative z-10" style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,61,109,0.2)' }}>
                       <Lock size={44} style={{ color: 'rgba(255,61,109,0.5)' }} />
                    </div>
                    <div className="relative z-10 px-8 space-y-4">
                      <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, fontStyle: 'normal', textTransform: 'none' }}>Private Circle</h2>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', maxWidth: '280px', margin: '0 auto', lineHeight: 1.7, fontStyle: 'normal', textTransform: 'none' }}>Join this community to see its content and participate in the discussion.</p>
                      <button onClick={handleJoinLeave} style={{ marginTop: '16px', height: '56px', padding: '0 40px', background: 'linear-gradient(135deg, #FF3D6D, #e01f55)', color: '#fff', borderRadius: '18px', fontWeight: 800, fontSize: '14px', border: 'none', cursor: 'pointer', boxShadow: '0 12px 32px rgba(255,61,109,0.4)', fontStyle: 'normal', textTransform: 'none' }}>{pendingJoin ? 'Request Pending' : 'Request Access'}</button>
                    </div>
                </div>
              )}
           </div>
        </div>
      </main>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom { from { transform: translateY(20px); } to { transform: translateY(0); } }
        .animate-in { animation-duration: 500ms; animation-fill-mode: both; }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-bottom-4 { animation-name: slide-in-from-bottom; }
        .slide-in-from-bottom-6 { animation-name: slide-in-from-bottom; }
        .slide-in-from-bottom-8 { animation-name: slide-in-from-bottom; }
        .delay-200 { animation-delay: 200ms; }
      `}</style>
    </div>
  );
}
