import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  X,
  Clock,
  CheckCircle2,
  Camera,
  FileText,
  Building2,
  GraduationCap,
  AtSign,
  User as UserIcon,
  Flame,
} from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import EditProfileModal from './EditProfileModal';
import type { User } from '../../types/user';

interface ChecklistItem {
  id: string;
  label: string;
  field: keyof User;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  actionText: string;
  isCompleted: boolean;
}

export const AestheticProfileCompletionBanner: React.FC = () => {
  const { user, setUser } = useUserStore();
  const [showEditModal, setShowEditModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDismissMenu, setShowDismissMenu] = useState(false);

  // Check if banner is currently dismissed
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      if (localStorage.getItem('profileCompletionCardDismissed') === 'true') {
        return true;
      }
      const until = localStorage.getItem('profileCompletionDismissedUntil');
      if (until && Number(until) > Date.now()) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // Calculate items and completion percentage
  const checklist: ChecklistItem[] = useMemo(() => {
    if (!user) return [];
    return [
      {
        id: 'avatar',
        label: 'Photo',
        field: 'avatar_url',
        icon: Camera,
        actionText: 'Add photo',
        isCompleted: Boolean(user.avatar_url && user.avatar_url.trim().length > 0),
      },
      {
        id: 'bio',
        label: 'Bio',
        field: 'bio',
        icon: FileText,
        actionText: 'Add bio',
        isCompleted: Boolean(user.bio && user.bio.trim().length > 0),
      },
      {
        id: 'campus',
        label: 'Campus',
        field: 'campus',
        icon: Building2,
        actionText: 'Add campus',
        isCompleted: Boolean(user.campus && user.campus.trim().length > 0),
      },
      {
        id: 'major',
        label: 'Major',
        field: 'major',
        icon: GraduationCap,
        actionText: 'Add major',
        isCompleted: Boolean(user.major && user.major.trim().length > 0),
      },
      {
        id: 'name',
        label: 'Name',
        field: 'name',
        icon: UserIcon,
        actionText: 'Add name',
        isCompleted: Boolean(user.name && user.name.trim().length > 0),
      },
      {
        id: 'username',
        label: 'Handle',
        field: 'username',
        icon: AtSign,
        actionText: 'Add username',
        isCompleted: Boolean(user.username && user.username.trim().length > 0),
      },
    ];
  }, [user]);

  const completedCount = useMemo(() => {
    return checklist.filter((i) => i.isCompleted).length;
  }, [checklist]);

  const percentage = useMemo(() => {
    if (checklist.length === 0) return 100;
    return Math.round((completedCount / checklist.length) * 100);
  }, [completedCount, checklist.length]);

  const nextIncompleteItem = useMemo(() => {
    return checklist.find((i) => !i.isCompleted);
  }, [checklist]);

  const remaining = checklist.length - completedCount;

  // Dismissal handlers
  const handleDismissHours = useCallback((hours: number) => {
    try {
      const until = Date.now() + hours * 60 * 60 * 1000;
      localStorage.setItem('profileCompletionDismissedUntil', String(until));
    } catch {}
    setIsDismissed(true);
    setShowDismissMenu(false);
  }, []);

  const handleDismissPermanent = useCallback(() => {
    try {
      localStorage.setItem('profileCompletionCardDismissed', 'true');
    } catch {}
    setIsDismissed(true);
    setShowDismissMenu(false);
  }, []);

  const handleQuickClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Default quick-close dismisses for 24 hours
    handleDismissHours(24);
  }, [handleDismissHours]);

  // If 100% complete or dismissed, do not render
  if (isDismissed || percentage >= 100 || !user) {
    return null;
  }

  // Circular progress calculations (radius 14, circumference ~88)
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative mb-3 z-10"
      >
        {/* Glassmorphism Outer Card */}
        <div className="relative overflow-hidden rounded-2xl bg-white/80 dark:bg-[#121214]/85 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.35)] transition-all">
          {/* Subtle top glow highlight */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#ff1493]/30 to-transparent" />

          {/* Main Compact Row */}
          <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
            {/* Left: Progress Ring + Text */}
            <div
              className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
              onClick={() => setIsExpanded((prev) => !prev)}
            >
              {/* Sleek SVG Progress Ring */}
              <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                  {/* Background Track */}
                  <circle
                    cx="18"
                    cy="18"
                    r={radius}
                    fill="none"
                    strokeWidth="3"
                    className="stroke-black/[0.06] dark:stroke-white/[0.08]"
                  />
                  {/* Progress Arc */}
                  <circle
                    cx="18"
                    cy="18"
                    r={radius}
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="stroke-[#ff1493] transition-all duration-700 ease-out"
                  />
                </svg>
                {/* Percentage in center */}
                <span className="absolute text-[10px] font-black text-slate-800 dark:text-zinc-100 font-mono tracking-tighter">
                  {percentage}%
                </span>
              </div>

              {/* Title & dynamic hint */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-[14px] font-bold text-slate-900 dark:text-white tracking-tight truncate">
                    Complete your profile
                  </h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ff1493]/10 dark:bg-[#ff1493]/20 text-[#ff1493] leading-none">
                    <Flame size={11} strokeWidth={2.2} />
                    {remaining} left
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 dark:text-zinc-400 truncate mt-0.5 leading-snug">
                  {nextIncompleteItem ? (
                    <span>
                      Next: <strong className="font-semibold text-slate-700 dark:text-zinc-200">{nextIncompleteItem.actionText}</strong>
                    </span>
                  ) : (
                    'Your profile is looking great!'
                  )}
                </p>
              </div>
            </div>

            {/* Right: Action Buttons & Close Control */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Expand Toggle Chevron */}
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-black/6 dark:hover:bg-white/6 transition-colors"
                title={isExpanded ? 'Collapse checklist' : 'View checklist'}
                aria-label={isExpanded ? 'Collapse checklist' : 'View checklist'}
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#ff1493] hover:bg-[#e0127f] active:scale-95 text-white text-[12px] font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <span>Edit</span>
                <ChevronRight size={13} strokeWidth={2.5} />
              </button>

              {/* Close / Dismiss with snooze popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={handleQuickClose}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setShowDismissMenu((prev) => !prev);
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-black/6 dark:hover:bg-white/6 transition-colors"
                  title="Dismiss (hold for options)"
                  aria-label="Dismiss banner"
                >
                  <X size={15} strokeWidth={2.2} />
                </button>

                {/* Snooze context dropdown */}
                <AnimatePresence>
                  {showDismissMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-white dark:bg-[#1a1a1c] border border-black/10 dark:border-white/10 shadow-xl p-1.5 z-50 text-left"
                    >
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Dismiss options
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDismissHours(24)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
                      >
                        <Clock size={13} className="text-slate-400" />
                        Remind tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissHours(24 * 7)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
                      >
                        <Clock size={13} className="text-slate-400" />
                        Remind in 7 days
                      </button>
                      <div className="my-1 border-t border-black/5 dark:border-white/5" />
                      <button
                        type="button"
                        onClick={handleDismissPermanent}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                      >
                        <X size={13} />
                        Don't show again
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Expandable Checklist Drawer */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden border-t border-black/[0.04] dark:border-white/[0.06] bg-black/[0.015] dark:bg-white/[0.015]"
              >
                <div className="p-3 sm:p-3.5 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {checklist.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setShowEditModal(true)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.97] ${
                            item.isCompleted
                              ? 'bg-emerald-500/[0.07] dark:bg-emerald-500/[0.12] border border-emerald-500/20'
                              : 'bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/6 dark:hover:bg-white/6 border border-black/[0.05] dark:border-white/[0.06]'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              item.isCompleted
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white dark:bg-zinc-800 text-slate-400 dark:text-zinc-400 shadow-sm'
                            }`}
                          >
                            {item.isCompleted ? (
                              <CheckCircle2 size={14} strokeWidth={2.2} />
                            ) : (
                              <Icon size={13} strokeWidth={2} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[12px] font-semibold truncate leading-tight ${item.isCompleted ? 'text-slate-600 dark:text-zinc-300' : 'text-slate-800 dark:text-zinc-100'}`}>
                              {item.label}
                            </p>
                            <p
                              className={`text-[10px] font-medium truncate mt-0.5 ${
                                item.isCompleted
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-[#ff1493]'
                              }`}
                            >
                              {item.isCompleted ? '✓ Done' : item.actionText}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[12px] text-slate-400 dark:text-zinc-500">A complete profile helps you connect with campus peers.</span>
                    <button
                      type="button"
                      onClick={() => handleDismissHours(24)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 underline underline-offset-2 transition-colors whitespace-nowrap ml-3"
                    >
                      Remind tomorrow
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Embedded Actionable Modal */}
      {showEditModal && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onProfileUpdated={(updatedUser) => {
            setUser(updatedUser);
          }}
        />
      )}
    </>
  );
};

export default AestheticProfileCompletionBanner;
