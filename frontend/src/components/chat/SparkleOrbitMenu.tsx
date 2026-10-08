import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

export interface OrbitAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color?: string;
  onClick: () => void;
}

interface SparkleOrbitMenuProps {
  isOpen: boolean;
  onClose: () => void;
  actions: OrbitAction[];
}

export const SparkleOrbitMenu: React.FC<SparkleOrbitMenuProps> = ({
  isOpen,
  onClose,
  actions,
}) => {
  const currentTheme = useThemeStore((state) => state.currentTheme);
  const primaryColor = currentTheme?.colors?.primary || '#ff1493';

  if (!isOpen) return null;

  // Generous radius for a wide, un-congested, open orbital constellation layout
  const radius = 155;
  const count = actions.length;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-(--z-modal) bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Constellation Container */}
        <motion.div
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.1, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="relative w-[380px] h-[380px] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Orbital Orbit Ring Visual */}
          <div
            className="absolute inset-0 rounded-full border-2 border-dashed border-white/15 pointer-events-none animate-spin-slow"
            style={{ margin: '15px' }}
          />

          {/* Center Hub Button */}
          <button
            onClick={onClose}
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 0 35px ${primaryColor}80`,
            }}
            className="w-16 h-16 rounded-full text-white flex items-center justify-center z-30 active:scale-90 transition-all border-4 border-white/30 shadow-2xl"
          >
            <X size={26} strokeWidth={3} />
          </button>

          {/* Orbit Nodes */}
          {actions.map((act, idx) => {
            const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <motion.div
                key={act.id}
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={{ x, y, scale: 1, opacity: 1 }}
                exit={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                transition={{
                  type: 'spring',
                  damping: 20,
                  stiffness: 300,
                  delay: idx * 0.035,
                }}
                className="absolute flex flex-col items-center gap-1.5 z-30 group"
              >
                <button
                  onClick={() => {
                    act.onClick();
                    onClose();
                  }}
                  style={{
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                  }}
                  className="w-13 h-13 rounded-full bg-[#181628]/95 hover:bg-[#ff1493] text-white border-2 flex items-center justify-center shadow-2xl transition-all group-hover:scale-115 active:scale-95 group-hover:border-white"
                >
                  {act.icon}
                </button>
                <span className="text-[11px] font-black text-white bg-slate-950/90 border border-white/20 px-3 py-1 rounded-full shadow-2xl backdrop-blur-md whitespace-nowrap pointer-events-none group-hover:text-amber-300 transition-all tracking-wide">
                  {act.label}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
