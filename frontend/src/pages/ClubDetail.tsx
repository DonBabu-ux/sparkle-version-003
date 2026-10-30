import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, MapPin, MessageSquare, ChevronRight, Sparkles } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import PostCard from '../components/PostCard';
import api from '../api/api';
import type { Post } from '../types/post';
import { useCallback } from 'react';
import { logger } from '../utils/logger';

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
  const [club, setClub] = useState<Club | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'members'>('posts');
  const [joining, setJoining] = useState(false);

  const fetchClub = useCallback(async () => {
    setLoading(true);
    try {
      const clubRes = await api.get(`/clubs/${id}`);
      setClub(clubRes.data.club || clubRes.data);
    } catch (err) {
      logger.error('Club detail error:', err);
    }
    // Posts are non-fatal: the club detail must still load even if the posts
    // endpoint is not yet registered for this club.
    try {
      const postsRes = await api.get(`/clubs/${id}/posts`);
      setPosts(postsRes.data.posts || postsRes.data || []);
    } catch (err) {
      logger.debug('Club posts unavailable:', err?.message || err);
      setPosts([]);
    }
    try {
      const membersRes = await api.get(`/clubs/${id}/members`);
      setMembers(membersRes.data.members || membersRes.data || []);
    } catch (err) {
      logger.debug('Club members unavailable:', err?.message || err);
      setMembers([]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { if (id) fetchClub(); }, [id, fetchClub]);

  const handleJoin = async () => {
    if (!club) return;
    setJoining(true);
    try {
      if (club.is_member) {
        await api.post(`/clubs/${id}/leave`);
        setClub(prev => prev ? { ...prev, is_member: false, member_count: prev.member_count - 1 } : prev);
      } else {
        await api.post(`/clubs/${id}/join`);
        setClub(prev => prev ? { ...prev, is_member: true, member_count: prev.member_count + 1 } : prev);
      }
    } catch (err) {
      logger.error('Join/leave error:', err);
    } finally {
      setJoining(false);
    }
  };

  if (loading) return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 overflow-x-hidden font-sans">
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <Spinner size="large" color="text-primary" />
        <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Loading club...</p>
      </div>
    </div>
  );

  if (!club) return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 overflow-x-hidden font-sans">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-10">
        <div className="w-24 h-24 bg-[#f6eef3] dark:bg-zinc-900 rounded-2xl flex items-center justify-center border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700">
           <Users size={40} className="text-slate-600 dark:text-zinc-300" />
        </div>
        <div className="space-y-4">
           <h2 className="text-2xl font-bold tracking-tight text-[#18181b] dark:text-zinc-100 leading-none">Club <span className="text-[#ff1493]">not found.</span></h2>
           <p className="text-base text-slate-600 dark:text-zinc-300">This club is no longer available.</p>
        </div>
        <button onClick={() => navigate('/clubs')} className="px-8 h-12 bg-[#ff1493] text-white rounded-full font-bold text-sm hover:bg-[#ff2d87] transition-colors">Browse clubs</button>
      </div>
    </div>
  );

  return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 overflow-x-hidden font-sans">

      <main className="flex-1 p-6 lg:p-12 relative z-10 max-w-7xl mx-auto w-full">
        <button
          onClick={() => navigate('/clubs')}
          className="mb-12 w-12 h-12 rounded-2xl bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm flex items-center justify-center text-[#18181b] dark:text-zinc-100 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft size={22} strokeWidth={2.5} />
        </button>

        <div className="animate-fade-in space-y-16">
          {/* Hero Section */}
          <div className="relative">
            <div
              className="h-[350px] md:h-[500px] rounded-3xl bg-cover bg-center border border-[#e6d8e1] dark:border-zinc-700 shadow-sm relative overflow-hidden"
              style={{ backgroundImage: `url(${club.banner_url || 'https://images.unsplash.com/photo-1541339907198-e08756ebafe3?w=1200'})` }}
            />

            <div className="absolute -bottom-16 left-12 flex items-end gap-10">
              <div className="p-1 rounded-3xl bg-[#fdf8fa] dark:bg-zinc-800 shadow-sm relative z-20 border border-[#e6d8e1] dark:border-zinc-700 overflow-hidden">
                <img
                  src={club.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(club.name)}&background=black&color=fff`}
                  className="w-32 h-32 md:w-56 md:h-56 rounded-2xl object-cover"
                  alt=""
                />
              </div>
            </div>

            <div className="absolute top-8 right-8 z-20">
               <div className="px-4 py-2 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-full text-xs font-semibold text-slate-600 dark:text-zinc-300">
                  Club ID: {club.club_id.split('-')[0].toUpperCase()}
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mt-32">
            {/* Sidebar Info */}
            <aside className="lg:col-span-4 flex flex-col gap-10 pt-16">
               <div className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 p-8 rounded-3xl shadow-sm space-y-8">

                 <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#f0e5ec] dark:bg-zinc-700 text-[#ff1493] rounded-full text-xs font-semibold">
                    <Sparkles size={14} /> {club.category}
                 </div>

                 <h1 className="text-3xl font-bold text-[#18181b] dark:text-zinc-100 tracking-tight leading-tight">{club.name}</h1>

                 <div className="flex flex-col gap-4 text-sm font-semibold text-[#18181b] dark:text-zinc-100 pt-6 border-t border-[#ede3e9] dark:border-zinc-900">
                    <div className="flex items-center gap-3">
                       <Users size={18} className="text-[#ff1493]" />
                       <span>{club.member_count} members</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <MapPin size={18} className="text-[#ff1493]" />
                       <span>{club.campus}</span>
                    </div>
                 </div>

                 <p className="text-base text-slate-600 dark:text-zinc-300 leading-relaxed border-l-2 border-[#ff1493] pl-4">
                    {club.description}
                 </p>

                 <div className="flex flex-col gap-6 pt-8">
                   <button
                     onClick={handleJoin}
                     disabled={joining}
                     className={`w-full h-12 rounded-full font-bold text-sm transition-colors ${club.is_member ? 'bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-red-500' : 'bg-[#ff1493] text-white hover:bg-[#ff2d87]'}`}
                   >
                    {joining ? 'Joining...' : club.is_member ? 'Leave club' : 'Join club'}
                  </button>
                </div>
               </div>
             </aside>

             {/* Main Content Area */}
             <div className="lg:col-span-8 flex flex-col gap-12 pt-16">
                <div className="bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 p-2 rounded-full flex gap-3 w-fit">
                  {[
                   { id: 'posts', label: 'Posts', icon: MessageSquare },
                   { id: 'members', label: 'Members', icon: Users }
                 ].map(tab => (
                   <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id as 'posts' | 'members')}
                     className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-colors ${activeTab === tab.id ? 'bg-[#ff1493] text-white' : 'text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100'}`}
                   >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                 ))}
               </div>

               <div className="pb-64 flex flex-col gap-12">
               {activeTab === 'posts' ? (
                 posts.length === 0 ? (
                    <div className="py-16 text-center bg-[#f6eef3] dark:bg-zinc-900 border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 rounded-3xl flex flex-col items-center gap-6">
                       <div className="w-16 h-16 bg-[#fdf8fa] dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-600 dark:text-zinc-300">
                          <MessageSquare size={32} />
                       </div>
                       <div className="space-y-2">
                          <h3 className="text-lg font-bold text-[#18181b] dark:text-zinc-100">No posts yet</h3>
                          <p className="text-sm text-slate-600 dark:text-zinc-300 max-w-xs mx-auto">No posts in this club yet. Be the first to share something.</p>
                      </div>
                   </div>
                 ) : (
                   posts.map(post => <PostCard key={post.post_id} post={post} />)
                 )
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                   {members.map(m => (
                     <div
                       key={m.user_id}
                        className="p-5 rounded-2xl bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 hover:border-[#ff1493]/40 transition-colors flex items-center justify-between cursor-pointer"
                       onClick={() => navigate(`/profile/${m.username}`)}
                     >
                       <div className="flex items-center gap-4">
                          <div className="rounded-2xl bg-[#fdf8fa] dark:bg-zinc-800 border border-[#ede3e9] dark:border-zinc-700 overflow-hidden">
                           <img
                             src={m.avatar_url || '/uploads/avatars/no-profile.png'}
                             className="w-16 h-16 rounded-xl object-cover"
                             alt=""
                           />
                         </div>
                         <div className="flex flex-col">
                             <span className="font-bold text-base text-[#18181b] dark:text-zinc-100 leading-none mb-2">@{m.username}</span>
                             <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ff1493]" />
                                <span className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-zinc-300">{m.role || 'Member'}</span>
                            </div>
                         </div>
                       </div>
                        <ChevronRight size={20} className="text-slate-600 dark:text-zinc-300" />
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



        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
