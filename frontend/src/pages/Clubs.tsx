import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, MapPin, X, Camera, Image as ImageIcon, Search, Orbit } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

const CATEGORIES = ['All Communities', 'Academic', 'Social', 'Sports', 'Music/Arts', 'Technology', 'Volunteer'];

interface Club {
  club_id: string;
  name: string;
  description: string;
  category: string;
  campus: string;
  member_count: number;
  logo_url?: string;
  banner_url?: string;
}

export default function Clubs() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All Communities');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Social', description: '', campus: user?.campus || '' });

  useEffect(() => {
    fetchClubs(activeCategory);
  }, [activeCategory]);

  const fetchClubs = async (cat: string) => {
    setLoading(true);
    try {
      const category = cat === 'All Communities' ? 'all' : cat;
      const res = await api.get(`/clubs?category=${category}`);
      setClubs(res.data.clubs || res.data || []);
    } catch (err) {
      console.error('Failed to fetch clubs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/clubs', form);
      const clubId = res.data.club_id || res.data.clubId;
      if (clubId) navigate(`/clubs/${clubId}`);
    } catch (err) {
      console.error('Create club error:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />
      
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-7xl mx-auto w-full pt-16 md:pt-12">
        <header className="mb-24 animate-fade-in px-4">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
              <div className="max-w-4xl space-y-8">
                 <div className="inline-flex items-center gap-4 px-6 py-2.5 bg-white/80 backdrop-blur-3xl border border-white rounded-full mb-4 shadow-xl shadow-primary/5">
                    <Users size={18} strokeWidth={3} className="text-primary" />
                    <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">The Village Communities</span>
                 </div>
                 <h1 className="text-5xl md:text-9xl font-black text-black tracking-tighter leading-none italic uppercase">
                    Campus <span className="text-primary">Clubs</span>
                 </h1>
                  <p className="text-xl font-bold text-black opacity-60 leading-relaxed italic max-w-2xl">
                    Discover and join signals that match your frequency at <span className="text-primary">{user?.campus || 'the village'}</span>.
                  </p>
              </div>
              
              <button 
                onClick={() => setShowModal(true)}
                className="flex items-center gap-4 px-12 py-6 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.05] transition-all active:scale-95 italic whitespace-nowrap"
              >
                <Plus size={24} strokeWidth={4} />
                Register Circle
              </button>
           </div>
        </header>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10 mb-20 px-4">
           <div className="flex items-center gap-4 overflow-x-auto pb-4 lg:pb-0 no-scrollbar w-full lg:w-auto">
              {CATEGORIES.map(cat => (
                 <button 
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-10 py-4.5 rounded-[22px] font-black text-[11px] uppercase tracking-widest transition-all duration-500 whitespace-nowrap shadow-lg border italic ${activeCategory === cat ? 'bg-white border-primary text-primary scale-105 shadow-primary/5' : 'bg-white/40 border-white text-black/20 hover:bg-white hover:text-black hover:shadow-xl'}`}
                 >
                   {cat}
                 </button>
              ))}
           </div>

           <div className="relative w-full lg:w-[400px] group">
              <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-black/10 group-focus-within:text-primary transition-colors" size={24} strokeWidth={4} />
              <input 
                type="text" 
                placeholder="Scan for community signals..." 
                className="w-full h-20 bg-white/80 border border-white rounded-[32px] pl-20 pr-8 text-lg font-black text-black placeholder:text-black/5 focus:bg-white focus:border-primary transition-all outline-none shadow-2xl shadow-primary/5 italic"
              />
           </div>
        </div>

        {/* Grid */}
        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-2">
             {[1,2,3,4,5,6].map(i => (
                <div key={i} className="aspect-[4/5] bg-white/40 border-4 border-dashed border-white rounded-[56px] animate-pulse"></div>
             ))}
           </div>
        ) : clubs.length === 0 ? (
           <div className="py-48 flex flex-col items-center text-center px-8 bg-white/20 border-4 border-dashed border-white rounded-[64px] shadow-inner animate-fade-in mx-4">
              <Orbit size={140} strokeWidth={1} className="text-black/5 animate-spin-slow" />
              <h3 className="text-5xl font-black text-black/10 italic mb-8 uppercase tracking-tighter">Silent Spectrum.</h3>
              <p className="text-[11px] font-black text-black/30 uppercase tracking-[0.4em] max-w-sm mx-auto mb-12 italic leading-loose">
                 No communities captured on this frequency. Amplify a new circle!
              </p>
              <button 
                onClick={() => setShowModal(true)}
                className="px-12 py-6 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 italic transition-all hover:scale-[1.05]"
              >
                 Initialize Pulse
              </button>
           </div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pb-48 px-2">
              {clubs.map((club) => (
                 <Link 
                  key={club.club_id} 
                  to={`/clubs/${club.club_id}`}
                  className="bg-white/80 backdrop-blur-3xl rounded-[56px] group hover:scale-[1.03] transition-all duration-700 overflow-hidden shadow-2xl shadow-primary/5 border border-white relative animate-fade-in"
                 >
                   <div className="relative aspect-video overflow-hidden mt-3 mx-3 rounded-[42px] border border-black/5">
                      <img 
                        src={club.banner_url || '/uploads/avatars/default.png'} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                        alt="" 
                      />
                      <div className="absolute top-6 left-6 px-6 py-2 bg-black/60 backdrop-blur-3xl border border-white/20 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] italic">
                         {club.category} Pulse
                      </div>
                   </div>
                   <div className="px-12 pb-12 -mt-16 relative z-10 flex flex-col items-start">
                      <div className="mb-8">
                         <div className="p-1 rounded-[32px] bg-white shadow-2xl inline-block group-hover:-rotate-6 transition-transform duration-700 border border-black/5">
                           <img 
                               src={club.logo_url || '/uploads/avatars/default.png'}
                               className="w-24 h-24 rounded-[28px] object-cover"
                               alt=""
                           />
                         </div>
                      </div>
                      <h3 className="text-3xl font-black text-black mb-4 group-hover:text-primary transition-colors leading-none uppercase tracking-tighter italic">{club.name}</h3>
                      <p className="text-base font-bold text-black opacity-60 line-clamp-2 leading-relaxed mb-12 italic">
                        {club.description || 'Connecting frequencies across the village...'}
                      </p>
                      
                      <div className="flex items-center justify-between pt-10 border-t border-black/[0.03] w-full">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm border border-primary/10">
                               <Users size={24} strokeWidth={4} />
                            </div>
                            <div className="flex flex-col">
                               <span className="text-lg font-black text-black leading-none">{club.member_count || 0}</span>
                               <span className="text-[8px] font-black text-black/20 uppercase tracking-widest mt-1 italic">Synced Signals</span>
                            </div>
                         </div>
                         <div className="flex items-center gap-3 text-black/10 group-hover:text-primary transition-colors italic">
                            <MapPin size={18} strokeWidth={4} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{club.campus}</span>
                         </div>
                      </div>
                   </div>
                 </Link>
              ))}
           </div>
        )}
      </main>

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/40 backdrop-blur-2xl animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white/90 backdrop-blur-3xl w-full max-w-4xl rounded-[56px] shadow-2xl border border-white overflow-hidden animate-scale-in max-h-[90vh] overflow-y-auto no-scrollbar relative" onClick={e => e.stopPropagation()}>
             <div className="p-16 pb-0 flex items-center justify-between">
                <div>
                   <h3 className="text-5xl font-black text-black tracking-tighter italic uppercase">Register Circle</h3>
                   <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.4em] mt-4 italic">Initialize a new campus frequency node.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="w-16 h-16 bg-black/5 rounded-3xl flex items-center justify-center text-black/10 hover:text-black transition-all">
                    <X size={28} strokeWidth={4} />
                </button>
             </div>
             
             <form onSubmit={handleCreate} className="p-16 space-y-12">
                <div className="grid grid-cols-2 gap-8">
                   <div className="bg-black/5 rounded-[32px] p-10 flex flex-col items-center justify-center gap-4 text-black/10 hover:text-primary hover:bg-white transition-all cursor-pointer shadow-sm group">
                      <Camera size={48} strokeWidth={3} className="transition-transform group-hover:scale-110" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Identity Logo</span>
                   </div>
                   <div className="bg-black/5 rounded-[32px] p-10 flex flex-col items-center justify-center gap-4 text-black/10 hover:text-primary hover:bg-white transition-all cursor-pointer shadow-sm group">
                      <ImageIcon size={48} strokeWidth={3} className="transition-transform group-hover:scale-110" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Aura Banner</span>
                   </div>
                </div>

                <div className="space-y-10">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-8 italic">Circle Designation</label>
                      <input 
                        type="text" 
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        className="w-full h-20 bg-black/5 border-2 border-transparent rounded-[28px] px-8 text-xl font-black text-black focus:bg-white focus:border-primary transition-all outline-none italic"
                        placeholder="e.g. Neo-Signal Arts, Quantum Chess..." 
                        required 
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-4">
                         <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-8 italic">Frequency Band (Category)</label>
                         <select 
                          value={form.category}
                          onChange={e => setForm({...form, category: e.target.value})}
                          className="w-full h-20 bg-black/5 border-2 border-transparent rounded-[28px] px-8 font-black text-black focus:bg-white focus:border-primary transition-all outline-none appearance-none italic"
                         >
                             {CATEGORIES.filter(c => c !== 'All Communities').map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                      </div>
                      <div className="space-y-4">
                         <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-8 italic">Broadcast Node (Campus)</label>
                         <input type="text" value={form.campus} readOnly className="w-full h-20 bg-black/5 border-none rounded-[28px] px-8 font-black text-black/30 cursor-not-allowed italic" />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-8 italic">The Script (About)</label>
                      <textarea 
                        rows={3} 
                        value={form.description}
                        onChange={e => setForm({...form, description: e.target.value})}
                        className="w-full bg-black/5 border-2 border-transparent rounded-[32px] p-8 text-lg font-black text-black focus:bg-white focus:border-primary transition-all outline-none resize-none italic"
                        placeholder="Tell the village about the frequency you're establishing..." 
                        required 
                      />
                   </div>
                </div>

                <div className="flex items-center gap-6 pt-6">
                   <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="flex-1 h-16 rounded-[24px] font-black text-[11px] text-black/20 uppercase tracking-widest hover:text-red-500 transition-all italic"
                   >
                     Cancel Sync
                   </button>
                   <button 
                    type="submit" 
                    className="flex-[2] h-16 bg-primary text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all italic"
                   >
                     {creating ? 'Transmitting...' : 'Initialize Circle'}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
