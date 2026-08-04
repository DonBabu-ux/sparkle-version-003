import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  CheckCircle2,
  Sparkles,
  Pin,
  BellOff,
  Eraser,
  Download,
  Ban,
  Flag,
  X,
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

interface ActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface ActionSection {
  title: string;
  items: ActionItem[];
}

interface SparkleActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onViewProfile?: () => void;
  onMarkUnread?: () => void;
  onFavorite?: () => void;
  onPin?: () => void;
  onMute?: () => void;
  onClearChat?: () => void;
  onExportChat?: () => void;
  onBlockUser?: () => void;
  onReportUser?: () => void;
  isPinned?: boolean;
  isFavorite?: boolean;
  isMuted?: boolean;
}

export const SparkleActionSheet: React.FC<SparkleActionSheetProps> = ({
  isOpen,
  onClose,
  onViewProfile,
  onMarkUnread,
  onFavorite,
  onPin,
  onMute,
  onClearChat,
  onExportChat,
  onBlockUser,
  onReportUser,
  isPinned = false,
  isFavorite = false,
  isMuted = false,
}) => {
  const currentTheme = useThemeStore((state) => state.currentTheme);
  const primaryColor = currentTheme?.colors?.primary || '#FF008A';

  if (!isOpen) return null;

  const sections: ActionSection[] = [
    {
      title: 'Profile',
      items: [
        {
          id: 'profile',
          label: 'View Profile',
          icon: <User size={18} className="text-white" />,
          onClick: () => onViewProfile?.(),
        },
      ],
    },
    {
      title: 'Conversation',
      items: [
        {
          id: 'unread',
          label: 'Mark as Unread',
          icon: <CheckCircle2 size={18} className="text-emerald-400" />,
          onClick: () => onMarkUnread?.(),
        },
        {
          id: 'favorite',
          label: isFavorite ? 'Remove Favorite' : 'Favorite Chat',
          icon: <Sparkles size={18} className={isFavorite ? "text-amber-400 fill-amber-400" : "text-amber-300"} />,
          onClick: () => onFavorite?.(),
        },
        {
          id: 'pin',
          label: isPinned ? 'Unpin Chat' : 'Pin Chat',
          icon: <Pin size={18} className={isPinned ? "text-[#FF008A] fill-[#FF008A]" : "text-sky-400"} />,
          onClick: () => onPin?.(),
        },
        {
          id: 'mute',
          label: isMuted ? 'Unmute Notifications' : 'Mute Notifications',
          icon: <BellOff size={18} className="text-purple-400" />,
          onClick: () => onMute?.(),
        },
      ],
    },
    {
      title: 'Management',
      items: [
        {
          id: 'clear',
          label: 'Clear Chat',
          icon: <Eraser size={18} className="text-orange-400" />,
          onClick: () => onClearChat?.(),
        },
        {
          id: 'export',
          label: 'Export Chat',
          icon: <Download size={18} className="text-blue-400" />,
          onClick: () => onExportChat?.(),
        },
      ],
    },
    {
      title: 'Safety',
      items: [
        {
          id: 'block',
          label: 'Block User',
          icon: <Ban size={18} className="text-rose-400" />,
          onClick: () => onBlockUser?.(),
          danger: true,
        },
        {
          id: 'report',
          label: 'Report User',
          icon: <Flag size={18} className="text-rose-400" />,
          onClick: () => onReportUser?.(),
          danger: true,
        },
      ],
    },
  ];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pb-16 sm:pb-4 select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="w-full max-w-md bg-[#161426]/98 border border-white/20 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-2xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Brand Shimmer Line */}
          <div
            className="h-1 w-full"
            style={{
              backgroundImage: `linear-gradient(to right, transparent, ${primaryColor}, transparent)`,
            }}
          />

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/10">
            <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-[#FF008A]" />
              <span>Sparkle Options</span>
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90"
            >
              <X size={16} />
            </button>
          </div>

          {/* Grouped Sections with 100% White Legible Text */}
          <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto no-scrollbar">
            {sections.map((sec) => (
              <div key={sec.title} className="bg-white/[0.06] border border-white/10 rounded-2xl p-2">
                <div className="px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white/90">
                  {sec.title}
                </div>
                <div className="space-y-0.5">
                  {sec.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        item.onClick();
                        onClose();
                      }}
                      className={`w-full min-h-[48px] px-3 py-2.5 rounded-xl flex items-center gap-3.5 transition-all text-left active:scale-[0.98] ${
                        item.danger
                          ? 'hover:bg-rose-500/25 text-rose-300'
                          : 'hover:bg-white/15 text-white'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <span className="text-sm font-extrabold text-white tracking-tight leading-tight flex-1">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
