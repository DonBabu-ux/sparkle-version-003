import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, ArrowLeft, ShieldAlert, CreditCard, 
  MapPin, MessageCircle, AlertTriangle, CheckCircle2,
  UserCheck, FileText, Package, Eye, ChevronRight, ChevronLeft
} from 'lucide-react';
import clsx from 'clsx';

export default function MarketplaceSafety() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);

  const slides = [
    {
      title: "Secure Payments",
      icon: <CreditCard size={28} />,
      content: "Never pay via wire transfers or gift cards. Inspect before paying.",
      detail: "Always keep transactions within Sparkle for 100% protection."
    },
    {
      title: "Safe Meetups",
      icon: <MapPin size={28} />,
      content: "Meet in public, well-lit areas. Bring a friend if possible.",
      detail: "Malls and coffee shops are ideal for safe item exchanges."
    },
    {
      title: "Verify the Item",
      icon: <ShieldCheck size={28} />,
      content: "Inspect thoroughly. Test electronics and check for damage.",
      detail: "Don't be rushed. A good seller respects your verification time."
    },
    {
      title: "In-App Messaging",
      icon: <MessageCircle size={28} />,
      content: "Keep all chats in Sparkle. Avoid moving to other apps.",
      detail: "Our security layers can only protect you while you stay on-platform."
    },
    {
      title: "User Verification",
      icon: <UserCheck size={28} />,
      content: "Look for the verified badge on seller profiles.",
      detail: "Verified users have passed our strict identity protocols."
    },
    {
      title: "Documentation",
      icon: <FileText size={28} />,
      content: "Ask for receipts or warranty cards for high-value items.",
      detail: "Original proof of purchase ensures the item is legitimately owned."
    }
  ];

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    })
  };

  const [[page, direction], setPage] = useState([0, 0]);

  const paginate = (newDirection: number) => {
    const nextItem = page + newDirection;
    if (nextItem >= 0 && nextItem < slides.length) {
      setPage([nextItem, newDirection]);
      setCurrentPage(nextItem);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-sans selection:bg-[#1877F2]/30">
      {/* Ultra-Minimal Header */}
      <header className="px-6 h-20 flex items-center justify-between sticky top-0 z-50 bg-[#0A0A0A]/50 backdrop-blur-xl border-b border-white/5">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full hover:bg-white/10 transition-all active:scale-90"
        >
          <ArrowLeft size={20} className="text-white/70" />
        </button>
        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30">
          Shield Protocol
        </span>
        <div className="w-10" /> {/* Spacer */}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8 relative">
        {/* Animated Background Element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#1877F2]/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-[340px] aspect-[4/5] relative">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={page}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              className="absolute inset-0 bg-[#121212] border border-white/10 rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-2xl"
            >
              {/* Glassmorphic Icon Container */}
              <div className="w-16 h-16 bg-[#1877F2]/10 border border-[#1877F2]/20 rounded-2xl flex items-center justify-center mb-8 shadow-inner">
                <div className="text-[#1877F2]">
                  {slides[page].icon}
                </div>
              </div>

              <h2 className="text-2xl font-black mb-4 tracking-tight leading-tight">
                {slides[page].title}
              </h2>

              <p className="text-[15px] text-white/80 leading-relaxed font-medium mb-4">
                {slides[page].content}
              </p>

              <p className="text-[12px] text-white/30 leading-relaxed italic font-medium">
                {slides[page].detail}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Tiny Navigation Controls */}
          <div className="absolute -bottom-16 left-0 right-0 flex items-center justify-between px-2">
            <button 
              onClick={() => paginate(-1)}
              disabled={page === 0}
              className={clsx(
                "w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/5 transition-all active:scale-90",
                page === 0 ? "opacity-0" : "opacity-100 hover:bg-white/10"
              )}
            >
              <ChevronLeft size={18} className="text-white/40" />
            </button>

            {/* Micro Pagination Dots */}
            <div className="flex gap-1.5">
              {slides.map((_, idx) => (
                <div 
                  key={idx}
                  className={clsx(
                    "w-1 h-1 rounded-full transition-all duration-300",
                    page === idx ? "bg-[#1877F2] w-4" : "bg-white/10"
                  )}
                />
              ))}
            </div>

            <button 
              onClick={() => paginate(1)}
              disabled={page === slides.length - 1}
              className={clsx(
                "w-10 h-10 flex items-center justify-center rounded-full bg-[#1877F2]/10 border border-[#1877F2]/20 transition-all active:scale-90",
                page === slides.length - 1 ? "opacity-0" : "opacity-100 hover:bg-[#1877F2]/20"
              )}
            >
              <ChevronRight size={18} className="text-[#1877F2]" />
            </button>
          </div>
        </div>
      </main>

      {/* Modern Footer */}
      <footer className="pb-12 pt-8 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest">
            Protected Transaction
          </span>
        </div>
        <p className="text-[10px] text-white/10 font-bold tracking-[0.5em] uppercase">
          Sparkle Secure v4.2
        </p>
      </footer>
    </div>
  );
}
