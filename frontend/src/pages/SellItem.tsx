import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function SellItem() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'other',
    condition: 'good',
    location: '',
    campus: 'main_campus'
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setMedia(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.price || loading) return;

    setLoading(true);
    const data = new FormData();
    Object.entries(formData).forEach(([key, val]) => data.append(key, val));
    media.forEach(file => data.append('media', file));

    try {
      const res = await api.post('/marketplace/listings', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        navigate(`/marketplace/listings/${res.data.listing_id}`);
      }
    } catch (err) {
      console.error('Failed to create listing:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 py-20">
         <div className="flex items-center gap-6 mb-12">
            <div className="w-16 h-16 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white text-3xl shadow-2xl">🏷️</div>
            <div>
               <h1 className="text-4xl font-black text-slate-800 tracking-tight">Relinquish Artifact</h1>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">List an item in the Sparkle Mall Resonance</p>
            </div>
         </div>

         <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Media Upload */}
            <div className="lg:col-span-12">
               <div className="premium-card bg-white p-8 border-dashed border-2 border-slate-200 text-center">
                  <input type="file" multiple id="media-upload" onChange={handleFileChange} className="hidden" />
                  <label htmlFor="media-upload" className="cursor-pointer">
                     <div className="text-4xl mb-4">📸</div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enshrine Item Media</p>
                     <p className="text-xs text-slate-300 mt-2 font-medium">Select images or clips (Up to 20 fragments)</p>
                  </label>
                  {media.length > 0 && (
                    <div className="flex flex-wrap gap-4 mt-8 justify-center">
                       {media.map((file, idx) => (
                         <div key={idx} className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden relative">
                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="" />
                         </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>

            {/* Core Data */}
            <div className="lg:col-span-8">
               <div className="premium-card bg-white p-10 space-y-8">
                  <div>
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Item Title</label>
                     <input 
                       type="text" 
                       required
                       value={formData.title}
                       onChange={e => setFormData({...formData, title: e.target.value})}
                       placeholder="What is this object called?" 
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-medium outline-none transition-all focus:bg-white focus:ring-4 focus:ring-indigo-50"
                     />
                  </div>
                  <div>
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Specifications</label>
                     <textarea 
                       value={formData.description}
                       onChange={e => setFormData({...formData, description: e.target.value})}
                       placeholder="Detail the resonance of this item..." 
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-medium outline-none transition-all focus:bg-white focus:ring-4 focus:ring-indigo-50 min-h-[160px]"
                     />
                  </div>
               </div>
            </div>

            {/* Secondary Controls */}
            <div className="lg:col-span-4 space-y-8">
               <div className="premium-card bg-white p-8">
                  <div className="space-y-6">
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Value (USD)</label>
                        <input 
                          type="number" 
                          required
                          value={formData.price}
                          onChange={e => setFormData({...formData, price: e.target.value})}
                          placeholder="Price..." 
                          className="w-full bg-indigo-50/50 border border-indigo-100 text-indigo-600 rounded-2xl py-4 px-6 text-xl font-black outline-none transition-all focus:bg-indigo-50 focus:ring-4 focus:ring-indigo-100"
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Category</label>
                        <select 
                          value={formData.category}
                          onChange={e => setFormData({...formData, category: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-black uppercase tracking-widest text-slate-600 outline-none"
                        >
                           <option value="electronics">Electronics</option>
                           <option value="fashion">Fashion</option>
                           <option value="books">Books</option>
                           <option value="other">Other Art</option>
                        </select>
                     </div>
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Echo State</label>
                        <select 
                          value={formData.condition}
                          onChange={e => setFormData({...formData, condition: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-black uppercase tracking-widest text-slate-600 outline-none"
                        >
                           <option value="new">New / Pristine</option>
                           <option value="good">Good / Balanced</option>
                           <option value="fair">Fair / Used</option>
                        </select>
                     </div>
                  </div>
               </div>

               <button 
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-2xl shadow-slate-200 active:scale-95"
               >
                 {loading ? 'Transmitting...' : 'Register Artifact'}
               </button>
            </div>
         </form>
      </main>
    </div>
  );
}
