import React, { useState, useEffect } from 'react';
import { X, Zap, Star, ShieldCheck, ChevronRight, MessageCircle, Calendar, Clock, ArrowRight, Check } from 'lucide-react';
import api from '../../api/api';
import { useModalStore } from '../../store/modalStore';
import { motion, AnimatePresence } from 'framer-motion';

interface SkillOfferDetail extends any {
  offer_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  is_free: boolean;
  username: string;
  name: string;
  avatar_url: string;
  average_rating: number | null;
  review_count: number;
}

export default function SkillDetailModal({ offerId, onClose }: { offerId: string, onClose: () => void }) {
  const [offer, setOffer] = useState<SkillOfferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingData, setBookingData] = useState({
    booking_date: new Date().toISOString().split('T')[0],
    duration_minutes: 60,
    notes: ''
  });

  useEffect(() => {
    fetchOffer();
  }, [offerId]);

  const fetchOffer = async () => {
    try {
      const res = await api.get(`/skill-market/offers/${offerId}`);
      setOffer(res.data.offer || res.data.data || res.data);
    } catch (err) {
      console.error('Failed to fetch offer detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    setIsBooking(true);
    try {
      await api.post(`/skill-market/offers/${offerId}/book`, bookingData);
      setBooked(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Booking failed:', err);
      alert('Failed to initiate booking.');
    } finally {
      setIsBooking(false);
    }
  };

  if (loading) return null; // Or a mini spinner
  if (!offer) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 lowercase">
      <div className="absolute inset-0 bg-black/10 backdrop-blur-3xl" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-[540px] bg-white rounded-[56px] shadow-[0_60px_180px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col border-4 border-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-10 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={offer.avatar_url || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-[22px] object-cover border-4 border-black/5" alt="" />
            <div>
              <h4 className="font-black text-xl text-black leading-none mb-1 uppercase italic tracking-tighter">{offer.name}</h4>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md font-black text-[9px] uppercase tracking-wider italic">verified expert</span>
                <div className="flex items-center gap-1 text-amber-500 font-black text-[11px] italic">
                  <Star size={12} fill="currentColor" /> {offer.average_rating || '5.0'}
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-black/20 hover:text-black transition-all">
            <X size={20} strokeWidth={4} />
          </button>
        </div>

        <div className="p-10 flex-1 overflow-y-auto max-h-[75vh] no-scrollbar">
          <div className="mb-8">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-3 block italic">{offer.category} / {offer.skill_type}</span>
            <h2 className="text-4xl font-black text-black leading-[0.9] tracking-tighter uppercase italic mb-6">{offer.title}</h2>
            <p className="text-[15px] font-bold text-black/50 leading-relaxed italic">
              {offer.description}
            </p>
          </div>

          {!booked ? (
            <div className="bg-black/5 rounded-[40px] p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="font-black text-lg uppercase italic tracking-tighter mb-2">Initiate Engagement</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-black/20 uppercase tracking-widest px-2 italic">Select Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-black/20" size={18} />
                    <input 
                      type="date" 
                      value={bookingData.booking_date}
                      onChange={(e) => setBookingData({ ...bookingData, booking_date: e.target.value })}
                      className="w-full bg-white rounded-2xl pl-14 pr-6 py-4 font-black text-sm italic border-none outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-black/20 uppercase tracking-widest px-2 italic">Duration (min)</label>
                  <div className="relative">
                    <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-black/20" size={18} />
                    <input 
                      type="number" 
                      value={bookingData.duration_minutes}
                      onChange={(e) => setBookingData({ ...bookingData, duration_minutes: parseInt(e.target.value) })}
                      className="w-full bg-white rounded-2xl pl-14 pr-6 py-4 font-black text-sm italic border-none outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-black/20 uppercase tracking-widest px-2 italic">Engagement Notes</label>
                <textarea 
                  placeholder="ADD ANY SPECIFIC REQUIREMENTS OR QUESTIONS..."
                  rows={2}
                  value={bookingData.notes}
                  onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                  className="w-full bg-white rounded-3xl px-6 py-4 font-bold text-sm italic border-none outline-none focus:ring-2 ring-primary/20 no-scrollbar"
                />
              </div>

              <button 
                onClick={handleBook}
                disabled={isBooking}
                className="w-full py-5 bg-black text-white rounded-[24px] font-black uppercase italic tracking-tighter text-lg flex items-center justify-center gap-3 hover:bg-primary transition-all active:scale-95 shadow-xl shadow-black/10"
              >
                {isBooking ? 'Processing...' : `Confirm Exchange — ${offer.is_free ? 'FREE' : `KSH ${offer.price}`}`}
                {!isBooking && <ArrowRight size={20} strokeWidth={4} />}
              </button>
            </div>
          ) : (
            <div className="bg-emerald-500 rounded-[40px] p-12 text-center text-white animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check size={40} strokeWidth={4} />
              </div>
              <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-2 text-white">Request Transmitted</h3>
              <p className="font-bold opacity-80 italic uppercase tracking-widest text-[10px] text-white">the expert has been notified. expect a response in your inbox soon.</p>
            </div>
          )}
        </div>

        <div className="px-10 pb-10 flex gap-4">
           <button className="flex-1 h-14 bg-black/5 rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase italic tracking-widest hover:bg-black/10 transition-all">
              <MessageCircle size={18} /> chat with expert
           </button>
        </div>
      </motion.div>
    </div>
  );
}
