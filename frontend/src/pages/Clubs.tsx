import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, MapPin, X, Camera, Image as ImageIcon, Search } from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { logger } from '../utils/logger';

const CATEGORIES = ['All Communities', 'Academic', 'Social', 'Sports', 'Music/Arts', 'Technology', 'Volunteer'];
const CATEGORY_LABELS: Record<string, string> = { 'All Communities': 'All' };

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
  const [searchQuery, setSearchQuery] = useState('');
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
      logger.error('Failed to fetch clubs:', err);
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
      logger.error('Create club error:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 font-sans overflow-x-hidden">

      <main className="flex-1 p-6 lg:p-12 relative z-10 max-w-5xl mx-auto w-full">
        {/* Header */}
        <header className="mb-8 px-1">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-full mb-4">
                <Users size={14} className="text-primary" />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">Campus clubs</span>
              </div>
              <h1 className="text-3xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight">Clubs</h1>
              <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1.5 max-w-xl">
                Discover clubs that match your interests at {user?.campus || 'your campus'}, or start your own.
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors self-start"
            >
              <Plus size={16} strokeWidth={2.5} />
              Create club
            </button>
          </div>
        </header>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap border ${
                  activeCategory === cat
                    ? 'bg-primary border-primary text-white'
                    : 'bg-[#fdf8fa] dark:bg-zinc-800 border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-[#18181b] dark:hover:text-zinc-100'
                }`}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-zinc-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clubs..."
              className="w-full h-10 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-full pl-10 pr-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-400 focus:border-primary outline-none transition-colors"
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-24">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-[#f6eef3] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : clubs.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center px-6 bg-[#f6eef3] dark:bg-zinc-800 border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 rounded-3xl">
            <Users size={40} className="text-slate-600 dark:text-zinc-400 mb-3" />
            <h3 className="text-lg font-bold text-[#18181b] dark:text-zinc-100 mb-1">No clubs yet</h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-sm">
              Nothing in this category yet. Start the first club and your campus can join.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors"
            >
              Create club
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-24">
            {clubs.filter((club) => {
              const q = searchQuery.trim().toLowerCase();
              return !q || club.name.toLowerCase().includes(q) || club.description.toLowerCase().includes(q) || club.category.toLowerCase().includes(q);
            }).map((club) => (
              <Link
                key={club.club_id}
                to={`/clubs/${club.club_id}`}
                className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 shadow-sm hover:border-primary transition-colors overflow-hidden group flex flex-col"
              >
                <div className="relative h-32 overflow-hidden">
                  <img
                    src={club.banner_url || '/uploads/groups/default.png'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    alt=""
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-zinc-900/70 text-white rounded-full text-[11px] font-semibold">
                    {club.category}
                  </div>
                </div>
                <div className="p-5 pt-0 -mt-7 relative z-10 flex flex-col flex-1">
                  <div className="mb-3">
                    <div className="p-0.5 rounded-2xl bg-[#fdf8fa] dark:bg-zinc-800 inline-block border border-[#e6d8e1] dark:border-zinc-700">
                      <img
                        src={club.logo_url || '/uploads/groups/default.png'}
                        className="w-14 h-14 rounded-2xl object-cover"
                        alt=""
                      />
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[#18181b] dark:text-zinc-100 leading-snug mb-1 group-hover:text-primary transition-colors">{club.name}</h3>
                  <p className="text-[13px] text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-4 flex-1">
                    {club.description || 'A space for members to connect and share.'}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-[#ede3e9] dark:border-zinc-900 w-full">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400 text-[11px] font-bold">
                      <Users size={13} />
                      <span>{club.member_count || 0} members</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400 group-hover:text-primary transition-colors text-[11px] font-bold">
                      <MapPin size={13} />
                      <span>{club.campus}</span>
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
        <div className="fixed inset-0 z-(--z-chrome) flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-[#fdf8fa] dark:bg-zinc-800 w-full max-w-lg rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar relative" onClick={e => e.stopPropagation()}>
            <div className="p-6 pb-0 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight">Create a club</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">Start a new club on your campus.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-9 h-9 bg-[#f0e5ec] dark:bg-zinc-700 rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#f6eef3] dark:bg-zinc-900 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-zinc-400 hover:text-primary hover:bg-[#fdf8fa] dark:hover:bg-zinc-800 transition-colors cursor-pointer border border-[#e6d8e1] dark:border-zinc-700 group">
                  <Camera size={28} className="transition-transform group-hover:scale-110" />
                  <span className="text-xs font-bold">Club logo</span>
                </div>
                <div className="bg-[#f6eef3] dark:bg-zinc-900 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-zinc-400 hover:text-primary hover:bg-[#fdf8fa] dark:hover:bg-zinc-800 transition-colors cursor-pointer border border-[#e6d8e1] dark:border-zinc-700 group">
                  <ImageIcon size={28} className="transition-transform group-hover:scale-110" />
                  <span className="text-xs font-bold">Club banner</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 ml-1">Club name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full h-11 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 text-sm text-[#18181b] dark:text-zinc-100 focus:bg-[#fdf8fa] dark:focus:bg-zinc-800 focus:border-primary outline-none transition-colors"
                    placeholder="e.g. Drama Club, Chess Club..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 ml-1">Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="w-full h-11 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 text-sm text-[#18181b] dark:text-zinc-100 focus:bg-[#fdf8fa] dark:focus:bg-zinc-800 focus:border-primary outline-none appearance-none transition-colors"
                    >
                      {CATEGORIES.filter(c => c !== 'All Communities').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 ml-1">Campus</label>
                    <input type="text" value={form.campus} readOnly className="w-full h-11 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 text-sm text-slate-600 dark:text-zinc-400 cursor-not-allowed" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 ml-1">About</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl p-4 text-sm text-[#18181b] dark:text-zinc-100 focus:bg-[#fdf8fa] dark:focus:bg-zinc-800 focus:border-primary outline-none resize-none transition-colors"
                    placeholder="Tell people what your club is about..."
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 h-11 rounded-full text-sm font-bold text-slate-600 dark:text-zinc-400 hover:text-red-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-[2] h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors"
                >
                  {creating ? 'Creating...' : 'Create club'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
