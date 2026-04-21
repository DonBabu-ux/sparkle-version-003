import { useState, useEffect, useCallback } from 'react';
import { Search, PackageOpen, AlertCircle, CheckCircle2, Plus, MapPin, Calendar, Tag, X } from 'lucide-react';
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
  const [form, setForm] = useState({ category: 'electronics', title: '', description: '', location: '' });
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
      setForm({ category: 'electronics', title: '', description: '', location: '' });
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
    <div className="page-wrapper">
      <Navbar />
      <div className="lf-content">
        <main className="lf-container">
          {/* Hero */}
          <div className="lf-hero">
            <div>
              <h1>Lost &amp; Found</h1>
              <p>Sparkle helps you reunite with your belongings. Fast, secure, and campus-wide.</p>
            </div>
            <button className="lf-report-btn" onClick={() => { setShowReport(true); setStep(1); }}>
              <Plus size={18} /> Report Item
            </button>
          </div>

          {/* Tabs */}
          <div className="lf-tabs">
            {(['all', 'lost', 'found'] as FilterType[]).map(t => (
              <button key={t} className={`lf-tab ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
                {t === 'all' && <Search size={15} />}
                {t === 'lost' && <AlertCircle size={15} />}
                {t === 'found' && <CheckCircle2 size={15} />}
                {t === 'all' ? 'Browse All' : t === 'lost' ? 'Lost Items' : 'Found Items'}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="lf-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="lf-skeleton">
                  <div className="lfs-img pulse" />
                  <div className="lfs-body">
                    <div className="lfs-line pulse" style={{ width: '30%', marginBottom: 8 }} />
                    <div className="lfs-line pulse" style={{ width: '80%', marginBottom: 6 }} />
                    <div className="lfs-line pulse" style={{ width: '55%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="lf-empty">
              <PackageOpen size={52} className="lf-empty-icon" />
              <h3>Nothing here yet</h3>
              <p>No {filter === 'all' ? '' : filter} items found. Be the first to report one!</p>
            </div>
          ) : (
            <div className="lf-grid">
              {items.map(item => (
                <div key={item.id} className="lf-card">
                  <div className="lf-card-image">
                    <span className={`lf-badge ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>
                      {item.type}
                    </span>
                    <img
                      src={item.image_url || 'https://placehold.co/400x220?text=No+Photo'}
                      alt={item.title}
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x220?text=No+Photo'; }}
                    />
                  </div>
                  <div className="lf-card-body">
                    <span className="lf-category"><Tag size={11} /> {item.category || 'General'}</span>
                    <h3 className="lf-item-title">{item.title}</h3>
                    <div className="lf-meta-list">
                      {item.location && <div className="lf-meta-item"><MapPin size={13} /> {item.location}</div>}
                      <div className="lf-meta-item">
                        <Calendar size={13} />
                        {new Date(item.createdAt || item.date_lost_found || Date.now()).toLocaleDateString()}
                      </div>
                      {item.reporter_username && (
                        <div className="lf-meta-item" style={{ color: '#94a3b8', fontSize: 12 }}>
                          Reported by {item.reporter_username}
                        </div>
                      )}
                    </div>
                    {item.description && <p className="lf-description">{item.description}</p>}
                    
                    <div className="lf-card-actions" style={{ marginTop: 'auto', paddingTop: 20 }}>
                       {(user?.id === item.reporter_id || user?.user_id === item.reporter_id) ? (
                         <button 
                          onClick={() => handleResolve(item.id)}
                          className="lf-action-link"
                          style={{ color: '#10b981', border: 'none', background: 'none', padding: 0, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                         >
                           Mark Resolved
                         </button>
                       ) : (
                         <button 
                          onClick={() => handleClaim(item)}
                          className="lf-action-link"
                          style={{ color: '#FF3D6D', border: 'none', background: 'none', padding: 0, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                         >
                           {item.type === 'lost' ? "I found this" : "This is mine"}
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Report Wizard Modal */}
      {showReport && (
        <div className="lf-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowReport(false); }}>
          <div className="lf-modal">
            <div className="lf-modal-header">
              <h2>Report an Item</h2>
              <button className="lf-modal-close" onClick={() => setShowReport(false)}><X size={18} /></button>
            </div>

            {/* Progress */}
            <div className="lf-progress-bar">
              <div className="lf-progress-fill" style={{ width: `${(step / 3) * 100}%` }} />
            </div>
            <div className="lf-step-labels">Step {step} of 3</div>

            {/* Step 1 */}
            {step === 1 && (
              <div className="lf-step">
                <h3>What happened?</h3>
                <div className="lf-type-grid">
                  <button className={`lf-type-btn ${reportType === 'lost' ? 'active' : ''}`} onClick={() => setReportType('lost')}>
                    <AlertCircle size={22} /> I Lost Something
                  </button>
                  <button className={`lf-type-btn ${reportType === 'found' ? 'active' : ''}`} onClick={() => setReportType('found')}>
                    <CheckCircle2 size={22} /> I Found Something
                  </button>
                </div>
                <div className="lf-form-field">
                  <label>Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {['Electronics', 'Documents / IDs', 'Keys', 'Clothing / Accessories', 'Other'].map(c => (
                      <option key={c} value={c.toLowerCase()}>{c}</option>
                    ))}
                  </select>
                </div>
                <button className="lf-next-btn" onClick={() => setStep(2)}>Next Step →</button>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="lf-step">
                <h3>Item Details</h3>
                <div className="lf-form-field">
                  <label>Title</label>
                  <input type="text" placeholder="e.g. Blue Sony Headphones" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div className="lf-form-field">
                  <label>Description</label>
                  <textarea rows={4} placeholder="Brand, color, specific markings..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="lf-step-nav">
                  <button className="lf-back-btn" onClick={() => setStep(1)}>← Back</button>
                  <button className="lf-next-btn" onClick={() => setStep(3)} disabled={!form.title}>Next Step →</button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="lf-step">
                <h3>Location &amp; Submit</h3>
                <div className="lf-form-field">
                  <label>Where was it?</label>
                  <input type="text" placeholder="e.g. Student Union, 2nd Floor" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="lf-step-nav">
                  <button className="lf-back-btn" onClick={() => setStep(2)}>← Back</button>
                  <button className="lf-submit-btn" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main, #f8fafc); min-height: 100vh; }
        .lf-content { flex: 1; overflow-y: auto; }
        .lf-container { max-width: 1100px; margin: 0 auto; padding: 30px 24px 100px; }

        .lf-hero { background: linear-gradient(135deg, #FF3D6D 0%, #FF8E9D 100%); border-radius: 32px; padding: 48px 40px; color: white; margin-bottom: 32px; box-shadow: 0 20px 50px rgba(255,61,109,0.18); display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .lf-hero h1 { font-size: 2.2rem; font-weight: 900; margin: 0 0 8px; }
        .lf-hero p { font-size: 1rem; opacity: 0.9; margin: 0; font-weight: 500; }
        .lf-report-btn { display: inline-flex; align-items: center; gap: 8px; background: white; color: #FF3D6D; border: none; padding: 14px 26px; border-radius: 18px; font-weight: 800; cursor: pointer; transition: 0.2s; white-space: nowrap; box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
        .lf-report-btn:hover { transform: scale(1.03); }

        .lf-tabs { display: flex; gap: 8px; margin-bottom: 28px; }
        .lf-tab { flex: 1; padding: 14px; border-radius: 18px; border: none; background: white; color: #64748b; font-weight: 700; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); font-size: 0.9rem; }
        .lf-tab:hover { color: #FF3D6D; transform: translateY(-2px); }
        .lf-tab.active { background: white; color: #FF3D6D; box-shadow: 0 8px 20px rgba(0,0,0,0.07); transform: translateY(-2px); border: 2px solid rgba(255,61,109,0.15); }

        .lf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }

        .lf-card { background: white; border-radius: 28px; overflow: hidden; border: 1px solid rgba(0,0,0,0.05); transition: all 0.4s; box-shadow: 0 8px 24px rgba(0,0,0,0.05); display: flex; flex-direction: column; }
        .lf-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); border-color: rgba(255,61,109,0.15); }
        .lf-card-image { height: 200px; position: relative; background: #f1f5f9; overflow: hidden; }
        .lf-card-image img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
        .lf-card:hover .lf-card-image img { transform: scale(1.06); }
        .lf-badge { position: absolute; top: 14px; right: 14px; padding: 6px 14px; border-radius: 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; backdrop-filter: blur(8px); }
        .badge-lost { background: rgba(239,68,68,0.85); color: white; }
        .badge-found { background: rgba(16,185,129,0.85); color: white; }
        .lf-card-body { padding: 22px; flex: 1; display: flex; flex-direction: column; }
        .lf-category { font-size: 11px; font-weight: 800; color: #FF3D6D; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
        .lf-item-title { font-size: 1.1rem; font-weight: 800; color: #0f172a; margin: 0 0 12px; line-height: 1.35; }
        .lf-meta-list { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
        .lf-meta-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; font-weight: 600; }
        .lf-description { font-size: 13px; color: #64748b; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 0; }

        .lf-skeleton { background: white; border-radius: 28px; overflow: hidden; border: 1px solid rgba(0,0,0,0.05); }
        .lfs-img { height: 200px; background: #e2e8f0; }
        .lfs-body { padding: 22px; }
        .lfs-line { height: 12px; border-radius: 6px; background: #e2e8f0; margin-bottom: 8px; }
        .pulse { animation: lfPulse 1.5s ease-in-out infinite; }
        @keyframes lfPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .lf-empty { text-align: center; padding: 80px 40px; background: white; border-radius: 28px; border: 1px solid rgba(0,0,0,0.05); grid-column: 1/-1; }
        .lf-empty-icon { color: #cbd5e1; margin-bottom: 16px; }
        .lf-empty h3 { font-size: 1.3rem; font-weight: 800; color: #1e293b; margin: 0 0 8px; }
        .lf-empty p { color: #64748b; }

        .lf-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .lf-modal { background: white; width: 100%; max-width: 560px; border-radius: 32px; padding: 40px; max-height: 90vh; overflow-y: auto; box-shadow: 0 40px 80px rgba(0,0,0,0.3); animation: lfSlide 0.3s ease; }
        @keyframes lfSlide { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .lf-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .lf-modal-header h2 { font-size: 1.5rem; font-weight: 900; margin: 0; color: #0f172a; }
        .lf-modal-close { background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: 0.2s; }
        .lf-modal-close:hover { background: #fee2e2; color: #ef4444; }
        .lf-progress-bar { height: 5px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
        .lf-progress-fill { height: 100%; background: linear-gradient(90deg, #FF6B8B, #FF3D6D); border-radius: 4px; transition: width 0.4s ease; }
        .lf-step-labels { font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 24px; }
        .lf-step h3 { font-size: 1.2rem; font-weight: 900; color: #0f172a; margin: 0 0 20px; }
        .lf-type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .lf-type-btn { padding: 16px; border: 2px solid #e2e8f0; border-radius: 18px; background: white; font-weight: 700; cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; align-items: center; gap: 8px; color: #64748b; font-size: 0.9rem; }
        .lf-type-btn.active { border-color: #FF3D6D; color: #FF3D6D; background: #fff5f7; }
        .lf-form-field { margin-bottom: 18px; }
        .lf-form-field label { display: block; font-weight: 700; font-size: 0.88rem; color: #334155; margin-bottom: 8px; }
        .lf-form-field input, .lf-form-field select, .lf-form-field textarea { width: 100%; padding: 13px 15px; border: 2px solid #e2e8f0; border-radius: 16px; font-size: 0.95rem; color: #1e293b; background: #f8fafc; transition: 0.2s; box-sizing: border-box; font-family: inherit; }
        .lf-form-field input:focus, .lf-form-field select:focus, .lf-form-field textarea:focus { border-color: #FF3D6D; outline: none; background: white; }
        .lf-form-field textarea { resize: none; }
        .lf-step-nav { display: flex; justify-content: space-between; margin-top: 24px; gap: 12px; }
        .lf-next-btn, .lf-submit-btn { background: #0f172a; color: white; border: none; padding: 14px 28px; border-radius: 16px; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .lf-next-btn:hover, .lf-submit-btn:hover { background: #FF3D6D; }
        .lf-next-btn:disabled, .lf-submit-btn:disabled { opacity: 0.5; cursor: wait; }
        .lf-back-btn { background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 14px 28px; border-radius: 16px; font-weight: 700; cursor: pointer; }
      `}</style>
    </div>
  );
}
