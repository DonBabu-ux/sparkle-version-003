import { showError, showSuccess } from '../utils/toast';
import { confirmDialog } from '../store/dialogStore';
import { useState, useEffect, useCallback } from 'react';
import { Search, PackageOpen, AlertCircle, CheckCircle2, Plus, MapPin, Calendar, Tag, X, Share2 } from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { logger } from '../utils/logger';

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
  const [searchQuery, setSearchQuery] = useState('');
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
      logger.error('LF fetch error:', err);
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
      logger.error('Report submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (id: string) => {
    if (!await confirmDialog('Mark this item as resolved? It will be removed from the list.')) return;
    try {
      await api.delete(`/lost-found/${id}`);
      fetchItems();
    } catch {
      showError('Failed to resolve item');
    }
  };

  const handleClaim = async (item: LFItem) => {
    try {
      await api.post(`/lost-found/${item.id}/claim`);
      showSuccess(`Claim request sent to ${item.reporter_username}! They will be notified.`);
    } catch {
      showError('Failed to send claim request');
    }
  };

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All items' },
    { key: 'lost', label: 'Lost' },
    { key: 'found', label: 'Found' },
  ];

  return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 font-sans overflow-x-hidden">

      <main className="flex-1 p-4 md:p-8 relative z-10 max-w-[1400px] mx-auto w-full">

        {/* Header */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight">Lost &amp; Found</h1>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-xl">
              Report a lost item or share one you found. Keep your campus community organized.
            </p>
          </div>
          <button
            onClick={() => { setShowReport(true); setStep(1); }}
            className="flex items-center gap-2 px-5 h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors self-start"
          >
            <Plus size={16} strokeWidth={2.5} />
            Report an item
          </button>
        </header>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
          <div className="flex w-full items-center gap-2 overflow-x-auto p-1.5 bg-[#f0e5ec] dark:bg-zinc-700 rounded-[1.5rem] border border-[#e6d8e1] dark:border-zinc-700">
            {FILTERS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 h-11 px-3 rounded-2xl text-[12px] font-bold uppercase tracking-widest transition-colors ${
                  filter === t.key
                    ? 'bg-[#fdf8fa] dark:bg-zinc-800 text-[#18181b] dark:text-zinc-100 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-[#18181b] dark:hover:text-zinc-100'
                }`}
              >
                {t.key === 'lost' && <AlertCircle size={14} />}
                {t.key === 'found' && <CheckCircle2 size={14} />}
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-zinc-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="w-full h-11 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-[2rem] pl-11 pr-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-400 focus:border-primary outline-none transition-colors"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="pb-20">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-72 bg-[#f6eef3] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center px-6 bg-[#f6eef3] dark:bg-zinc-900 border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 rounded-3xl">
              <div className="w-14 h-14 bg-[#f0e5ec] dark:bg-zinc-700 rounded-full flex items-center justify-center mb-4">
                <PackageOpen size={24} className="text-slate-600 dark:text-zinc-400" />
              </div>
              <h3 className="text-lg font-bold text-[#18181b] dark:text-zinc-100 mb-1">No items yet</h3>
              <p className="text-[13px] text-slate-600 dark:text-zinc-400 max-w-sm mb-5">
                Nothing reported yet. When someone posts a lost or found item, it will show up here.
              </p>
              <button
                onClick={() => setShowReport(true)}
                className="px-5 h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors"
              >
                Report an item
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.filter((item) => {
                const q = searchQuery.trim().toLowerCase();
                return !q || item.title.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q);
              }).map((item) => (
                <div
                  key={item.id}
                  className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col"
                >
                  {/* Media */}
                  <div className="relative h-44 overflow-hidden bg-[#f6eef3] dark:bg-zinc-900">
                    {item.image_url ? (
                      <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 dark:text-zinc-400">
                        <PackageOpen size={32} strokeWidth={1.5} />
                        <span className="text-[11px] font-semibold mt-2">No photo</span>
                      </div>
                    )}
                    <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white ${item.type === 'lost' ? 'bg-[#18181b] dark:bg-zinc-700' : 'bg-primary'}`}>
                      {item.type === 'lost' ? 'Lost' : 'Found'}
                    </div>
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const url = `${window.location.origin}/lost-found`;
                          const text = `${item.type === 'lost' ? 'Lost' : 'Found'}: ${item.title}`;
                          if (navigator.share) {
                            try {
                              await navigator.share({ title: item.title, text, url });
                              return;
                            } catch { /* dismissed — fall through to copy */ }
                          }
                          try {
                            await navigator.clipboard.writeText(url);
                            showSuccess('Link copied to clipboard!');
                          } catch { /* clipboard unavailable */ }
                        }}
                        className="w-9 h-9 bg-zinc-900/60 backdrop-blur-xl rounded-full flex items-center justify-center text-white hover:bg-primary transition-colors"
                        aria-label="Share item"
                      >
                        <Share2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex-grow flex flex-col">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                      <Tag size={12} />
                      {item.category || 'General'}
                    </div>
                    <h3 className="text-base font-bold text-[#18181b] dark:text-zinc-100 leading-snug mb-1">{item.title}</h3>
                    <p className="text-[13px] text-slate-600 dark:text-zinc-400 leading-relaxed line-clamp-2 mb-4">{item.description || 'No details provided.'}</p>

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6eef3] dark:bg-zinc-900 rounded-full text-xs font-medium text-slate-600 dark:text-zinc-400">
                        <MapPin size={13} className="text-primary" />
                        {item.location || 'Campus-wide'}
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6eef3] dark:bg-zinc-900 rounded-full text-xs font-medium text-slate-600 dark:text-zinc-400">
                        <Calendar size={13} className="text-primary" />
                        {new Date(item.createdAt || item.date_lost_found || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-[#ede3e9] dark:border-zinc-900 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.reporter_username || 'A')}&background=ff1493&color=fff&bold=true`}
                          className="w-9 h-9 rounded-full object-cover border border-[#e6d8e1] dark:border-zinc-700"
                          alt=""
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#18181b] dark:text-zinc-100 truncate">@{item.reporter_username}</p>
                          <p className="text-[11px] text-slate-600 dark:text-zinc-400">Reported by</p>
                        </div>
                      </div>

                      {(user?.id === item.reporter_id || user?.user_id === item.reporter_id) ? (
                        <button
                          onClick={() => handleResolve(item.id)}
                          className="px-4 h-9 bg-emerald-500 text-white rounded-full text-xs font-bold hover:bg-emerald-600 transition-colors shrink-0"
                        >
                          Mark as resolved
                        </button>
                      ) : (
                        <button
                          onClick={() => handleClaim(item)}
                          className="px-4 h-9 bg-primary text-white rounded-full text-xs font-bold hover:bg-[#ff2d87] transition-colors shrink-0"
                        >
                          {item.type === 'lost' ? 'Mark as found' : 'Claim item'}
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

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 z-(--z-chrome) flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowReport(false)}>
          <div className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 shadow-2xl w-full max-w-lg overflow-hidden relative" onClick={e => e.stopPropagation()}>

            {/* Progress */}
            <div className="absolute top-0 inset-x-0 h-1 bg-[#f0e5ec] dark:bg-zinc-900">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />
            </div>

            <div className="p-6 pb-0 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight">Report an item</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">Step {step} of 3</p>
              </div>
              <button onClick={() => setShowReport(false)} className="w-9 h-9 bg-[#f0e5ec] dark:bg-zinc-700 rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 pt-5">
              {step === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setReportType('lost')}
                      className={`flex flex-col items-center justify-center gap-3 h-36 rounded-2xl border-2 transition-colors ${
                        reportType === 'lost' ? 'bg-primary border-primary text-white' : 'bg-[#fdf8fa] dark:bg-zinc-900 border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-primary'
                      }`}
                    >
                      <AlertCircle size={32} />
                      <span className="text-sm font-bold">I lost something</span>
                    </button>
                    <button
                      onClick={() => setReportType('found')}
                      className={`flex flex-col items-center justify-center gap-3 h-36 rounded-2xl border-2 transition-colors ${
                        reportType === 'found' ? 'bg-primary border-primary text-white' : 'bg-[#fdf8fa] dark:bg-zinc-900 border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-primary'
                      }`}
                    >
                      <CheckCircle2 size={32} />
                      <span className="text-sm font-bold">I found something</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="w-full h-11 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 text-sm text-[#18181b] dark:text-zinc-100 focus:border-primary outline-none transition-colors"
                    >
                      {['Electronics', 'Documents', 'Keys', 'Clothing', 'Bags', 'Other'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <button onClick={() => setStep(2)} className="w-full h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors">
                    Continue
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">Item name</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Silver laptop"
                      className="w-full h-11 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-400 focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">Details</label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe unique marks, colors, or details..."
                      className="w-full bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl p-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-400 focus:border-primary outline-none transition-colors resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep(1)} className="px-5 h-11 rounded-full text-sm font-bold text-slate-600 dark:text-zinc-400 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors">Back</button>
                    <button onClick={() => setStep(3)} disabled={!form.title} className="flex-1 h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors disabled:opacity-50">Continue</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">Last seen location</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-zinc-400" size={15} />
                      <input
                        type="text"
                        value={form.location}
                        onChange={e => setForm({ ...form, location: e.target.value })}
                        placeholder="e.g. Main Library, Blue Cafe..."
                        className="w-full h-11 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl pl-11 pr-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-400 focus:border-primary outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#18181b] dark:text-zinc-100">Almost done</h4>
                      <p className="text-xs text-slate-600 dark:text-zinc-400">Your report will be shared with your campus.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep(2)} className="px-5 h-11 rounded-full text-sm font-bold text-slate-600 dark:text-zinc-400 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors">Back</button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors disabled:opacity-50"
                    >
                      {submitting ? 'Posting...' : 'Post report'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
