import { useState, useRef } from 'react';
import { X, Camera, Tag, DollarSign, Package, Loader2 } from 'lucide-react';
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
        <div className="modal-title">
          <i className="fas fa-store" style={{color: '#10b981'}}></i> List for Sale
        </div>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="modal-body">
        <div className="input-group">
          <label><Package size={14} /> What are you selling?</label>
          <input type="text" placeholder="e.g. Psychology Textbook, Lab Coat" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid-row">
          <div className="input-group">
            <label><DollarSign size={14} /> Price (KSh)</label>
            <input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="input-group">
            <label><Tag size={14} /> Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="category-select">
              <option value="student_market">Student Market</option>
              <option value="blackmarket">Black Market</option>
              <option value="electronics">Electronics</option>
              <option value="books">Books</option>
            </select>
          </div>
        </div>

        <div className="input-group">
          <label>Description</label>
          <textarea placeholder="Condition, location, etc..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>

        <div className="upload-container">
          <label>Photos</label>
          <div className="media-preview-container">
            {previews.map((p, i) => (
              <div key={i} className="preview-sq">
                <img src={p} alt="" />
                <button className="del-btn" onClick={() => removeFile(i)}><X size={12} /></button>
              </div>
            ))}
            {previews.length < 4 && (
              <div className="add-photo-sq" onClick={() => fileRef.current?.click()}>
                <Camera size={20} />
                <input type="file" ref={fileRef} hidden multiple accept="image/*" onChange={handleFile} />
              </div>
            )}
          </div>
        </div>

        <button className="submit-market-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <>Publish Item <i className="fas fa-check"></i></>}
        </button>
      </div>

      <style>{`
        .modal-inner { display: flex; flex-direction: column; height: 100%; border-radius: 28px; background: white; overflow: hidden; }
        .modal-header { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #efefef; }
        .modal-title { font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; color: #10b981; }
        .close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; }

        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 18px; }
        .input-group label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 700; color: #64748b; margin-bottom: 8px; }
        .input-group input, .input-group textarea, .category-select { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: inherit; font-size: 0.95rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .grid-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

        .media-preview-container { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px; }
        .preview-sq { width: 70px; height: 70px; border-radius: 10px; overflow: hidden; position: relative; background: #f1f5f9; }
        .preview-sq img { width: 100%; height: 100%; object-fit: cover; }
        .del-btn { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); color: white; border: none; width: 18px; height: 18px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .add-photo-sq { width: 70px; height: 70px; border-radius: 10px; border: 2px dashed #e2e8f0; display: flex; align-items: center; justify-content: center; color: #94a3b8; cursor: pointer; }
        
        .submit-market-btn { width: 100%; padding: 16px; border-radius: 16px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; font-weight: 800; font-size: 1.05rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3); transition: 0.2s; margin-top: 10px; }
        .submit-market-btn:hover { transform: translateY(-2px); opacity: 0.95; }
        .submit-market-btn:disabled { opacity: 0.7; }
      `}</style>
    </div>
  );
}
