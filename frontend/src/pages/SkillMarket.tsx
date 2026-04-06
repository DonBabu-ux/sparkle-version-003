import { useState, useEffect } from 'react';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function SkillMarket() {
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await api.get('/marketplace/skills');
        setSkills(response.data.skillOffers || response.data || []);
      } catch (err) {
        console.error('Failed to fetch skills:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSkills();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-20">
         <div className="flex items-center gap-6 mb-16">
            <div className="w-16 h-16 bg-cyan-500 rounded-[2.5rem] flex items-center justify-center text-white text-3xl shadow-2xl shadow-cyan-100">🧬</div>
            <div>
               <h1 className="text-4xl font-black text-slate-800 tracking-tight">Skill Resonance</h1>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Peer-to-peer specialized services & knowledge sharing</p>
            </div>
         </div>

         {loading ? (
           <div className="py-20 text-center">
              <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {skills.map((skill, idx) => (
                <div key={idx} className="premium-card bg-slate-50 border-white group">
                   <div className="flex items-center gap-4 mb-6">
                      <img src={skill.provider_avatar || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-2xl object-cover" alt="" />
                      <div>
                         <h3 className="font-black text-slate-800 truncate">{skill.title}</h3>
                         <p className="text-[9px] font-black text-cyan-600 uppercase">By {skill.provider_name}</p>
                      </div>
                   </div>
                   <p className="text-sm text-slate-500 font-medium mb-6 line-clamp-3">{skill.description}</p>
                   <div className="flex items-center justify-between mt-auto pt-6 border-t border-white">
                      <span className="text-xl font-black text-slate-800">{skill.price_display || 'Negotiable'}</span>
                      <button className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-600 transition-all">Engage</button>
                   </div>
                </div>
              ))}
              
              <div className="premium-card border-dashed border-2 border-slate-200 flex flex-col items-center justify-center p-12 text-center group cursor-pointer hover:border-cyan-500 transition-all">
                 <div className="w-16 h-16 bg-slate-100 rounded-[2rem] flex items-center justify-center text-3xl mb-4 group-hover:bg-cyan-100 group-hover:scale-110 transition-all">🏗️</div>
                 <h3 className="font-black text-slate-800 mb-1">Offer a Service</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monetize your expertise</p>
              </div>
           </div>
         )}
      </main>
    </div>
  );
}
