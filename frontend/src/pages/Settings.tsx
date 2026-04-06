import { useState } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function Settings() {
  const { user, setUser } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    campus: user?.campus || '',
    major: user?.major || '',
    year_of_study: user?.year_of_study || '',
    is_private: user?.is_private || false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const response = await api.post('/profile/update', formData);
      if (response.data.success) {
        setSuccess('Profile updated successfully!');
        setUser({ ...user, ...formData });
      } else {
        setError(response.data.message || 'Update failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 pb-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-xl border border-slate-100">⚙️</div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Control Center</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Calibrate your cosmic frequency</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Navigation Sidebar */}
          <aside className="md:col-span-4 space-y-2">
            {['Profile', 'Privacy', 'Security', 'Notifications'].map(item => (
              <button 
                key={item}
                className={`w-full text-left px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  item === 'Profile' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'text-slate-400 hover:bg-white hover:text-slate-600'
                }`}
              >
                {item}
              </button>
            ))}
          </aside>

          {/* Form Content */}
          <section className="md:col-span-8">
            <form onSubmit={handleSubmit} className="premium-card bg-white border-white shadow-2xl shadow-slate-200 space-y-8">
              
              {success && (
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-xs font-bold border border-emerald-100 text-center animate-bounce">
                  ✨ {success}
                </div>
              )}
              
              {error && (
                <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold border border-rose-100 text-center">
                  ⚠️ {error}
                </div>
              )}

              <div className="space-y-6">
                <div className="flex items-center gap-6 pb-6 border-b border-slate-50">
                   <div className="relative group">
                     <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-24 h-24 rounded-[32px] object-cover ring-4 ring-slate-50" alt="" />
                     <div className="absolute inset-0 bg-slate-900/40 rounded-[32px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-black uppercase tracking-widest">Change</div>
                   </div>
                   <div>
                      <h3 className="font-black text-slate-800 leading-none mb-1">Avatar</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Recommended: 400x400 PNG/JPG</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Display Name</label>
                    <input 
                      name="name"
                      className="w-full bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all" 
                      type="text" 
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Handle</label>
                    <input 
                      name="username"
                      className="w-full bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all" 
                      type="text" 
                      value={formData.username}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Bio-Signature</label>
                  <textarea 
                    name="bio"
                    rows={3}
                    className="w-full bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all resize-none" 
                    placeholder="Express your cosmic essence..."
                    value={formData.bio}
                    onChange={handleChange}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Campus</label>
                    <input 
                      name="campus"
                      className="w-full bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all" 
                      type="text" 
                      value={formData.campus}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Major</label>
                    <input 
                      name="major"
                      className="w-full bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all" 
                      type="text" 
                      value={formData.major}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Cycle</label>
                    <select 
                      name="year_of_study"
                      className="w-full bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all appearance-none"
                      value={formData.year_of_study}
                      onChange={handleChange}
                    >
                      <option value="">Select Year</option>
                      <option value="Freshman">Freshman</option>
                      <option value="Sophomore">Sophomore</option>
                      <option value="Junior">Junior</option>
                      <option value="Senior">Senior</option>
                      <option value="Graduate">Graduate</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                   <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Secret Mode</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Only approved residents can see your archive.</p>
                      </div>
                      <input 
                        name="is_private"
                        type="checkbox" 
                        className="w-10 h-6 bg-slate-300 rounded-full appearance-none checked:bg-indigo-600 transition-all cursor-pointer relative after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all checked:after:left-5" 
                        checked={formData.is_private}
                        onChange={handleChange}
                      />
                   </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-[24px] text-sm font-black uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Transmitting Changes...' : 'Commit Settings'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
