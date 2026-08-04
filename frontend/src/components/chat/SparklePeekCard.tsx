import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Film, Pin, Sparkles, ShieldCheck, X } from 'lucide-react';
import { IdentityManager } from '../../utils/identityManager';
import { useThemeStore } from '../../store/themeStore';

interface SparklePeekCardProps {
  chat: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SparklePeekCard: React.FC<SparklePeekCardProps> = ({ chat, isOpen, onClose }) => {
  const currentTheme = useThemeStore((state) => state.currentTheme);
  const primaryColor = currentTheme?.colors?.primary || '#ff1493';

  if (!isOpen || !chat) return null;

  const identity = IdentityManager.resolveIdentity(chat);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[450] bg-black/65 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 24, stiffness: 320 }}
          className="w-full max-w-sm bg-[#161426]/95 border-2 border-white/20 rounded-3xl p-6 shadow-2xl overflow-hidden backdrop-blur-2xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90"
          >
            <X size={16} />
          </button>

          {/* Header & Avatar */}
          <div className="flex items-center gap-4 mb-5">
            <div className="relative shrink-0">
              <img
                src={identity.avatar}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-xl"
                alt=""
              />
              {identity.presence.showPresence && identity.presence.isOnline && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#161426] rounded-full shadow-md" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <h3 className="text-lg font-black text-white truncate flex items-center gap-2">
                <span>{identity.displayName}</span>
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {chat.is_pinned && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#ff1493] bg-[#ff1493]/15 border border-[#ff1493]/30 px-2 py-0.5 rounded-full">
                    <Pin size={10} className="fill-[#ff1493]" />
                    <span>PINNED</span>
                  </span>
                )}
                {chat.is_favorite && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-full">
                    <Sparkles size={10} className="fill-amber-400" />
                    <span>FAVORITE</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-300 mt-1">
                {identity.presence.showPresence
                  ? identity.presence.isOnline
                    ? 'Online now'
                    : 'Recently active'
                  : 'Sparkle Member'}
              </p>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <Image size={20} className="text-sky-400" />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Shared Photos</p>
                <p className="text-sm font-black text-white">124</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <Film size={20} className="text-purple-400" />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Shared Media</p>
                <p className="text-sm font-black text-white">89</p>
              </div>
            </div>
          </div>

          {/* Encryption & Security Badge */}
          <div
            style={{
              borderColor: `${primaryColor}40`,
              backgroundColor: `${primaryColor}15`,
            }}
            className="p-3.5 rounded-2xl border flex items-center gap-3 text-white font-extrabold text-xs shadow-md"
          >
            <ShieldCheck size={18} style={{ color: primaryColor }} />
            <span>End-to-End Encryption & Privacy Active 🔒</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
