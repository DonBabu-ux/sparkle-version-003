import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/api';

export default function CreateGroup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    campus: 'main',
    category: 'general',
    is_public: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/groups', formData);
      if (response.data.success) {
        navigate(`/groups/${response.data.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Manifestation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-3xl mx-auto px-4 py-20">
        <div className="flex items-center gap-6 mb-12">
           <div className="w-16 h-16 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white text-3xl shadow-2xl">⚡</div>
           <div>
             <h1 className="text-4xl font-black text-slate-800 tracking-tight">Initiate Collective</h1>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Carve your space in the Sparkle Matrix</p>
           </div>
        </div>

        <div className="premium-card bg-white p-10 shadow-2xl shadow-slate-200 border-white">
           {error && (
             <div className="mb-8 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl animate-shake">
               ⚠️ {error}
             </div>
           )}

           <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Collective Signature</label>
                 <input 
                   type="text" 
                   required
                   value={formData.name}
                   onChange={e => setFormData({...formData, name: e.target.value})}
                   placeholder="Enter group name..." 
                   className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all placeholder:text-slate-300"
                 />
              </div>

              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Group Mission</label>
                 <textarea 
                   value={formData.description}
                   onChange={e => setFormData({...formData, description: e.target.value})}
                   placeholder="Define the essence of this tribe..." 
                   className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all placeholder:text-slate-300 min-h-[120px]"
                 />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Campus Resonance</label>
                    <select 
                      value={formData.campus}
                      onChange={e => setFormData({...formData, campus: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                    >
                      <option value="main">Main Campus</option>
                      <option value="north">North Sector</option>
                      <option value="south">South Sector</option>
                      <option value="virtual">Virtual Ether</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Domain</label>
                    <select 
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                    >
                      <option value="general">General</option>
                      <option value="tech">Technology</option>
                      <option value="art">Aesthetic / Art</option>
                      <option value="gaming">Gaming</option>
                      <option value="study">Academic</option>
                    </select>
                 </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                 <div>
                   <h4 className="text-xs font-black text-slate-800 uppercase">Public Visibility</h4>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Open resonance to all Sparklers</p>
                 </div>
                 <div 
                   onClick={() => setFormData({...formData, is_public: !formData.is_public})}
                   className={`w-14 h-8 rounded-full relative cursor-pointer transition-all ${formData.is_public ? 'bg-indigo-600' : 'bg-slate-300'}`}
                 >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.is_public ? 'left-7' : 'left-1'}`}></div>
                 </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Manifesting...' : 'Initiate Sequence'}
              </button>
           </form>
        </div>
      </main>
    </div>
  );
}
