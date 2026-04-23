import { useState, useEffect, useCallback } from 'react';
import { Search, PackageOpen, AlertCircle, CheckCircle2, Plus, MapPin, Calendar, Tag, X, Sparkles, Orbit, ChevronRight, Share2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

type FilterType = 'all' | 'lost' | 'found';

interface LFItem {
  id: string;
  title: string;
  description?: string;
  type: 'lost' | 'found';
  category?: string;
  location?: string;
  image_url?: string;
  reporter_username?: string;
  reporter_id?: string;
  date_lost_found?: string;
  createdAt?: string;
}

export default function LostFound() {
  const { user } = useUserStore();
  const [items, setItems] = useState<LFItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showReport, setShowReport] = useState(false);
  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState<'lost' | 'found'>('lost');
  const [form, setForm] = useState({ category: 'Electronics', title: '', description: '', location: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/lost-found?type=${filter}`);
      setItems(res.data.items || res.data || []);
    } catch (err) {
      console.error('LF fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post('/lost-found', { ...form, type: reportType });
      setShowReport(false);
      setStep(1);
      setForm({ category: 'Electronics', title: '', description: '', location: '' });
      fetchItems();
    } catch (err) {
      console.error('Report submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (id: string) => {
    if (!confirm('Mark this item as resolved? It will be removed from the list.')) return;
    try {
      await api.delete(`/lost-found/${id}`);
      fetchItems();
    } catch {
      alert('Failed to resolve item');
    }
  };

  const handleClaim = async (item: LFItem) => {
    try {
      await api.post(`/lost-found/${item.id}/claim`);
      alert(`Claim request sent to ${item.reporter_username}! They will be notified.`);
    } catch {
      alert('Failed to send claim request');
    }
  };

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-7xl mx-auto w-full pt-20 md:pt-32">
          
          {/* Editorial Header */}
          <header className="mb-24 animate-fade-in px-4">
             <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-16">
                <div className="max-w-4xl space-y-8">
                   <div className="inline-flex items-center gap-4 px-6 py-2.5 bg-white/80 backdrop-blur-3xl border border-white rounded-full shadow-xl shadow-primary/5">
                      <PackageOpen size={18} strokeWidth={3} className="text-primary" />
                       <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">Campus Satellite Support</span>
                   </div>
                   <h1 className="text-6xl md:text-9xl font-black text-black tracking-tighter leading-none italic uppercase">
                      Lost & <span className="text-primary italic">Sync'd.</span>
                   </h1>
                    <p className="text-xl font-bold text-black opacity-60 max-w-2xl leading-relaxed italic border-l-8 border-primary/20 pl-8 uppercase tracking-tighter">
                      Broadcast missing harmonics or report found signals. Maintaining the village collective organized.
                    </p>
                </div>
                
                <button 
                  onClick={() => { setShowReport(true); setStep(1); }}
                  className="h-24 px-16 bg-primary text-white rounded-[32px] font-black text-sm uppercase tracking-[0.4em] italic shadow-2xl shadow-primary/40 hover:scale-[1.05] hover:shadow-primary/60 transition-all active:scale-95 flex items-center justify-center gap-6"
                >
                  <Plus size={32} strokeWidth={4} /> Initialize Report
                </button>
             </div>
          </header>

          {/* Precision Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-20 px-4">
             <div className="flex items-center gap-4 overflow-x-auto pb-4 lg:pb-0 no-scrollbar w-full lg:w-auto">
                {(['all', 'lost', 'found'] as FilterType[]).map(t => (
                   <button 
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`h-16 px-10 rounded-[24px] font-black text-[11px] uppercase tracking-[0.3em] transition-all flex items-center gap-4 border shadow-sm italic whitespace-nowrap ${filter === t ? 'bg-white border-white text-primary shadow-2xl shadow-primary/10' : 'bg-white/40 border-white text-black opacity-30 hover:opacity-100 hover:bg-white'}`}
                   >
                     {t === 'lost' && <AlertCircle size={16} strokeWidth={3} />}
                     {t === 'found' && <CheckCircle2 size={16} strokeWidth={3} />}
                     <span>{t === 'all' ? 'Universal Stream' : `${t} Frequencies`}</span>
                   </button>
                ))}
             </div>

             <div className="relative w-full lg:w-[450px] group">
                <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-black/10 group-focus-within:text-primary transition-colors" size={24} strokeWidth={4} />
                <input 
                  type="text" 
                  placeholder="Scan village items..." 
                  className="w-full h-20 bg-white/80 border border-white rounded-[32px] pl-20 pr-8 text-lg font-black text-black placeholder:text-black/5 focus:bg-white focus:border-primary transition-all outline-none shadow-2xl shadow-primary/5 italic"
                />
             </div>
          </div>

          {/* Premium Grid */}
          <div className="pb-64 px-4">
          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {[1,2,3,4,5,6].map(i => (
                   <div key={i} className="h-[500px] bg-white/40 backdrop-blur-3xl border border-white rounded-[56px] animate-pulse shadow-sm" />
                ))}
             </div>
          ) : items.length === 0 ? (
            <div className="py-64 flex flex-col items-center justify-center text-center gap-12 bg-white/40 backdrop-blur-3xl border-4 border-dashed border-white rounded-[80px] shadow-2xl shadow-primary/5 animate-fade-in group">
               <Orbit size={140} strokeWidth={2} className="text-primary/10 animate-spin-slow" />
               <div className="space-y-6">
                  <h3 className="text-5xl font-black text-black opacity-5 italic uppercase tracking-tighter leading-none">Silent Sector.</h3>
                  <p className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] max-w-xs mx-auto italic">No {filter === 'all' ? '' : filter} items intercepted in this harmonic sector yet.</p>
                  <button onClick={() => setShowReport(true)} className="mt-8 h-18 px-12 bg-primary text-white rounded-[24px] font-black uppercase tracking-widest italic hover:scale-105 transition-all shadow-xl shadow-primary/30">Start Broadcast</button>
               </div>
            </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {items.map((item, i) => (
                   <div 
                    key={item.id} 
                    className="bg-white/80 backdrop-blur-3xl group hover:scale-[1.03] transition-all duration-700 rounded-[56px] border border-white p-4 pb-12 shadow-2xl shadow-primary/5 overflow-hidden flex flex-col animate-scale-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                   >
                     {/* Media Content */}
                     <div className="relative h-64 overflow-hidden rounded-[42px] bg-black/5 ring-4 ring-white group-hover:ring-primary/10 transition-all duration-700">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
                            alt="" 
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-black/5 opacity-40">
                             <PackageOpen size={80} strokeWidth={1} />
                             <span className="text-[10px] font-black uppercase tracking-widest italic mt-4">Node Identity Missing</span>
                          </div>
                        )}
                        <div className={`absolute top-6 left-6 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl italic border border-white/20 ${item.type === 'lost' ? 'bg-black text-white' : 'bg-primary text-white'}`}>
                           {item.type} Frequency
                        </div>
                        
                        <div className="absolute top-6 right-6">
                           <button className="w-12 h-12 bg-white/20 backdrop-blur-3xl border border-white/20 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:text-primary">
                              <Share2 size={20} strokeWidth={3} />
                           </button>
                        </div>
                     </div>

                     <div className="px-10 pt-10 flex-grow flex flex-col h-full bg-none">
                        <div className="flex items-center gap-4 text-[9px] font-black text-primary uppercase tracking-[0.3em] mb-4 italic">
                           <Tag size={16} strokeWidth={4} />
                           {item.category || 'General Spectrum'}
                        </div>
                        <h3 className="text-3xl font-black text-black mb-4 tracking-tighter italic leading-none group-hover:text-primary transition-colors uppercase">{item.title}</h3>
                        <p className="text-base font-bold text-black opacity-30 leading-tight line-clamp-2 mb-10 italic uppercase tracking-tighter">{item.description || 'No detailed harmonic data provided.'}</p>
                        
                        <div className="space-y-4 mb-12 flex-grow">
                           <div className="flex items-center gap-5 group/info">
                              <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center text-black/10 group-hover/info:bg-primary group-hover/info:text-white transition-all shadow-inner border border-black/5">
                                 <MapPin size={20} strokeWidth={4} />
                              </div>
                              <span className="text-xs font-black text-black italic uppercase tracking-widest truncate">{item.location || 'GLOBAL SECTOR'}</span>
                           </div>
                           <div className="flex items-center gap-5 group/info">
                              <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center text-black/10 group-hover/info:bg-primary group-hover/info:text-white transition-all shadow-inner border border-black/5">
                                 <Calendar size={20} strokeWidth={4} />
                              </div>
                              <span className="text-xs font-black text-black/20 italic uppercase tracking-widest">
                                 {new Date(item.createdAt || item.date_lost_found || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                              </span>
                           </div>
                        </div>

                        <div className="mt-auto pt-10 border-t border-black/5 flex items-center justify-between">
                           <div className="flex items-center gap-5">
                              <div className="relative group/avatar">
                                 <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.reporter_username || 'A')}&background=e11d48&color=fff&bold=true`} className="w-14 h-14 rounded-2xl object-cover shadow-2xl border-2 border-white group-hover/avatar:rotate-12 transition-transform" alt="" />
                                 <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full border-4 border-white shadow-lg"></div>
                              </div>
                              <div className="flex flex-col">
                                  <span className="text-[12px] font-black text-black leading-none uppercase italic tracking-tighter group-hover:text-primary transition-colors cursor-pointer">@{item.reporter_username}</span>
                                  <span className="text-[9px] font-black text-black opacity-20 uppercase tracking-[0.2em] mt-2 italic">Node Reporter</span>
                              </div>
                           </div>

                           {(user?.id === item.reporter_id || user?.user_id === item.reporter_id) ? (
                             <button 
                               onClick={() => handleResolve(item.id)}
                               className="h-14 px-8 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest italic hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-500/20 active:scale-95"
                             >
                                Resolve Sync
                             </button>
                           ) : (
                             <button 
                               onClick={() => handleClaim(item)}
                               className="h-14 px-10 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest italic hover:scale-110 transition-all shadow-2xl shadow-primary/30 active:scale-95"
                             >
                                {item.type === 'lost' ? "Signal Found" : "Claim Sync"}
                             </button>
                           )}
                        </div>
                     </div>
                   </div>
                ))}
             </div>
          )}
          </div>
        </main>
      

      {/* High-Fidelity Report Step Modal */}
      {showReport && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/40 backdrop-blur-2xl animate-fade-in" onClick={() => setShowReport(false)}>
          <div className="bg-white/90 backdrop-blur-3xl w-full max-w-2xl rounded-[56px] shadow-2xl border border-white overflow-hidden animate-scale-in relative" onClick={e => e.stopPropagation()}>
             
             {/* Progress Bar Top */}
             <div className="absolute top-0 inset-x-0 h-3 bg-black/5">
                <div 
                  className="h-full bg-primary transition-all duration-1000 ease-out shadow-2xl shadow-primary"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
             </div>

             <div className="p-16 pb-0 flex items-center justify-between">
                <div>
                   <h3 className="text-5xl font-black text-black tracking-tighter italic uppercase">Broadcast Report</h3>
                   <div className="flex items-center gap-4 mt-4">
                      <span className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] italic leading-none">Step {step} Vector Scan</span>
                      <div className="flex gap-1.5">
                         {[1,2,3].map(i => (
                            <div key={i} className={`w-3 h-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-primary w-6' : 'bg-black/10'}`} />
                         ))}
                      </div>
                   </div>
                </div>
                <button onClick={() => setShowReport(false)} className="w-18 h-18 bg-black/5 rounded-[24px] flex items-center justify-center text-black opacity-10 hover:opacity-100 hover:rotate-90 transition-all duration-500">
                    <X size={32} strokeWidth={4} />
                </button>
             </div>

             <div className="p-16 pt-12">
                {step === 1 && (
                  <div className="space-y-12 animate-fade-in">
                    <div className="grid grid-cols-2 gap-8">
                       <button 
                        onClick={() => setReportType('lost')}
                        className={`flex flex-col items-center justify-center gap-6 h-64 rounded-[40px] border-4 transition-all duration-700 shadow-2xl ${reportType === 'lost' ? 'bg-primary border-primary text-white shadow-primary/30 scale-[1.03] rotate-2' : 'bg-white border-white text-black opacity-20 hover:border-primary/20 hover:opacity-60'}`}
                       >
                         <AlertCircle size={64} strokeWidth={4} className={reportType === 'lost' ? 'animate-pulse' : ''} />
                         <span className="text-sm font-black uppercase tracking-[0.3em] italic">Lost Harmonic</span>
                       </button>
                       <button 
                        onClick={() => setReportType('found')}
                        className={`flex flex-col items-center justify-center gap-6 h-64 rounded-[40px] border-4 transition-all duration-700 shadow-2xl ${reportType === 'found' ? 'bg-primary border-primary text-white shadow-primary/30 scale-[1.03] -rotate-2' : 'bg-white border-white text-black opacity-20 hover:border-primary/20 hover:opacity-60'}`}
                       >
                         <CheckCircle2 size={64} strokeWidth={4} className={reportType === 'found' ? 'animate-pulse' : ''} />
                         <span className="text-sm font-black uppercase tracking-[0.3em] italic">Captured Sync</span>
                       </button>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Sector Category</label>
                        <select 
                          value={form.category}
                          onChange={e => setForm({...form, category: e.target.value})}
                          className="w-full h-20 bg-black/5 border-2 border-transparent rounded-[28px] px-10 text-lg font-black text-black focus:bg-white focus:border-primary transition-all outline-none appearance-none italic shadow-inner"
                        >
                          {['Electronics', 'Documents', 'Keys', 'Clothing', 'Bags', 'Other'].map(c => (
                              <option key={c} value={c} className="bg-white">{c.toUpperCase()} FREQUENCY</option>
                          ))}
                        </select>
                    </div>

                    <button onClick={() => setStep(2)} className="w-full h-24 bg-primary text-white rounded-[32px] font-black text-sm uppercase tracking-[0.4em] italic shadow-2xl shadow-primary/40 hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-4">
                      Initialize Vector <ChevronRight size={20} strokeWidth={4} />
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-12 animate-fade-in">
                    <div className="space-y-10">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Item Designation</label>
                          <input 
                            type="text" 
                            value={form.title}
                            onChange={e => setForm({...form, title: e.target.value})}
                            placeholder="e.g. Silver Harmonic Laptop..."
                            className="w-full h-20 bg-black/5 border-2 border-transparent rounded-[28px] px-10 text-xl font-black text-black focus:bg-white focus:border-primary transition-all outline-none italic shadow-inner"
                          />
                       </div>
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Defragmented Visuals</label>
                          <textarea 
                            rows={3} 
                            value={form.description}
                            onChange={e => setForm({...form, description: e.target.value})}
                            placeholder="Describe unique signals, marks, or specific village resonance..."
                            className="w-full bg-black/5 border-2 border-transparent rounded-[40px] px-10 py-8 text-lg font-black text-black focus:bg-white focus:border-primary transition-all outline-none italic resize-none shadow-inner"
                          />
                       </div>
                    </div>

                    <div className="flex items-center gap-6">
                       <button onClick={() => setStep(1)} className="w-40 h-20 rounded-[28px] bg-black/5 text-black opacity-20 font-black text-[10px] uppercase tracking-widest transition-all hover:bg-black/10 hover:opacity-100 italic">Retract</button>
                       <button onClick={() => setStep(3)} disabled={!form.title} className="flex-1 h-20 bg-primary text-white rounded-[28px] font-black text-sm uppercase tracking-[0.2em] italic shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30">Advance Scan</button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-16 animate-fade-in">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-10 italic">Last Logged Sector</label>
                        <div className="relative group">
                          <MapPin className="absolute left-10 top-1/2 -translate-y-1/2 text-black/10 group-focus-within:text-primary transition-all scale-125" size={24} strokeWidth={4} />
                          <input 
                            type="text" 
                            value={form.location}
                            onChange={e => setForm({...form, location: e.target.value})}
                            placeholder="e.g. Village Core, Sector Blue Cafe..."
                            className="w-full h-24 bg-black/5 border-2 border-transparent rounded-[32px] pl-20 pr-10 text-xl font-black text-black focus:bg-white focus:border-primary transition-all outline-none italic shadow-inner"
                          />
                        </div>
                    </div>

                    <div className="p-10 bg-primary/5 rounded-[40px] flex items-center gap-8 text-left shadow-inner border border-primary/10 relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-8 text-primary opacity-5 group-hover:rotate-12 transition-transform">
                          <Sparkles size={100} />
                       </div>
                       <div className="w-18 h-18 bg-primary/10 rounded-3xl flex items-center justify-center text-primary shrink-0 animate-pulse border border-primary/20"><Sparkles size={32} strokeWidth={4} /></div>
                       <div className="relative z-10">
                           <h4 className="text-2xl font-black italic text-black uppercase tracking-tighter leading-none mb-3">Sync Optimized</h4>
                           <p className="text-[10px] font-black text-black opacity-30 uppercase tracking-[0.4em] italic leading-tight">Broadcast vector will be dispersed to all village nodes immediately.</p>
                       </div>
                    </div>

                    <div className="flex items-center gap-6">
                       <button onClick={() => setStep(2)} className="w-40 h-24 rounded-[32px] bg-black/5 text-black opacity-20 font-black text-[10px] uppercase tracking-widest transition-all hover:bg-black/10 italic">Sector Back</button>
                       <button 
                        onClick={handleSubmit} 
                        disabled={submitting} 
                        className="flex-1 h-24 bg-primary text-white rounded-[32px] font-black text-sm uppercase tracking-[0.4em] italic shadow-2xl shadow-primary/40 hover:scale-[1.05] active:scale-95 transition-all"
                       >
                           {submitting ? 'Transmitting...' : 'Full Broadcast'}
                       </button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 25s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
