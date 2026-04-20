import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
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
    <div className="h-screen bg-slate-50 flex flex-col">
       <Navbar /> 
       <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
       </div>
    </div>
  );

  if (!group) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 pb-20">
        {/* Cover & Brand Area */}
        <div className="relative h-64 md:h-80 w-full mb-20">
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[3rem] overflow-hidden shadow-2xl">
              {group.cover_image && <img src={group.cover_image} className="w-full h-full object-cover opacity-50 blur-sm" alt="" />}
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
           </div>

           {/* Brand Center */}
           <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div className="w-32 h-32 md:w-36 md:h-36 bg-white p-2 rounded-[2.5rem] shadow-2xl relative">
                 <img src={group.icon_url || '/uploads/avatars/default.png'} className="w-full h-full rounded-[2rem] object-cover" alt="" />
                 {group.verified && (
                   <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-lg">✓</div>
                 )}
              </div>
              <div className="text-center mt-6">
                 <h1 className="text-3xl font-black text-slate-800 tracking-tight">{group.name}</h1>
                 <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1 bg-white px-3 py-1 rounded-full shadow-sm">
                   {group.category || 'General Hub'} • {group.campus}
                 </p>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mt-24">
           {/* Info Sidebar */}
           <aside className="lg:col-span-4 space-y-6">
              <div className="premium-card bg-white p-8">
                 <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">Essence</h3>
                 <p className="text-slate-600 font-medium leading-relaxed mb-8">{group.description || 'No description provided by the guardians of this collective.'}</p>
                 
                 <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-slate-50 rounded-2xl">
                       <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acolytes</span>
                       <span className="text-xl font-black text-slate-800">{group.member_count || 0}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                       <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Frequency</span>
                       <span className="text-xl font-black text-slate-800">{posts.length} S</span>
                    </div>
                 </div>

                 <button 
                  onClick={handleJoinLeave}
                  className={`w-full py-4 rounded-[1.2rem] font-black text-xs uppercase tracking-widest transition-all shadow-xl ${
                    isMember 
                    ? 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600' 
                    : pendingJoin 
                    ? 'bg-slate-900/50 text-white opacity-50 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-slate-900 shadow-indigo-100'
                  }`}
                 >
                   {isMember ? 'Abandon Frequency' : pendingJoin ? 'Signal Pending' : 'Join Resonance'}
                 </button>

                 {isOwner && (
                   <button 
                     onClick={() => navigate(`/groups/${id}/settings`)}
                     className="w-full mt-3 py-3 border border-slate-100 text-slate-400 rounded-[1.2rem] font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-all"
                   >
                     Founder Panel
                   </button>
                 )}
              </div>
           </aside>

           {/* Collective Feed */}
           <div className="lg:col-span-8 space-y-10">
              {isMember ? (
                <>
                  <div className="premium-card bg-white p-6 flex items-center justify-between">
                     <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Share a signal with the tribe...</p>
                     <button className="bg-indigo-50 text-indigo-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-md shadow-indigo-50">Create Entry</button>
                  </div>
                  
                  <div className="flex flex-col gap-8">
                    {posts.length > 0 ? posts.map(post => (
                      <PostCard key={post.post_id} post={post} />
                    )) : (
                      <div className="text-center py-20 bg-white/50 rounded-[3rem] border-2 border-dashed border-slate-200">
                         <p className="text-sm font-black text-slate-300 uppercase tracking-widest">The collective feed is silent.</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="premium-card bg-indigo-900 border-none text-white p-12 text-center h-[400px] flex flex-col items-center justify-center space-y-8 shadow-2xl shadow-indigo-200">
                    <div className="text-5xl">🗝️</div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight mb-2">Restricted Access</h2>
                      <p className="text-indigo-200/60 font-black text-[10px] uppercase tracking-[0.2em] max-w-xs mx-auto">This collective requires resonance before signals can be observed.</p>
                    </div>
                </div>
              )}
           </div>
        </div>
      </main>
    </div>
  );
}
