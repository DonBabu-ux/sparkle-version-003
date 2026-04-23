import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, MapPin, Settings, MessageSquare, ChevronRight, Orbit, Sparkles } from 'lucide-react';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import type { Post } from '../types/post';
import { useCallback } from 'react';

interface ClubMember {
  user_id: string;
  username: string;
  avatar_url?: string;
  role?: string;
}

interface Club {
  club_id: string;
  name: string;
  description: string;
  category: string;
  campus: string;
  member_count: number;
  logo_url?: string;
  banner_url?: string;
  is_member?: boolean;
  is_admin?: boolean;
  creator_id?: string;
}

export default function ClubDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [club, setClub] = useState<Club | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'members'>('posts');
  const [joining, setJoining] = useState(false);

  const fetchClub = useCallback(async () => {
    setLoading(true);
    try {
      const [clubRes, postsRes, membersRes] = await Promise.all([
        api.get(`/clubs/${id}`),
        api.get(`/clubs/${id}/posts`),
        api.get(`/clubs/${id}/members`),
      ]);
      setClub(clubRes.data.club || clubRes.data);
      setPosts(postsRes.data.posts || postsRes.data || []);
      setMembers(membersRes.data.members || membersRes.data || []);
    } catch (err) {
      console.error('Club detail error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchClub(); }, [id, fetchClub]);

  const handleJoin = async () => {
    if (!club) return;
    setJoining(true);
    try {
      if (club.is_member) {
        await api.delete(`/clubs/${id}/leave`);
        setClub(prev => prev ? { ...prev, is_member: false, member_count: prev.member_count - 1 } : prev);
      } else {
        await api.post(`/clubs/${id}/join`);
        setClub(prev => prev ? { ...prev, is_member: true, member_count: prev.member_count + 1 } : prev);
      }
    } catch (err) {
      console.error('Join/leave error:', err);
    } finally {
      setJoining(false);
    }
  };

  if (loading) return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 gap-8">
        <Orbit size={64} className="text-primary animate-spin-slow" strokeWidth={4} />
        <p className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic animate-pulse">Syncing Circle Node...</p>
      </div>
    </div>
  );

  if (!club) return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 text-center px-6 gap-10">
        <div className="w-24 h-24 bg-black/5 rounded-[32px] flex items-center justify-center border-4 border-dashed border-black/10">
           <Users size={40} className="text-black opacity-10" />
        </div>
        <div className="space-y-4">
           <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Node <span className="text-primary">Isolated.</span></h2>
           <p className="text-base font-bold text-black opacity-30 italic">This circle harmonic is no longer broadcasting.</p>
        </div>
        <button onClick={() => navigate('/clubs')} className="px-12 h-18 bg-primary text-white rounded-[24px] font-black uppercase tracking-widest italic hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-primary/30">Browser Sectors</button>
      </div>
    </div>
  );

  const isAdmin = club.is_admin || club.creator_id === (user?.id || user?.user_id);

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />
      
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-7xl mx-auto w-full pt-16 md:pt-12">
        <button 
          onClick={() => navigate('/clubs')}
          className="mb-12 w-16 h-16 rounded-[24px] bg-white border border-white shadow-2xl flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all group"
        >
          <ArrowLeft size={28} strokeWidth={4} className="group-hover:-translate-x-1.5 transition-transform" />
        </button>

        <div className="animate-fade-in space-y-16">
          {/* Hero Section */}
          <div className="relative group">
            <div 
              className="h-[350px] md:h-[500px] rounded-[56px] bg-cover bg-center border-[6px] border-white shadow-2xl relative overflow-hidden"
              style={{ backgroundImage: `url(${club.banner_url || 'https://images.unsplash.com/photo-1541339907198-e08756ebafe3?w=1200'})` }}
            >
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm group-hover:backdrop-blur-none transition-all duration-1000"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            </div>
            
            <div className="absolute -bottom-16 left-12 flex items-end gap-10">
              <div className="p-1 rounded-[40px] bg-white shadow-2xl relative z-20 border-[4px] border-white/50 overflow-hidden group-hover:scale-110 transition-transform duration-700">
                <img 
                  src={club.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(club.name)}&background=black&color=fff`} 
                  className="w-32 h-32 md:w-56 md:h-56 rounded-[32px] object-cover" 
                  alt="" 
                />
              </div>
            </div>

            <div className="absolute top-8 right-8 z-20">
               <div className="px-8 py-3 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-full text-[10px] font-black text-white uppercase tracking-[0.4em] italic shadow-2xl">
                  Circle ID: {club.club_id.split('-')[0].toUpperCase()}
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mt-32">
            {/* Sidebar Info */}
            <aside className="lg:col-span-4 flex flex-col gap-10 pt-16">
              <div className="bg-white/80 backdrop-blur-3xl border border-white/65 p-12 rounded-[56px] shadow-2xl shadow-primary/5 space-y-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] pointer-events-none"></div>
                
                <div className="inline-flex items-center gap-4 px-6 py-2.5 bg-primary/5 border border-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-[0.4em] italic animate-pulse">
                   <Sparkles size={14} strokeWidth={3} /> {club.category}
                </div>
                
                <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter leading-none italic uppercase underline decoration-primary decoration-8 underline-offset-[12px] group-hover:decoration-primary/40 transition-all">{club.name}</h1>
                
                <div className="flex flex-col gap-6 text-[11px] font-black text-black uppercase tracking-widest pt-8 border-t border-black/[0.03]">
                   <div className="flex items-center gap-4 group/item">
                      <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center text-black/10 group-hover/item:bg-primary group-hover/item:text-white transition-all shadow-inner border border-black/5">
                        <Users size={20} strokeWidth={3} />
                      </div>
                      <span className="italic">{club.member_count} Village Synchronized</span>
                   </div>
                   <div className="flex items-center gap-4 group/item">
                      <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center text-black/10 group-hover/item:bg-primary group-hover/item:text-white transition-all shadow-inner border border-black/5">
                        <MapPin size={20} strokeWidth={3} />
                      </div>
                      <span className="italic">{club.campus} SECTOR</span>
                   </div>
                </div>
                
                <p className="text-base font-bold text-black opacity-60 leading-relaxed italic border-l-4 border-primary/20 pl-6">
                   {club.description}
                </p>
                
                <div className="flex flex-col gap-6 pt-10">
                  <button 
                    onClick={handleJoin}
                    disabled={joining}
                    className={`w-full h-20 rounded-[28px] font-black text-sm uppercase tracking-[0.3em] italic transition-all duration-500 shadow-2xl ${club.is_member ? 'bg-black text-white hover:bg-black/80' : 'bg-primary text-white shadow-primary/30 hover:scale-[1.03] active:scale-95'}`}
                  >
                    {joining ? 'Harmonizing...' : club.is_member ? 'Lock Sync' : 'Initialize Sync'}
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => navigate(`/clubs/${id}/settings`)}
                      className="w-full h-20 bg-white border-2 border-dashed border-black/10 text-black/40 rounded-[28px] font-black text-sm uppercase tracking-[0.3em] italic hover:border-primary hover:text-primary transition-all active:scale-95 flex items-center justify-center gap-4"
                    >
                      <Settings size={20} strokeWidth={4} /> Vector Controls
                    </button>
                  )}
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <div className="lg:col-span-8 flex flex-col gap-12 pt-16">
              <div className="bg-white/60 backdrop-blur-3xl border border-white/80 p-2.5 rounded-[32px] flex gap-3 w-fit shadow-2xl shadow-primary/5">
                {[
                  { id: 'posts', label: 'Signal Stream', icon: MessageSquare },
                  { id: 'members', label: 'Nodes', icon: Users }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'posts' | 'members')}
                    className={`flex items-center gap-4 px-10 py-5 rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] transition-all italic ${activeTab === tab.id ? 'bg-white text-primary shadow-2xl shadow-primary/10' : 'text-black opacity-30 hover:opacity-100 hover:scale-105'}`}
                  >
                    <tab.icon size={18} strokeWidth={4} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="pb-64 flex flex-col gap-12">
              {activeTab === 'posts' ? (
                posts.length === 0 ? (
                  <div className="py-64 text-center bg-white/40 backdrop-blur-3xl border-4 border-dashed border-white rounded-[80px] flex flex-col items-center gap-10 shadow-2xl shadow-primary/5 animate-fade-in group">
                     <div className="w-24 h-24 bg-black/5 rounded-[32px] flex items-center justify-center text-black opacity-10 group-hover:scale-125 transition-transform duration-1000">
                        <MessageSquare size={48} strokeWidth={2} />
                     </div>
                     <div className="space-y-6">
                        <h3 className="text-5xl font-black text-black opacity-5 italic uppercase tracking-tighter leading-none">Static Noise.</h3>
                        <p className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] max-w-xs mx-auto italic">No active signals in this circle. Be the first to synchronize your broadcast.</p>
                     </div>
                  </div>
                ) : (
                  posts.map(post => <PostCard key={post.post_id} post={post} />)
                )
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                  {members.map(m => (
                    <div 
                      key={m.user_id} 
                      className="p-8 rounded-[40px] bg-white/80 backdrop-blur-3xl border border-white hover:border-primary/40 transition-all flex items-center justify-between group cursor-pointer shadow-2xl shadow-primary/5 hover:scale-[1.05]"
                      onClick={() => navigate(`/profile/${m.username}`)}
                    >
                      <div className="flex items-center gap-6">
                        <div className="p-0.5 rounded-[20px] bg-white shadow-xl border border-black/5 overflow-hidden group-hover:rotate-6 transition-transform">
                          <img 
                            src={m.avatar_url || '/uploads/avatars/default.png'} 
                            className="w-16 h-16 rounded-2xl object-cover" 
                            alt="" 
                          />
                        </div>
                        <div className="flex flex-col">
                           <span className="font-black text-lg text-black uppercase italic tracking-tighter group-hover:text-primary transition-colors leading-none mb-2">@{m.username}</span>
                           <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-black/20 italic">{m.role || 'Inhabitant'}</span>
                           </div>
                        </div>
                      </div>
                      <ChevronRight size={24} strokeWidth={4} className="text-black/10 group-hover:text-primary group-hover:translate-x-3 transition-all" />
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
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
