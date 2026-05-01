import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, X, ChevronRight, MapPin, Tag, List, Info, DollarSign } from 'lucide-react';
import api from '../api/api';
import clsx from 'clsx';

const CATEGORIES = [
  'Vehicles', 'Housing', 'Home Sales', 'Rentals', 'Home & Garden', 
  'Furniture', 'Household Appliances', 'Tools', 'Garden', 
  'Electronics', 'Clothing', 'Jewelry', 'Baby & Kids', 
  'Health', 'Toys & Games', 'Pet Supplies', 'Books'
];

export default function SellItem() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'used_good',
    location: 'Nairobi, Kenya',
    campus: 'Main Campus'
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setMedia(prev => [...prev, ...files]);
      
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.price || !formData.category || loading) return;

    setLoading(true);
    const data = new FormData();
    Object.entries(formData).forEach(([key, val]) => data.append(key, val));
    media.forEach(file => data.append('media', file));

    try {
      const res = await api.post('/marketplace/listings', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        navigate(`/marketplace/listings/${res.data.listing_id || res.data.id}`);
      }
    } catch (err) {
      console.error('Failed to create listing:', err);
      alert('Failed to create listing. Please check all fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="text-[19px] font-bold">Create listing</h1>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={loading || !formData.title || !formData.price || !formData.category}
          className={clsx(
            "text-[16px] font-bold transition-opacity",
            (loading || !formData.title || !formData.price || !formData.category) ? "text-slate-300" : "text-[#1877F2]"
          )}
        >
          {loading ? 'Posting...' : 'Post'}
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Media Section */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[17px]">Photos</h3>
            <span className="text-slate-500 text-sm">{media.length}/10</span>
          </div>
          
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 flex-shrink-0 bg-white border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-[#1877F2] hover:border-[#1877F2] transition-all"
            >
              <Camera size={24} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Add</span>
            </button>
            
            {previews.map((url, i) => (
              <div key={i} className="w-24 h-24 flex-shrink-0 relative rounded-xl overflow-hidden border border-slate-200">
                <img src={url} className="w-full h-full object-cover" alt="" />
                <button 
                  type="button"
                  onClick={() => removeMedia(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* Input Fields */}
        <div className="divide-y divide-slate-100">
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase mb-1">Title</label>
              <input 
                type="text" 
                placeholder="What are you selling?"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full text-[16px] font-medium placeholder-slate-300 outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-slate-500 uppercase mb-1">Price</label>
              <div className="flex items-center gap-1">
                <span className="text-[16px] font-bold">KES</span>
                <input 
                  type="number" 
                  placeholder="Price"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})}
                  className="w-full text-[16px] font-medium placeholder-slate-300 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="p-4">
            <label className="block text-[13px] font-bold text-slate-500 uppercase mb-2">Category</label>
            <select 
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full text-[16px] font-medium bg-transparent outline-none appearance-none"
            >
              <option value="" disabled>Select a category</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat.toLowerCase().replace(/ /g, '-')}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="p-4">
            <label className="block text-[13px] font-bold text-slate-500 uppercase mb-2">Condition</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'new', label: 'New' },
                { id: 'used_like_new', label: 'Used - Like New' },
                { id: 'used_good', label: 'Used - Good' },
                { id: 'used_fair', label: 'Used - Fair' }
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFormData({...formData, condition: c.id})}
                  className={clsx(
                    "px-4 py-2 rounded-full text-sm font-bold border transition-all",
                    formData.condition === c.id 
                      ? "bg-[#1877F2] text-white border-[#1877F2]" 
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <label className="block text-[13px] font-bold text-slate-500 uppercase mb-1">Location</label>
            <div className="flex items-center justify-between">
              <input 
                type="text" 
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                className="w-full text-[16px] font-medium outline-none"
              />
              <MapPin size={20} className="text-[#1877F2]" />
            </div>
          </div>

          <div className="p-4">
            <label className="block text-[13px] font-bold text-slate-500 uppercase mb-1">Description</label>
            <textarea 
              placeholder="Describe what you're selling (optional)"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full text-[16px] font-medium placeholder-slate-300 outline-none min-h-[120px] resize-none"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
