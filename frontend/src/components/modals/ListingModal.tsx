import { useState, useRef } from 'react';
import { X, Camera, Tag, DollarSign, Package, Loader2, Store, Plus, ChevronLeft } from 'lucide-react';
import api from '../../api/api';

interface ListingModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ListingModal({ onClose, onSuccess }: ListingModalProps) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('student_market');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles([...files, ...selected]);
    const urls = selected.map(f => URL.createObjectURL(f));
    setPreviews([...previews, ...urls]);
  };

  const removeFile = (i: number) => {
    setFiles(files.filter((_, idx) => idx !== i));
    setPreviews(previews.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!title || !price) {
      alert('Title and price are required');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('price', price);
      fd.append('description', description);
      fd.append('category', category);
      files.forEach(f => fd.append('media', f));

      await api.post('/marketplace/listings', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Marketplace listing failed:', err);
      alert('Failed to publish item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-inner">
      <div className="modal-header">
        <div className="flex items-center gap-2">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-black hover:bg-black/5 transition-all"
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>
          <div className="modal-title">
            <Store size={20} strokeWidth={3} className="text-black" /> 
            <span className="font-heading font-black text-xl text-black tracking-tighter uppercase italic">Create Listing</span>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-black/30 hover:bg-black hover:text-white transition-all lg:flex hidden" onClick={onClose}><X size={18} strokeWidth={3}/></button>
      </div>

      <div className="modal-body p-8 space-y-8">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em] flex items-center gap-3"><Package size={14} strokeWidth={3} /> Item Name</label>
          <input type="text" placeholder="e.g. Psychology Textbook..." className="w-full p-5 bg-black/[0.02] border border-black/5 rounded-2xl outline-none font-bold text-black focus:bg-white focus:border-black transition-all" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em] flex items-center gap-3"><DollarSign size={14} strokeWidth={3} /> Price</label>
            <input type="number" placeholder="0.00" className="w-full p-5 bg-black/[0.02] border border-black/5 rounded-2xl outline-none font-bold text-black focus:bg-white focus:border-black transition-all" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em] flex items-center gap-3"><Tag size={14} strokeWidth={3} /> Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-5 bg-black/[0.02] border border-black/5 rounded-2xl outline-none font-bold text-black focus:bg-white focus:border-black transition-all appearance-none cursor-pointer">
              <option value="student_market">Student Market</option>
              <option value="blackmarket">Black Market</option>
              <option value="electronics">Electronics</option>
              <option value="books">Books</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em]">Detailed description</label>
          <textarea placeholder="State condition, pick-up location, etc..." className="w-full p-5 bg-black/[0.02] border border-black/5 rounded-2xl outline-none font-bold text-black focus:bg-white focus:border-black transition-all min-h-[120px] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em] flex items-center gap-3"><Camera size={14} strokeWidth={3} /> Media Attachments</label>
          <div className="flex gap-4 flex-wrap">
            {previews.map((p, i) => (
              <div key={i} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-black/5 group">
                <img src={p} alt="" className="w-full h-full object-cover" />
                <button className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeFile(i)}><X size={12} /></button>
              </div>
            ))}
            {previews.length < 4 && (
              <button className="w-20 h-20 rounded-2xl border-2 border-dashed border-black/10 flex items-center justify-center text-black/20 hover:text-black hover:border-black/20 hover:bg-black/5 transition-all" onClick={() => fileRef.current?.click()}>
                <Plus size={24} strokeWidth={3} />
                <input type="file" ref={fileRef} hidden multiple accept="image/*" onChange={handleFile} />
              </button>
            )}
          </div>
        </div>

        <button className="w-full py-6 rounded-[24px] bg-primary text-white font-black text-[14px] uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <>List Item <Package size={20} strokeWidth={3}/></>}
        </button>
      </div>

      <style>{`
        .modal-inner { display: flex; flex-direction: column; height: 100%; border-radius: 40px; background: white; overflow: hidden; border: 1px solid rgba(0,0,0,0.05); }
        .modal-header { padding: 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.05); background: white; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
