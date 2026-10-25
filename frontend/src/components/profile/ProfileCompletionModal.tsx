import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Camera, FileText, Building2, GraduationCap, AtSign, User as UserIcon,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import Spinner from '../ui/Spinner';
import { useUserStore } from '../../store/userStore';
import api from '../../api/api';
import { validateFiles } from '../../utils/fileValidation';
import type { User } from '../../types/user';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (user: User) => void;
  /** Scroll/focus the modal on this checklist id when it opens. */
  focusItemId?: string | null;
}

interface CompletionField {
  id: string;
  label: string;
  field: keyof User;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  filled: (user: User) => boolean;
}

const FIELDS: CompletionField[] = [
  { id: 'avatar', label: 'Profile photo', field: 'avatar_url', icon: Camera, filled: (u) => !!(u.avatar_url && u.avatar_url.trim()) },
  { id: 'bio', label: 'Bio', field: 'bio', icon: FileText, filled: (u) => !!(u.bio && u.bio.trim()) },
  { id: 'campus', label: 'Campus', field: 'campus', icon: Building2, filled: (u) => !!(u.campus && u.campus.trim()) },
  { id: 'major', label: 'Major', field: 'major', icon: GraduationCap, filled: (u) => !!(u.major && u.major.trim()) },
  { id: 'name', label: 'Name', field: 'name', icon: UserIcon, filled: (u) => !!(u.name && u.name.trim()) },
  { id: 'username', label: 'Username', field: 'username', icon: AtSign, filled: (u) => !!(u.username && u.username.trim()) },
];

/**
 * Focused profile-completion flow (Facebook-style): after login, users with an
 * incomplete profile are walked through ONLY the missing details here instead of
 * being dropped into the full profile editor. Saves field-by-field through the
 * same endpoints the editor uses (/users/avatar, /users/profile).
 */
export const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({
  isOpen, onClose, onProfileUpdated, focusItemId,
}) => {
  const { user, setUser } = useUserStore();
  const [draft, setDraft] = useState({ name: '', username: '', bio: '', campus: '', major: '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);

  // Seed the draft from the current user each time the modal opens
  useEffect(() => {
    if (!isOpen || !user) return;
    setDraft({
      name: user.name || '',
      username: user.username || '',
      bio: user.bio || '',
      campus: user.campus || '',
      major: user.major || '',
    });
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setUsernameAvailable(null);
    setError(null);
    setDone(false);
  }, [isOpen, user]);

  // Never leak the preview blob when the modal unmounts
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  useEffect(() => {
    if (isOpen && focusItemId && focusRef.current) {
      focusRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [isOpen, focusItemId]);

  // Live username availability (debounced) — same endpoint Signup uses
  useEffect(() => {
    const v = draft.username.trim();
    if (!isOpen || !v || v === user?.username) {
      setUsernameAvailable(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-username?username=${encodeURIComponent(v)}`);
        setUsernameAvailable(res.data?.available === true);
      } catch {
        setUsernameAvailable(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [draft.username, isOpen, user?.username]);

  if (!isOpen || !user) return null;

  const dirty =
    !!avatarFile ||
    draft.name.trim() !== (user.name || '') ||
    draft.username.trim() !== (user.username || '') ||
    draft.bio.trim() !== (user.bio || '') ||
    draft.campus.trim() !== (user.campus || '') ||
    draft.major.trim() !== (user.major || '');

  const handleAvatarPick = (file: File | undefined) => {
    if (!file) return;
    const check = validateFiles([file], { kind: 'image', maxSizeMB: 8 });
    if (!check.ok) {
      setError(check.error || 'That file can\'t be used');
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      let updated: User = { ...user };

      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        const res = await api.post('/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        updated = res.data?.user || { ...updated, avatar_url: res.data?.avatar_url || updated.avatar_url };
        setUser(updated);
      }

      const payload: Record<string, string> = {};
      const name = draft.name.trim();
      const username = draft.username.trim();
      const bio = draft.bio.trim();
      const campus = draft.campus.trim();
      const major = draft.major.trim();
      if (name && name !== (user.name || '')) payload.name = name;
      if (username && username !== (user.username || '') && usernameAvailable !== false) payload.username = username;
      if (bio !== (user.bio || '')) payload.bio = bio;
      if (campus !== (user.campus || '')) payload.campus = campus;
      if (major !== (user.major || '')) payload.major = major;

      if (Object.keys(payload).length > 0) {
        const res = await api.put('/users/profile', payload);
        updated = res.data?.user || { ...updated, ...payload };
        setUser(updated);
      }

      onProfileUpdated(updated);
      const stillMissing = FIELDS.some((f) => !f.filled(updated));
      if (!stillMissing) {
        setDone(true);
        setTimeout(() => onClose(), 1400);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save your details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const completedCount = FIELDS.filter((f) => f.filled(user) || (f.id === 'avatar' && !!avatarFile)).length;
  const percentage = Math.round((completedCount / FIELDS.length) * 100);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-(--z-modal) flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="relative w-full sm:max-w-md bg-white dark:bg-[#121214] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden"
          role="dialog" aria-modal="true" aria-label="Complete your profile"
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
              <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="3" className="stroke-black/[0.06] dark:stroke-white/[0.08]" />
                <circle
                  cx="22" cy="22" r={radius} fill="none" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (percentage / 100) * circumference}
                  className="stroke-[#ff1493] transition-all duration-700"
                />
              </svg>
              <span className="absolute text-[10px] font-black text-slate-800 dark:text-zinc-100 font-mono">{percentage}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white tracking-tight">
                {done ? 'Profile complete' : 'Add your details'}
              </h2>
              <p className="text-[12px] text-slate-500 dark:text-zinc-400 truncate">
                {done ? 'Looks great — you are all set' : 'A complete profile helps you connect with campus peers'}
              </p>
            </div>
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {done ? (
            <div className="p-8 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 size={30} className="text-emerald-500" />
              </div>
              <p className="text-[13px] font-semibold text-slate-600 dark:text-zinc-300">Profile complete</p>
            </div>
          ) : (
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar">
              {/* Avatar row */}
              <div ref={focusItemId === 'avatar' ? focusRef : undefined} className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <img
                    src={avatarPreview || user.avatar_url || '/uploads/avatars/no-profile.png'}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover border border-black/[0.06] dark:border-white/[0.08]"
                  />
                  {avatarPreview && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#ff1493] text-white flex items-center justify-center text-[9px] font-black">✓</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white">Profile photo</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">Pick a photo friends will recognize</p>
                </div>
                <input
                  ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleAvatarPick(e.target.files?.[0])}
                />
                <button
                  type="button" onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] text-[12px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-black/[0.08] dark:hover:bg-white/[0.12] transition-colors active:scale-95"
                >
                  {user.avatar_url || avatarFile ? 'Change' : 'Add'}
                </button>
              </div>

              <div className="h-px bg-black/[0.05] dark:bg-white/[0.06]" />

              {/* Name + Username */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Name</span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Your name"
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-[13px] text-slate-900 dark:text-white outline-none focus:border-[#ff1493]/50"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Username</span>
                  <div className="relative">
                    <input
                      value={draft.username}
                      onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') }))}
                      placeholder="handle"
                      className={`mt-1 w-full px-3 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border text-[13px] text-slate-900 dark:text-white outline-none ${
                        usernameAvailable === false ? 'border-red-500/60' : 'border-black/[0.06] dark:border-white/[0.08] focus:border-[#ff1493]/50'
                      }`}
                    />
                    {usernameAvailable === true && (
                      <CheckCircle2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                    )}
                    {usernameAvailable === false && (
                      <AlertCircle size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500" />
                    )}
                  </div>
                  {usernameAvailable === false && (
                    <span className="text-[10px] font-semibold text-red-500">That username is taken</span>
                  )}
                </label>
              </div>

              {/* Bio */}
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Bio</span>
                <textarea
                  value={draft.bio}
                  onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                  rows={2}
                  maxLength={160}
                  placeholder="Tell people about yourself"
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-[13px] text-slate-900 dark:text-white outline-none focus:border-[#ff1493]/50 resize-none"
                />
                <span className="text-[10px] text-slate-400">{draft.bio.length}/160</span>
              </label>

              {/* Campus + Major */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Campus</span>
                  <input
                    value={draft.campus}
                    onChange={(e) => setDraft((d) => ({ ...d, campus: e.target.value }))}
                    placeholder="Your campus"
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-[13px] text-slate-900 dark:text-white outline-none focus:border-[#ff1493]/50"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Major</span>
                  <input
                    value={draft.major}
                    onChange={(e) => setDraft((d) => ({ ...d, major: e.target.value }))}
                    placeholder="What you study"
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-[13px] text-slate-900 dark:text-white outline-none focus:border-[#ff1493]/50"
                  />
                </label>
              </div>

              {error && (
                <p className="text-[12px] font-semibold text-red-500 flex items-center gap-1.5">
                  <AlertCircle size={13} /> {error}
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          {!done && (
            <div className="flex items-center gap-2 p-4 border-t border-black/[0.06] dark:border-white/[0.08]">
              <button
                type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 dark:text-zinc-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                Skip for now
              </button>
              <button
                type="button" onClick={handleSave}
                disabled={!dirty || saving || usernameAvailable === false}
                className="flex-1 py-2.5 rounded-xl bg-[#ff1493] hover:bg-[#e0127f] active:scale-95 text-white text-[13px] font-bold shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {saving && <Spinner size="small" className="text-white" />}
                Save details
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProfileCompletionModal;
