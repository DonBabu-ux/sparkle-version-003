import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Camera, X, ChevronRight, MapPin, 
  Car, Home, Key, Sofa, Laptop, Shirt, Watch, 
  Baby, Heart, Gamepad, Dog, Book, Wrench, Flower2, 
  Tv, LayoutGrid, Check
} from 'lucide-react';
import api from '../api/api';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  { id: 'vehicles', label: 'Vehicles', icon: Car },
  { id: 'housing', label: 'Housing', icon: Home },
  { id: 'rentals', label: 'Rentals', icon: Key },
  { id: 'home-garden', label: 'Home & Garden', icon: Flower2 },
  { id: 'furniture', label: 'Furniture', icon: Sofa },
  { id: 'electronics', label: 'Electronics', icon: Laptop },
  { id: 'household-appliances', label: 'Appliances', icon: Tv },
  { id: 'clothing', label: 'Clothing', icon: Shirt },
  { id: 'jewelry', label: 'Jewelry', icon: Watch },
  { id: 'baby-kids', label: 'Baby & Kids', icon: Baby },
  { id: 'health', label: 'Health', icon: Heart },
  { id: 'toys-games', label: 'Toys & Games', icon: Gamepad },
  { id: 'pet-supplies', label: 'Pet Supplies', icon: Dog },
  { id: 'books', label: 'Books', icon: Book },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'other', label: 'Other', icon: LayoutGrid }
];

export default function SellItem() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
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

  const selectedCategory = CATEGORIES.find(c => c.id === formData.category);

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
    } catch (err: any) {
      console.error('Failed to create listing:', err);
      // Fallback for 401: if unauthorized, maybe token expired
      if (err.response?.status === 401) {
        alert('Your session has expired. Please log in again.');
      } else {
        alert('Failed to create listing. Please check all fields.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-marketplace-text font-sans pb-10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-marketplace-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="text-[19px] font-bold">Create listing</h1>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={loading || !formData.title || !formData.price || !formData.category}
          className={clsx(
            "text-[16px] font-bold px-4 py-1.5 rounded-full transition-all duration-300",
            (loading || !formData.title || !formData.price || !formData.category) 
              ? "text-marketplace-muted bg-transparent" 
              : "text-white bg-[#1877F2] shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95"
          )}
        >
          {loading ? 'Posting...' : 'Post'}
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Media Section */}
        <div className="p-4 bg-marketplace-bg border-b border-marketplace-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[17px]">Photos</h3>
            <span className="text-marketplace-muted text-sm">{media.length}/10</span>
          </div>
          
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 flex-shrink-0 bg-white border-2 border-dashed border-marketplace-border rounded-xl flex flex-col items-center justify-center gap-1 text-marketplace-muted hover:text-[#1877F2] hover:border-[#1877F2] transition-all"
            >
              <Camera size={24} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Add</span>
            </button>
            
            {previews.map((url, i) => (
              <div key={i} className="w-24 h-24 flex-shrink-0 relative rounded-xl overflow-hidden border border-marketplace-border">
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
        <div className="divide-y divide-slate-50">
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[13px] font-bold text-marketplace-muted uppercase mb-1">Title</label>
              <input 
                type="text" 
                placeholder="What are you selling?"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full text-[16px] font-medium placeholder-marketplace-muted/30 outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-marketplace-muted uppercase mb-1">Price</label>
              <div className="flex items-center gap-1">
                <span className="text-[16px] font-bold">KES</span>
                <input 
                  type="number" 
                  placeholder="Price"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})}
                  className="w-full text-[16px] font-medium placeholder-marketplace-muted/30 outline-none"
                />
              </div>
            </div>
          </div>

          <div 
            onClick={() => setIsCategoryModalOpen(true)}
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-marketplace-bg transition-colors"
          >
            <div>
              <label className="block text-[13px] font-bold text-marketplace-muted uppercase mb-1">Category</label>
              <p className={clsx(
                "text-[16px] font-medium",
                formData.category ? "text-marketplace-text" : "text-marketplace-muted/40"
              )}>
                {selectedCategory ? selectedCategory.label : 'Select a category'}
              </p>
            </div>
            <ChevronRight size={20} className="text-marketplace-muted" />
          </div>

          <div className="p-4">
            <label className="block text-[13px] font-bold text-marketplace-muted uppercase mb-2">Condition</label>
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
                      : "bg-marketplace-bg text-marketplace-muted border-marketplace-border hover:bg-slate-100"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <label className="block text-[13px] font-bold text-marketplace-muted uppercase mb-1">Location</label>
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
            <label className="block text-[13px] font-bold text-marketplace-muted uppercase mb-1">Description</label>
            <textarea 
              placeholder="Describe what you're selling (optional)"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full text-[16px] font-medium placeholder-marketplace-muted/30 outline-none min-h-[120px] resize-none"
            />
          </div>
        </div>
      </form>

      {/* Category Selection Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsCategoryModalOpen(false)}
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="px-6 py-4 border-b border-marketplace-border flex items-center justify-between bg-white sticky top-0 z-10">
                <h2 className="text-xl font-bold">Select Category</h2>
                <button onClick={() => setIsCategoryModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-marketplace-bg">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto no-scrollbar">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setFormData({...formData, category: cat.id});
                      setIsCategoryModalOpen(false);
                    }}
                    className={clsx(
                      "flex flex-col items-center gap-3 p-4 rounded-2xl transition-all border group",
                      formData.category === cat.id 
                        ? "bg-blue-50 border-[#1877F2] shadow-sm" 
                        : "bg-marketplace-bg hover:bg-slate-100 border-transparent"
                    )}
                  >
                    <div className={clsx(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110",
                      formData.category === cat.id ? "bg-white text-[#1877F2]" : "bg-white text-marketplace-muted shadow-sm"
                    )}>
                      <cat.icon size={24} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={clsx(
                        "text-[13px] font-bold",
                        formData.category === cat.id ? "text-[#1877F2]" : "text-marketplace-text"
                      )}>
                        {cat.label}
                      </span>
                      {formData.category === cat.id && <Check size={14} className="text-[#1877F2]" />}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
