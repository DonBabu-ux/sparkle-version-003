import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import { Users, Globe, Layers, MessageSquare, Lock, ArrowLeft, Shield, Sparkles, Orbit, ChevronRight } from 'lucide-react';
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
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 gap-8">
        <Orbit size={64} className="text-primary animate-spin-slow" strokeWidth={4} />
        <p className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic animate-pulse">Synchronizing Collective Hub...</p>
      </div>
    </div>
  );

  if (!group) return null;

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />
      
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-7xl mx-auto w-full pt-16 md:pt-12">
        <button 
          onClick={() => navigate('/groups')}
          className="mb-12 w-16 h-16 rounded-[24px] bg-white border border-white shadow-2xl flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all group"
        >
          <ArrowLeft size={28} strokeWidth={4} className="group-hover:-translate-x-1.5 transition-transform" />
        </button>

        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-16 mb-24 animate-fade-in px-4">
          <div className="max-w-4xl space-y-8">
            <div className="inline-flex items-center gap-4 px-6 py-2.5 rounded-full bg-white/80 border border-white backdrop-blur-3xl shadow-xl shadow-primary/5">
              <Users size={18} strokeWidth={3} className="text-primary" />
              <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">Collective Satellite</span>
            </div>
            <h1 className="text-6xl md:text-9xl font-black text-black tracking-tighter leading-none italic uppercase underline decoration-primary decoration-8 underline-offset-[16px]">
              {group.name} <span className="text-primary italic">Consensus.</span>
            </h1>
            <p className="text-xl font-bold text-black opacity-60 leading-relaxed italic max-w-2xl border-l-8 border-primary/20 pl-8">
               {group.description || 'A synchronized space for deep collaboration and shared village harmonics.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 w-full lg:w-auto">
            <button 
              onClick={handleJoinLeave}
              className={`flex-1 sm:flex-none h-20 px-12 rounded-[32px] font-black text-sm uppercase tracking-[0.3em] italic transition-all duration-500 shadow-2xl ${isMember ? 'bg-black text-white hover:bg-black/80' : pendingJoin ? 'bg-black/10 text-black/20 cursor-default shadow-none border border-black/5' : 'bg-primary text-white shadow-primary/30 hover:scale-[1.03] active:scale-95'}`}
            >
              {isMember ? 'Linked Hub' : pendingJoin ? 'Syncing...' : 'Link Node'}
            </button>
            {isOwner && (
               <button onClick={() => navigate(`/groups/${id}/settings`)} className="flex-1 sm:flex-none h-20 px-10 bg-white border-2 border-dashed border-black/10 text-black/40 rounded-[32px] font-black text-sm uppercase tracking-[0.3em] italic hover:border-primary hover:text-primary transition-all active:scale-95 flex items-center justify-center gap-4">
                  <Shield size={20} strokeWidth={4} /> Vector Control
               </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 animate-fade-in relative z-10 pb-64 px-4">
           {/* Stats Sidebar */}
           <aside className="lg:col-span-4 space-y-12">
              <div className="grid grid-cols-2 gap-8">
                 <div className="p-10 bg-white/80 backdrop-blur-3xl border border-white/65 rounded-[56px] flex flex-col items-center justify-center text-center shadow-2xl shadow-primary/5 group hover:scale-[1.05] transition-transform">
                    <span className="text-5xl font-black text-black tracking-tighter leading-none mb-3 group-hover:text-primary transition-colors">{group.member_count || 0}</span>
                    <span className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] italic mb-2">Syncs</span>
                    <Users size={16} strokeWidth={3} className="text-primary/20" />
                 </div>
                 <div className="p-10 bg-white/80 backdrop-blur-3xl border border-white/65 rounded-[56px] flex flex-col items-center justify-center text-center shadow-2xl shadow-primary/5 group hover:scale-[1.05] transition-transform">
                    <span className="text-5xl font-black text-black tracking-tighter leading-none mb-3 group-hover:text-primary transition-colors">{posts.length}</span>
                    <span className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] italic mb-2">Sparks</span>
                    <Sparkles size={16} strokeWidth={3} className="text-primary/20" />
                 </div>
              </div>

              <div className="p-12 bg-white/80 backdrop-blur-3xl border border-white/65 rounded-[56px] shadow-2xl shadow-primary/5 space-y-10 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] pointer-events-none"></div>
                 <h3 className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] italic">Telemetry</h3>
                 <div className="space-y-6">
                    <div className="flex items-center gap-5 group/item">
                        <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-black/10 group-hover/item:bg-primary group-hover/item:text-white transition-all shadow-inner border border-black/5">
                           <Globe size={20} strokeWidth={3} />
                        </div>
                        <span className="text-sm font-black text-black italic uppercase tracking-widest">{group.campus} SECTOR</span>
                    </div>
                    <div className="flex items-center gap-5 group/item">
                        <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-black/10 group-hover/item:bg-primary group-hover/item:text-white transition-all shadow-inner border border-black/5">
                           <Layers size={20} strokeWidth={3} />
                        </div>
                        <span className="text-sm font-black text-black italic uppercase tracking-widest">{group.category || 'GENERAL SPECTRUM'}</span>
                    </div>
                 </div>
              </div>
           </aside>

           {/* Main Feed area */}
           <div className="lg:col-span-8 flex flex-col gap-12 pt-8">
              {isMember ? (
                <>
                  <div className="p-12 bg-white/40 border-4 border-dashed border-white rounded-[56px] flex flex-col sm:flex-row items-center justify-between gap-8 shadow-inner animate-fade-in group hover:bg-white/60 transition-all">
                      <div className="flex items-center gap-6">
                         <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center text-black opacity-10 group-hover:rotate-12 transition-transform">
                            <MessageSquare size={24} strokeWidth={3} />
                         </div>
                         <p className="text-lg font-black text-black opacity-20 italic uppercase tracking-widest leading-none">Initiate Signal...</p>
                      </div>
                      <button className="w-full sm:w-auto h-16 px-10 bg-primary text-white rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] italic hover:scale-105 transition-all shadow-2xl shadow-primary/20 flex items-center justify-center gap-4">
                        Send Spark <ChevronRight size={18} strokeWidth={4} />
                      </button>
                  </div>
                  
                  <div className="flex flex-col gap-12">
                    {posts.length > 0 ? posts.map(post => (
                      <PostCard key={post.post_id} post={post} />
                    )) : (
                      <div className="py-64 text-center bg-white/40 backdrop-blur-3xl border-4 border-dashed border-white rounded-[80px] flex flex-col items-center gap-10 shadow-2xl shadow-primary/5 animate-fade-in group">
                         <div className="w-24 h-24 bg-black/5 rounded-[32px] flex items-center justify-center text-black opacity-10 group-hover:scale-125 transition-transform duration-1000">
                            <MessageSquare size={48} strokeWidth={2} />
                         </div>
                         <div className="space-y-6">
                            <h3 className="text-5xl font-black text-black opacity-5 italic uppercase tracking-tighter leading-none">Silent Frequency.</h3>
                            <p className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] max-w-xs mx-auto italic">No active sparks in this collective. Be the first to harmonize the stream.</p>
                         </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-48 flex flex-col items-center justify-center text-center gap-12 bg-black rounded-[80px] shadow-2xl relative overflow-hidden group">
                    {/* Background Noise */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="absolute inset-0 bg-primary/20 blur-[150px] animate-pulse"></div>
                    
                    <div className="w-40 h-40 bg-white/5 rounded-[48px] flex items-center justify-center text-white opacity-20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-1000 relative z-10">
                       <Lock size={100} strokeWidth={1} />
                    </div>
                    
                    <div className="space-y-6 relative z-10 px-8">
                      <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight italic uppercase leading-none mb-6">Restricted <span className="text-primary italic">Sector.</span></h2>
                      <p className="text-white opacity-40 text-xl font-bold italic max-w-md mx-auto leading-relaxed">Join the collective consensus to decrypt and participate in this private broadcast.</p>
                      <button onClick={handleJoinLeave} className="mt-8 h-24 px-16 bg-primary text-white rounded-[32px] font-black text-sm uppercase tracking-[0.4em] italic shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all">Command Link</button>
                    </div>
                </div>
              )}
           </div>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
