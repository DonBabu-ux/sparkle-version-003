import { useState, useEffect } from 'react';
import { 
  Hammer, Zap, Star, ShieldCheck, ChevronRight, 
  Search, Filter, Plus, Briefcase, GraduationCap, 
  Code, Palette, PenTool, Music, Cpu, MoreHorizontal
} from 'lucide-react';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalStore } from '../store/modalStore';

interface SkillOffer {
  offer_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  is_free: boolean;
  username: string;
  name: string;
  avatar_url: string;
  average_rating: number | null;
  review_count: number;
  created_at: string;
}

const CATEGORIES = [
  { id: 'all', name: 'All Skills', icon: Briefcase },
  { id: 'tutoring', name: 'Tutoring', icon: GraduationCap },
  { id: 'coding', name: 'Coding', icon: Code },
  { id: 'design', name: 'Design', icon: Palette },
  { id: 'writing', name: 'Writing', icon: PenTool },
  { id: 'music', name: 'Music', icon: Music },
  { id: 'tech', name: 'Tech Support', icon: Cpu },
];

export default function SkillMarket() {
  const [skills, setSkills] = useState<SkillOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { setActiveModal, refreshCounter } = useModalStore();

  useEffect(() => {
    fetchSkills();
  }, [activeCategory, refreshCounter]);

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (activeCategory !== 'all') params.category = activeCategory;
      
      const response = await api.get('/skill-market/offers', { params });
      const data = response.data.offers || response.data;
      setSkills(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSkills = skills.filter(skill => 
    skill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="skill-market-page min-h-screen bg-[#fcfdff] flex lowercase">
      <Navbar />
      
      <main className="flex-1 lg:pl-24 pt-20 lg:pt-0">
        <div className="max-w-[1400px] mx-auto px-6 py-10">
          
          {/* Header & Search */}
          <header className="mb-12">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="max-w-2xl">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] mb-6 italic"
                >
                  <Zap size={14} fill="currentColor" />
                  Skill Matrix Active
                </motion.div>
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-5xl lg:text-7xl font-black tracking-tighter italic uppercase leading-[0.85] mb-6"
                >
                  Student <br />
                  <span className="text-primary">Power Hub</span>
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg font-bold text-black/40 max-w-lg leading-relaxed italic"
                >
                  monetize your expertise or find specialized talent right within your student community. turn knowledge into value.
                </motion.p>
              </div>

              <div className="flex flex-col gap-4 w-full lg:max-w-sm">
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/5 rounded-[24px] blur-xl group-focus-within:bg-primary/10 transition-all" />
                  <div className="relative flex items-center bg-white border-2 border-black/[0.03] rounded-[24px] px-6 h-16 shadow-sm group-focus-within:border-primary/20 transition-all">
                    <Search className="text-black/20 mr-4" size={20} strokeWidth={3} />
                    <input 
                      type="text" 
                      placeholder="search skills..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none outline-none w-full font-bold text-black placeholder:text-black/20 italic"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => setActiveModal('skill_offer')}
                  className="h-16 bg-black text-white rounded-[24px] font-black uppercase italic tracking-tighter text-lg flex items-center justify-center gap-3 hover:bg-primary transition-all active:scale-95 shadow-xl shadow-black/10"
                >
                  <Plus size={20} strokeWidth={4} />
                  List a service
                </button>
              </div>
            </div>
          </header>

          {/* Category Bar */}
          <div className="mb-12 overflow-x-auto no-scrollbar -mx-6 px-6">
            <div className="flex items-center gap-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`
                      shrink-0 flex items-center gap-3 px-6 py-4 rounded-[20px] font-black text-sm transition-all relative
                      ${isActive ? 'bg-black text-white shadow-lg' : 'bg-white border-2 border-black/[0.03] text-black/40 hover:bg-black/5'}
                    `}
                  >
                    <Icon size={18} strokeWidth={isActive ? 3 : 2} />
                    <span className="italic uppercase tracking-tight">{cat.name}</span>
                    {isActive && <motion.div layoutId="cat-glow" className="absolute inset-0 bg-primary/20 blur-xl -z-10 rounded-full" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="relative min-h-[400px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-40">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="font-black text-[10px] uppercase tracking-[0.4em] italic">Syncing matrix...</p>
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-24 h-24 bg-black/5 rounded-[40px] flex items-center justify-center mb-8">
                  <Hammer size={40} className="text-black/10" />
                </div>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-2">No skills found</h3>
                <p className="font-bold text-black/20 max-w-xs italic uppercase tracking-widest text-[10px]">be the first to offer this service in your sector.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                <AnimatePresence>
                  {filteredSkills.map((skill, idx) => (
                    <motion.div 
                      key={skill.offer_id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setActiveModal('skill_detail', null, { offerId: skill.offer_id })}
                      className="group bg-white border-4 border-black/[0.02] rounded-[48px] p-8 hover:border-primary/10 transition-all hover:shadow-[0_40px_80px_rgba(225,29,72,0.05)] flex flex-col relative overflow-hidden cursor-pointer"
                    >
                      {/* Background Decor */}
                      <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] group-hover:scale-110 transition-all">
                        <Hammer size={120} strokeWidth={1} />
                      </div>

                      <div className="flex items-start justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-4">
                          <img 
                            src={skill.avatar_url || '/uploads/avatars/default.png'} 
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-black/5 group-hover:scale-110 transition-transform"
                            alt="" 
                          />
                          <div>
                            <h4 className="font-black text-[15px] text-black leading-none mb-1 uppercase italic tracking-tighter">{skill.name}</h4>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5 text-amber-500">
                                <Star size={10} fill="currentColor" />
                                <span className="font-black text-[10px] italic">{skill.average_rating || '5.0'}</span>
                              </div>
                              <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest">({skill.review_count} rvs)</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-black/10 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <ShieldCheck size={20} strokeWidth={3} />
                        </div>
                      </div>

                      <div className="flex-1 mb-8 relative z-10">
                        <div className="text-[9px] font-black text-primary uppercase tracking-[0.3em] mb-3 italic">
                          {CATEGORIES.find(c => c.id === skill.category)?.name || skill.category}
                        </div>
                        <h3 className="text-2xl font-black text-black leading-tight tracking-tighter uppercase italic mb-4 group-hover:text-primary transition-colors">
                          {skill.title}
                        </h3>
                        <p className="text-[13px] font-bold text-black/40 leading-relaxed italic line-clamp-3">
                          {skill.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-8 border-t-2 border-black/[0.02] relative z-10">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-black/20 uppercase tracking-widest mb-1 italic">Starting at</span>
                          <span className="text-2xl font-black text-emerald-500 tracking-tighter italic">
                            {skill.is_free ? 'FREE' : `KSH ${skill.price}`}
                          </span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveModal('skill_detail', null, { offerId: skill.offer_id }); }}
                          className="px-8 py-4 bg-black text-white rounded-[20px] font-black text-sm uppercase italic tracking-tighter hover:bg-primary transition-all active:scale-95 shadow-lg shadow-black/5"
                        >
                          Engage <ChevronRight size={16} className="inline ml-1" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
        .animate-scale-in { animation: scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}

